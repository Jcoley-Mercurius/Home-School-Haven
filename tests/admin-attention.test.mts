import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { deriveAttention } from "../src/lib/admin/attention.ts"
import { describeActivity } from "../src/lib/admin/activity.ts"
import type {
  AttentionProgram,
  AttentionStudent,
} from "../src/lib/admin/attention.ts"
import type { EnrollmentState } from "../src/lib/enrollment/repository.ts"

/**
 * The two administrator judgements that are worth pinning directly rather than
 * only through a browser.
 *
 * The attention derivation is where this release could most easily start lying:
 * it turns raw operational rows into sentences about payment, consent, and
 * enrollment, and the difference between "payment activity awaiting
 * verification" and "payment confirmed" is the trust contract of the whole
 * Foundation Release (MPS-REQ-013, DO-DONT "Trust states"). An end-to-end test
 * can see that a card rendered; only this can see exactly which rows produced
 * it and exactly what the sentence claims.
 *
 * The activity phrasing matters for a smaller but sharper reason: it is the one
 * place where a raw database string could reach an operator's screen, and its
 * fallback is what stops an unmapped entity type from doing so.
 */

function program(overrides: Partial<AttentionProgram> = {}): AttentionProgram {
  return {
    publicationState: "published",
    educatorAssigned: true,
    needsContentReview: false,
    hasUnpublishedDetail: false,
    ...overrides,
  }
}

function student(consentApproved: boolean): AttentionStudent {
  return { consentApproved }
}

/** A complete, entirely healthy read: every source present, nothing to flag. */
const CLEAN = {
  enrollmentStates: ["confirmed", "canceled"] as EnrollmentState[],
  students: [student(true)],
  programs: [program()],
}

describe("deriveAttention", () => {
  it("reports nothing when every check passes", () => {
    const result = deriveAttention(CLEAN)

    assert.deepEqual(result.items, [])
    assert.equal(result.incomplete, false)
  })

  it("counts payment_pending separately and never calls it confirmed", () => {
    const result = deriveAttention({
      ...CLEAN,
      enrollmentStates: ["payment_pending", "payment_pending", "confirmed"],
    })

    const item = result.items.find(
      (candidate) => candidate.category === "payment_pending_verification",
    )
    assert.ok(item, "payment verification item is present")
    assert.equal(item.count, 2, "confirmed is not counted as pending")
    assert.equal(item.tone, "warning")

    /* The sentence must state non-confirmation itself. Leaving the reader to
       infer it from a tone is exactly the inference DO-DONT forbids, and an
       administrator reading "2 payments" as "2 paid" is the specific mistake
       this release exists to prevent. */
    assert.match(item.detail, /not confirmed payment/i)
    assert.match(item.detail, /not confirmed/i)
  })

  it("treats an opened checkout as pending review, not as payment", () => {
    // `started` means the external provider was opened and nothing
    // authoritative has come back. It is a registration awaiting review.
    const result = deriveAttention({
      ...CLEAN,
      enrollmentStates: ["started", "approval_pending"],
    })

    const review = result.items.find(
      (candidate) => candidate.category === "enrollment_pending_review",
    )
    assert.ok(review)
    assert.equal(review.count, 2)

    assert.equal(
      result.items.some(
        (candidate) => candidate.category === "payment_pending_verification",
      ),
      false,
      "an opened checkout is not payment verification",
    )
  })

  it("flags an unapproved consent affirmation as blocked", () => {
    const result = deriveAttention({
      ...CLEAN,
      students: [student(false), student(false), student(true)],
    })

    const consent = result.items.find(
      (candidate) => candidate.category === "consent_unavailable",
    )
    assert.ok(consent)
    assert.equal(consent.count, 2)
    assert.equal(consent.tone, "blocked")
  })

  it("counts only published programs as missing an educator", () => {
    // A draft with no educator is not an operational problem; a published one
    // is, because families can reach it and no educator can serve it.
    const result = deriveAttention({
      ...CLEAN,
      programs: [
        program({ educatorAssigned: false }),
        program({ publicationState: "draft", educatorAssigned: false }),
        program({ publicationState: "archived", educatorAssigned: false }),
      ],
    })

    const missing = result.items.find(
      (candidate) => candidate.category === "missing_educator_assignment",
    )
    assert.ok(missing)
    assert.equal(missing.count, 1)
  })

  it("reports unpublished detail as unpublished, not as a defect", () => {
    const result = deriveAttention({
      ...CLEAN,
      programs: [program({ hasUnpublishedDetail: true })],
    })

    const incomplete = result.items.find(
      (candidate) => candidate.category === "incomplete_program_information",
    )
    assert.ok(incomplete)
    assert.match(incomplete.detail, /no published price, schedule, or dates/i)
    assert.equal(incomplete.tone, "information")
  })

  it("keeps the approved hierarchy order", () => {
    const result = deriveAttention({
      enrollmentStates: ["payment_pending", "approval_pending", "blocked"],
      students: [student(false)],
      programs: [
        program({
          educatorAssigned: false,
          needsContentReview: true,
          hasUnpublishedDetail: true,
        }),
      ],
    })

    assert.deepEqual(
      result.items.map((item) => item.category),
      [
        "payment_pending_verification",
        "enrollment_pending_review",
        "consent_unavailable",
        "enrollment_blocked",
        "missing_educator_assignment",
        "content_review_required",
        "incomplete_program_information",
      ],
    )
  })

  it("marks the result incomplete when a source could not be read", () => {
    // The distinction that matters: a short list from a partial read must not
    // be presentable as "nothing needs attention".
    const result = deriveAttention({ ...CLEAN, enrollmentStates: null })

    assert.equal(result.incomplete, true)
    assert.equal(
      result.items.some((item) => item.category.startsWith("enrollment")),
      false,
      "no enrollment claim is made from a failed enrollment read",
    )
  })

  it("makes no claim at all when every source failed", () => {
    const result = deriveAttention({
      enrollmentStates: null,
      students: null,
      programs: null,
    })

    assert.deepEqual(result.items, [])
    assert.equal(result.incomplete, true)
  })

  it("marks enrollment, consent, and family items as sample records", () => {
    const result = deriveAttention({
      enrollmentStates: ["payment_pending"],
      students: [student(false)],
      programs: [program()],
    })

    for (const item of result.items) {
      assert.equal(
        item.sample,
        true,
        `${item.category} is sanitized sample data`,
      )
    }
  })
})

describe("describeActivity", () => {
  it("phrases every audited pair in plain language", () => {
    assert.equal(describeActivity("program", "created"), "Program created")
    assert.equal(
      describeActivity("program", "updated"),
      "Program details updated",
    )
    assert.equal(
      describeActivity("educator_assignment", "assigned"),
      "Educator assignment added",
    )
    assert.equal(
      describeActivity("enrollment", "state_changed"),
      "Enrollment state changed",
    )
  })

  it("phrases the family and student events the setup flow emits", () => {
    /* These three are emitted by `create_family_for_current_user` and the
       `students` audit trigger. They were missing from the first version of the
       map, so every recent row on the overview degraded to the fallback and an
       administrator saw eight identical lines. */
    assert.equal(
      describeActivity("family", "created"),
      "Family account created",
    )
    assert.equal(
      describeActivity("student", "created"),
      "Student profile added",
    )
    assert.equal(
      describeActivity("student", "deleted"),
      "Student profile removed",
    )
  })

  it("names no child or family in any phrasing", () => {
    // Audit rows carry no name, and no phrasing may introduce one.
    for (const [entity, action] of [
      ["family", "created"],
      ["student", "created"],
      ["student", "deleted"],
      ["enrollment", "state_changed"],
    ] as const) {
      const description = describeActivity(entity, action)
      assert.doesNotMatch(description, /sample|@|name/i)
    }
  })

  it("never renders an unmapped database string", () => {
    // The fallback is the control: an entity type added by a future migration
    // must not put its raw name on an operator's screen.
    const description = describeActivity("consent_record", "superseded")

    assert.equal(description, "Operational change recorded")
    assert.doesNotMatch(description, /consent_record|superseded/)
  })
})
