/**
 * Shape and initial value of the family-invitation forms.
 *
 * Outside `actions.ts` because a `"use server"` module may only export async
 * functions — the constraint documented in `src/app/contact/form-state.ts`.
 */

/** The invite form, which is the only one that carries a typed value back. */
export type InviteFamilyFormState = {
  /**
   * `invited` and `resent` are the two successes, and they are distinct: an
   * administrator who typed an address that was already waiting needs to know
   * a new link replaced the old one rather than that a second family was
   * created.
   *
   * `existingAccount` is shown only on this administrator-only surface. No
   * public surface in this release discloses whether an address has an
   * account.
   */
  status:
    | "idle"
    | "invited"
    | "resent"
    | "invalid"
    | "existingAccount"
    | "forbidden"
    | "notConfigured"
    | "unavailable"
    | "failed"
  fieldErrors: { email?: string }
  values: { email: string }
}

export const emptyInviteFamilyFormState: InviteFamilyFormState = {
  status: "idle",
  fieldErrors: {},
  values: { email: "" },
}

/** Resend and revoke, which act on one existing invitation. */
export type InvitationActionFormState = {
  status:
    | "idle"
    | "resent"
    | "revoked"
    | "invalid"
    | "notFound"
    | "notResendable"
    | "notRevocable"
    | "sendLimit"
    | "forbidden"
    | "notConfigured"
    | "unavailable"
    | "failed"
  /** Which invitation this outcome belongs to. */
  invitationId: string | null
}

export const emptyInvitationActionFormState: InvitationActionFormState = {
  status: "idle",
  invitationId: null,
}
