import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  canResend,
  canRevoke,
  displayState,
  invitationStateDescription,
  invitationStateLabel,
  invitationStateTone,
} from "../src/lib/admin/invitation-state.ts"
import type {
  InvitationDisplayState,
  InvitationState,
} from "../src/lib/admin/invitation-state.ts"

/**
 * The rules behind the administrator's invitation list (MPS-REQ-011,
 * MPS-ACC-017, MPS-REQ-021).
 *
 * The database holds the authoritative copy of the expiry rule —
 * `public.family_invitation_status()` in
 * `supabase/migrations/20260902170123_family_invitation_provisioning.sql`,
 * pinned by `supabase/tests/database/140_family_invitations.test.sql`. This
 * pins the copy the administrator's list renders from. Divergence between the
 * two is a defect in whichever was changed alone, and these two suites are what
 * catch it.
 *
 * The label assertions are not cosmetic. "Waiting to be accepted" and
 * "Expired" are what an administrator acts on, and an expired invitation
 * described as waiting would leave a family with a dead link nobody reissued.
 */

const NOW = new Date("2026-09-02T12:00:00.000Z")
const LATER = "2026-09-02T13:00:00.000Z"
const EARLIER = "2026-09-02T11:00:00.000Z"

const ALL_STORED: InvitationState[] = ["pending", "accepted", "revoked"]
const ALL_DISPLAY: InvitationDisplayState[] = [
  "pending",
  "expired",
  "accepted",
  "revoked",
]

describe("displayState (MPS-REQ-021)", () => {
  it("reports a pending invitation inside its window as pending", () => {
    assert.equal(
      displayState({ state: "pending", expiresAt: LATER }, NOW),
      "pending",
    )
  })

  it("derives expiry rather than trusting the stored state", () => {
    assert.equal(
      displayState({ state: "pending", expiresAt: EARLIER }, NOW),
      "expired",
    )
  })

  it("treats the exact expiry instant as closed, not open", () => {
    assert.equal(
      displayState({ state: "pending", expiresAt: NOW.toISOString() }, NOW),
      "expired",
    )
  })

  it("never re-opens an accepted or revoked invitation, whatever the clock says", () => {
    for (const state of ["accepted", "revoked"] as const) {
      assert.equal(displayState({ state, expiresAt: LATER }, NOW), state)
      assert.equal(displayState({ state, expiresAt: EARLIER }, NOW), state)
    }
  })

  it("treats an unreadable expiry as closed", () => {
    /* The safe direction for an ambiguous credential is closed: an
       administrator can always resend, and a wrongly-open invitation is an
       account nobody authorized today. */
    assert.equal(
      displayState({ state: "pending", expiresAt: "not a date" }, NOW),
      "expired",
    )
  })
})

describe("canResend (MPS-ACC-017)", () => {
  it("allows renewing an expired invitation", () => {
    assert.equal(canResend({ state: "pending", expiresAt: EARLIER }, NOW), true)
  })

  it("allows resending one that is still waiting", () => {
    assert.equal(canResend({ state: "pending", expiresAt: LATER }, NOW), true)
  })

  it("refuses to resend an accepted invitation", () => {
    /* The account exists; its owner uses password recovery, not a second
       invitation. */
    assert.equal(canResend({ state: "accepted", expiresAt: LATER }, NOW), false)
  })

  it("refuses to resend a revoked invitation", () => {
    assert.equal(canResend({ state: "revoked", expiresAt: LATER }, NOW), false)
  })
})

describe("canRevoke", () => {
  it("allows withdrawing a waiting or expired invitation", () => {
    assert.equal(canRevoke({ state: "pending", expiresAt: LATER }, NOW), true)
    assert.equal(canRevoke({ state: "pending", expiresAt: EARLIER }, NOW), true)
  })

  it("refuses to withdraw an ACCEPTED invitation", () => {
    /* Revoking deletes the provisioned account. Doing that to an accepted
       invitation would delete a real family's account — an unresolved
       retention decision (GAP-ADMIN-011), not a button. */
    assert.equal(canRevoke({ state: "accepted", expiresAt: LATER }, NOW), false)
  })

  it("refuses to withdraw an already-revoked invitation", () => {
    assert.equal(canRevoke({ state: "revoked", expiresAt: LATER }, NOW), false)
  })
})

describe("state vocabulary", () => {
  it("covers exactly the three stored states", () => {
    assert.equal(ALL_STORED.length, 3)
  })

  it("labels and describes every display state in plain words", () => {
    for (const state of ALL_DISPLAY) {
      assert.ok(invitationStateLabel(state).length > 0)
      assert.ok(invitationStateDescription(state).length > 0)
    }
  })

  it("never spells a waiting invitation as a completed one", () => {
    /* `success` is reserved for something that actually completed. An
       invitation nobody has accepted has completed nothing, and rendering it in
       the completed tone is how a state gets misread at a glance. */
    assert.equal(invitationStateTone("accepted"), "success")
    for (const state of ["pending", "expired", "revoked"] as const) {
      assert.notEqual(invitationStateTone(state), "success")
    }
  })

  it("gives every state a distinct label", () => {
    const labels = new Set(ALL_DISPLAY.map(invitationStateLabel))
    assert.equal(labels.size, ALL_DISPLAY.length)
  })
})
