"use server"

import { createHash } from "node:crypto"

import { z } from "zod"

import {
  emptyGuidanceFormState,
  MESSAGE_MAX_LENGTH,
  type GuidanceFormState,
} from "./form-state"
import {
  recordGuidanceRequest,
  type GuidanceRequest,
} from "@/lib/contact/recorder"
import { programs } from "@/content/programs"

/**
 * Contact / Request Guidance submission (MPS-REQ-009, MPS-REQ-010,
 * MPS-ACC-012, MPS-ACC-014).
 *
 * All validation happens here, on the server: client input is untrusted
 * (AGENTS.md §11, MTS INTEGRATION-MANIFEST "validate all external and form
 * input at the server boundary"). The client form adds no native constraints,
 * so this path is always exercised.
 *
 * Submitted values are validated, handed to the recording boundary, and
 * discarded. They are never logged, never placed in a URL, and never returned
 * to any other visitor. Only the values the sender typed are echoed back to the
 * sender's own form so a failed submission does not lose their work
 * (MDS-QA manual scenario 8).
 */
const REQUEST_TYPES = ["guidance", "question", "visit", "assistance"] as const

const schema = z.object({
  type: z.enum(REQUEST_TYPES, {
    error: "Choose what you would like help with.",
  }),
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(120, "Enter a shorter name."),
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address we can reply to.")
    .max(254, "Enter a shorter email address.")
    .pipe(
      z.email("Enter a valid email address, for example name@example.com."),
    ),
  phone: z
    .string()
    .trim()
    .max(40, "Enter a shorter phone number.")
    .optional()
    .transform((value) => value || null),
  programSlug: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine(
      (value) => value === null || programs.some((p) => p.slug === value),
      "Choose a published program, or leave this unset.",
    ),
  message: z
    .string()
    .trim()
    .min(1, "Tell us a little about what you are looking for.")
    .max(
      MESSAGE_MAX_LENGTH,
      `Please keep this under ${MESSAGE_MAX_LENGTH} characters.`,
    ),
})

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * Idempotency key for one submission (MPS-ACC-012 "an authorized administrative
 * record is created once").
 *
 * Derived from the content rather than generated, because the duplicates worth
 * collapsing are exactly the ones that are byte-identical: a double-clicked
 * button, a resubmitted form, a retried action, a refreshed POST. Each arrives
 * as a separate server-action invocation, so a freshly generated token would
 * differ every time and defeat the guard it exists to provide.
 *
 * The UTC date is part of the key on purpose. Two identical requests today are
 * one request; the same words sent again next week are a family following up
 * because nobody replied, and that deserves its own record rather than a
 * silently reused reference.
 *
 * The digest is truncated into UUID shape for the `uuid` column. It is a
 * deduplication key, never a secret and never shown to anyone: an inquiry is
 * readable only by an administrator regardless of who holds this value.
 */
function submissionToken(request: {
  type: string
  email: string
  programSlug: string | null
  message: string
}): string {
  const digest = createHash("sha256")
    .update(
      [
        new Date().toISOString().slice(0, 10),
        request.type,
        request.email.toLowerCase(),
        request.programSlug ?? "",
        request.message,
      ].join("\u0000"),
    )
    .digest("hex")

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    ((parseInt(digest[16], 16) & 0x3) | 0x8).toString(16) + digest.slice(17, 20),
    digest.slice(20, 32),
  ].join("-")
}

/**
 * Server action for submitting a guidance request.
 * @param _previous - The previous form state (unused but required by useActionState).
 * @param formData - The submitted form data containing the guidance request.
 * @returns The updated form state with validation errors or submission status.
 */
export async function submitGuidanceRequest(
  _previous: GuidanceFormState,
  formData: FormData,
): Promise<GuidanceFormState> {
  const values = {
    type: readString(formData, "type"),
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    phone: readString(formData, "phone"),
    programSlug: readString(formData, "programSlug"),
    message: readString(formData, "message"),
  }

  const parsed = schema.safeParse(values)

  if (!parsed.success) {
    const fieldErrors: GuidanceFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as keyof GuidanceRequest] = issue.message
      }
    }
    return { status: "invalid", fieldErrors, values }
  }

  const result = await recordGuidanceRequest({
    ...parsed.data,
    submissionToken: submissionToken(parsed.data),
  })

  if (result.status === "recorded") {
    return {
      status: "recorded",
      fieldErrors: {},
      values: emptyGuidanceFormState.values,
      reference: result.reference,
    }
  }

  /* Keep what was typed so the sender can retry or copy it into a call. */
  return { status: result.status, fieldErrors: {}, values }
}
