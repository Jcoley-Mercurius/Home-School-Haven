/**
 * Field and file shapes for announcement and learning-resource authoring.
 *
 * Kept out of the action modules so the same rule cannot drift between the form
 * and the server, and so it can be unit-tested without a Supabase project.
 *
 * This layer exists to produce a sentence an author can act on. It is NOT the
 * control: every bound here is repeated by the SECURITY DEFINER functions and
 * the column constraints in `20260901000000_program_content_authoring.sql`,
 * which are what a request bypassing this application meets.
 */

import { z } from "zod"

/* A relative import with an explicit extension, not the `@/` alias: this file
   must stay loadable by `node --test`, which does not resolve the alias. Same
   constraint as `admin/validation.ts`. */
import { FILE_BACKED_KINDS } from "./lifecycle.ts"

/* Every bound below matches a database constraint of the same number. Where
   they could disagree, the database is right. */
const TITLE_MAX = 160
const BODY_MAX = 4000
const DESCRIPTION_MAX = 600
const URL_MAX = 2000

/**
 * The approved upload allowlist. Owner decision, 2026-08-31 (GAP-CONTENT-01).
 *
 * Macro-bearing Office container formats, archives, and executables are
 * excluded deliberately: an educator uploads a file that a family later
 * downloads, so the platform is a distribution path and the narrow set is the
 * defensible one for a sanitized review.
 *
 * Restated in three places on purpose — here, the column constraint, and the
 * bucket's `allowed_mime_types`. A request that skips this application still
 * meets the other two.
 */
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const

/** What each allowed type is called, and the extension it is stored under. */
const CONTENT_TYPE_EXTENSIONS: Record<
  (typeof ALLOWED_CONTENT_TYPES)[number],
  string
> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
}

/** Owner decision, 2026-08-31 (GAP-CONTENT-02). 10 MB, stated in bytes. */
const MAX_FILE_BYTES = 10 * 1024 * 1024

/** For the form's help text, so the limit is never written twice as prose. */
const MAX_FILE_LABEL = "10 MB"

const title = z
  .string()
  .trim()
  .min(1, "Enter a title.")
  .max(TITLE_MAX, `Use ${TITLE_MAX} characters or fewer.`)

const announcementSchema = z.object({
  title,
  body: z
    .string()
    .trim()
    .min(1, "Write the announcement.")
    .max(BODY_MAX, `Use ${BODY_MAX} characters or fewer.`),
})

/**
 * A web address for a link-backed resource.
 *
 * `http(s)` only. Anything else — `javascript:`, `data:` — must not reach the
 * database, so the renderer never has to defend against a scheme that was
 * stored. The column constraint says the same, in a regular expression.
 */
const resourceUrl = z
  .string()
  .trim()
  .min(1, "Enter a web address.")
  .max(URL_MAX, `Use ${URL_MAX} characters or fewer.`)
  .refine(
    (value) => /^https?:\/\//.test(value),
    "A web address must start with http:// or https://.",
  )

const description = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, `Use ${DESCRIPTION_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))

/**
 * A resource draft.
 *
 * The URL requirement depends on the kind, so it is checked after the object
 * parses rather than on the field: a file-backed resource that carried a web
 * address would have two media, and the constraint that forbids that is a table
 * constraint, which produces no sentence anyone can act on.
 */
const resourceSchema = z
  .object({
    title,
    description,
    kind: z.enum(["document", "link", "video", "activity", "download"]),
    url: z.string().trim().max(URL_MAX),
  })
  .superRefine((value, ctx) => {
    const fileBacked = (FILE_BACKED_KINDS as readonly string[]).includes(
      value.kind,
    )

    if (fileBacked) {
      if (value.url !== "") {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "A file resource does not take a web address.",
        })
      }
      return
    }

    const parsed = resourceUrl.safeParse(value.url)
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: parsed.error.issues[0]?.message ?? "Enter a web address.",
      })
    }
  })

/** Why a candidate upload was refused, or that it was not. */
type FileCheck =
  | { ok: true; contentType: (typeof ALLOWED_CONTENT_TYPES)[number] }
  | {
      ok: false
      reason: "missing" | "type" | "empty" | "tooLarge"
      message: string
    }

/**
 * Check a candidate upload before anything touches Storage.
 *
 * Takes the size and type as values rather than a `File` so it can be tested
 * without a browser, and so the caller must have measured the REAL byte length
 * rather than trusting a declared one. The distinction matters: `File.type` is
 * client-supplied and a request composed by hand can claim anything.
 *
 * @param input - The candidate's declared type and its real byte length.
 * @returns Whether the upload may proceed, with a sentence when it may not.
 */
function checkUpload(input: {
  contentType: string
  byteLength: number
  hasFile: boolean
}): FileCheck {
  if (!input.hasFile) {
    return { ok: false, reason: "missing", message: "Choose a file to upload." }
  }

  if (input.byteLength <= 0) {
    return {
      ok: false,
      reason: "empty",
      message: "That file is empty. Choose a file with content in it.",
    }
  }

  if (input.byteLength > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "tooLarge",
      message: `That file is larger than ${MAX_FILE_LABEL}. Choose a smaller file.`,
    }
  }

  const allowed = ALLOWED_CONTENT_TYPES.find(
    (type) => type === input.contentType,
  )
  if (!allowed) {
    return {
      ok: false,
      reason: "type",
      /* Names what IS accepted. "Invalid file type" tells an educator they were
         wrong without telling them what would be right. */
      message: "Upload a PDF, PNG, JPEG, or plain text file.",
    }
  }

  return { ok: true, contentType: allowed }
}

export {
  ALLOWED_CONTENT_TYPES,
  BODY_MAX,
  CONTENT_TYPE_EXTENSIONS,
  DESCRIPTION_MAX,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  TITLE_MAX,
  URL_MAX,
  announcementSchema,
  checkUpload,
  resourceSchema,
  resourceUrl,
}
export type { FileCheck }
