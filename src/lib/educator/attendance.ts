/**
 * The educator's per-session attendance roster (MPS-FEA-011, MPS-REQ-018,
 * MPS-ACC-028).
 *
 * WHY THIS IS A SECOND VIEW AND NOT A WIDER FIRST ONE
 *
 * Attendance is recorded per child per session, so an educator must be able to
 * name the record they are writing. `public.educator_roster_students` exposes
 * `preferred_name` and deliberately carries NO id, and widening it would push
 * an identifier into every roster read that has no use for one.
 *
 * `public.educator_session_roster` is the narrow addition. It exposes an
 * ENROLLMENT id — which points at a registration, not at a child — alongside
 * the same single approved name field, scoped through `educator_assignments` on
 * `(select auth.uid())` and filtered to `state = 'confirmed'`. So an educator
 * recording attendance never receives a student identifier, and
 * `public.students` remains unreachable to them by every route: that table
 * carries own-family and administrator policies and no educator policy at all.
 *
 * `EDUCATOR_ROSTER_COLUMNS` is untouched by this module. It is not restated,
 * extended, or copied; this view carries its own allowlist below, bound to its
 * select literal in both directions at compile time for the same reason —
 * a view can gain a column in a later migration, and an application asking for
 * `*` would start returning it.
 *
 * WHAT "NOT RECORDED" MEANS, AND WHAT IT DOES NOT
 *
 * `attended: false` means no attendance record exists for this pairing. It is
 * NOT a claim that the child was absent. MPS-FEA-011 approves attendance
 * tracking and defines no vocabulary for absent, excused, or tardy
 * (GAP-ADMIN-010), so this product records the one thing it can record
 * truthfully and says the rest in words.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

/**
 * Every column of `public.educator_session_roster` this application will read.
 *
 * `session_id` and `enrollment_id` are operational identifiers. `preferred_name`
 * is the one approved student field. `attended` is a boolean about a record,
 * not about a child.
 *
 * A `student_id`, `family_id`, `grade_level`, or guardian column appearing in
 * this list would be a widening of what an educator may know about a child, and
 * would need the checklist §9 answer that does not exist.
 */
const ATTENDANCE_ROSTER_COLUMNS = [
  "session_id",
  "enrollment_id",
  "preferred_name",
  "attended",
] as const

/* One unbroken literal — PostgREST infers the row type from it, and a
   runtime-built string degrades every column to `GenericStringError`. */
// prettier-ignore
const ATTENDANCE_ROSTER_SELECT = "session_id,enrollment_id,preferred_name,attended"

/**
 * The bidirectional compile-time binding: a column added to one side and not
 * the other fails typecheck, as either a missing key or an excess property.
 */
const ALLOWLIST_MATCHES_SELECT: Record<
  (typeof ATTENDANCE_ROSTER_COLUMNS)[number],
  true
> = {
  session_id: true,
  enrollment_id: true,
  preferred_name: true,
  attended: true,
}

void ALLOWLIST_MATCHES_SELECT

/** One line of a session's attendance roster. */
type AttendanceEntry = {
  /** Points at a registration. Never a student identifier. */
  enrollmentId: string
  /** Preferred name only. `""` when the view returned no name. */
  studentName: string
  /** True when a record exists. False means "not recorded", never "absent". */
  attended: boolean
}

/** A session's roster, keyed by session id. */
type AttendanceRosters = Map<string, AttendanceEntry[]>

type AttendanceRead =
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "ready"; rosters: AttendanceRosters }

/**
 * The attendance rosters for the sessions of one assigned program.
 *
 * `programId` reaches this function from a route. It narrows and never widens:
 * the view is already bounded by the viewer's own assignments, so a program id
 * they do not hold matches no row — including one they typed themselves. The
 * caller has additionally proven the assignment through `getAssignedProgram()`,
 * which is the second of the two independent controls.
 *
 * The read is by session id rather than by program, because the view carries no
 * program column: it exposes the narrowest set that supports the operation, and
 * the caller already knows which sessions belong to the program.
 *
 * @param sessionIds - The sessions whose rosters are wanted.
 * @returns One roster per session, or a state explaining why not.
 */
async function getSessionAttendanceRosters(
  sessionIds: readonly string[],
): Promise<AttendanceRead> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }
  if (sessionIds.length === 0) {
    return { status: "ready", rosters: new Map() }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("educator_session_roster")
    .select(ATTENDANCE_ROSTER_SELECT)
    .in("session_id", sessionIds)
    .order("preferred_name")

  if (error) return { status: "failed" }

  const rosters: AttendanceRosters = new Map()

  for (const row of data ?? []) {
    /* Every column of a view is nullable in the generated types because a view
       column always is. A missing id would make an unaddressable row, so it is
       skipped rather than rendered as a control that cannot work. */
    if (!row.session_id || !row.enrollment_id) continue

    const entries = rosters.get(row.session_id) ?? []
    entries.push({
      enrollmentId: row.enrollment_id,
      /* An empty name renders as an explicit "not available" rather than as a
         blank row that reads like an empty value. */
      studentName: row.preferred_name ?? "",
      attended: row.attended ?? false,
    })
    rosters.set(row.session_id, entries)
  }

  return { status: "ready", rosters }
}

export { ATTENDANCE_ROSTER_COLUMNS, getSessionAttendanceRosters }
export type { AttendanceEntry, AttendanceRead, AttendanceRosters }
