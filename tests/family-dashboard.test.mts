import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { nextAction, selectStudent } from "../src/lib/family/dashboard-state.ts"
import type { EnrollmentRecord } from "../src/lib/enrollment/repository.ts"
import type { Student } from "../src/lib/family/repository.ts"

/**
 * The two dashboard judgements, exercised directly.
 *
 * Both are worth pinning here rather than only through the browser. The
 * selector's fallback is a security-adjacent behaviour whose whole point is
 * that it is invisible — an end-to-end test can only observe that nothing bad
 * happened, while this can observe exactly what happened. And the next-action
 * priority is a chain of eight branches where the ordering is the requirement:
 * a payment-pending family must never be told to go browse programs.
 */

function student(id: string, preferredName: string): Student {
  return {
    id,
    preferredName,
    gradeLevel: null,
    guardianRelationship: null,
  }
}

function enrollment(state: EnrollmentRecord["state"]): EnrollmentRecord {
  return {
    id: `enrollment-${state}`,
    studentId: "student-a",
    studentName: "Sample Student A1",
    state,
    programId: "program-a",
    program: { slug: "art-lab", name: "Art Lab", publishedSchedule: null },
  }
}

const STUDENTS = [
  student("student-a", "Sample A1"),
  student("student-b", "Sample A2"),
]

describe("selectStudent", () => {
  it("returns null when the family has no students", () => {
    assert.equal(selectStudent([], undefined), null)
    assert.equal(selectStudent([], "student-a"), null)
  })

  it("defaults to the first student when nothing is requested", () => {
    assert.equal(selectStudent(STUDENTS, undefined)?.id, "student-a")
    assert.equal(selectStudent(STUDENTS, null)?.id, "student-a")
    assert.equal(selectStudent(STUDENTS, "")?.id, "student-a")
  })

  it("honours a requested id that belongs to the family", () => {
    assert.equal(selectStudent(STUDENTS, "student-b")?.id, "student-b")
  })

  /* The one that matters. An id from another family is not an error message,
     not a 403, and not a disclosure that the id exists elsewhere — it is
     indistinguishable from an id that never existed. */
  it("falls back silently for an id outside the family", () => {
    for (const foreign of [
      "student-from-another-family",
      "00000000-0000-4000-8000-000000000000",
      "'; drop table students; --",
    ]) {
      assert.equal(
        selectStudent(STUDENTS, foreign)?.id,
        "student-a",
        `${foreign} must fall back rather than select`,
      )
    }
  })
})

describe("nextAction", () => {
  it("asks for a student profile before anything else", () => {
    const action = nextAction([], [enrollment("payment_pending")])
    assert.equal(action?.title, "Add a student profile")
  })

  /* A failed enrollment read must not become "you have no registrations".
     Claiming an action from data we do not have is the guess this returns
     null to avoid. */
  it("claims no action when the enrollment read failed", () => {
    assert.equal(nextAction(STUDENTS, null), null)
  })

  it("surfaces payment verification above every other enrollment state", () => {
    const action = nextAction(STUDENTS, [
      enrollment("confirmed"),
      enrollment("waitlisted"),
      enrollment("approval_pending"),
      enrollment("payment_pending"),
    ])
    assert.equal(action?.title, "Payment verification pending")
    assert.equal(action?.tone, "attention")
    assert.match(action!.body, /not yet confirmed/)
  })

  it("never lets a confirmed enrollment mask an unresolved one", () => {
    for (const unresolved of [
      "started",
      "payment_failed",
      "blocked",
      "approval_pending",
      "waitlisted",
    ] as const) {
      const action = nextAction(STUDENTS, [
        enrollment("confirmed"),
        enrollment(unresolved),
      ])
      assert.notEqual(
        action,
        null,
        `${unresolved} alongside confirmed must still raise an action`,
      )
    }
  })

  it("offers the catalog only when there is genuinely nothing", () => {
    const action = nextAction(STUDENTS, [])
    assert.equal(action?.title, "Explore what is on offer")
    assert.equal(action?.href, "/programs")
  })

  it("stays quiet when every enrollment is settled", () => {
    assert.equal(
      nextAction(STUDENTS, [enrollment("confirmed"), enrollment("canceled")]),
      null,
    )
  })

  it("promises no financial or policy outcome in any branch", () => {
    const states: EnrollmentRecord["state"][] = [
      "started",
      "approval_pending",
      "payment_pending",
      "waitlisted",
      "confirmed",
      "payment_failed",
      "canceled",
      "blocked",
    ]
    for (const state of states) {
      const action = nextAction(STUDENTS, [enrollment(state)])
      if (!action) continue
      const copy = `${action.title} ${action.body}`
      assert.doesNotMatch(
        copy,
        /refund|scholarship|discount|credit|transfer|approved for|eligible/i,
        `the ${state} action must not imply a financial or policy outcome`,
      )
    }
  })

  it("never calls a waitlist place an enrollment", () => {
    const action = nextAction(STUDENTS, [enrollment("waitlisted")])
    assert.match(action!.body, /not enrollment/)
  })
})
