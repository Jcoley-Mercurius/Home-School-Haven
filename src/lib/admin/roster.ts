/**
 * The one authoritative roster read (MPS-REQ-017, MPS-REQ-020, MPS-ACC-028;
 * MDS `components.table` variant `roster`).
 *
 * The rule this read feeds lives in `roster-state.ts`, which explains why a
 * roster is derived from enrollments rather than stored. This module is the
 * authorized query and nothing else.
 *
 * WHICH FIELDS, AND WHY SO FEW
 *
 * An administrator reading a roster needs to know which child, from which
 * family, in which state, since when. That is the whole select list. No grade
 * level, no guardian relationship, no affirmation version, no state note, no
 * email. What is never read cannot reach a screenshot, a log, an error object,
 * or a payload.
 *
 * `EDUCATOR_ROSTER_COLUMNS` in `roster-state.ts` is narrower still, and is what
 * the later educator workspace must select. This module is administrator-facing
 * and uses the fuller list above.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { partitionRoster } from "@/lib/admin/roster-state"

import type { AdminRead } from "@/lib/admin/repository"
import type { ProgramRoster, RosterEntry } from "@/lib/admin/roster-state"

/* One unbroken literal — PostgREST infers the row type from it, and a
   runtime-built string degrades every column to `GenericStringError`. */
// prettier-ignore
const ROSTER_COLUMNS = "id,state,state_changed_at,students(preferred_name),families(name)"

/**
 * The roster for one program (MPS-ACC-028).
 *
 * Scoped by `program_id` because a roster is per-program by definition. This is
 * the one place in `lib/admin` where a query is narrowed by a parameter, and
 * the parameter is a program id — an operational fact, not a permission. It
 * broadens nothing: RLS decides which enrollments the viewer may see at all, so
 * an administrator gets the program's rows, an assigned educator gets the same
 * rows only for a program they hold, and anyone else gets none — including for
 * a program id they typed themselves.
 *
 * @param programId - The program whose roster is wanted.
 * @returns The roster, or a state explaining why not.
 */
async function getProgramRoster(
  programId: string,
): Promise<AdminRead<ProgramRoster>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("enrollments")
    .select(ROSTER_COLUMNS)
    .eq("program_id", programId)
    .order("state_changed_at", { ascending: false })

  if (error) return { status: "failed" }

  const entries: RosterEntry[] = (data ?? []).map((row) => ({
    enrollmentId: row.id,
    state: row.state,
    stateChangedAt: row.state_changed_at,
    /* An unresolved join renders as an explicit "not available" in the UI
       rather than as a blank cell that reads like an empty value. */
    studentName: row.students?.preferred_name ?? "",
    familyName: row.families?.name ?? "",
  }))

  return { status: "ready", data: partitionRoster(entries) }
}

export { getProgramRoster }
