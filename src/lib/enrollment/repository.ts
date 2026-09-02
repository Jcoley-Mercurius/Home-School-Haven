/**
 * Enrollment reads for the authenticated viewer.
 *
 * Same contract as `src/lib/family/repository.ts`: the family comes from the
 * session, no caller supplies a family id, and there is no `.eq()` narrowing
 * the result — RLS returns this family's enrollments and nothing else, so the
 * boundary lives in the database rather than in a filter we could forget.
 *
 * The one write is `requestEnrollment`, and it writes nothing itself: it calls
 * `public.family_request_enrollment`, which performs the MPS-REQ-012 evaluation
 * on a locked program row and is the only path by which a parent creates an
 * enrollment. `public.enrollments` still has no client INSERT policy and no
 * client INSERT privilege, so this module could not write a row directly even
 * if it tried — which is the point.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import {
  parseOutcome,
  type EnrollmentOutcome,
} from "@/lib/enrollment/eligibility"

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

/** One enrollment, with the program facts its own page needs. */
export type FamilyEnrollmentDetail = {
  id: string
  studentId: string
  studentName: string
  state: EnrollmentState
  programId: string
  program: {
    slug: string
    name: string
    publishedSchedule: string | null
    /** Presentation text, verbatim. Never a payment amount. */
    publishedPrice: string | null
    /** `null` when Home School Haven has published no registration link. */
    checkoutUrl: string | null
    confirmationMode: Enums<"program_confirmation_mode">
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

/**
 * One enrollment belonging to the authenticated viewer's family.
 *
 * No `.eq()` on a family column and no family id from the caller: RLS returns
 * this family's row or no row. An id belonging to another family is therefore
 * indistinguishable from an id that never existed, which is what it should be.
 *
 * @param enrollmentId - The enrollment to read.
 * @returns The enrollment, or a state explaining why not.
 */
export async function getFamilyEnrollment(
  enrollmentId: string,
): Promise<
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "missing" }
  | { status: "ready"; enrollment: FamilyEnrollmentDetail }
> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id,state,student_id,program_id,students(preferred_name),programs(slug,name,published_schedule,published_price,checkout_url,confirmation_mode)",
    )
    .eq("id", enrollmentId)
    .maybeSingle()

  if (error) return { status: "failed" }
  if (!data) return { status: "missing" }

  return {
    status: "ready",
    enrollment: {
      id: data.id,
      studentId: data.student_id,
      studentName: data.students?.preferred_name ?? "",
      state: data.state,
      programId: data.program_id,
      program: data.programs
        ? {
            slug: data.programs.slug,
            name: data.programs.name,
            publishedSchedule: data.programs.published_schedule,
            publishedPrice: data.programs.published_price,
            checkoutUrl: data.programs.checkout_url,
            confirmationMode: data.programs.confirmation_mode,
          }
        : null,
    },
  }
}

/**
 * Request an enrollment (MPS-REQ-012, MPS-WFL-003).
 *
 * Every decision belongs to `family_request_enrollment`: capacity, waitlist,
 * confirmation mode, duplicates, publication state, family ownership, and the
 * guardian-authority affirmation. This function chooses nothing — it passes the
 * parent's two selections and their affirmation, and reports what the database
 * decided.
 *
 * Nothing is logged: a student id and a program id together are family data.
 *
 * @param input - The student, the program, and the guardian-authority affirmation.
 * @returns The outcome and, when one was recorded, the enrollment.
 */
export async function requestEnrollment(input: {
  studentId: string
  programId: string
  authorityAffirmed: boolean
}): Promise<
  | { ok: false; reason: "unavailable" | "forbidden" | "failed" }
  | {
      ok: true
      outcome: EnrollmentOutcome
      enrollmentId: string | null
      state: EnrollmentState | null
    }
> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("family_request_enrollment", {
    target_student: input.studentId,
    target_program: input.programId,
    authority_affirmed: input.authorityAffirmed,
  })

  /* 42501 is the function's own authorization refusal — not a parent of this
     student, or not a parent at all. It says nothing about whether the student
     exists. */
  if (error) {
    return {
      ok: false,
      reason: error.code === "42501" ? "forbidden" : "failed",
    }
  }

  const row = Array.isArray(data) ? data[0] : null
  const outcome = parseOutcome(row?.outcome)

  /* An outcome this build does not recognise is a failure, never a success.
     Falling through to "registered" on an unknown answer is how a trust state
     gets invented. */
  if (!row || !outcome) return { ok: false, reason: "failed" }

  return {
    ok: true,
    outcome,
    enrollmentId: row.enrollment_id ?? null,
    state: row.state ?? null,
  }
}

/** The program facts the registration surface needs, and only those. */
export type EnrollableProgram = {
  id: string
  slug: string
  name: string
  publishedSchedule: string | null
  publishedPrice: string | null
  availability: Enums<"availability_state">
  confirmationMode: Enums<"program_confirmation_mode">
  /** `null` when Home School Haven has not established one (MPS-RUL-002). */
  capacity: number | null
  waitlistEnabled: boolean
  checkoutUrl: string | null
}

/**
 * A published program, for the registration surface.
 *
 * `programs_select_published_*` is what makes this safe for a parent to call:
 * an unpublished or archived program is not returned at all, so the surface
 * cannot offer a registration the database would refuse. The refusal is still
 * the control — `family_request_enrollment` re-reads publication state on a
 * locked row — but a parent should not be walked into it.
 *
 * @param slug - The program's public slug.
 * @returns The program, or a state explaining why not.
 */
export async function getEnrollableProgram(
  slug: string,
): Promise<
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "missing" }
  | { status: "ready"; program: EnrollableProgram }
> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("programs")
    .select(
      "id,slug,name,published_schedule,published_price,availability,confirmation_mode,capacity,waitlist_enabled,checkout_url",
    )
    .eq("slug", slug)
    .maybeSingle()

  if (error) return { status: "failed" }
  if (!data) return { status: "missing" }

  return {
    status: "ready",
    program: {
      id: data.id,
      slug: data.slug,
      name: data.name,
      publishedSchedule: data.published_schedule,
      publishedPrice: data.published_price,
      availability: data.availability,
      confirmationMode: data.confirmation_mode,
      capacity: data.capacity,
      waitlistEnabled: data.waitlist_enabled,
      checkoutUrl: data.checkout_url,
    },
  }
}
