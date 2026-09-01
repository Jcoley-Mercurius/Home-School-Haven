"use server"

/**
 * The authoring server actions (MPS-REQ-019, MPS-REQ-024, MPS-ACC-029/030).
 *
 * WHY THESE ARE SHARED RATHER THAN COPIED BESIDE EACH ROUTE
 *
 * The same four verbs are reached from `/educator/programs/[programId]/…` and
 * from `/admin/communications/…`. Two copies would be two places to get the
 * authorization check right, and the second copy is the one that would
 * eventually be edited without the first. The redirect target differs per
 * surface, so it is a parameter; nothing else about the operation is.
 *
 * THREE CHECKS, AND ONLY THE LAST ONE MATTERS
 *
 *   1. the page guard, which decides what a viewer is shown;
 *   2. `mayAuthorForProgram()` here, which decides what this endpoint does;
 *   3. `private.content_may_author()` inside the writing transaction.
 *
 * A server action is a public HTTP endpoint. It can be invoked directly,
 * without ever loading the page whose guard would have refused, so (1) protects
 * nothing on its own. (2) exists to give a proper response rather than
 * surfacing a database error. (3) is the control — it is the only one a request
 * cannot route around, and it is the reason this file can be read as
 * convenience rather than as security.
 *
 * NOTHING HERE TRUSTS THE FORM FOR AN IDENTITY
 *
 * A form carries a program id, a content id, and an `updated_at`. None is
 * believed: the program id is checked against the viewer's own assignments, the
 * content id is resolved to a row whose OWN program is then checked, and
 * `updated_at` is a concurrency token that can only cause a refusal, never an
 * escalation. The viewer id itself is never in a form at all — it comes from
 * `requireViewer()`, which reads verified JWT claims.
 */

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireViewer } from "@/lib/auth/guards"
import { isUuid, mayAuthorForProgram } from "@/lib/content/authority"
import { getResource } from "@/lib/content/resources"
import { getAnnouncement } from "@/lib/content/announcements"
import { isFileBacked } from "@/lib/content/lifecycle"
import {
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
  type ContentMutation,
} from "@/lib/content/mutations"
import {
  buildStoragePath,
  discardOrphanedUpload,
  uploadResourceFile,
} from "@/lib/content/storage"
import {
  announcementSchema,
  checkUpload,
  resourceSchema,
  type ALLOWED_CONTENT_TYPES,
} from "@/lib/content/validation"

import type {
  AnnouncementFormState,
  ContentFormStatus,
  ResourceFormState,
} from "@/lib/content/form-state"

/**
 * Map a mutation failure to a form status.
 *
 * `forbidden` and `notFound` both become `gone`: the two are different facts
 * internally and the same sentence to a browser.
 * @param result - The failed mutation.
 * @returns The status to render.
 */
function statusFor(result: Extract<ContentMutation, { ok: false }>): {
  status: ContentFormStatus
  message?: string
} {
  switch (result.reason) {
    case "forbidden":
    case "notFound":
      return { status: "gone" }
    case "stale":
      return { status: "stale" }
    case "invalidTransition":
    case "rejected":
      return { status: "rejected", message: result.message }
    default:
      return { status: "failed" }
  }
}

/**
 * Read a form field as a trimmed string.
 * @param formData - The submitted form.
 * @param key - The field name.
 * @returns The value, or `""` when absent.
 */
function field(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * Where to send the author after a successful write.
 *
 * The base path arrives from a hidden field, so it is validated against a
 * literal allowlist of prefixes rather than followed. An unvalidated redirect
 * target from a form is an open redirect, and the fact that only our own pages
 * ever submit this form is not a control.
 * @param formData - The submitted form.
 * @returns A safe in-app path.
 */
function safeBasePath(formData: FormData): string {
  const value = field(formData, "basePath")
  if (/^\/educator\/programs\/[0-9a-f-]{36}$/i.test(value)) return value
  if (value === "/admin/communications") return value
  return "/educator"
}

/**
 * Re-authorize a form submission against the viewer's own authority.
 *
 * @param programId - The program the write targets, already resolved from the
 *   stored row for anything but a create.
 * @returns Whether the write may proceed.
 */
async function authorized(programId: string, returnTo: string) {
  const viewer = await requireViewer(returnTo)
  return mayAuthorForProgram(viewer, programId)
}

/* --------------------------------------------------------------------------
   Announcements
   -------------------------------------------------------------------------- */

/**
 * Create an announcement draft, or replace a published one with a new draft.
 *
 * One action for both because the form is identical and the difference is a
 * single stored fact — whether a predecessor is being superseded. Two actions
 * would be two copies of the same validation.
 * @param _previous - The prior form state, unused.
 * @param formData - The submitted form.
 * @returns The next form state, or a redirect on success.
 */
export async function saveAnnouncementAction(
  _previous: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const values = {
    title: field(formData, "title"),
    body: field(formData, "body"),
    programId: field(formData, "programId"),
  }
  const basePath = safeBasePath(formData)
  const replacesId = field(formData, "replacesId")
  const editsId = field(formData, "editsId")
  const expectedUpdatedAt = field(formData, "expectedUpdatedAt")

  const parsed = announcementSchema.safeParse(values)
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        title: flattened.fieldErrors.title?.[0],
        body: flattened.fieldErrors.body?.[0],
      },
      values,
    }
  }

  /* The program is resolved from the STORED row whenever one exists. The form's
     own `programId` is used only when creating, where there is no row to read
     it from — and even then it is checked against the viewer's assignments
     before anything is written. */
  let programId = values.programId
  if (editsId || replacesId) {
    const existing = await getAnnouncement(editsId || replacesId)
    if (!existing) return { status: "gone", fieldErrors: {}, values }
    programId = existing.programId
  }

  if (!isUuid(programId)) {
    return {
      status: "invalid",
      fieldErrors: { programId: "Choose a program." },
      values,
    }
  }

  if (!(await authorized(programId, basePath))) {
    return { status: "gone", fieldErrors: {}, values }
  }

  let result: ContentMutation
  if (editsId) {
    result = await updateAnnouncementDraft({
      announcementId: editsId,
      expectedUpdatedAt,
      title: parsed.data.title,
      body: parsed.data.body,
    })
  } else if (replacesId) {
    result = await replaceAnnouncement({
      announcementId: replacesId,
      expectedUpdatedAt,
      title: parsed.data.title,
      body: parsed.data.body,
    })
  } else {
    result = await createAnnouncementDraft({
      programId,
      title: parsed.data.title,
      body: parsed.data.body,
    })
  }

  if (!result.ok) {
    return { ...statusFor(result), fieldErrors: {}, values }
  }

  revalidatePath(basePath)
  revalidatePath("/family/announcements")
  revalidatePath("/educator/announcements")

  const target =
    result.outcome === "created" || result.outcome === "replaced"
      ? `${basePath}/announcements/${result.id}`
      : `${basePath}/announcements/${editsId}`

  redirect(target)
}

/**
 * Reduce a mutation failure to a short token for the redirect.
 *
 * A LIFECYCLE MOVE MUST NOT FAIL SILENTLY.
 *
 * These actions return `void` and redirect, so there is no form state to carry
 * a message. Without this, a refused publish redirected back to an unchanged
 * page and the author was left to infer from a missing badge that anything had
 * happened at all — which MPS-REQ-021 forbids: every state needs to be
 * observable and to state a recovery.
 *
 * A TOKEN, NOT THE DATABASE'S SENTENCE. The message stays out of the URL: a URL
 * is logged, shared, and kept in history, and text placed there is text that
 * escapes the page. The manage page turns the token back into a sentence.
 *
 * @param result - The failed mutation.
 * @returns The token to append as `?refused=`.
 */
function refusalToken(result: Extract<ContentMutation, { ok: false }>): string {
  switch (result.reason) {
    case "stale":
      return "stale"
    case "forbidden":
    case "notFound":
      return "gone"
    case "invalidTransition":
    case "rejected":
      return "refused"
    default:
      return "failed"
  }
}

/**
 * Publish or remove an announcement.
 *
 * A lifecycle move carries no editable content, so it needs no field validation
 * and no echoed values — only the id, the concurrency token, and which move.
 * @param formData - The submitted form.
 */
export async function announcementLifecycleAction(
  formData: FormData,
): Promise<void> {
  const announcementId = field(formData, "announcementId")
  const expectedUpdatedAt = field(formData, "expectedUpdatedAt")
  const move = field(formData, "move")
  const basePath = safeBasePath(formData)

  if (!isUuid(announcementId)) redirect(basePath)

  const existing = await getAnnouncement(announcementId)
  if (!existing) redirect(basePath)

  if (!(await authorized(existing.programId, basePath))) redirect(basePath)

  let result: ContentMutation | null = null
  if (move === "publish") {
    result = await publishAnnouncement({ announcementId, expectedUpdatedAt })
  } else if (move === "remove") {
    result = await removeAnnouncement({ announcementId, expectedUpdatedAt })
  }

  revalidatePath(basePath)
  revalidatePath("/family/announcements")
  revalidatePath("/educator/announcements")

  const target = `${basePath}/announcements/${announcementId}`
  redirect(
    result && !result.ok ? `${target}?refused=${refusalToken(result)}` : target,
  )
}

/* --------------------------------------------------------------------------
   Learning resources
   -------------------------------------------------------------------------- */

/**
 * Create a resource draft, edit one, or replace a published one.
 * @param _previous - The prior form state, unused.
 * @param formData - The submitted form.
 * @returns The next form state, or a redirect on success.
 */
export async function saveResourceAction(
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const values = {
    title: field(formData, "title"),
    description: field(formData, "description"),
    url: field(formData, "url"),
    kind: field(formData, "kind") || "link",
    programId: field(formData, "programId"),
  }
  const basePath = safeBasePath(formData)
  const replacesId = field(formData, "replacesId")
  const editsId = field(formData, "editsId")
  const expectedUpdatedAt = field(formData, "expectedUpdatedAt")

  const parsed = resourceSchema.safeParse(values)
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      fieldErrors: {
        title: flattened.fieldErrors.title?.[0],
        description: flattened.fieldErrors.description?.[0],
        url: flattened.fieldErrors.url?.[0],
        kind: flattened.fieldErrors.kind?.[0],
      },
      values,
    }
  }

  let programId = values.programId
  if (editsId || replacesId) {
    const existing = await getResource(editsId || replacesId)
    if (!existing) return { status: "gone", fieldErrors: {}, values }
    programId = existing.programId
  }

  if (!isUuid(programId)) {
    return {
      status: "invalid",
      fieldErrors: { programId: "Choose a program." },
      values,
    }
  }

  if (!(await authorized(programId, basePath))) {
    return { status: "gone", fieldErrors: {}, values }
  }

  const url = parsed.data.url === "" ? null : parsed.data.url

  let result: ContentMutation
  if (editsId) {
    result = await updateResourceDraft({
      resourceId: editsId,
      expectedUpdatedAt,
      title: parsed.data.title,
      description: parsed.data.description,
      url,
    })
  } else if (replacesId) {
    result = await replaceResource({
      resourceId: replacesId,
      expectedUpdatedAt,
      title: parsed.data.title,
      description: parsed.data.description,
      url,
    })
  } else {
    result = await createResourceDraft({
      programId,
      title: parsed.data.title,
      description: parsed.data.description,
      kind: parsed.data.kind,
      url,
    })
  }

  if (!result.ok) {
    return { ...statusFor(result), fieldErrors: {}, values }
  }

  revalidatePath(basePath)
  revalidatePath("/family/resources")
  revalidatePath("/educator/resources")

  const target =
    result.outcome === "created" || result.outcome === "replaced"
      ? `${basePath}/resources/${result.id}`
      : `${basePath}/resources/${editsId}`

  redirect(target)
}

/**
 * Upload a file and register it against its draft.
 *
 * THE ORDER OF CHECKS IS THE DESIGN
 *
 *   1. resolve the draft, and take its program FROM THE ROW;
 *   2. re-authorize against that program;
 *   3. read the bytes and measure their REAL length — `File.type` and any
 *      declared size are client-supplied and a hand-composed request can claim
 *      anything, so the measurement is what is checked;
 *   4. derive the path from the row's own program and id — the browser neither
 *      supplies nor sees a storage path;
 *   5. upload;
 *   6. register through the RPC, which independently re-checks the path, the
 *      size, and the type.
 *
 * If (6) refuses, the object written at (5) is discarded, so a rejected upload
 * leaves no file nothing references.
 *
 * @param _previous - The prior form state, unused.
 * @param formData - The submitted form, carrying the file.
 * @returns The next form state, or a redirect on success.
 */
export async function uploadResourceFileAction(
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resourceId = field(formData, "resourceId")
  const expectedUpdatedAt = field(formData, "expectedUpdatedAt")
  const basePath = safeBasePath(formData)
  const blank = {
    title: "",
    description: "",
    url: "",
    kind: "document",
    programId: "",
  }

  if (!isUuid(resourceId)) {
    return { status: "gone", fieldErrors: {}, values: blank }
  }

  const existing = await getResource(resourceId)
  if (!existing) return { status: "gone", fieldErrors: {}, values: blank }

  if (!(await authorized(existing.programId, basePath))) {
    return { status: "gone", fieldErrors: {}, values: blank }
  }

  if (!isFileBacked(existing.kind)) {
    return {
      status: "rejected",
      fieldErrors: { file: "This resource is a link, not a file." },
      values: blank,
    }
  }

  const candidate = formData.get("file")
  const file = candidate instanceof File ? candidate : null
  const body = file ? await file.arrayBuffer() : new ArrayBuffer(0)

  const check = checkUpload({
    contentType: file?.type ?? "",
    /* The measured length, not a declared one. */
    byteLength: body.byteLength,
    hasFile: file !== null && file.size > 0,
  })

  if (!check.ok) {
    return {
      status: "invalid",
      fieldErrors: { file: check.message },
      values: blank,
    }
  }

  const storagePath = buildStoragePath(
    existing.programId,
    existing.id,
    check.contentType as (typeof ALLOWED_CONTENT_TYPES)[number],
  )

  const uploaded = await uploadResourceFile({
    storagePath,
    body,
    contentType: check.contentType,
  })

  if (!uploaded.ok) {
    return {
      status: uploaded.reason === "unavailable" ? "unavailable" : "failed",
      fieldErrors: {
        file: "The file could not be uploaded. Nothing was saved — please try again.",
      },
      values: blank,
    }
  }

  const registered = await attachResourceFile({
    resourceId,
    expectedUpdatedAt,
    storagePath,
    /* The original name, for the download's filename. Not the stored key. */
    fileName: file?.name ?? "file",
    byteLength: body.byteLength,
    contentType: check.contentType,
  })

  if (!registered.ok) {
    await discardOrphanedUpload(storagePath)
    const mapped = statusFor(registered)
    return {
      ...mapped,
      fieldErrors: { file: mapped.message },
      values: blank,
    }
  }

  revalidatePath(basePath)
  redirect(`${basePath}/resources/${resourceId}`)
}

/**
 * Publish or remove a resource.
 * @param formData - The submitted form.
 */
export async function resourceLifecycleAction(
  formData: FormData,
): Promise<void> {
  const resourceId = field(formData, "resourceId")
  const expectedUpdatedAt = field(formData, "expectedUpdatedAt")
  const move = field(formData, "move")
  const basePath = safeBasePath(formData)

  if (!isUuid(resourceId)) redirect(basePath)

  const existing = await getResource(resourceId)
  if (!existing) redirect(basePath)

  if (!(await authorized(existing.programId, basePath))) redirect(basePath)

  let result: ContentMutation | null = null
  if (move === "publish") {
    result = await publishResource({ resourceId, expectedUpdatedAt })
  } else if (move === "remove") {
    result = await removeResource({ resourceId, expectedUpdatedAt })
  }

  revalidatePath(basePath)
  revalidatePath("/family/resources")
  revalidatePath("/educator/resources")

  const target = `${basePath}/resources/${resourceId}`
  redirect(
    result && !result.ok ? `${target}?refused=${refusalToken(result)}` : target,
  )
}
