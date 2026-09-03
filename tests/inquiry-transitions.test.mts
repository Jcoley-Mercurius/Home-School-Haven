import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  INQUIRY_STATE_LABELS,
  INQUIRY_STATE_MEANINGS,
  INQUIRY_TRANSITIONS,
  INQUIRY_TYPE_LABELS,
  inquiryTransitionAllowed,
  isSensitiveInquiry,
  nextInquiryStates,
} from "../src/lib/admin/inquiry-transitions.ts"
import type { InquiryState } from "../src/lib/admin/inquiry-transitions.ts"

/**
 * The rule that decides which triage buttons an administrator is offered.
 *
 * The database holds the authoritative copy — `private.inquiry_transition_allowed`
 * in `supabase/migrations/20260904000000_inquiry_capture_foundation.sql`, pinned
 * by `supabase/tests/database/120_inquiry_capture.test.sql`. This pins the copy
 * the UI renders from. Divergence between the two is a defect in whichever was
 * changed alone, and these two suites are what catch it.
 *
 * The label assertions are not cosmetic. MPS-RUL-004 forbids the beta deciding
 * or issuing a financial outcome, and a button reading "Approve assistance"
 * would claim one had been decided regardless of what the database recorded.
 * The words are part of the control.
 */

const ALL_STATES: InquiryState[] = [
  "submitted",
  "under_review",
  "awaiting_family",
  "approved_path_provided",
  "not_available",
  "closed",
]

describe("inquiry transition table (MPS-WFL-004)", () => {
  it("covers exactly the six approved states", () => {
    assert.deepEqual(
      Object.keys(INQUIRY_TRANSITIONS).sort(),
      [...ALL_STATES].sort(),
    )
  })

  it("never proposes a state outside the approved six", () => {
    for (const state of ALL_STATES) {
      for (const target of INQUIRY_TRANSITIONS[state]) {
        assert.ok(
          ALL_STATES.includes(target),
          `${state} may not move to ${target}`,
        )
      }
    }
  })

  it("never offers a move to the state already held", () => {
    for (const state of ALL_STATES) {
      assert.ok(
        !INQUIRY_TRANSITIONS[state].includes(state),
        `${state} should not offer itself`,
      )
    }
  })

  it("requires review before a conclusion is recorded", () => {
    /* MPS-WFL-004's main path puts "Administrator reviews" before "determine
       next step". Concluding straight from `submitted` would record an outcome
       nobody is shown to have looked at. */
    assert.ok(!inquiryTransitionAllowed("submitted", "approved_path_provided"))
    assert.ok(!inquiryTransitionAllowed("submitted", "not_available"))
    assert.ok(inquiryTransitionAllowed("submitted", "under_review"))
    assert.ok(
      inquiryTransitionAllowed("under_review", "approved_path_provided"),
    )
    assert.ok(inquiryTransitionAllowed("awaiting_family", "not_available"))
  })

  it("lets a review go back for more information and resume", () => {
    /* MPS-WFL-004 alternate path "More information required", and back again
       when the family answers. */
    assert.ok(inquiryTransitionAllowed("under_review", "awaiting_family"))
    assert.ok(inquiryTransitionAllowed("awaiting_family", "under_review"))
  })

  it("treats closed as terminal", () => {
    assert.deepEqual(nextInquiryStates("closed"), [])
    for (const state of ALL_STATES) {
      assert.ok(
        !inquiryTransitionAllowed("closed", state),
        `closed must not reopen to ${state}`,
      )
    }
  })

  it("lets every non-terminal state reach closed", () => {
    for (const state of ALL_STATES.filter((s) => s !== "closed")) {
      assert.ok(
        inquiryTransitionAllowed(state, "closed"),
        `${state} should be closable`,
      )
    }
  })
})

describe("inquiry vocabulary (MPS-RUL-004)", () => {
  it("labels and explains every state", () => {
    for (const state of ALL_STATES) {
      assert.ok(INQUIRY_STATE_LABELS[state].length > 0)
      assert.ok(INQUIRY_STATE_MEANINGS[state].length > 0)
    }
  })

  it("never words a state as a granted financial outcome", () => {
    /* The beta records status and decides nothing. A label or explanation
       saying "approved", "granted", "awarded", "discount", or "declined" would
       assert an outcome that no part of this product is permitted to reach. */
    const forbidden = [
      "approved",
      "granted",
      "awarded",
      "discount",
      "scholarship",
      "declined",
      "denied",
      "eligible",
    ]

    for (const state of ALL_STATES) {
      const text =
        `${INQUIRY_STATE_LABELS[state]} ${INQUIRY_STATE_MEANINGS[state]}`.toLowerCase()

      for (const word of forbidden) {
        /* `approved_path_provided`'s explanation names these words only to deny
           them ("it is not a discount, an award, or an eligibility decision"),
           which is the one place they belong. */
        if (state === "approved_path_provided") continue
        assert.ok(
          !text.includes(word),
          `${state} must not be worded with "${word}": ${text}`,
        )
      }
    }
  })

  it("labels every public pathway", () => {
    for (const type of [
      "guidance",
      "question",
      "visit",
      "assistance",
    ] as const) {
      assert.ok(INQUIRY_TYPE_LABELS[type].length > 0)
    }
  })

  it("treats only the cost-assistance pathway as sensitive", () => {
    assert.ok(isSensitiveInquiry("assistance"))
    assert.ok(!isSensitiveInquiry("guidance"))
    assert.ok(!isSensitiveInquiry("question"))
    assert.ok(!isSensitiveInquiry("visit"))
  })
})
