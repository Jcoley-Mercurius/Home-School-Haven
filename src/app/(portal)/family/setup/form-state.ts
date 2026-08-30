/**
 * Family setup form state.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions — the same constraint as `(auth)/sign-in/form-state.ts`.
 */

export type FamilySetupFormState = {
  /**
   * `invalid` is a field problem; `forbidden` is the database refusing the
   * caller; `unavailable` is an environment with no Supabase project; `failed`
   * is everything else. Success never appears here — it redirects to /family.
   */
  status: "idle" | "invalid" | "forbidden" | "unavailable" | "failed"
  fieldErrors: { name?: string }
  /** Echoed so a failed submission does not cost what was typed. */
  values: { name: string }
}

export const emptyFamilySetupFormState: FamilySetupFormState = {
  status: "idle",
  fieldErrors: {},
  values: { name: "" },
}
