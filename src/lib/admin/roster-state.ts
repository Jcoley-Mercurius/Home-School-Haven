/**
 * The roster rule: which enrollments are actually a roster, and which only
 * look like one (MPS-REQ-017, MPS-REQ-020, MPS-ACC-028).
 *
 * Pure and dependency-free, so it can be exercised directly rather than only
 * through a browser. It is separated from the read in `roster.ts` for the same
 * reason `family/dashboard-state.ts` is separated from `family/repository.ts`:
 * this is the judgement, and a judgement worth stating is worth testing without
 * a database.
 *
 * THERE IS NO ROSTER TABLE, AND THERE MUST NOT BE ONE
 *
 * A confirmed enrollment IS the roster relationship. Storing a second copy — a
 * `roster_members` table, a `programs.roster_count`, a materialized view —
 * would create a second thing that can be right or wrong about which child is
 * in which program, and the two would drift the first time one write path
 * forgot the other. So this derives; it never records.
 *
 * That also settles MPS-ACC-028's "exactly once" without a distinct or a
 * grouping trick: `enrollments_one_per_student_program` already makes a second
 * row for the same (student, program) pair impossible, so one confirmed
 * enrollment per student per program is a database guarantee this code inherits
 * rather than a rule it re-implements.
 *
 * CONFIRMED IS NOT "NOT CANCELLED"
 *
 * The split below is an explicit equality against `confirmed`, never an
 * exclusion of a list of states. The difference matters: an enum value added
 * later would silently join the roster under an exclusion rule, and the one
 * thing this surface must never do is present an unconfirmed child as enrolled.
 * Everything that is not `confirmed` lands in `notConfirmed`, whatever it is.
 *
 * `payment_pending` is the case that makes the rule concrete. It means payment
 * activity is awaiting verification, and this release has no way to verify it
 * (GAP-ADMIN-002). It is not enrollment, it is not nearly-enrollment, and it
 * does not belong on a roster.
 */

import type { EnrollmentState } from "@/lib/admin/transitions"

/**
 * The only student columns an assigned educator may be shown, pending
 * checklist §9 (GAP-ADMIN-014).
 *
 * RLS grants rows, not columns, so `students_select_assigned_educator` exposes
 * every column of a matched row. The narrowing has to happen in the select
 * list, which is why this list is exported and commented rather than left
 * implicit: the educator workspace slice reuses it, and must not widen it on
 * its own authority.
 */
const EDUCATOR_ROSTER_COLUMNS = ["preferred_name"] as const

/** One roster line. Family name for identification, never contact detail. */
type RosterEntry = {
  enrollmentId: string
  state: EnrollmentState
  stateChangedAt: string
  /** Preferred name only. `""` when the join could not be resolved. */
  studentName: string
  familyName: string
}

/**
 * A program's roster, split by whether the place is actually confirmed.
 *
 * `notConfirmed` is a separate list rather than a flag on one list, because a
 * single list with a status column invites a reader to skim it as "the
 * roster". Two lists under two headings cannot be skimmed that way.
 */
type ProgramRoster = {
  /** Confirmed enrollments, by student name. Each student appears once. */
  confirmed: RosterEntry[]
  /** Everything else, newest change first, with its own state on each row. */
  notConfirmed: RosterEntry[]
  /** Rows whose student or family join did not resolve. Reported, not hidden. */
  partial: number
}

/**
 * Split enrollment rows into the confirmed roster and everything else.
 *
 * @param entries - Every enrollment on one program.
 * @returns The two lists and the partial-join count.
 */
function partitionRoster(entries: RosterEntry[]): ProgramRoster {
  /* Explicit equality, never an exclusion list — see the module note. */
  const confirmed = entries
    .filter((entry) => entry.state === "confirmed")
    /* Confirmed rows read better by name than by when they were last touched;
       the unconfirmed list keeps recency, because that is what an operator
       acting on it needs. */
    .sort((a, b) => a.studentName.localeCompare(b.studentName))

  return {
    confirmed,
    notConfirmed: entries.filter((entry) => entry.state !== "confirmed"),
    /* An unresolved join is partial data, not an error. The enrollment is real
       and the administrator responsible for it must still see that it exists;
       dropping the row to tidy the display would hide a child's record from
       the person accountable for it. */
    partial: entries.filter(
      (entry) => entry.studentName === "" || entry.familyName === "",
    ).length,
  }
}

export { EDUCATOR_ROSTER_COLUMNS, partitionRoster }
export type { ProgramRoster, RosterEntry }
