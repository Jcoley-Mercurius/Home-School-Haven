/**
 * Shape and initial value of the contact request form state.
 *
 * This lives outside `actions.ts` on purpose: a `"use server"` module may only
 * export async functions, so a shared constant exported from there arrives as
 * `undefined` in the client bundle and breaks the first render.
 */
import type { GuidanceRequest } from "@/lib/contact/recorder"

/**
 * Server-side message limit. It lives here rather than in `actions.ts` because
 * the form renders a counter against it, and a `"use server"` module may only
 * export async functions. One constant means the counter and the validation
 * can never disagree (prompt §4, D-C5).
 */
export const MESSAGE_MAX_LENGTH = 2000

export type GuidanceFormState = {
  /**
   * `idle` before submission; `invalid` when validation failed; the remaining
   * values mirror the recorder outcomes. There is deliberately no state that
   * claims success without a record behind it.
   */
  status: "idle" | "invalid" | "recorded" | "unavailable" | "failed"
  fieldErrors: Partial<Record<keyof GuidanceRequest, string>>
  /** Echoed back to the sender only, so a failed attempt loses no typing. */
  values: {
    type: string
    name: string
    email: string
    phone: string
    programSlug: string
    message: string
  }
  reference?: string
}

export const emptyGuidanceFormState: GuidanceFormState = {
  status: "idle",
  fieldErrors: {},
  values: {
    type: "guidance",
    name: "",
    email: "",
    phone: "",
    programSlug: "",
    message: "",
  },
}
