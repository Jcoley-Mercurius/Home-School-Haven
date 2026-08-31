/**
 * Announcement and learning-resource reads for the educator workspace
 * (MPS-REQ-018, MPS-REQ-019, MPS-ACC-030).
 *
 * READ ONLY, BY CONSTRUCTION
 *
 * There are no write functions, and there is no write to add: neither
 * `public.announcements` nor `public.learning_resources` grants any client role
 * INSERT, UPDATE, or DELETE, and neither carries a write policy. MPS-REQ-019's
 * authoring half — create, publish, replace, remove — is a later slice with its
 * own approved prompt. This is the half that reads.
 *
 * DRAFTS ARE SHOWN, AND SHOWN AS DRAFTS
 *
 * The family policies filter on `published`; the educator policies deliberately
 * do not, so an educator sees unpublished rows on their own programs. That is
 * surfaced rather than suppressed: MDS `announcement` lists `educator_draft`
 * among its approved variants, and MPS-REQ-019 requires "a visible content
 * state". Silently dropping a draft would tell an educator their program has no
 * announcement when it has one; rendering it like a published one would tell
 * them families can read it. Both are worse than saying which it is.
 *
 * SCOPING
 *
 * Both reads are bounded by the program ids the caller has already proven the
 * viewer holds. The `.in()` is a narrowing over an authorized set, not the
 * authorization itself — `announcements_select_assigned_educator` and
 * `learning_resources_select_assigned_educator` decide that independently, and
 * a forged request reaching PostgREST directly meets them and nothing else.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type {
  EducatorAnnouncement,
  EducatorResource,
} from "@/lib/educator/workspace-state"
import type { SectionState } from "@/lib/enrollment/repository"

/**
 * Announcements on the given assigned programs, newest published first.
 *
 * @param programIds - Program ids the viewer's assignment already authorized.
 * @returns The announcements, or a state explaining why not.
 */
async function listEducatorAnnouncements(
  programIds: string[],
): Promise<SectionState<EducatorAnnouncement>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }
  /* No assignments is an empty workspace, not a failed read. Asking PostgREST
     for `in.()` would be a query with no meaning. */
  if (programIds.length === 0) return { status: "ready", items: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,published,published_at,program_id,programs(name)")
    .in("program_id", programIds)
    /* Published first, newest first; drafts last. A draft has no
       `published_at`, so ordering on that column alone would float it to the
       top of "Recent announcements" — and an educator cannot act on a draft in
       this release, so leading with one buries the notice families can
       actually see. */
    .order("published", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      published: row.published,
      publishedAt: row.published_at,
      programId: row.program_id,
      programName: row.programs?.name ?? null,
    })),
  }
}

/**
 * Learning resources on the given assigned programs, by title.
 *
 * @param programIds - Program ids the viewer's assignment already authorized.
 * @returns The resources, or a state explaining why not.
 */
async function listEducatorResources(
  programIds: string[],
): Promise<SectionState<EducatorResource>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }
  if (programIds.length === 0) return { status: "ready", items: [] }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("learning_resources")
    .select("id,title,description,url,published,program_id,programs(name)")
    .in("program_id", programIds)
    /* Published first, then by title, for the same reason as announcements. */
    .order("published", { ascending: false })
    .order("title")

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      published: row.published,
      programId: row.program_id,
      programName: row.programs?.name ?? null,
    })),
  }
}

export { listEducatorAnnouncements, listEducatorResources }
