"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import { setEnrollmentState } from "@/lib/admin/enrollments"
import { enrollmentStateSchema } from "@/lib/admin/validation"
import { isSupabaseConfigured } from "@/lib/env"

import { type EnrollmentActionFormState } from "./form-state"

/**
 * Change an enrollment's state (MPS-REQ-017, MPS-REQ-024; MPS-RUL-004).
 *
 * WHAT THIS ACTION IS, AND WHAT IT REFUSES TO BE
 *
 * It records an authorized administrator's decision about an enrollment, with
 * a mandatory note, attributed and timestamped. That is all.
 *
 * It does not verify a payment. Checklist §2 — how a successful, pending,
 * failed, cancelled, reversed, or disputed payment is identified — is
 * unanswered, so no payment evidence exists to record and none is recorded
 * (GAP-ADMIN-002). Confirming an enrollment says an administrator decided the
 * child has a place; it says nothing about money having moved.
 *
 * It does not decide or issue any financial outcome. Cancelling records a
 * status, exactly as MPS-RUL-004 permits — "the beta records status but does
 * not decide or issue the outcome automatically". No refund, credit, transfer,
 * discount, or scholarship exists anywhere in this path (MPS GAP-010).
 *
 * FOUR TARGET STATES, ENFORCED IN TWO PLACES
 *
 * `enrollmentStateSchema` accepts only `confirmed`, `waitlisted`, `blocked`,
 * and `canceled`. A browser that submits `payment_pending` — a real state that
 * the UI displays as a label — is refused here, before the database is asked,
 * because it is not a state anyone decides. `admin_set_enrollment_state` then
 * applies the approved transition table itself, so a request that never touches
 * this action meets the same rule.
 *
 * THREE OUTCOMES THAT ARE NOT FAILURES
 *
 *   `unchanged` — the record already had that state. A repeat submission writes
 *     nothing, moves no timestamp, and creates no second audit row claiming a
 *     change that did not happen. This is what makes a double-click, a
 *     double-tap, or two open tabs safe.
 *   `stale` — the record moved since the drawer rendered. Nothing is written,
 *     nobody's decision is flattened, and the administrator is told to look
 *     again before deciding.
 *   `notFound` — reported identically to a record the caller may not see, so a
 *     manipulated identifier learns nothing.
 */
export async function setEnrollmentStateAction(
  _previous: EnrollmentActionFormState,
  formData: FormData,
): Promise<EnrollmentActionFormState> {
  const enrollmentId = String(formData.get("enrollmentId") ?? "")
  const values = { note: String(formData.get("note") ?? "") }

  const parsed = enrollmentStateSchema.safeParse({
    enrollmentId,
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    state: String(formData.get("state") ?? ""),
    note: values.note,
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      /* The unparsed id still identifies which drawer should show the error.
         It is not used for anything else, and never reaches a query. */
      enrollmentId: enrollmentId || null,
      fieldErrors: {
        note: flattened.fieldErrors.note?.[0],
        state:
          flattened.fieldErrors.state?.[0] ??
          flattened.fieldErrors.expectedUpdatedAt?.[0] ??
          flattened.fieldErrors.enrollmentId?.[0],
      },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      enrollmentId: parsed.data.enrollmentId,
      fieldErrors: {},
      values,
    }
  }

  await requireAdmin("/admin/enrollments")

  const result = await setEnrollmentState({
    enrollmentId: parsed.data.enrollmentId,
    state: parsed.data.state,
    note: parsed.data.note,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  })

  if (!result.ok) {
    return {
      status:
        result.reason === "stale"
          ? "stale"
          : result.reason === "notFound"
            ? "notFound"
            : result.reason === "forbidden"
              ? "forbidden"
              : result.reason === "invalidTransition"
                ? "invalidTransition"
                : result.reason === "rejected"
                  ? "invalid"
                  : "failed",
      enrollmentId: parsed.data.enrollmentId,
      fieldErrors:
        result.reason === "rejected"
          ? { note: "Say why this enrollment is changing. This is recorded." }
          : {},
      values,
    }
  }

  /* The family's own dashboard reads the same record, and MPS-ACC-022 requires
     both views to agree. Revalidating `/family` is what keeps "one consistent
     authoritative state" true a second after the change rather than a minute
     after it. The overview's counts, attention list, and activity feed all
     derive from enrollment state too. */
  revalidatePath("/admin")
  revalidatePath("/admin/enrollments")
  revalidatePath("/family")

  return {
    status: result.outcome === "unchanged" ? "unchanged" : "updated",
    enrollmentId: parsed.data.enrollmentId,
    fieldErrors: {},
    /* Cleared on success so the next decision starts from an empty note rather
       than inheriting the reason for the previous one. */
    values: { note: "" },
  }
}
