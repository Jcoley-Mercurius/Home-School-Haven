/**
 * Shape and initial value of the invitation-acceptance form.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions — the same constraint documented in
 * `src/app/(auth)/reset-password/form-state.ts`.
 */

export type AcceptInvitationFormState = {
  /**
   * `idle` before submission; `invalid` when a field failed validation;
   * `closed` when the invitation is expired, revoked, already accepted, or
   * absent — one state for all four, because the visitor is not told which;
   * `unavailable` when this environment has no Supabase project connected;
   * `failed` on an unexpected error. Success never reaches a state here — it
   * redirects into the family experience, already signed in.
   */
  status: "idle" | "invalid" | "closed" | "unavailable" | "failed"
  /** No password is ever echoed back, so there are no `values`. */
  fieldErrors: { password?: string; confirmPassword?: string }
}

export const emptyAcceptInvitationFormState: AcceptInvitationFormState = {
  status: "idle",
  fieldErrors: {},
}
