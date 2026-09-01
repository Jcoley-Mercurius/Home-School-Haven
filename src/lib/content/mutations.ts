/**
 * The authoring calls — every write this slice can make (MPS-REQ-019,
 * MPS-REQ-024).
 *
 * Each function is a thin caller over a SECURITY DEFINER database function.
 * There is no `.insert()`, `.update()`, or `.delete()` anywhere in this module,
 * and none can be added: `public.announcements` and `public.learning_resources`
 * grant no client role a write verb. What looks like a convenience layer is the
 * only door.
 *
 * `expectedUpdatedAt` is the optimistic-concurrency contract
 * `admin_update_program_facts` established. A second author who loaded the item
 * before the first one saved is refused with `stale` rather than silently
 * overwriting an edit they never saw.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { ResourceKind } from "@/lib/content/lifecycle"

/**
 * The outcome of an authoring call.
 *
 * `forbidden` and `notFound` are deliberately different values internally and
 * deliberately rendered the same way, so a response never confirms that a
 * record exists to someone who may not see it. Same contract as
 * `admin/programs.ts`.
 */
type ContentMutation =
  | { ok: true; outcome: "updated" | "published" | "removed" | "attached" }
  | { ok: true; outcome: "created" | "replaced"; id: string }
  | {
      ok: false
      reason:
        | "forbidden"
        | "notFound"
        | "stale"
        | "invalidTransition"
        | "rejected"
        | "failed"
      /** Safe to show. Never echoes a submitted value or a database detail. */
      message?: string
    }

/**
 * Map a PostgREST error to a mutation outcome.
 *
 * The SQLSTATEs are the ones the migration raises deliberately, so each has a
 * meaning rather than being a guess at what went wrong.
 * @param code - The PostgREST error code.
 * @param message - The database message, written to be read by an author.
 * @returns The failed mutation result.
 */
function mapError(
  code: string | undefined,
  message: string | undefined,
): ContentMutation {
  switch (code) {
    case "42501":
      return { ok: false, reason: "forbidden" }
    case "P0002":
      return { ok: false, reason: "notFound" }
    /* PostgREST's pass-through convention: HTTP 409, code intact. NOT 40001 —
       PostgREST treats SQLSTATE class 40 as a transient upstream failure,
       swallows the code entirely, and answers "The upstream server is timing
       out", which would report a recoverable conflict as a server fault. See
       the note in the migration. */
    case "PT409":
      return { ok: false, reason: "stale" }
    case "23514":
      return { ok: false, reason: "invalidTransition", message }
    /* 22023 is raised only by the explicit `raise exception` calls in the
       migration, whose messages are written for an author to act on. */
    case "22023":
      return { ok: false, reason: "rejected", message }
    default:
      return { ok: false, reason: "failed" }
  }
}

async function client() {
  return createClient()
}

/* --------------------------------------------------------------------------
   Announcements
   -------------------------------------------------------------------------- */

/** A new announcement draft. Nothing reaches a family until it is published. */
async function createAnnouncementDraft(input: {
  programId: string
  title: string
  body: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { data, error } = await supabase.rpc(
    "content_create_announcement_draft",
    {
      target_program: input.programId,
      announcement_title: input.title,
      announcement_body: input.body,
    },
  )

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "created", id: data as string }
}

/** Edit a draft in place. A published announcement is replaced, never edited. */
async function updateAnnouncementDraft(input: {
  announcementId: string
  expectedUpdatedAt: string
  title: string
  body: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_update_announcement_draft", {
    target_id: input.announcementId,
    expected_updated_at: input.expectedUpdatedAt,
    announcement_title: input.title,
    announcement_body: input.body,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "updated" }
}

/** Publish a draft. The moment enrolled families can read it. */
async function publishAnnouncement(input: {
  announcementId: string
  expectedUpdatedAt: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_publish_announcement", {
    target_id: input.announcementId,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "published" }
}

/** Supersede a published announcement with a new draft, preserving the original. */
async function replaceAnnouncement(input: {
  announcementId: string
  expectedUpdatedAt: string
  title: string
  body: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { data, error } = await supabase.rpc("content_replace_announcement", {
    target_id: input.announcementId,
    expected_updated_at: input.expectedUpdatedAt,
    announcement_title: input.title,
    announcement_body: input.body,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "replaced", id: data as string }
}

/** Withdraw. Access is revoked; the record is retained (GAP-CONTENT-03). */
async function removeAnnouncement(input: {
  announcementId: string
  expectedUpdatedAt: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_remove_announcement", {
    target_id: input.announcementId,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "removed" }
}

/* --------------------------------------------------------------------------
   Learning resources
   -------------------------------------------------------------------------- */

/** A new resource draft. A file-backed kind gets its file in a second step. */
async function createResourceDraft(input: {
  programId: string
  title: string
  description: string | null
  kind: ResourceKind
  url: string | null
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  /* `null` travels as `""`. A PostgreSQL function argument carries no
     nullability, so the generated types call each of these `string`; the
     function converts an empty argument back to NULL. Lossless, because `""`
     is not a value this product stores. */
  const { data, error } = await supabase.rpc("content_create_resource_draft", {
    target_program: input.programId,
    resource_title: input.title,
    resource_description: input.description ?? "",
    resource_kind: input.kind,
    resource_url: input.url ?? "",
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "created", id: data as string }
}

/** Register an uploaded object against its draft. */
async function attachResourceFile(input: {
  resourceId: string
  expectedUpdatedAt: string
  storagePath: string
  fileName: string
  byteLength: number
  contentType: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_attach_resource_file", {
    target_id: input.resourceId,
    expected_updated_at: input.expectedUpdatedAt,
    object_path: input.storagePath,
    original_file_name: input.fileName,
    object_size_bytes: input.byteLength,
    object_content_type: input.contentType,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "attached" }
}

/** Edit a resource draft in place. The kind is not editable — see the migration. */
async function updateResourceDraft(input: {
  resourceId: string
  expectedUpdatedAt: string
  title: string
  description: string | null
  url: string | null
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_update_resource_draft", {
    target_id: input.resourceId,
    expected_updated_at: input.expectedUpdatedAt,
    resource_title: input.title,
    resource_description: input.description ?? "",
    resource_url: input.url ?? "",
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "updated" }
}

/** Publish a resource draft. Refused for a file-backed draft with no file. */
async function publishResource(input: {
  resourceId: string
  expectedUpdatedAt: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_publish_resource", {
    target_id: input.resourceId,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "published" }
}

/** Supersede a published resource with a new draft of the same kind. */
async function replaceResource(input: {
  resourceId: string
  expectedUpdatedAt: string
  title: string
  description: string | null
  url: string | null
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { data, error } = await supabase.rpc("content_replace_resource", {
    target_id: input.resourceId,
    expected_updated_at: input.expectedUpdatedAt,
    resource_title: input.title,
    resource_description: input.description ?? "",
    resource_url: input.url ?? "",
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "replaced", id: data as string }
}

/** Withdraw. Revokes the row AND, through the object policy, the file. */
async function removeResource(input: {
  resourceId: string
  expectedUpdatedAt: string
}): Promise<ContentMutation> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await client()
  const { error } = await supabase.rpc("content_remove_resource", {
    target_id: input.resourceId,
    expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapError(error.code, error.message)
  return { ok: true, outcome: "removed" }
}

export {
  attachResourceFile,
  createAnnouncementDraft,
  createResourceDraft,
  publishAnnouncement,
  publishResource,
  removeAnnouncement,
  removeResource,
  replaceAnnouncement,
  replaceResource,
  updateAnnouncementDraft,
  updateResourceDraft,
}
export type { ContentMutation }
