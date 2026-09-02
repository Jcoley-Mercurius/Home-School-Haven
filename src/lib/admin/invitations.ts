/**
 * Invite-only family provisioning (MPS-REQ-011, MPS-ACC-015/016/017,
 * MPS-REQ-021, MPS-REQ-024).
 *
 * APPROVED PRODUCT DECISION, 2026-09-02
 *
 * Only an authorized administrator may invite a family. There is no public
 * self-service signup — `[auth].enable_signup` stays false — and an invitation
 * may produce the `parent` role and nothing else.
 *
 * THE ONLY MODULE THAT TOUCHES THE ADMIN API
 *
 * Creating an account while public signup is disabled has exactly one possible
 * mechanism, and this file is where it lives. Read `@/lib/supabase/admin` for
 * why the secret key exists at all. The rule that keeps the blast radius small:
 *
 *   * The privileged client makes TWO kinds of call, both against
 *     `auth.users` — `inviteUserByEmail` and `deleteUser`. It never reads or
 *     writes an application table.
 *   * Every application read and write below goes through the ordinary
 *     RLS-filtered server client. So administrator authority is still decided
 *     by `private.is_admin()` in the database, exactly as on every other admin
 *     surface, and is never assumed from possession of the key.
 *
 * THREE INDEPENDENT REFUSALS PROTECT AN ESTABLISHED ACCOUNT
 *
 * Deleting an account is the one irreversible thing this module can do, so the
 * refusals are layered and none of them is load-bearing alone:
 *
 *   1. Both callers refuse an invitation that is not `pending`.
 *   2. `accountIsEstablished()` refuses an account holding a role grant or a
 *      family membership, whatever the invitation row says — and answers
 *      "established" when it cannot tell.
 *   3. `family_invitations_state_consistent` in Postgres refuses to mark an
 *      accepted invitation revoked at all, so a forged request that never
 *      reaches this file meets the same rule.
 *
 * WHY REVOKE DELETES THE ACCOUNT
 *
 * The invitation token lives in `auth.users`, not in `family_invitations`.
 * Marking a row revoked would leave the emailed link working. So revoking (and
 * the first half of resending) deletes the UNACCEPTED account, which is what
 * actually kills the link; the row stays behind as history with
 * `invited_user_id` set to NULL by the FK. An accepted invitation is never
 * revoked here — that would delete a real family's account, and retention is an
 * unresolved owner decision (GAP-ADMIN-011).
 *
 * ONE CLOCK, NOT TWO
 *
 * `INVITATION_WINDOW_SECONDS` deliberately equals `auth.email.otp_expiry` in
 * `supabase/config.toml`. The emailed link and the invitation record then die
 * together, so the administrator's list cannot show "waiting" over a link that
 * stopped working an hour ago.
 *
 * One hour is the APPROVED Foundation Demo limitation (MPS DEC-023). An expired
 * invitation is resent rather than extended, which is also what exercises
 * MPS-ACC-017. Changing it is not a code decision: `otp_expiry` is shared with
 * password recovery, whose approved one-hour lifetime must not move.
 *
 * WHAT NEVER LEAVES THIS MODULE
 *
 * No token, no action link, and no secret is returned, rendered, or logged.
 * Errors from the Admin API are inspected for a status code and then dropped —
 * an error object can carry the request that produced it, and that request
 * holds a credential.
 */

import "server-only"

import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { createAdminClient, isAdminApiConfigured } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { displayState } from "@/lib/admin/invitation-state"

import type { AdminRead } from "@/lib/admin/repository"
import type {
  InvitationDisplayState,
  InvitationState,
} from "@/lib/admin/invitation-state"

/**
 * How long an invitation stays open: one hour, the approved Foundation Demo
 * limitation (MPS DEC-023). Equal to `auth.email.otp_expiry` by construction —
 * see the module note.
 */
export const INVITATION_WINDOW_SECONDS = 3600

/** An invitation as the administrator's list shows it. */
export type AdminInvitation = {
  id: string
  /** The invited adult's address. Administrator-only, never public. */
  email: string
  state: InvitationDisplayState
  createdAt: string
  expiresAt: string
  lastSentAt: string
  sentCount: number
  acceptedAt: string | null
  revokedAt: string | null
}

/**
 * The outcome of an invitation action.
 *
 * `existingAccount` is reported ONLY to an already-authorized administrator, on
 * a surface they reached through `requireAdmin()`. No public surface in this
 * release discloses whether an address has an account, and nothing here changes
 * that (the sign-in and recovery forms still answer identically either way).
 */
export type InvitationResult =
  | { ok: true; outcome: "invited" | "resent" | "revoked"; id: string }
  | {
      ok: false
      reason:
        | "unavailable"
        | "notConfigured"
        | "forbidden"
        | "notFound"
        | "existingAccount"
        | "notResendable"
        | "notRevocable"
        | "sendLimit"
        | "failed"
    }

type InvitationRow = {
  id: string
  email: string
  invited_user_id: string | null
  state: InvitationState
  created_at: string
  expires_at: string
  last_sent_at: string
  sent_count: number
  accepted_at: string | null
  revoked_at: string | null
}

/* One unbroken literal — PostgREST infers the row type from it. */
// prettier-ignore
const SELECT_COLUMNS = "id,email,invited_user_id,state,created_at,expires_at,last_sent_at,sent_count,accepted_at,revoked_at"

/** Where the emailed invitation lands. */
function acceptCallback(): string {
  const callback = new URL("/auth/confirm", siteUrl())
  callback.searchParams.set("next", "/invitation/accept")
  return callback.toString()
}

function nextExpiry(): string {
  return new Date(Date.now() + INVITATION_WINDOW_SECONDS * 1000).toISOString()
}

/** Addresses are compared and stored in one case, so one address is one row. */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function toAdminInvitation(row: InvitationRow): AdminInvitation {
  return {
    id: row.id,
    email: row.email,
    state: displayState({ state: row.state, expiresAt: row.expires_at }),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSentAt: row.last_sent_at,
    sentCount: row.sent_count,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }
}

/**
 * Every invitation, newest first.
 *
 * Reach comes from `family_invitations_select_admin`, evaluated against the
 * verified session — an educator or a parent running this exact query gets
 * nothing, because no policy could return them a row.
 * @returns The invitation list, or a distinguishable unavailable/failed state.
 */
export async function listInvitations(): Promise<AdminRead<AdminInvitation[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("family_invitations")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { status: "failed" }

  return { status: "ready", data: (data ?? []).map(toAdminInvitation) }
}

/** The pending invitation for an address, if there is one. */
async function findPending(email: string): Promise<InvitationRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("family_invitations")
    .select(SELECT_COLUMNS)
    .eq("email", email)
    .eq("state", "pending")
    .maybeSingle()

  return data ?? null
}

/**
 * Sends an invitation email and returns the account it provisioned.
 *
 * The Admin API refuses an address that already has an account, and that
 * refusal is the duplicate check (MPS-ACC-016): it is atomic, and it consults
 * `auth.users`, which application code cannot read.
 */
async function sendInvite(
  email: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; reason: "existingAccount" | "failed" }
> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: acceptCallback(),
    })

    if (error) {
      /* 422 is "already registered". Read from the status code rather than the
         message so an upstream wording change cannot silently reclassify a
         duplicate as an outage. */
      return {
        ok: false,
        reason: error.status === 422 ? "existingAccount" : "failed",
      }
    }

    if (!data?.user?.id) return { ok: false, reason: "failed" }

    return { ok: true, userId: data.user.id }
  } catch {
    /* Not logged: the error can carry the request, and the request holds a
       credential and an email address. */
    return { ok: false, reason: "failed" }
  }
}

/**
 * Whether an account has become a real participant in the platform.
 *
 * A role grant or a family membership means somebody accepted, was given
 * access, and may already own records. `accept_family_invitation()` grants
 * `parent` in the same statement that marks the invitation accepted, so in
 * ordinary operation "established" and "accepted" arrive together — this is the
 * check for when they do not: a half-completed acceptance, a grant made by an
 * administrator through the CLI, a row edited by hand.
 *
 * Both reads go through the RLS-filtered client. An administrator may read
 * every role grant (`user_roles_select_admin`) and every family membership
 * (`family_members_select_admin`), so a `true` here is a real observation.
 *
 * A failed read answers `true`. Not knowing whether an account is established
 * is not permission to delete it.
 */
async function accountIsEstablished(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const [roles, memberships] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1),
      supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", userId)
        .limit(1),
    ])

    if (roles.error || memberships.error) return true

    return (roles.data?.length ?? 0) > 0 || (memberships.data?.length ?? 0) > 0
  } catch {
    return true
  }
}

/**
 * Deletes an account that was provisioned but never accepted, which is what
 * invalidates its outstanding invitation link.
 *
 * THE LAST GUARD BEFORE AN IRREVERSIBLE ACT
 *
 * Callers already refuse a non-pending invitation, and the database refuses to
 * mark an accepted invitation revoked. This is the third check, and it looks at
 * the ACCOUNT rather than the invitation: an account holding a role grant or a
 * family membership is a person using the platform, and deleting one is a
 * retention decision this release does not have (GAP-ADMIN-011). It is refused
 * here even if every check above it were wrong.
 *
 * @returns `false` when the account was not deleted — because the delete
 *   failed, or because it was refused — so the caller can decline to report a
 *   revoke or a resend that did not happen.
 */
async function deleteUnacceptedAccount(userId: string): Promise<boolean> {
  if (await accountIsEstablished(userId)) return false

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    /* An account that is already gone is the state we wanted. */
    return !error || error.status === 404
  } catch {
    return false
  }
}

/**
 * Closes an invitation whose link was destroyed but whose replacement could not
 * be sent.
 *
 * This is the partial failure that matters: `resendInvitation` deletes the old
 * account first, so between that delete and a successful send the invitation is
 * pending with no working link. Left alone, the administrator's list would say
 * "waiting to be accepted" over a link that no longer exists.
 *
 * Setting `expires_at` to now makes the row read as **Expired** — derived, not
 * stored — which is both true and actionable: Expired offers Resend. The row is
 * never marked accepted or revoked, because neither happened.
 *
 * Best effort by design. If this update also fails, the invitation is left
 * pending and the next resend still recovers it; nothing here may throw over
 * the failure it is cleaning up after.
 */
async function closeUnsendableInvitation(invitationId: string): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from("family_invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("state", "pending")
  } catch {
    /* Not logged, and not escalated. */
  }
}

/**
 * Invites one family (MPS-REQ-011).
 *
 * Idempotent by design: a second invitation for an address that is already
 * waiting resends the existing one rather than creating a second record. The
 * database enforces the same rule with a unique partial index, so a
 * double-clicked button, a retried action, or two administrators working the
 * same list cannot fan one family into two invitations.
 *
 * @param email - The invited adult's address, as typed.
 * @param invitedBy - The signed-in administrator, taken from the verified
 *   server session by the caller. Never accepted from the browser.
 * @returns The outcome.
 */
export async function inviteFamily(
  email: string,
  invitedBy: string,
): Promise<InvitationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }
  if (!isAdminApiConfigured()) return { ok: false, reason: "notConfigured" }

  const address = normalizeEmail(email)

  const existing = await findPending(address)
  if (existing) return resendInvitation(existing.id)

  const sent = await sendInvite(address)
  if (!sent.ok) return { ok: false, reason: sent.reason }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("family_invitations")
    .insert({
      email: address,
      invited_user_id: sent.userId,
      invited_by: invitedBy,
      expires_at: nextExpiry(),
    })
    .select("id")
    .single()

  if (error || !data) {
    /* The account exists but no invitation record does. Leaving it would be a
       provisioned account nobody can see, revoke, or account for — so it is
       removed and the administrator is told nothing happened. */
    await deleteUnacceptedAccount(sent.userId)
    /* 42501 is RLS refusing the insert: the caller is not an administrator
       according to the database, whatever the page thought. */
    return {
      ok: false,
      reason: error?.code === "42501" ? "forbidden" : "failed",
    }
  }

  return { ok: true, outcome: "invited", id: data.id }
}

/**
 * Reissues an invitation (MPS-ACC-017 "verification can be safely renewed").
 *
 * The old account is deleted first, so the previous link stops working the
 * moment a new one is issued — two live links to one family account is not a
 * state this flow will produce.
 *
 * @param invitationId - Which invitation. Read back from the database under RLS
 *   before anything is done to it, so an id from the browser can only ever name
 *   a row the signed-in administrator was already allowed to see.
 * @returns The outcome.
 */
export async function resendInvitation(
  invitationId: string,
): Promise<InvitationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }
  if (!isAdminApiConfigured()) return { ok: false, reason: "notConfigured" }

  const supabase = await createClient()
  const { data: row, error: readError } = await supabase
    .from("family_invitations")
    .select(SELECT_COLUMNS)
    .eq("id", invitationId)
    .maybeSingle()

  if (readError) return { ok: false, reason: "failed" }
  if (!row) return { ok: false, reason: "notFound" }
  if (row.state !== "pending") return { ok: false, reason: "notResendable" }
  if (row.sent_count >= 50) return { ok: false, reason: "sendLimit" }

  if (row.invited_user_id) {
    if (await accountIsEstablished(row.invited_user_id)) {
      /* The invitation says pending but the account is already a participant.
         Deleting it is refused, and so is pretending a resend happened. */
      return { ok: false, reason: "notResendable" }
    }
    if (!(await deleteUnacceptedAccount(row.invited_user_id))) {
      /* The old link could not be killed. Sending a second one would leave two
         live credentials for one account, so nothing is sent. */
      return { ok: false, reason: "failed" }
    }
  }

  const sent = await sendInvite(row.email)
  if (!sent.ok) {
    /* The old account is gone and no new one exists. The row must stop
       claiming its link works — see `closeUnsendableInvitation`. */
    await closeUnsendableInvitation(row.id)
    return { ok: false, reason: sent.reason }
  }

  const { error } = await supabase
    .from("family_invitations")
    .update({
      invited_user_id: sent.userId,
      expires_at: nextExpiry(),
      last_sent_at: new Date().toISOString(),
      sent_count: row.sent_count + 1,
    })
    .eq("id", row.id)
    .eq("state", "pending")

  if (error) {
    /* The row could not be moved to the new account, so the account it points
       at must not survive: a provisioned account no invitation names is one
       nobody can see, revoke, or account for. */
    await deleteUnacceptedAccount(sent.userId)
    await closeUnsendableInvitation(row.id)
    return {
      ok: false,
      reason: error.code === "42501" ? "forbidden" : "failed",
    }
  }

  return { ok: true, outcome: "resent", id: row.id }
}

/**
 * Withdraws an invitation that was never accepted.
 *
 * @param invitationId - Which invitation, checked against RLS before use.
 * @param revokedBy - The signed-in administrator, from the verified session.
 * @returns The outcome.
 */
export async function revokeInvitation(
  invitationId: string,
  revokedBy: string,
): Promise<InvitationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "unavailable" }
  if (!isAdminApiConfigured()) return { ok: false, reason: "notConfigured" }

  const supabase = await createClient()
  const { data: row, error: readError } = await supabase
    .from("family_invitations")
    .select(SELECT_COLUMNS)
    .eq("id", invitationId)
    .maybeSingle()

  if (readError) return { ok: false, reason: "failed" }
  if (!row) return { ok: false, reason: "notFound" }
  /* An accepted or already-revoked invitation is not revocable. The accepted
     case is the one that matters: it would mean deleting a family's account. */
  if (row.state !== "pending") return { ok: false, reason: "notRevocable" }

  if (row.invited_user_id) {
    if (await accountIsEstablished(row.invited_user_id)) {
      /* The invitation says pending, but the account holds a role or a family
         membership: somebody is using it. Withdrawing would mean deleting a
         participant's account, which this workflow never does
         (GAP-ADMIN-011). */
      return { ok: false, reason: "notRevocable" }
    }
    if (!(await deleteUnacceptedAccount(row.invited_user_id))) {
      /* Reporting a revoke while the link still works would be a lie about a
         credential. */
      return { ok: false, reason: "failed" }
    }
  }

  const { error } = await supabase
    .from("family_invitations")
    .update({
      state: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      invited_user_id: null,
    })
    .eq("id", row.id)
    .eq("state", "pending")

  if (error) {
    return {
      ok: false,
      reason: error.code === "42501" ? "forbidden" : "failed",
    }
  }

  return { ok: true, outcome: "revoked", id: row.id }
}
