"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth/guards"
import { addStudent, removeStudent } from "@/lib/family/repository"
import { studentSchema } from "@/lib/family/validation"
import { isSupabaseConfigured } from "@/lib/env"

import { type StudentFormState } from "./form-state"

/**
 * Add a demo student profile to the viewer's own family (deviation D-FF1;
 * MPS-REQ-001, MPS-RUL-006, MPS-RUL-008).
 *
 * The family is never submitted with the form. It is derived inside the
 * database function from `auth.uid()`, so there is no family id for a forged
 * request to substitute.
 *
 * The guardian-authority checkbox is required before the profile is created
 * (MPS-RUL-008). It is an affirmation, not an acceptance of consent or waiver
 * language — none is presented, because none is approved (MPS-RUL-010).
 */
export async function addStudentAction(
  _previous: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const values = {
    preferredName: String(formData.get("preferredName") ?? ""),
    gradeLevel: String(formData.get("gradeLevel") ?? ""),
    guardianRelationship: String(formData.get("guardianRelationship") ?? ""),
    authority: formData.get("authority") === "on",
  }

  const parsed = studentSchema.safeParse({
    preferredName: values.preferredName,
    gradeLevel: values.gradeLevel,
    guardianRelationship: values.guardianRelationship,
    authority: formData.get("authority") ?? "",
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        preferredName: flattened.fieldErrors.preferredName?.[0],
        gradeLevel: flattened.fieldErrors.gradeLevel?.[0],
        guardianRelationship: flattened.fieldErrors.guardianRelationship?.[0],
        authority: flattened.fieldErrors.authority?.[0],
      },
      values,
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", fieldErrors: {}, values }
  }

  await requireRole("parent", "/family/students/new")

  let result
  try {
    result = await addStudent({
      preferredName: parsed.data.preferredName,
      gradeLevel: parsed.data.gradeLevel,
      guardianRelationship: parsed.data.guardianRelationship,
    })
  } catch {
    return { status: "failed", fieldErrors: {}, values }
  }

  if (!result.ok) {
    return {
      status: result.reason === "forbidden" ? "forbidden" : "failed",
      fieldErrors: {},
      values,
    }
  }

  redirect("/family")
}

/**
 * Remove a demo student profile.
 *
 * A recovery path for a mistyped sample record, not a data-deletion policy —
 * retention and deletion remain checklist §11. The id is client-supplied and
 * that is safe: the database checks family membership itself, so an id from
 * another family removes nothing.
 */
export async function removeStudentAction(formData: FormData): Promise<void> {
  const studentId = String(formData.get("studentId") ?? "")
  if (!studentId) redirect("/family")

  await requireRole("parent", "/family")
  await removeStudent(studentId)
  redirect("/family")
}
