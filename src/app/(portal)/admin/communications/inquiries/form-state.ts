/**
 * Shape and initial value of the inquiry triage form state.
 *
 * Outside `actions.ts` for the reason recorded in
 * `src/app/contact/form-state.ts`: a `"use server"` module may only export
 * async functions, so a shared constant exported from there arrives as
 * `undefined` in the client bundle.
 */

export type InquiryActionFormState = {
  /**
   * `updated` is the only success. There is deliberately no state that reports
   * a change nobody made — a refusal by the transition graph is reported as a
   * refusal, not quietly rendered as success (MPS-REQ-021).
   */
  status:
    | "idle"
    | "updated"
    | "invalid"
    | "invalidTransition"
    | "forbidden"
    | "notFound"
    | "unavailable"
    | "failed"
  /** Which drawer should show this outcome. */
  inquiryId: string | null
}

export const emptyInquiryActionFormState: InquiryActionFormState = {
  status: "idle",
  inquiryId: null,
}
