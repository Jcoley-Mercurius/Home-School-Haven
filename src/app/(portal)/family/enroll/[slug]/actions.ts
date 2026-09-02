"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth/guards"
import { isSupabaseConfigured } from "@/lib/env"
import { presentOutcome } from "@/lib/enrollment/eligibility"
import {
  getEnrollableProgram,
  requestEnrollment,
} from "@/lib/enrollment/repository"

import { type EnrollFormState } from "./form-state"

/**
 * Request a registration (MPS-REQ-012, MPS-WFL-003).
 *
 * A Server Action is a public HTTP endpoint. The page's guard does not protect
 * it, so the guard runs again here — and behind that,
 * `family_request_enrollment` re-derives `auth.uid()`, re-reads the student's
 * family, re-reads the locked program row, and makes every eligibility decision
 * itself. This module decides nothing. It cannot: it has no privilege to
 * insert an enrollment, and no argument it passes could persuade the function
 * to skip a check.
 *
 * The program is resolved from its SLUG here rather than accepted as an id from
 * the form. A slug is public; a program id in a form body would be a value the
 * browser supplies and the server trusts, and there is no reason to introduce
 * one.
 *
 * Nothing is logged. A student id and a program together are family data.
 */
const enrollSchema = z.object({
  studentId: z.uuid("Choose which student you are registering."),
  /* MPS-RUL-008. An affirmation of parental authority, not an acceptance of
     consent or waiver language — none is approved (MPS GAP-005), and
     MPS-RUL-010 forbids inventing it. */
  authority: z.literal(
    "on",
    "Confirm that you are this student's parent or guardian.",
  ),
})

export async function requestEnrollmentAction(
  _previous: EnrollFormState,
  formData: FormData,
): Promise<EnrollFormState> {
  const values = {
    studentId: String(formData.get("studentId") ?? ""),
    authority: String(formData.get("authority") ?? ""),
  }
  const slug = String(formData.get("slug") ?? "")

  const parsed = enrollSchema.safeParse(values)
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        studentId: flattened.fieldErrors.studentId?.[0],
        authority: flattened.fieldErrors.authority?.[0],
      },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireRole("parent", `/family/enroll/${slug}`)

  const program = await getEnrollableProgram(slug)
  if (program.status !== "ready") {
    return {
      status: program.status === "unavailable" ? "unavailable" : "failed",
      fieldErrors: {},
      values,
    }
  }

  const result = await requestEnrollment({
    studentId: parsed.data.studentId,
    programId: program.program.id,
    authorityAffirmed: true,
  })

  if (!result.ok) {
    return { status: result.reason, fieldErrors: {}, values }
  }

  const presentation = presentOutcome(result.outcome)

  /* A blocked outcome recorded nothing and started no payment. It stays on this
     page with the reason and the recovery, rather than redirecting to an
     enrollment that does not exist (MPS-ACC-018, MPS-ACC-002). */
  if (!presentation.recorded || !result.enrollmentId) {
    return {
      status: "blocked",
      outcome: result.outcome,
      fieldErrors: {},
      values,
    }
  }

  /* `redirect()` signals by throwing, so it is called outside the try/catch
     above it. A `duplicate` outcome redirects too, and deliberately: the parent
     asked where this registration stands, and the answer is the same page the
     first request produced (MPS-ACC-023). */
  redirect(
    `/family/enrollments/${result.enrollmentId}?outcome=${result.outcome}`,
  )
}
