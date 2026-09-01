/**
 * Announcement reads and authoring calls (MPS-REQ-019, MPS-REQ-024,
 * MPS-ACC-030).
 *
 * EVERY WRITE IS AN RPC, AND THAT IS NOT A STYLE CHOICE
 *
 * `public.announcements` grants no client role INSERT, UPDATE, or DELETE. The
 * only way in is a SECURITY DEFINER function that re-checks authority inside
 * the transaction that writes, the posture `20260830090000` established for
 * `public.programs`. So there is no `.insert()` or `.update()` in this file to
 * find, and none can be added without a migration granting a privilege that is
 * currently absent.
 *
 * READS ARE NOT FILTERED BY AUDIENCE HERE
 *
 * Neither read below states who may see what. It does not need to: the SELECT
 * policies decide, and a family reaching this code gets published and replaced
 * rows on their own programs because that is what the policy returns. Writing
 * the audience rule here as well would put it in two places, one of which could
 * drift — the reasoning `family/content.ts` already records.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { ContentState } from "@/lib/content/lifecycle"
import type { SectionState } from "@/lib/enrollment/repository"

/** One announcement, with its lifecycle state and staff attribution. */
type AnnouncementRecord = {
  id: string
  programId: string
  programName: string | null
  title: string
  body: string
  state: ContentState
  publishedAt: string | null
  replacedById: string | null
  createdAt: string
  updatedAt: string
}

/* One unbroken literal — PostgREST infers the row type from it, and a
   runtime-built one degrades every column to `GenericStringError`. */
const ANNOUNCEMENT_COLUMNS =
  "id,program_id,title,body,state,published_at,replaced_by_id,created_at,updated_at,programs(name)"

type AnnouncementRow = {
  id: string
  program_id: string
  title: string
  body: string
  state: ContentState
  published_at: string | null
  replaced_by_id: string | null
  created_at: string
  updated_at: string
  programs: { name: string } | null
}

function mapAnnouncement(row: AnnouncementRow): AnnouncementRecord {
  return {
    id: row.id,
    programId: row.program_id,
    programName: row.programs?.name ?? null,
    title: row.title,
    body: row.body,
    state: row.state,
    publishedAt: row.published_at,
    replacedById: row.replaced_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Announcements the viewer may read, newest first.
 *
 * @param programIds - Optional narrowing to specific programs. A narrowing over
 *   an already-authorized set, never the authorization itself.
 * @returns The announcements, or a state explaining why not.
 */
async function listAnnouncements(
  programIds?: string[],
): Promise<SectionState<AnnouncementRecord>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }
  /* An empty authorized set is an empty workspace, not a failed read. Asking
     PostgREST for `in.()` would be a query with no meaning. */
  if (programIds && programIds.length === 0) {
    return { status: "ready", items: [] }
  }

  const supabase = await createClient()

  let query = supabase.from("announcements").select(ANNOUNCEMENT_COLUMNS)
  if (programIds) query = query.in("program_id", programIds)

  const { data, error } = await query
    /* Published before draft before replaced before removed is not what an
       enum sort gives, so ordering is done in application code over a short
       authorized list. Sorting cannot widen it. */
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => mapAnnouncement(row as AnnouncementRow)),
  }
}

/**
 * One announcement by id, or `null` when the viewer may not read it.
 *
 * A row the policy refuses and a row that does not exist both return `null`,
 * and the caller must not distinguish them: a distinguishable "forbidden" tells
 * a prober the record exists.
 *
 * @param announcementId - The announcement's UUID, from a route.
 * @returns The announcement, or `null`.
 */
async function getAnnouncement(
  announcementId: string,
): Promise<AnnouncementRecord | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", announcementId)
    .maybeSingle()

  if (error || !data) return null
  return mapAnnouncement(data as AnnouncementRow)
}

export { getAnnouncement, listAnnouncements }
export type { AnnouncementRecord }
