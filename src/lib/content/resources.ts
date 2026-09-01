/**
 * Learning-resource reads (MPS-REQ-019, MPS-ACC-030).
 *
 * Audience is decided by the SELECT policies, not here — the same reasoning
 * `announcements.ts` records. Writes live in `mutations.ts`; there is no write
 * verb on this table for any client role.
 *
 * WHAT A RESOURCE'S "MEDIUM" IS
 *
 * A resource is either an external link or a file in the private
 * `program-resources` bucket, never both — `learning_resources_one_medium`
 * enforces that. So `url` and `storagePath` are modelled as mutually exclusive
 * here too, and `storagePath` is deliberately NOT carried into the type a
 * component receives (see `ResourceRecord`).
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { ContentState, ResourceKind } from "@/lib/content/lifecycle"
import type { SectionState } from "@/lib/enrollment/repository"

/**
 * One learning resource as a surface receives it.
 *
 * `storagePath` IS NOT A FIELD HERE, and its absence is the point. The object
 * key is a server concern: it is used to mint a signed URL and to authorize the
 * download route, and neither needs a browser to know it. A path serialized
 * into an RSC payload would be a durable hint about the bucket's shape in
 * exchange for nothing. `hasFile` carries everything a renderer actually needs.
 */
type ResourceRecord = {
  id: string
  programId: string
  programName: string | null
  title: string
  description: string | null
  kind: ResourceKind
  state: ContentState
  /** `null` for a file-backed resource. Always `http(s)` when present. */
  url: string | null
  /** True when a file is attached and the download route will serve it. */
  hasFile: boolean
  fileName: string | null
  fileSizeBytes: number | null
  contentType: string | null
  replacedById: string | null
  createdAt: string
  updatedAt: string
}

const RESOURCE_COLUMNS =
  "id,program_id,title,description,kind,state,url,storage_path,file_name,file_size_bytes,content_type,replaced_by_id,created_at,updated_at,programs(name)"

type ResourceRow = {
  id: string
  program_id: string
  title: string
  description: string | null
  kind: ResourceKind
  state: ContentState
  url: string | null
  storage_path: string | null
  file_name: string | null
  file_size_bytes: number | null
  content_type: string | null
  replaced_by_id: string | null
  created_at: string
  updated_at: string
  programs: { name: string } | null
}

function mapResource(row: ResourceRow): ResourceRecord {
  return {
    id: row.id,
    programId: row.program_id,
    programName: row.programs?.name ?? null,
    title: row.title,
    description: row.description,
    kind: row.kind,
    state: row.state,
    url: row.url,
    /* The path is consumed here and goes no further. */
    hasFile: row.storage_path !== null,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    contentType: row.content_type,
    replacedById: row.replaced_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Resources the viewer may read, by title.
 *
 * @param programIds - Optional narrowing over an already-authorized set.
 * @returns The resources, or a state explaining why not.
 */
async function listResources(
  programIds?: string[],
): Promise<SectionState<ResourceRecord>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }
  if (programIds && programIds.length === 0) {
    return { status: "ready", items: [] }
  }

  const supabase = await createClient()

  let query = supabase.from("learning_resources").select(RESOURCE_COLUMNS)
  if (programIds) query = query.in("program_id", programIds)

  const { data, error } = await query.order("title")

  if (error) return { status: "failed" }

  return {
    status: "ready",
    items: (data ?? []).map((row) => mapResource(row as ResourceRow)),
  }
}

/**
 * One resource by id, or `null` when the viewer may not read it.
 *
 * Refused and nonexistent are the same answer, for the same reason as
 * `getAnnouncement`.
 * @param resourceId - The resource's UUID, from a route.
 * @returns The resource, or `null`.
 */
async function getResource(resourceId: string): Promise<ResourceRecord | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("learning_resources")
    .select(RESOURCE_COLUMNS)
    .eq("id", resourceId)
    .maybeSingle()

  if (error || !data) return null
  return mapResource(data as ResourceRow)
}

export { getResource, listResources }
export type { ResourceRecord }
