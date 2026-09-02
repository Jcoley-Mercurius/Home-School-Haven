import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  OUTCOME,
  mayOfferCheckout,
  parseOutcome,
  presentOutcome,
  type EnrollmentOutcome,
} from "../src/lib/enrollment/eligibility.ts"
import { CONFIRMATION_MODE } from "../src/lib/enrollment/confirmation-mode.ts"

/**
 * The presentation half of the MPS-REQ-012 evaluation.
 *
 * `public.family_request_enrollment` is the control and the pgTAP suite pins
 * it. This pins the table that turns its answer into words, because a mapping
 * that quietly offered a payment path on the wrong outcome would be a trust
 * failure no database test could catch.
 */
const OUTCOMES = Object.keys(OUTCOME) as EnrollmentOutcome[]

describe("enrollment outcome presentation", () => {
  it("offers a payment path for exactly one outcome (MPS-ACC-018/019/020/021)", () => {
    const offering = OUTCOMES.filter((o) => presentOutcome(o).offersPayment)
    assert.deepEqual(offering, ["started"])
  })

  it("records nothing for every blocked outcome (MPS-ACC-002, MPS-ACC-018)", () => {
    for (const outcome of OUTCOMES) {
      if (!outcome.startsWith("blocked_")) continue
      const presentation = presentOutcome(outcome)
      assert.equal(presentation.recorded, false, outcome)
      assert.equal(presentation.offersPayment, false, outcome)
      /* The blocker has to be named, not merely implied by a refusal. */
      assert.ok(presentation.sentence.length > 0, outcome)
      assert.match(presentation.sentence, /no payment was started/, outcome)
    }
  })

  it("never offers payment for approval_pending or waitlisted", () => {
    /* MPS-ACC-019 and MPS-ACC-020 are the two states most easily mistaken for
       a step toward checkout. Neither may reach one. */
    assert.equal(presentOutcome("approval_pending").offersPayment, false)
    assert.equal(presentOutcome("waitlisted").offersPayment, false)
    assert.equal(presentOutcome("approval_pending").recorded, true)
    assert.equal(presentOutcome("waitlisted").recorded, true)
  })

  it("says a waitlist place is not enrollment (MPS-RUL-002)", () => {
    assert.match(presentOutcome("waitlisted").sentence, /not enrollment/)
    assert.match(
      presentOutcome("waitlisted").sentence,
      /no payment was collected/,
    )
  })

  it("says a duplicate added and charged nothing (MPS-ACC-023)", () => {
    const duplicate = presentOutcome("duplicate")
    assert.equal(duplicate.recorded, true)
    assert.equal(duplicate.offersPayment, false)
    assert.match(
      duplicate.sentence,
      /Nothing was added and nothing was charged/,
    )
  })

  it("never claims confirmation on any outcome", () => {
    /* The word "confirm" is allowed, and several sentences need it — but only
       ever negated. Stripping the negated forms must leave none behind: a
       positive claim of confirmation is the one thing no outcome may make
       (DO-DONT "Trust states"). The imperative "Confirm that you are this
       student's parent" is an instruction to the reader, not a claim about the
       registration, so only the noun and participle forms are checked. */
    for (const outcome of OUTCOMES) {
      const { heading, sentence } = presentOutcome(outcome)
      const text = `${heading} ${sentence}`
      assert.doesNotMatch(text, /\benrolled\b/i, outcome)
      assert.doesNotMatch(
        text.replace(/\b(not|does not|is not)\s+confirm\w*/gi, ""),
        /\bconfirmed\b|\bconfirmation\b/i,
        outcome,
      )
    }
  })

  it("gives every outcome a heading and a recovery decision", () => {
    for (const outcome of OUTCOMES) {
      const presentation = presentOutcome(outcome)
      assert.ok(presentation.heading.length > 0, outcome)
      assert.ok(
        ["guidance", "programs", "dashboard", null].includes(
          presentation.recovery,
        ),
        outcome,
      )
    }
  })
})

describe("parseOutcome", () => {
  it("accepts every known outcome", () => {
    for (const outcome of OUTCOMES) {
      assert.equal(parseOutcome(outcome), outcome)
    }
  })

  it("rejects anything else", () => {
    /* An unrecognised answer must never fall through as a success. The caller
       treats null as a failure, which is the safe direction. */
    for (const value of [
      "confirmed",
      "paid",
      "",
      "toString",
      "constructor",
      "__proto__",
      null,
      undefined,
      7,
      { outcome: "started" },
    ]) {
      assert.equal(parseOutcome(value), null)
    }
  })
})

describe("mayOfferCheckout", () => {
  it("agrees with offersPayment: started, and nothing else", () => {
    /* MPS-WFL-003's eight states, verbatim. `public.enrollment_state` is the
       authoritative copy and the pgTAP suite pins it; this list exists so a
       ninth state cannot quietly acquire a payment path here. */
    const states = [
      "started",
      "approval_pending",
      "payment_pending",
      "waitlisted",
      "confirmed",
      "payment_failed",
      "canceled",
      "blocked",
    ] as const
    const offering = states.filter((state) => mayOfferCheckout(state))
    assert.deepEqual(offering, ["started"])
    assert.equal(
      presentOutcome("started").offersPayment,
      mayOfferCheckout("started"),
    )
  })
})

describe("confirmation mode presentation (MPS-RUL-001)", () => {
  it("has exactly the two approved modes", () => {
    assert.deepEqual(Object.keys(CONFIRMATION_MODE).sort(), [
      "administrator_approval",
      "instant",
    ])
  })

  it("never lets 'instant' read as confirmed enrollment", () => {
    const instant = CONFIRMATION_MODE.instant
    assert.match(instant.description, /not confirmed enrollment/i)
    assert.match(instant.familyNote, /does not confirm/i)
  })

  it("tells a family an approval-required program reviews first", () => {
    assert.match(
      CONFIRMATION_MODE.administrator_approval.familyNote,
      /does not confirm a place/i,
    )
  })
})
