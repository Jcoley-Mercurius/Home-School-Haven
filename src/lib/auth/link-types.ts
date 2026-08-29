/**
 * Which emailed link types `/auth/confirm` will act on.
 *
 * `verifyOtp` takes a `type` that arrives in a URL, so it is attacker-chosen
 * input. Only the types this release actually sends are honoured. Anything else
 * is refused before it reaches Supabase — including `magiclink`, which would be
 * a password-free sign-in that this release does not offer and that no approved
 * artifact authorizes.
 *
 * `signup` and `invite` are listed because an administrator provisioning an
 * account through Supabase produces those links, and a provisioned adult must
 * not hit a dead link. Accepting a link type is not an invitation or
 * self-registration policy: nothing here sends an invitation, creates an
 * account, or grants a permission. MPS-REQ-011 account creation and ACT-007
 * (invited secondary guardian) remain unresolved product gaps.
 */

import type { EmailOtpType } from "@supabase/supabase-js"

const ACCEPTED = [
  "recovery",
  "invite",
  "signup",
  "email_change",
] as const satisfies readonly EmailOtpType[]

export type AcceptedLinkType = (typeof ACCEPTED)[number]

/** The link type, or `null` when absent or outside the allow-list. */
export function parseLinkType(raw: unknown): AcceptedLinkType | null {
  if (typeof raw !== "string") return null
  return (ACCEPTED as readonly string[]).includes(raw)
    ? (raw as AcceptedLinkType)
    : null
}

/**
 * A recovery link is the only one that may open the reset form. An invite or
 * confirmation link establishes a session and goes to role routing instead:
 * those visitors were given a password rather than asking to replace one.
 */
export function isRecovery(type: AcceptedLinkType | null): boolean {
  return type === "recovery"
}
