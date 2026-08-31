/**
 * The educator workspace's authorized reads of the viewer's OWN assignments
 * (MPS-REQ-004, MPS-REQ-018, MPS-REQ-020; MPS-ACC-029).
 *
 * WHERE THE BOUNDARY IS, AND WHY IT IS DRAWN TWICE
 *
 * Every function here takes `educatorUserId` and filters on it. That value is
 * never a parameter the browser supplies: it comes from `getViewer()`, which
 * reads `getClaims()`, which verifies the JWT signature. A route, a search
 * param, a form field, and a request body are all incapable of reaching it.
 *
 * The filter is not the only control, and it is not the stronger one.
 * `educator_assignments_select_own`, `programs_select_assigned_educator`, and
 * their siblings decide independently what Postgres will return, so the same
 * call made by a parent, by a signed-out client, or by a hand-built PostgREST
 * request gets nothing regardless of what this module asks for. The filter
 * exists for a narrower reason: an ADMINISTRATOR passes the educator route
 * guard (ACT-004/006) and `educator_assignments_select_admin` would hand them
 * every assignment in the organization. Without `.eq()` here, `/educator` would
 * quietly become a second administrator surface with none of an administrator
 * surface's controls. With it, an administrator sees their own assignments —
 * normally none — and the educator area means one thing for everybody.
 *
 * REMOVAL TAKES EFFECT ON THE NEXT REQUEST
 *
 * Nothing caches an assignment in a session, a cookie, or a JWT claim. Both the
 * filter and the policies re-evaluate per statement, and the portal layout is
 * `force-dynamic`, so unassigning an educator revokes their reach on their very
 * next request with no sign-out involved.
 *
 * NO WRITES EXIST HERE
 *
 * Assignment is an administrator operation (`lib/admin/assignments.ts`, behind
 * `admin_assign_educator`). This module reads. `authenticated` holds no INSERT
 * or DELETE on `public.educator_assignments` at all, so there is no write for
 * an educator surface to expose even by mistake.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AssignedProgram } from "@/lib/educator/workspace-state"
import type { SectionState } from "@/lib/enrollment/repository"

/* One unbroken literal — PostgREST infers the row type from it, and a
   runtime-built string degrades every column to `GenericStringError`.

   No `published_price`, no `checkout_url`, no `availability`: MDS-REF-008's
   applicability note excludes pricing and availability from educator context,
   and what is never read cannot reach a payload, a screenshot, or a log. */
// prettier-ignore
const ASSIGNED_PROGRAM_COLUMNS = "program_id,programs(id,slug,name,summary,audience,format,location,educator,published_dates,published_schedule,published_duration,published_session_length,enrollment_window,publication_state)"

/** One assigned program, or the reason there is nothing to show. */
type AssignedProgramRead =
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "notFound" }
  | { status: "ready"; data: AssignedProgram }

type AssignmentRow = {
  program_id: string
  programs: {
    id: string
    slug: string
    name: string
    summary: string | null
    audience: string | null
    format: string | null
    location: string | null
    educator: string | null
    published_dates: string | null
    published_schedule: string | null
    published_duration: string | null
    published_session_length: string | null
    enrollment_window: string | null
    publication_state: AssignedProgram["publicationState"]
  } | null
}

/**
 * Map an assignment row to the program it points at.
 *
 * @param row - The assignment row with its embedded program.
 * @returns The program, or `null` when the embed did not resolve.
 */
function mapAssignment(row: AssignmentRow): AssignedProgram | null {
  const program = row.programs
  /* An assignment whose program did not come back is not rendered as a program
     with empty fields. The row is dropped and the caller reports the count, so
     a partial read reads as partial rather than as a program with no name. */
  if (!program) return null

  return {
    id: program.id,
    slug: program.slug,
    name: program.name,
    summary: program.summary,
    audience: program.audience,
    format: program.format,
    location: program.location,
    educator: program.educator,
    publishedDates: program.published_dates,
    publishedSchedule: program.published_schedule,
    publishedDuration: program.published_duration,
    publishedSessionLength: program.published_session_length,
    enrollmentWindow: program.enrollment_window,
    publicationState: program.publication_state,
  }
}

/**
 * Every program the authenticated educator is assigned to (MPS-ACC-029).
 *
 * Sorted by name in application code rather than by `sort_order` in the query:
 * PostgREST cannot order parent rows by an embedded column, and an educator
 * holds a handful of programs, not a catalog. Sorting a short authorized list
 * cannot widen it.
 *
 * @param educatorUserId - The verified viewer's id. Never browser-supplied.
 * @returns The assigned programs, or a state explaining why not.
 */
async function listAssignedPrograms(
  educatorUserId: string,
): Promise<SectionState<AssignedProgram>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("educator_assignments")
    .select(ASSIGNED_PROGRAM_COLUMNS)
    .eq("educator_user_id", educatorUserId)

  if (error) return { status: "failed" }

  const programs = (data ?? [])
    .map((row) => mapAssignment(row))
    .filter((program): program is AssignedProgram => program !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

  return { status: "ready", items: programs }
}

/**
 * One assigned program by id (MPS-ACC-029).
 *
 * THE ROUTE PARAMETER IS UNTRUSTED AND NOTHING HERE TREATS IT OTHERWISE.
 *
 * `programId` arrives from the URL. It is used only to narrow a query already
 * bounded by `educator_user_id`, so an id for a program the viewer does not
 * hold matches no row and returns `notFound` — the identical answer an id that
 * never existed gets. The caller must not distinguish the two either, because
 * a distinguishable "forbidden" tells a prober that the record exists.
 *
 * @param educatorUserId - The verified viewer's id. Never browser-supplied.
 * @param programId - The program's UUID, from the route.
 * @returns The program, `notFound`, or a state explaining why not.
 */
async function getAssignedProgram(
  educatorUserId: string,
  programId: string,
): Promise<AssignedProgramRead> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("educator_assignments")
    .select(ASSIGNED_PROGRAM_COLUMNS)
    .eq("educator_user_id", educatorUserId)
    .eq("program_id", programId)
    .maybeSingle()

  if (error) return { status: "failed" }
  if (!data) return { status: "notFound" }

  const program = mapAssignment(data)
  if (!program) return { status: "notFound" }

  return { status: "ready", data: program }
}

export { getAssignedProgram, listAssignedPrograms }
export type { AssignedProgramRead }
