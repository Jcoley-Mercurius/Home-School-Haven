/**
 * Schedule reads, for every surface (MPS-REQ-015, MPS-REQ-018, MPS-REQ-020).
 *
 * ONE RECORD, FOUR AUDIENCES, NO PER-AUDIENCE FILTER
 *
 * MPS-REQ-020 requires that the schedule be consistent across the public,
 * family, educator, and administrative experiences. That consistency is a
 * property of there being ONE `public.program_sessions` row rather than of four
 * surfaces agreeing to copy it faithfully — so none of the functions below
 * filters by viewer, family, or assignment. The RLS policies do it:
 *
 *   - a visitor and any signed-in viewer read sessions of PUBLISHED programs;
 *   - an assigned educator additionally reads their assigned programs',
 *     including an unpublished one;
 *   - a family additionally reads the programs it holds an enrollment in, so a
 *     schedule they are relying on does not vanish because the catalog entry
 *     was unpublished;
 *   - an administrator reads all of them.
 *
 * A `programId` argument narrows and never widens: an id the viewer may not see
 * matches no row, including one they typed into the address bar themselves.
 *
 * There is no write function here. Every write is an RPC in `mutations.ts`,
 * because `public.program_sessions` has no client write privilege at any verb.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createAnonymousClient } from "@/lib/supabase/anonymous"
import { createClient } from "@/lib/supabase/server"

import type { SessionState } from "@/lib/schedule/sessions"

/* One unbroken literal — PostgREST infers the row type from it, and a
   runtime-built string degrades every column to `GenericStringError`. */
// prettier-ignore
const SESSION_COLUMNS = "id,program_id,title,starts_at,ends_at,location,state,rescheduled_from,change_note,updated_at"

// prettier-ignore
const SESSION_WITH_PROGRAM_COLUMNS = "id,program_id,title,starts_at,ends_at,location,state,rescheduled_from,change_note,updated_at,programs(slug,name,publication_state)"

/** One session, as every surface reads it. */
type ScheduleSession = {
  id: string
  programId: string
  title: string
  /** ISO 8601 with an offset. A real moment, not a published phrase. */
  startsAt: string
  endsAt: string
  location: string | null
  state: SessionState
  /**
   * The ORIGINAL start time of a session that has been moved, so a family sees
   * the time they first planned around (MPS-ACC-025, "without erasing
   * history"). `null` when the session has never moved.
   */
  rescheduledFrom: string | null
  /** The administrator's explanation of a move or a cancellation. */
  changeNote: string | null
  /** The concurrency token carried into every edit form. */
  updatedAt: string
}

/** A session together with the program it belongs to. */
type ScheduleSessionWithProgram = ScheduleSession & {
  /** `null` when the program row is not readable by this viewer. */
  program: { slug: string; name: string; publicationState: string } | null
}

/**
 * A section read that distinguishes "nothing here" from "we could not look".
 *
 * The same shape every other section read in the product uses, so a failed
 * schedule query renders a recoverable error inside its own card while the rest
 * of the page still renders.
 */
type ScheduleRead<T> =
  | { status: "unavailable" }
  | { status: "failed" }
  | { status: "ready"; items: T[] }

/**
 * Map one PostgREST row onto the session shape.
 * @param row - The selected row.
 * @returns The mapped session.
 */
function mapSession(row: {
  id: string
  program_id: string
  title: string
  starts_at: string
  ends_at: string
  location: string | null
  state: SessionState
  rescheduled_from: string | null
  change_note: string | null
  updated_at: string
}): ScheduleSession {
  return {
    id: row.id,
    programId: row.program_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    state: row.state,
    rescheduledFrom: row.rescheduled_from,
    changeNote: row.change_note,
    updatedAt: row.updated_at,
  }
}

/**
 * Every session of one program, in chronological order.
 *
 * @param programId - The program whose schedule is wanted.
 * @returns The sessions, or a state explaining why not.
 */
async function listProgramSessions(
  programId: string,
): Promise<ScheduleRead<ScheduleSession>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_sessions")
    .select(SESSION_COLUMNS)
    .eq("program_id", programId)
    .order("starts_at", { ascending: true })

  if (error) return { status: "failed" }
  return { status: "ready", items: (data ?? []).map(mapSession) }
}

/**
 * Every session this viewer may read, with its program, in chronological order.
 *
 * The whole-schedule read behind the administrator agenda, the educator
 * schedule, and the family schedule. Each of those three sees a different set
 * of rows from the same query, decided in the database.
 *
 * @returns The sessions, or a state explaining why not.
 */
async function listVisibleSessions(): Promise<
  ScheduleRead<ScheduleSessionWithProgram>
> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_sessions")
    .select(SESSION_WITH_PROGRAM_COLUMNS)
    .order("starts_at", { ascending: true })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      ...mapSession(row),
      /* An unresolved join is reported as "not available", never rendered as a
         session belonging to no program. */
      program: row.programs
        ? {
            slug: row.programs.slug,
            name: row.programs.name,
            publicationState: row.programs.publication_state,
          }
        : null,
    })),
  }
}

/**
 * Narrow a session list to one program.
 *
 * Presentation only. Authorization already happened in the database; this is a
 * reader choosing which program to look at.
 *
 * @param sessions - The sessions already read.
 * @param programId - The program to narrow to.
 * @returns The matching sessions.
 */
function sessionsForProgram<T extends { programId: string }>(
  sessions: readonly T[],
  programId: string,
): T[] {
  return sessions.filter((session) => session.programId === programId)
}

/**
 * The sessions a signed-out visitor may see, read anonymously.
 *
 * WHY A SEPARATE FUNCTION AND NOT A FLAG ON THE ONE ABOVE
 *
 * The public catalog and calendar are statically rendered. `listVisibleSessions`
 * uses the cookie-bound client, and touching `cookies()` on a page opts that
 * page out of static rendering entirely — so using it on `/calendar` would have
 * silently turned the public calendar into a per-request render, which is a
 * performance regression nothing asked for and nothing would have reported.
 *
 * The session-less client is also the safer property rather than a workaround:
 * it is subject to the `anon` policies, so anything prerendered is by
 * construction something a signed-out visitor may see. A draft program's
 * session cannot reach a static page this way even if a caller asks for one.
 *
 * @returns The published programs' sessions, or a state explaining why not.
 */
async function listPublicSessions(): Promise<
  ScheduleRead<ScheduleSessionWithProgram>
> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = createAnonymousClient()
  const { data, error } = await supabase
    .from("program_sessions")
    .select(SESSION_WITH_PROGRAM_COLUMNS)
    .order("starts_at", { ascending: true })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      ...mapSession(row),
      program: row.programs
        ? {
            slug: row.programs.slug,
            name: row.programs.name,
            publicationState: row.programs.publication_state,
          }
        : null,
    })),
  }
}

export {
  listProgramSessions,
  listPublicSessions,
  listVisibleSessions,
  sessionsForProgram,
}
export type { ScheduleRead, ScheduleSession, ScheduleSessionWithProgram }
