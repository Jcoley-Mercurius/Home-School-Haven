/**
 * Private Storage for program resource files — upload and signed access.
 *
 * MTS INTEGRATION-MANIFEST: "Private program-scoped resources; signed access."
 * MPS-REQ-004: no public visitor or unassigned educator reaches a family's or a
 * program's private material.
 *
 * THE BUCKET IS PRIVATE AND `getPublicUrl` IS NEVER CALLED
 *
 * `program-resources` is created with `public = false` by the migration and
 * declared `public = false` again in `supabase/config.toml`. There is no public
 * object URL to leak, and no call in this module or anywhere else asks for one.
 *
 * NO SERVICE ROLE, ANYWHERE
 *
 * Every call here goes through the request-scoped client from
 * `@/lib/supabase/server`, which carries the publishable key and the viewer's
 * session. So the `storage.objects` policies are the ENFORCING control on both
 * upload and signed-URL issuance, not a control that a privileged key stepped
 * around. A signed URL minted with the service role would be minted for anyone;
 * minted with the viewer's session it can only be minted for an object that
 * viewer may already read.
 *
 * THE PATH IS DERIVED HERE AND NEVER ACCEPTED FROM A BROWSER
 *
 *     <program_id>/<resource_id>/<random>.<ext>
 *
 * The leading program id is what lets the object policies be expressed, but a
 * path is an INDEX, NOT AN AUTHORIZATION: the policies join the object name
 * back to `learning_resources.storage_path` and authorize against that row's
 * program and state. `content_attach_resource_file` independently requires the
 * path to start with the resource's own program and contain its own id, so a
 * request composed by hand cannot bind one program's object to another
 * program's row.
 */

import "server-only"

import { randomUUID } from "node:crypto"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import {
  CONTENT_TYPE_EXTENSIONS,
  type ALLOWED_CONTENT_TYPES,
} from "@/lib/content/validation"

/** The one bucket this release stores anything in. */
const RESOURCE_BUCKET = "program-resources"

/**
 * How long a signed download link lives, in seconds.
 *
 * Sixty seconds, because a signed Supabase URL CANNOT BE REVOKED once issued.
 * That is the honest limit of this design and it is worth stating plainly: if a
 * resource is removed while a link is in flight, that link keeps working until
 * it expires. The mitigations are the short life and the fact that the URL is
 * never persisted anywhere — it exists only in one `Location` header, is
 * re-minted per request, and every mint re-checks authority. The application
 * route stops serving immediately on removal; the already-issued URL is the
 * residual, recorded as RISK-C1.
 */
const SIGNED_URL_TTL_SECONDS = 60

/**
 * Build the object key for a new upload.
 *
 * @param programId - The owning program, from the authorized resource row.
 * @param resourceId - The owning resource, from the authorized resource row.
 * @param contentType - An already-validated content type.
 * @returns The object key, with a random middle segment so a leaked path for
 *   one resource reveals nothing about any other.
 */
function buildStoragePath(
  programId: string,
  resourceId: string,
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number],
): string {
  const extension = CONTENT_TYPE_EXTENSIONS[contentType]
  return `${programId}/${resourceId}/${randomUUID()}.${extension}`
}

/** Why an upload failed, or that it did not. */
type UploadResult =
  | { ok: true; storagePath: string }
  | { ok: false; reason: "unavailable" | "rejected" }

/**
 * Upload a validated file to the private bucket.
 *
 * The caller must have checked authority, type, and REAL byte length first —
 * this function trusts its arguments because everything upstream of it does
 * not. `upsert: false` so an upload can never overwrite an existing object,
 * which combined with the random path segment means a replacement is always a
 * new object and the previous file stays intact for anyone still reading the
 * previous resource.
 *
 * @param input - The derived path, the bytes, and the validated content type.
 * @returns The stored path, or why it failed.
 */
async function uploadResourceFile(input: {
  storagePath: string
  body: ArrayBuffer
  contentType: string
}): Promise<UploadResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }

  const supabase = await createClient()
  const { error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .upload(input.storagePath, input.body, {
      contentType: input.contentType,
      upsert: false,
    })

  /* The message is deliberately not surfaced. A storage error can name the
     bucket and the key, and neither belongs in a message a browser renders. */
  if (error) return { ok: false, reason: "rejected" }

  return { ok: true, storagePath: input.storagePath }
}

/**
 * Delete an object that was just uploaded but could not be registered.
 *
 * THIS IS NOT A RETENTION MECHANISM. It exists for exactly one case: the upload
 * succeeded and `content_attach_resource_file` then refused, which would
 * otherwise leave an object no row references and nothing can find. Removing an
 * orphan that never became content is not the deletion of content, which
 * remains unapproved (GAP-CONTENT-03) and for which no client policy exists.
 *
 * A failure here is swallowed. The caller is already reporting a failure to the
 * author, and an orphaned object is a housekeeping problem, not something to
 * replace that message with.
 *
 * @param storagePath - The object just written.
 */
async function discardOrphanedUpload(storagePath: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const supabase = await createClient()
    await supabase.storage.from(RESOURCE_BUCKET).remove([storagePath])
  } catch {
    /* Best effort. See above. */
  }
}

/**
 * Mint a short-lived signed URL for an object.
 *
 * Called only after the caller has re-derived the viewer, re-checked authority
 * for this specific resource, and confirmed the resource's state permits it.
 * The object policies check all of that again, independently, because this
 * client carries the viewer's own session.
 *
 * The returned URL is never logged, never stored, and never placed in an RSC
 * payload or a template — the one caller puts it in a `Location` header and
 * returns.
 *
 * @param storagePath - The object key, from the authorized resource row.
 * @returns The signed URL, or `null` when it could not be issued.
 */
async function createSignedResourceUrl(
  storagePath: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export {
  RESOURCE_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  buildStoragePath,
  createSignedResourceUrl,
  discardOrphanedUpload,
  uploadResourceFile,
}
export type { UploadResult }
