/**
 * Shape and initial value of the sign-in form state.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions — the same constraint documented in
 * `src/app/guidance/form-state.ts`.
 */

export type SignInFormState = {
  /**
   * `idle` before submission; `invalid` when a field failed validation;
   * `rejected` when the credentials did not match; `unavailable` when this
   * environment has no Supabase project connected. A successful sign-in never
   * reaches a state here — it redirects.
   */
  status: "idle" | "invalid" | "rejected" | "unavailable" | "failed"
  fieldErrors: { email?: string; password?: string }
  /**
   * The email is echoed back so a mistyped password does not cost the whole
   * form. The password is never echoed.
   */
  values: { email: string }
}

export const emptySignInFormState: SignInFormState = {
  status: "idle",
  fieldErrors: {},
  values: { email: "" },
}
