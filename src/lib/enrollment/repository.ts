/**
 * Enrollment reads for the authenticated viewer.
 *
 * Same contract as `src/lib/family/repository.ts`: the family comes from the
 * session, no caller supplies a family id, and there is no `.eq()` narrowing
 * the result — RLS returns this family's enrollments and nothing else, so the
 * boundary lives in the database rather than in a filter we could forget.
 *
 * There is no write function here on purpose. Creating an enrollment is
 * MPS-REQ-012/013 (eligibility, consent, capacity, and the external checkout
 * handoff) and belongs to the conversion journey. `public.enrollments` has no
 * client write policy or privilege at all, so nothing here could write one
 * anyway.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { Enums } from "@/lib/supabase/types"

export type EnrollmentState = Enums<"enrollment_state">

export type EnrollmentRecord = {
  id: string
  studentId: string
  /** Preferred name only. No other student field reaches this surface. */
  studentName: string
  state: EnrollmentState
  programId: string
  /**
   * `null` when the program is no longer readable — unpublished or archived
   * while the family still holds the enrollment. The record is still shown,
   * because deleting a family's enrollment from their own view to tidy up a
   * missing join would be worse than saying we cannot show the program.
   */
  program: {
    slug: string
    name: string
    /** Published schedule text, verbatim. `null` means none is published. */
    publishedSchedule: string | null
  } | null
}

/**
 * A section read that distinguishes "nothing here" from "we could not look".
 *
 * Every dashboard card uses this, so a failed read renders a recoverable error
 * inside that one card while the rest of the page still renders. A page that
 * disappears wholesale because one query failed tells the family less than a
 * page that says which part is missing.
 */
export type SectionState<T> =
  /** No Supabase project in this environment — not the same as "empty". */
  | { status: "unavailable" }
  /** The read failed. Never rendered as emptiness. */
  | { status: "failed" }
  | { status: "ready"; items: T[] }

/**
 * Every enrollment belonging to the authenticated viewer's family.
 * @returns The family's enrollments, or a state explaining why not.
 */
export async function getFamilyEnrollments(): Promise<
  SectionState<EnrollmentRecord>
> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id,state,student_id,program_id,students(preferred_name),programs(slug,name,published_schedule)",
    )
    .order("state_changed_at", { ascending: false })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.students?.preferred_name ?? "",
      state: row.state,
      programId: row.program_id,
      program: row.programs
        ? {
            slug: row.programs.slug,
            name: row.programs.name,
            publishedSchedule: row.programs.published_schedule,
          }
        : null,
    })),
  }
}

/**
 * Narrow a family's enrollments to one student.
 *
 * Presentation only. The authorization already happened in the database; this
 * is the parent choosing whose context to look at.
 *
 * @param enrollments - The family's enrollments.
 * @param studentId - The selected student, or `null` for the whole family.
 * @returns The matching enrollments.
 */
export function enrollmentsForStudent(
  enrollments: EnrollmentRecord[],
  studentId: string | null,
): EnrollmentRecord[] {
  if (!studentId) return enrollments
  return enrollments.filter((enrollment) => enrollment.studentId === studentId)
}
