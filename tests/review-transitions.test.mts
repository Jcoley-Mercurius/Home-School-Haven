import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  REVIEW_DISPOSITION_LABELS,
  REVIEW_DISPOSITION_MEANINGS,
  REVIEW_RESULT_LABELS,
  REVIEW_RESULT_MEANINGS,
  REVIEW_STATE_LABELS,
  REVIEW_STATE_MEANINGS,
  REVIEW_TRANSITIONS,
  demonstratedCount,
  nextReviewStates,
  reviewTransitionAllowed,
} from "../src/lib/admin/review-transitions.ts"
import type {
  ReviewDisposition,
  ReviewResult,
  ReviewSignalState,
} from "../src/lib/admin/review-transitions.ts"

/**
 * The rules that decide what the beta review may claim.
 *
 * The database holds the authoritative transition copy
 * (`private.review_transition_allowed`), pinned by
 * `supabase/tests/database/130_beta_review_evidence.test.sql`. This pins the
 * copy the UI renders from, and the vocabulary.
 *
 * `demonstratedCount` gets its own group because it is the single most
 * dangerous function in this slice: it decides what the review page tells
 * whoever is judging whether the beta is ready.
 */

const ALL_STATES: ReviewSignalState[] = [
  "not_reviewed",
  "in_review",
  "feedback_recorded",
  "decision_pending",
  "disposition_approved",
  "review_complete",
]

const ALL_RESULTS: ReviewResult[] = ["pass", "fail", "blocked", "not_tested"]

const ALL_DISPOSITIONS: ReviewDisposition[] = [
  "must_fix_beta_defect",
  "launch_requirement",
  "next_idea",
  "later_idea",
  "rejected_change",
]

describe("review transition table (MPS-WFL-008)", () => {
  it("covers exactly the six approved states", () => {
    assert.deepEqual(
      Object.keys(REVIEW_TRANSITIONS).sort(),
      [...ALL_STATES].sort(),
    )
  })

  it("never proposes a state outside the approved six", () => {
    for (const state of ALL_STATES) {
      for (const target of REVIEW_TRANSITIONS[state]) {
        assert.ok(ALL_STATES.includes(target), `${state} -> ${target}`)
      }
    }
  })

  it("never offers a move to the state already held", () => {
    for (const state of ALL_STATES) {
      assert.ok(!REVIEW_TRANSITIONS[state].includes(state), state)
    }
  })

  it("walks the approved main path end to end", () => {
    /* "Walk through success signals → Record feedback → Classify issue or
       idea → Approve disposition" and then done. */
    assert.ok(reviewTransitionAllowed("not_reviewed", "in_review"))
    assert.ok(reviewTransitionAllowed("in_review", "feedback_recorded"))
    assert.ok(reviewTransitionAllowed("feedback_recorded", "decision_pending"))
    assert.ok(
      reviewTransitionAllowed("decision_pending", "disposition_approved"),
    )
    assert.ok(
      reviewTransitionAllowed("disposition_approved", "review_complete"),
    )
  })

  it("lets a clean walkthrough finish without manufacturing feedback", () => {
    /* A signal can be demonstrated with nothing to say about it. Requiring a
       feedback item to close it would invent feedback nobody gave. */
    assert.ok(reviewTransitionAllowed("in_review", "review_complete"))
  })

  it("cannot skip from not_reviewed to any conclusion", () => {
    for (const target of ALL_STATES.filter((s) => s !== "in_review")) {
      assert.ok(
        !reviewTransitionAllowed("not_reviewed", target),
        `not_reviewed must not reach ${target} directly`,
      )
    }
  })

  it("cannot approve a disposition before a decision is pending", () => {
    assert.ok(
      !reviewTransitionAllowed("in_review", "disposition_approved"),
      "an unclassified signal has no disposition to approve",
    )
    assert.ok(
      !reviewTransitionAllowed("feedback_recorded", "disposition_approved"),
      "feedback must be classified before its disposition is approved",
    )
  })

  it("allows a completed signal to be reopened", () => {
    /* Unlike a family's inquiry, a review is not a record of someone's
       request; reopening one Samantha wants to revisit hides nothing. */
    assert.deepEqual(nextReviewStates("review_complete"), ["in_review"])
  })
})

describe("demonstratedCount (MPS-ACC-032)", () => {
  it("counts only a recorded pass", () => {
    assert.equal(demonstratedCount(["pass", "pass", "pass"]), 3)
    assert.equal(demonstratedCount(["pass", "fail", "pass"]), 2)
  })

  it("never counts blocked or not_tested as evidence", () => {
    /* The failure mode this guards: a review page reporting eight of eight
       because nobody walked any of them. */
    assert.equal(demonstratedCount(["not_tested", "not_tested"]), 0)
    assert.equal(demonstratedCount(["blocked", "blocked"]), 0)
    assert.equal(
      demonstratedCount(["pass", "blocked", "not_tested", "fail"]),
      1,
    )
  })

  it("reports nothing demonstrated for an untouched review", () => {
    assert.equal(demonstratedCount(Array(8).fill("not_tested")), 0)
  })

  it("counts an empty review as zero rather than throwing", () => {
    assert.equal(demonstratedCount([]), 0)
  })
})

describe("review vocabulary (MPS-REQ-022)", () => {
  it("labels and explains every state, result, and disposition", () => {
    for (const state of ALL_STATES) {
      assert.ok(REVIEW_STATE_LABELS[state].length > 0)
      assert.ok(REVIEW_STATE_MEANINGS[state].length > 0)
    }
    for (const result of ALL_RESULTS) {
      assert.ok(REVIEW_RESULT_LABELS[result].length > 0)
      assert.ok(REVIEW_RESULT_MEANINGS[result].length > 0)
    }
    for (const disposition of ALL_DISPOSITIONS) {
      assert.ok(REVIEW_DISPOSITION_LABELS[disposition].length > 0)
      assert.ok(REVIEW_DISPOSITION_MEANINGS[disposition].length > 0)
    }
  })

  it("offers no disposition meaning accepted into this release", () => {
    /* MPS-REQ-022 forbids silently changing scope, and MPS-WFL-008's recovery
       says unresolved items stay explicit gaps. A disposition worded as an
       acceptance would be that silent change wearing a label. */
    for (const disposition of ALL_DISPOSITIONS) {
      const label = REVIEW_DISPOSITION_LABELS[disposition].toLowerCase()
      for (const forbidden of [
        "accepted",
        "approved for release",
        "in scope",
        "added to",
        "scheduled",
      ]) {
        assert.ok(
          !label.includes(forbidden),
          `${disposition} must not be labelled "${forbidden}": ${label}`,
        )
      }
    }
  })

  it("never words not_tested as a kind of success", () => {
    const text =
      `${REVIEW_RESULT_LABELS.not_tested} ${REVIEW_RESULT_MEANINGS.not_tested}`.toLowerCase()
    for (const forbidden of ["pass", "fine", "ok", "demonstrated", "working"]) {
      assert.ok(
        !text.includes(forbidden),
        `not_tested must not read as success ("${forbidden}"): ${text}`,
      )
    }
  })

  it("says a launch requirement is not itself a scope change", () => {
    /* This is the disposition most likely to be mistaken for "we will build
       it", so its explanation has to disclaim that in words. */
    const meaning = REVIEW_DISPOSITION_MEANINGS.launch_requirement.toLowerCase()
    assert.ok(
      meaning.includes("does not add it to any release") ||
        meaning.includes("mps decision"),
      `launch_requirement must disclaim adding scope: ${meaning}`,
    )
  })
})
