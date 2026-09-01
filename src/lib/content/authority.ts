/**
 * Who may author content for which program (MPS-REQ-004, MPS-REQ-018,
 * MPS-REQ-019).
 *
 * ONE PREDICATE, THREE PLACES, AND ONLY ONE OF THEM IS THE CONTROL
 *
 * The rule is "an administrator, or an educator actively assigned to this
 * program". It is stated in `private.content_may_author()` in the database,
 * which is what a request bypassing this application meets and therefore the
 * control. It is stated again here so a page can render the right actions and
 * a server action can refuse early with a proper 404 rather than surfacing a
 * database error. The order matters: this file exists for the response, the
 * database exists for the refusal.
 *
 * THE VIEWER IS NEVER BROWSER-SUPPLIED
 *
 * Every function takes a `Viewer` produced by `getViewer()`, which reads the
 * user id from verified JWT claims. No route, form field, search parameter, or
 * request body is ever accepted as an identity, a role, or an assignment.
 *
 * ASSIGNMENT IS NOT CACHED, ANYWHERE
 *
 * There is no session copy, no cookie, and no JWT claim carrying the assignment
 * set. Both this check and the database policy re-evaluate per request, so an
 * administrator removing an assignment revokes authoring on the educator's very
 * next request without a sign-out.
 */

import "server-only"

import { isAdmin, type Viewer } from "@/lib/auth/session"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

/** A program the viewer may author content for, with just enough to label it. */
type AuthorableProgram = {
  id: string
  name: string
  slug: string
}

/**
 * Whether a string is shaped like a UUID.
 *
 * A route parameter is untrusted input. Checking the shape before it reaches a
 * query means a malformed id becomes a 404 rather than a PostgREST error whose
 * message would confirm that the endpoint exists — the DEFECT-PE3 precedent
 * from `/admin/programs/[programId]`.
 * @param value - The candidate, from a route or a form.
 * @returns True when the value is a well-formed UUID.
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/**
 * Whether this viewer may author content for this program.
 *
 * An administrator may, for any program that exists. An educator may, for a
 * program they hold a current assignment on — proven by reading
 * `educator_assignments` filtered on the verified viewer id, not by trusting
 * anything the request carried.
 *
 * @param viewer - The verified viewer.
 * @param programId - The program's UUID, from a route or a form.
 * @returns True when authoring is permitted. False on a malformed id, a missing
 *   program, an unconfigured environment, and any read failure — a failure to
 *   prove authority is not authority.
 */
async function mayAuthorForProgram(
  viewer: Viewer,
  programId: string,
): Promise<boolean> {
  if (!isUuid(programId)) return false
  if (!isSupabaseConfigured()) return false

  const supabase = await createClient()

  if (isAdmin(viewer)) {
    const { data, error } = await supabase
      .from("programs")
      .select("id")
      .eq("id", programId)
      .maybeSingle()
    return !error && data !== null
  }

  const { data, error } = await supabase
    .from("educator_assignments")
    .select("program_id")
    .eq("educator_user_id", viewer.userId)
    .eq("program_id", programId)
    .maybeSingle()

  return !error && data !== null
}

/**
 * Every program this viewer may author content for, by name.
 *
 * An administrator gets all of them; an educator gets their own assignments and
 * nothing else. This is what fills a program selector, so an educator is never
 * shown a program they would then be refused on.
 *
 * @param viewer - The verified viewer.
 * @returns The authorable programs, or an empty list when none or unreadable.
 */
async function listAuthorablePrograms(
  viewer: Viewer,
): Promise<AuthorableProgram[]> {
  if (!isSupabaseConfigured()) return []

  const supabase = await createClient()

  if (isAdmin(viewer)) {
    const { data, error } = await supabase
      .from("programs")
      .select("id,name,slug")
      .order("name")
    if (error) return []
    return data ?? []
  }

  const { data, error } = await supabase
    .from("educator_assignments")
    .select("programs(id,name,slug)")
    .eq("educator_user_id", viewer.userId)

  if (error) return []

  return (data ?? [])
    .map((row) => row.programs)
    .filter((program): program is AuthorableProgram => program !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export { isUuid, listAuthorablePrograms, mayAuthorForProgram }
export type { AuthorableProgram }
