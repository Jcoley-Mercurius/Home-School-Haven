/**
 * Shape and initial value of the beta-review form states.
 *
 * Outside `actions.ts` for the reason recorded in
 * `src/app/contact/form-state.ts`: a `"use server"` module may only export
 * async functions.
 */

export type ReviewActionStatus =
  | "idle"
  | "updated"
  | "invalid"
  | "invalidTransition"
  | "rejected"
  | "forbidden"
  | "notFound"
  | "unavailable"
  | "failed"

export type ReviewActionFormState = {
  status: ReviewActionStatus
  /** Which signal's panel should show this outcome. */
  signalId: string | null
  fieldErrors: {
    note?: string
    result?: string
    environment?: string
    buildIdentifier?: string
    method?: string
    evidence?: string
  }
}

export const emptyReviewActionFormState: ReviewActionFormState = {
  status: "idle",
  signalId: null,
  fieldErrors: {},
}
