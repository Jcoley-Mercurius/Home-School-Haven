"use server"

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
    submittedAt: new Date().toISOString(),
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
