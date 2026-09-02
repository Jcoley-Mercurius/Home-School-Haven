"use client"

import { useActionState } from "react"
import { CircleCheck, CircleSlash, Clock, TriangleAlert } from "lucide-react"

import {
  resendInvitationAction,
  revokeInvitationAction,
} from "@/app/(portal)/admin/families/actions"
import { emptyInvitationActionFormState } from "@/app/(portal)/admin/families/form-state"
import { EmptyState } from "@/components/family/section-states"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  canResend,
  canRevoke,
  invitationStateDescription,
  invitationStateLabel,
  invitationStateTone,
  type InvitationDisplayState,
} from "@/lib/admin/invitation-state"

import type { AdminInvitation } from "@/lib/admin/invitations"

/**
 * Invitation status for administrators (MPS-REQ-011, MPS-REQ-021,
 * MPS-REQ-024; MDS `components.table` variant `standard`, `responsive.rules.grid`
 * "Operational tables transform to labeled record cards").
 *
 * COLOUR IS NEVER THE MESSAGE
 *
 * Every state carries a word and an icon as well as a tone, because MDS
 * DO-DONT "Trust states" requires status meaning that survives greyscale and a
 * colour-vision difference.
 *
 * WHY "EXPIRED" IS NOT IN THE DATABASE
 *
 * It is derived from `expires_at` at render time (see
 * `@/lib/admin/invitation-state`). Nothing sweeps the table in this release, so
 * a stored `expired` would sit unset while the link quietly stopped working —
 * and this list would report an invitation as waiting when it was not.
 *
 * WHICH CONTROLS APPEAR
 *
 * Resend and Withdraw appear only where they are legitimate, and the rules live
 * in the pure module beside the labels rather than in this file. An accepted
 * invitation offers neither: reissuing is what password recovery is for, and
 * withdrawing would mean deleting a real family's account, which is an
 * unresolved retention decision (GAP-ADMIN-011).
 *
 * TWO RENDERINGS, ONE ACCESSIBILITY TREE
 *
 * Table from `sm` up, labeled record cards below it — both in the DOM, so a
 * test locator must be scoped to one of them (DEFECT-AO3).
 */
const STATE_ICON = {
  pending: Clock,
  expired: TriangleAlert,
  accepted: CircleCheck,
  revoked: CircleSlash,
} as const satisfies Record<
  InvitationDisplayState,
  typeof Clock | typeof TriangleAlert | typeof CircleCheck | typeof CircleSlash
>

/** Absolute, never "3 days ago" — an operator reconciling a record needs the date. */
function formatMoment(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function InvitationStatus({ state }: { state: InvitationDisplayState }) {
  const Icon = STATE_ICON[state]
  return (
    <Badge tone={invitationStateTone(state)}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {invitationStateLabel(state)}
    </Badge>
  )
}

function InvitationActions({ invitation }: { invitation: AdminInvitation }) {
  const [resendState, resend, resending] = useActionState(
    resendInvitationAction,
    emptyInvitationActionFormState,
  )
  const [revokeState, revoke, revoking] = useActionState(
    revokeInvitationAction,
    emptyInvitationActionFormState,
  )

  const lifecycle = {
    /* `displayState` has already folded expiry in, so the stored state is
       reconstructed for the rule functions rather than re-derived here. */
    state:
      invitation.state === "expired"
        ? ("pending" as const)
        : (invitation.state as "pending" | "accepted" | "revoked"),
    expiresAt: invitation.expiresAt,
  }

  const outcome = [resendState, revokeState].find(
    (state) => state.status !== "idle" && state.invitationId === invitation.id,
  )

  const message = outcome
    ? outcome.status === "resent"
      ? "A new invitation was sent. The previous link no longer works."
      : outcome.status === "revoked"
        ? "The invitation was withdrawn and its link no longer works."
        : outcome.status === "notResendable" ||
            outcome.status === "notRevocable"
          ? "This invitation has already been accepted or withdrawn. Reload the page to see its current state."
          : outcome.status === "sendLimit"
            ? "This invitation has been resent too many times. Contact the parent directly."
            : outcome.status === "notConfigured"
              ? "Invitation sending is not configured in this environment. Nothing changed."
              : outcome.status === "forbidden"
                ? "This account is not authorized to change an invitation. Nothing changed."
                : "Nothing changed. Please try again."
    : null

  const succeeded =
    outcome?.status === "resent" || outcome?.status === "revoked"

  if (!canResend(lifecycle) && !canRevoke(lifecycle)) {
    return null
  }

  return (
    <div className="flex flex-col items-start gap-[var(--hsh-space-2)]">
      <p role="status" aria-live="polite" className="sr-only">
        {message ?? ""}
      </p>

      <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
        {canResend(lifecycle) ? (
          <form action={resend}>
            <input
              type="hidden"
              name="invitationId"
              value={invitation.id}
              readOnly
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend"}
            </Button>
          </form>
        ) : null}

        {canRevoke(lifecycle) ? (
          <form action={revoke}>
            <input
              type="hidden"
              name="invitationId"
              value={invitation.id}
              readOnly
            />
            <Button type="submit" variant="quiet" size="sm" disabled={revoking}>
              {revoking ? "Withdrawing…" : "Withdraw"}
            </Button>
          </form>
        ) : null}
      </div>

      {message ? (
        <p
          className={
            succeeded
              ? "hsh-body-sm text-[var(--hsh-text-secondary)]"
              : "hsh-body-sm text-[var(--hsh-error)]"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

function InvitationList({ invitations }: { invitations: AdminInvitation[] }) {
  if (invitations.length === 0) {
    return (
      <EmptyState title="No invitations yet">
        <p>
          No family has been invited. A parent cannot create their own account —
          an invitation from this page is the only way one begins.
        </p>
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      {/* Table from `sm` up. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Family invitations, newest first, with their current state and the
            actions available for each.
          </caption>
          <thead>
            <tr className="border-b border-[var(--hsh-border-default)]">
              <th scope="col" className="hsh-label py-[var(--hsh-space-3)]">
                Invited address
              </th>
              <th scope="col" className="hsh-label py-[var(--hsh-space-3)]">
                State
              </th>
              <th scope="col" className="hsh-label py-[var(--hsh-space-3)]">
                Sent
              </th>
              <th scope="col" className="hsh-label py-[var(--hsh-space-3)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr
                key={invitation.id}
                className="border-b border-[var(--hsh-border-default)] align-top"
              >
                <td className="hsh-body-sm py-[var(--hsh-space-4)] pr-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]">
                  {invitation.email}
                </td>
                <td className="py-[var(--hsh-space-4)] pr-[var(--hsh-space-4)]">
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <InvitationStatus state={invitation.state} />
                    <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                      {invitationStateDescription(invitation.state)}
                    </span>
                  </div>
                </td>
                <td className="hsh-body-sm py-[var(--hsh-space-4)] pr-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {formatMoment(invitation.lastSentAt)}
                  {invitation.sentCount > 1
                    ? ` · sent ${invitation.sentCount} times`
                    : null}
                </td>
                <td className="py-[var(--hsh-space-4)]">
                  <InvitationActions invitation={invitation} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Labeled record cards below `sm`. */}
      <ul className="flex list-none flex-col gap-[var(--hsh-space-4)] p-0 sm:hidden">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
          >
            <p className="hsh-body text-[var(--hsh-text-primary)]">
              {invitation.email}
            </p>
            <InvitationStatus state={invitation.state} />
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {invitationStateDescription(invitation.state)}
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              Sent {formatMoment(invitation.lastSentAt)}
              {invitation.sentCount > 1
                ? ` · sent ${invitation.sentCount} times`
                : null}
            </p>
            <InvitationActions invitation={invitation} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Reported rather than hidden when the invitation read itself failed. */
function InvitationListError() {
  return (
    <Alert tone="warning" title="Invitations could not be loaded">
      Nothing has changed. Reload the page to try again — an invitation that
      cannot be listed has not been withdrawn.
    </Alert>
  )
}

export { InvitationList, InvitationListError }
