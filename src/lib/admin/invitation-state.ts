/**
 * Invitation lifecycle, as a pure function of a row and a clock
 * (MPS-REQ-011, MPS-REQ-021).
 *
 * WHY EXPIRY IS DERIVED HERE AND IN SQL, AND STORED NOWHERE
 *
 * `public.invitation_state` has three values. "Expired" is the fourth thing an
 * administrator needs to see and the one thing no writer ever sets: nothing in
 * this release sweeps the table, so a stored `expired` would sit unset while
 * the invitation quietly stopped working. Both readers — this module for the
 * administrator's list, `public.family_invitation_status()` for the invited
 * parent's own screen — derive it from `expires_at` instead, so neither can
 * report an invitation as open after it closed.
 *
 * WHY THIS FILE HAS NO IMPORTS
 *
 * It is the decision layer, testable without a database, a session, or a
 * network. `src/lib/admin/invitations.ts` holds the privileged calls; this holds
 * the rules about what a state means and what may be done to it.
 */

/** The three states the database stores. */
export type InvitationState = "pending" | "accepted" | "revoked"

/** What an administrator is shown. `expired` is derived, never stored. */
export type InvitationDisplayState =
  "pending" | "expired" | "accepted" | "revoked"

/** The fields the lifecycle rules actually depend on. */
export type InvitationLifecycle = {
  state: InvitationState
  /** ISO-8601, as PostgREST returns it. */
  expiresAt: string
}

/**
 * The state to show, with expiry folded in.
 * @param invitation - The stored state and expiry.
 * @param now - The moment to judge against; defaults to the current time.
 * @returns The display state.
 */
export function displayState(
  invitation: InvitationLifecycle,
  now: Date = new Date(),
): InvitationDisplayState {
  if (invitation.state !== "pending") return invitation.state

  const expiresAt = Date.parse(invitation.expiresAt)
  /* An unparseable timestamp is treated as expired, not as open. The safe
     direction for an ambiguous credential is closed: an administrator can
     always resend, and a wrongly-open invitation is an account nobody
     authorized today. */
  if (Number.isNaN(expiresAt)) return "expired"

  return expiresAt > now.getTime() ? "pending" : "expired"
}

/**
 * Whether an invitation may be resent.
 *
 * An expired one may — that is MPS-ACC-017's "verification can be safely
 * renewed". An accepted one may not: the account exists and its owner uses
 * password recovery, not a second invitation. A revoked one may not either;
 * reissuing is a fresh decision, made by inviting the address again.
 * @param invitation - The stored state and expiry.
 * @param now - The moment to judge against.
 * @returns `true` when resending is a legitimate move.
 */
export function canResend(
  invitation: InvitationLifecycle,
  now: Date = new Date(),
): boolean {
  const state = displayState(invitation, now)
  return state === "pending" || state === "expired"
}

/**
 * Whether an invitation may be revoked.
 *
 * Only one that was never accepted. Revoking deletes the provisioned account so
 * the emailed link dies with it — doing that to an ACCEPTED invitation would
 * delete a real family's account, which is a retention decision this release
 * does not have (GAP-ADMIN-011). An expired invitation is still revocable: the
 * link no longer works, but the unclaimed account still exists.
 * @param invitation - The stored state and expiry.
 * @param now - The moment to judge against.
 * @returns `true` when revoking is a legitimate move.
 */
export function canRevoke(
  invitation: InvitationLifecycle,
  now: Date = new Date(),
): boolean {
  const state = displayState(invitation, now)
  return state === "pending" || state === "expired"
}

/**
 * The administrator-facing label for a state. Meaning is carried by these
 * words, never by color alone (MDS accessibility, WCAG 2.2 AA).
 * @param state - The display state.
 * @returns The label.
 */
export function invitationStateLabel(state: InvitationDisplayState): string {
  switch (state) {
    case "pending":
      return "Waiting to be accepted"
    case "expired":
      return "Expired"
    case "accepted":
      return "Accepted"
    case "revoked":
      return "Revoked"
  }
}

/**
 * What the state means, in the administrator's terms.
 * @param state - The display state.
 * @returns One sentence of explanation.
 */
export function invitationStateDescription(
  state: InvitationDisplayState,
): string {
  switch (state) {
    case "pending":
      return "The invitation has been sent and the link still works."
    case "expired":
      return "The link no longer works. Resend it to issue a new one."
    case "accepted":
      return "The parent set a password and now has family access."
    case "revoked":
      return "The invitation was withdrawn and its link no longer works."
  }
}

/**
 * The badge tone for a state. Paired with the label above and an icon at the
 * call site — the badge never carries the meaning on its own (MDS DO-DONT
 * "Trust states", WCAG 2.2 AA).
 *
 * `accepted` is the only `success`: this system reserves that tone for
 * something that actually completed, and a waiting invitation has completed
 * nothing. `revoked` is `neutral` rather than a destructive tone — withdrawing
 * an invitation is an ordinary administrative act, not a failure.
 * @param state - The display state.
 * @returns An approved `Badge` tone.
 */
export function invitationStateTone(
  state: InvitationDisplayState,
): "pending" | "limited" | "success" | "neutral" {
  switch (state) {
    case "pending":
      return "pending"
    case "expired":
      return "limited"
    case "accepted":
      return "success"
    case "revoked":
      return "neutral"
  }
}
