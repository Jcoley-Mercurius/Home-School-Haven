/**
 * Shape and initial value of the Request Guidance form state.
 *
 * This lives outside `actions.ts` on purpose: a `"use server"` module may only
 * export async functions, so a shared constant exported from there arrives as
 * `undefined` in the client bundle and breaks the first render.
 */
import type { GuidanceRequest } from "@/lib/guidance/recorder"

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
