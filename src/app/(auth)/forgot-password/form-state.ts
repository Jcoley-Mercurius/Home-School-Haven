/**
 * Shape and initial value of the password-recovery request form.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions — the same constraint documented in
 * `src/app/(auth)/sign-in/form-state.ts`.
 */

export type ForgotPasswordFormState = {
  /**
   * `idle` before submission; `invalid` when the address failed validation;
   * `sent` when the request was accepted; `throttled` when another email
   * cannot be sent yet; `unavailable` when this environment has no Supabase
   * project connected; `failed` on an unexpected error.
   *
   * There is deliberately no state for "no such account". `sent` is returned
   * for a known and an unknown address alike — see `actions.ts`.
   */
  status: "idle" | "invalid" | "sent" | "throttled" | "unavailable" | "failed"
  fieldErrors: { email?: string }
  /** Echoed so a typo does not cost the whole form. */
  values: { email: string }
}

export const emptyForgotPasswordFormState: ForgotPasswordFormState = {
  status: "idle",
  fieldErrors: {},
  values: { email: "" },
}
