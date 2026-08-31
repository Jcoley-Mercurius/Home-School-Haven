/**
 * Authorized administrator enrollment reads and the one approved write
 * (MPS-REQ-017, MPS-REQ-020, MPS-REQ-024, MPS-RUL-004).
 *
 * MINIMUM NECESSARY, AS A SELECT LIST
 *
 * An administrator acting on an enrollment needs to know whose it is. That is
 * three facts: the student's preferred name, the family's name, and the
 * program. Nothing else is selected — not grade level, not guardian
 * relationship, not the parent's email, not the affirmation version. What is
 * never read cannot reach a screenshot, a log, or an error message.
 *
 * `students.preferred_name` is the only child field in this module, and there
 * is no legal name to leak because none is collected (MPS-RUL-006).
 *
 * THE ONE WRITE
 *
 * `public.enrollments` has no INSERT, UPDATE, or DELETE policy and no write
 * grant for any client role. `admin_set_enrollment_state` is the only way an
 * enrollment state changes in this product, and it performs the administrator
 * check, the staleness test, the approved-transition rule, and the idempotent
 * no-op inside one statement.
 *
 * WHAT DOES NOT EXIST HERE, DELIBERATELY
 *
 * No payment read, no payment write, no verification flag, no evidence field
 * (GAP-ADMIN-002: checklist §2 does not define how a successful payment is
 * identified). No scholarship, discount, refund, credit, or transfer of any
 * kind (MPS GAP-010, MPS-RUL-004). No create and no delete. Confirming an
 * enrollment records an administrator's decision; it records nothing about
 * money.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead } from "@/lib/admin/repository"
import type { MutationResult } from "@/lib/admin/programs"
import type {
  AdminEnrollmentTarget,
  EnrollmentState,
} from "@/lib/admin/transitions"

/**
 * One enrollment as the operations surfaces show it.
 *
 * `updatedAt` is the concurrency token the drawer carries into its form.
 */
type AdminEnrollment = {
  id: string
  state: EnrollmentState
  stateChangedAt: string
  /** The last administrator's note. Free text; never entered into the audit. */
  stateNote: string | null
  updatedAt: string
  /** Preferred name only. `""` when the join could not be resolved. */
  studentName: string
  familyName: string
  program: { id: string; slug: string; name: string } | null
}

/* One unbroken literal — see the note in `programs.ts`. */
// prettier-ignore
const SELECT_COLUMNS = "id,state,state_changed_at,state_note,updated_at,students(preferred_name),families(name),programs(id,slug,name)"

/**
 * Every enrollment the viewer is authorized to see, newest change first.
 *
 * No `.eq()` narrows this. `enrollments_select_admin` returns all of them to an
 * administrator, `enrollments_select_own_family` returns a parent their own,
 * and `enrollments_select_assigned_educator` returns an educator their assigned
 * programs' rosters. The same call is safe for each because the database, not
 * this function, decides the row set.
 *
 * @returns The enrollments, or a state explaining why not.
 */
async function listAdminEnrollments(): Promise<AdminRead<AdminEnrollment[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("enrollments")
    .select(SELECT_COLUMNS)
    .order("state_changed_at", { ascending: false })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    data: (data ?? []).map((row) => ({
      id: row.id,
      state: row.state,
      stateChangedAt: row.state_changed_at,
      stateNote: row.state_note,
      updatedAt: row.updated_at,
      /* An unresolved join renders as an explicit "not available" in the UI
         rather than as a blank cell that reads like an empty value. */
      studentName: row.students?.preferred_name ?? "",
      familyName: row.families?.name ?? "",
      program: row.programs
        ? {
            id: row.programs.id,
            slug: row.programs.slug,
            name: row.programs.name,
          }
        : null,
    })),
  }
}

/**
 * Change an enrollment's state (MPS-REQ-017).
 *
 * Records a status. Decides and issues no financial outcome (MPS-RUL-004), and
 * asserts nothing about whether a payment succeeded (GAP-ADMIN-002).
 *
 * `note` is required by the database as well as by the form, because
 * MPS-REQ-024's attributable history is only useful if it says why.
 *
 * @param input - The record, the target state, the note, and the token.
 * @returns The outcome, including the idempotent `unchanged` case.
 */
async function setEnrollmentState(input: {
  enrollmentId: string
  state: AdminEnrollmentTarget
  note: string
  expectedUpdatedAt: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_set_enrollment_state", {
    target_id: input.enrollmentId,
    next_state: input.state,
    note: input.note,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) {
    /* Deliberately not logged and deliberately not echoed. A failure here
       concerns a child's enrollment record, and a Supabase error object can
       carry the query that produced it. Only the code decides the recovery. */
    switch (error.code) {
      case "42501":
        return { ok: false, reason: "forbidden" }
      case "P0002":
        return { ok: false, reason: "notFound" }
      case "40001":
        return { ok: false, reason: "stale" }
      case "23514":
        return { ok: false, reason: "invalidTransition" }
      case "22023":
        return { ok: false, reason: "rejected" }
      default:
        return { ok: false, reason: "failed" }
    }
  }

  return { ok: true, outcome: data === "unchanged" ? "unchanged" : "updated" }
}

export { listAdminEnrollments, setEnrollmentState }
export type { AdminEnrollment }
