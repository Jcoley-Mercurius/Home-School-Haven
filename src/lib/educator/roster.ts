/**
 * The educator roster read — the narrowest query in the repository
 * (MPS-REQ-018, MPS-ACC-028; MDS `components.table` variant `roster`).
 *
 * WHY THIS IS NOT `admin/roster.ts`, AND NOT `public.students`
 *
 * The administrator roster reads `enrollments` joined to `students` and
 * `families`, because an administrator may see all three. An educator may not,
 * and the difference is enforced in the database rather than negotiated here:
 * `public.students` carries own-family and administrator policies and NO
 * educator policy at all, so a child's name is unreachable to an educator by
 * any query they or this module could compose.
 *
 * `public.educator_roster_students` is the one door. It is a security-barrier
 * view selecting `program_id` and `preferred_name`, joined through
 * `educator_assignments` on `(select auth.uid())` and filtered to
 * `state = 'confirmed'`. Three consequences follow, and all three are the
 * point:
 *
 *   * only confirmed children are named, so MPS-RUL-003 holds without this
 *     module filtering anything;
 *   * only `preferred_name` exists to be read, so grade level, guardian
 *     relationship, and affirmation bookkeeping cannot reach a payload even by
 *     mistake;
 *   * removing the assignment empties the view on the very next request, with
 *     no session, cookie, or JWT claim to invalidate.
 *
 * THE SECOND CONTROL
 *
 * This module still names its columns rather than asking for `*`. A view can
 * gain a column in a later migration; a select list cannot start returning one.
 * `EDUCATOR_ROSTER_SELECT` is bound to `EDUCATOR_ROSTER_COLUMNS` in both
 * directions at compile time — see the note in `workspace-state.ts`.
 *
 * THE UNCONFIRMED SIDE IS COUNTS, NOT NAMES
 *
 * An educator can read `enrollments` for a program they hold, which carries a
 * state but no name. That is exactly what is shown: how many records on this
 * program are not confirmed, and in which states. The children behind them are
 * not identified, because the view does not name them and nothing here tries to
 * reconstruct who they are.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import {
  EDUCATOR_ROSTER_SELECT,
  summarizeUnconfirmed,
} from "@/lib/educator/workspace-state"

import type { EnrollmentState } from "@/lib/admin/transitions"
import type {
  EducatorRosterEntry,
  UnconfirmedSummary,
} from "@/lib/educator/workspace-state"

/** One program's roster as an educator may see it. */
type EducatorRoster = {
  /** Confirmed children, by preferred name. Each appears exactly once. */
  confirmed: EducatorRosterEntry[]
  /** Everything else, as counts. No child is identified. */
  unconfirmed: UnconfirmedSummary
}

/** The roster, or the reason there is nothing to show. */
type EducatorRosterRead =
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "ready"; data: EducatorRoster }

/**
 * The roster for one assigned program (MPS-ACC-028).
 *
 * "Exactly once" is a database guarantee this inherits rather than a rule it
 * re-implements: `enrollments_one_per_student_program` makes a second row for
 * the same (student, program) pair impossible, so the view cannot emit a
 * duplicate and no distinct or grouping trick is needed here.
 *
 * `programId` reaches this function from a route. It narrows and never widens:
 * the view is already bounded by the viewer's own assignments, so a program id
 * they do not hold matches no row — including one they typed themselves. The
 * caller has additionally proven the assignment through `getAssignedProgram()`,
 * which is the second of the two independent controls.
 *
 * @param programId - The assigned program whose roster is wanted.
 * @returns The confirmed names and the unconfirmed counts, or a state
 *   explaining why not.
 */
async function getEducatorProgramRoster(
  programId: string,
): Promise<EducatorRosterRead> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const [rosterRows, enrollmentRows] = await Promise.all([
    supabase
      .from("educator_roster_students")
      .select(EDUCATOR_ROSTER_SELECT)
      .eq("program_id", programId)
      .order("preferred_name"),
    /* State only. There is no name to ask for on this side, and asking for a
       `student_id` would hand the render tree an identifier for a child the
       educator is not permitted to know about. */
    supabase.from("enrollments").select("state").eq("program_id", programId),
  ])

  if (rosterRows.error || enrollmentRows.error) return { status: "failed" }

  const confirmed: EducatorRosterEntry[] = (rosterRows.data ?? []).map(
    (row) => ({
      /* The view's column is nullable in the generated types because a view
         column always is. An empty name renders as an explicit "not available"
         rather than as a blank cell that reads like an empty value. */
      studentName: row.preferred_name ?? "",
    }),
  )

  const states = (enrollmentRows.data ?? []).map(
    (row) => row.state as EnrollmentState,
  )

  return {
    status: "ready",
    data: { confirmed, unconfirmed: summarizeUnconfirmed(states) },
  }
}

export { getEducatorProgramRoster }
export type { EducatorRoster, EducatorRosterRead }
