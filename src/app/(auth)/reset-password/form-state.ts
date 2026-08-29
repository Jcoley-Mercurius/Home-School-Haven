/**
 * Shape and initial value of the new-password form.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions — the same constraint documented in
 * `src/app/(auth)/sign-in/form-state.ts`.
 */

export type ResetPasswordFormState = {
  /**
   * `idle` before submission; `invalid` when a field failed validation;
   * `expired` when the recovery session is gone or was never established;
   * `unavailable` when this environment has no Supabase project connected;
   * `failed` on an unexpected error. Success never reaches a state here — it
   * redirects to the viewer's role home, already signed in.
   */
  status: "idle" | "invalid" | "expired" | "unavailable" | "failed"
  /** No password is ever echoed back, so there are no `values`. */
  fieldErrors: { password?: string; confirmPassword?: string }
}

export const emptyResetPasswordFormState: ResetPasswordFormState = {
  status: "idle",
  fieldErrors: {},
}
