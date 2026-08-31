import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { EDUCATOR_ROSTER_COLUMNS } from "../src/lib/admin/roster-state.ts"
import {
  EDUCATOR_ROSTER_SELECT,
  scheduleFacts,
  summarizeUnconfirmed,
  summarizeWorkspace,
} from "../src/lib/educator/workspace-state.ts"
import type { EnrollmentState } from "../src/lib/admin/transitions.ts"
import type { AssignedProgram } from "../src/lib/educator/workspace-state.ts"

/**
 * The educator workspace's judgements, exercised without a database.
 *
 * The first block is the one that matters most: it is the runtime half of the
 * privacy control. `ALLOWLIST_MATCHES_SELECT` in `workspace-state.ts` binds the
 * allowlist to the select literal at compile time in both directions, and this
 * asserts the literal actually spells the allowlist rather than merely agreeing
 * with it in cardinality. Together they mean widening what an educator sees of
 * a child cannot happen quietly — it breaks the build, then it breaks a test.
 */

/** A program with every published fact unset, to be overridden per case. */
function program(overrides: Partial<AssignedProgram> = {}): AssignedProgram {
  return {
    id: "10000000-0000-4000-8000-000000000004",
    slug: "sample-program",
    name: "Sample Program",
    summary: null,
    audience: null,
    format: null,
    location: null,
    educator: null,
    publishedDates: null,
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: null,
    enrollmentWindow: null,
    publicationState: "published",
    ...overrides,
  }
}

describe("EDUCATOR_ROSTER_SELECT", () => {
  it("asks for exactly the canonical allowlist and nothing more", () => {
    assert.equal(EDUCATOR_ROSTER_SELECT, EDUCATOR_ROSTER_COLUMNS.join(","))
  })

  it("selects no family, no grade, and no guardian data", () => {
    for (const forbidden of [
      "families",
      "students",
      "grade_level",
      "guardian_relationship",
      "state_note",
      "affirm",
      "email",
    ]) {
      assert.ok(
        !EDUCATOR_ROSTER_SELECT.includes(forbidden),
        `${forbidden} must never appear in the educator roster select`,
      )
    }
  })

  it("is exactly the allowlist, pinned", () => {
    /* A column added here without a reason would reach the response body of an
       educator page. Pinning the whole literal makes that a deliberate edit,
       and the compile-time guard in `workspace-state.ts` makes it a failing
       build if the allowlist and this literal ever disagree. */
    assert.equal(EDUCATOR_ROSTER_SELECT, "preferred_name")
  })
})

describe("summarizeUnconfirmed", () => {
  it("counts nothing when every record is confirmed", () => {
    assert.deepEqual(summarizeUnconfirmed(["confirmed", "confirmed"]), {
      total: 0,
      byState: [],
    })
  })

  it("treats every state that is not exactly `confirmed` as unconfirmed", () => {
    const states: EnrollmentState[] = [
      "started",
      "approval_pending",
      "payment_pending",
      "waitlisted",
      "payment_failed",
      "canceled",
      "blocked",
    ]
    const summary = summarizeUnconfirmed(states)
    assert.equal(summary.total, states.length)
    assert.equal(summary.byState.length, states.length)
  })

  it("groups repeated states and keeps first-seen order", () => {
    const summary = summarizeUnconfirmed([
      "waitlisted",
      "payment_pending",
      "waitlisted",
      "confirmed",
    ])
    assert.equal(summary.total, 3)
    assert.deepEqual(summary.byState, [
      { state: "waitlisted", count: 2 },
      { state: "payment_pending", count: 1 },
    ])
  })

  it("never reports a confirmed record among the unconfirmed", () => {
    /* MPS-ACC-028's failure mode, stated as a test: the one thing this surface
       must not do is present a confirmed child as unsettled or the reverse. */
    const summary = summarizeUnconfirmed(["confirmed", "payment_pending"])
    assert.equal(summary.total, 1)
    assert.deepEqual(summary.byState, [{ state: "payment_pending", count: 1 }])
  })

  it("is empty for a program with no enrollments at all", () => {
    assert.deepEqual(summarizeUnconfirmed([]), { total: 0, byState: [] })
  })
})

describe("scheduleFacts", () => {
  it("returns nothing when the source publishes no schedule", () => {
    assert.deepEqual(scheduleFacts(program()), [])
  })

  it("returns only the facts that are actually published", () => {
    const facts = scheduleFacts(
      program({ publishedSchedule: "Tuesdays", publishedDuration: "8 weeks" }),
    )
    assert.deepEqual(facts, [
      { label: "Schedule", value: "Tuesdays" },
      { label: "Duration", value: "8 weeks" },
    ])
  })

  it("treats whitespace as unpublished rather than as a value", () => {
    assert.deepEqual(scheduleFacts(program({ publishedSchedule: "   " })), [])
  })

  it("keeps a fixed reading order regardless of which facts exist", () => {
    const facts = scheduleFacts(
      program({
        enrollmentWindow: "Opens in spring",
        publishedDates: "Fall term",
      }),
    )
    assert.deepEqual(
      facts.map((fact) => fact.label),
      ["Dates", "Registration window"],
    )
  })
})

describe("summarizeWorkspace", () => {
  it("is all zeroes for an unassigned educator", () => {
    assert.deepEqual(summarizeWorkspace([]), {
      assignedPrograms: 0,
      publishedPrograms: 0,
      programsWithSchedule: 0,
    })
  })

  it("counts drafts as assigned but not as published", () => {
    const summary = summarizeWorkspace([
      program({ id: "a", publicationState: "published" }),
      program({ id: "b", publicationState: "draft" }),
    ])
    assert.equal(summary.assignedPrograms, 2)
    assert.equal(summary.publishedPrograms, 1)
  })

  it("counts a program with any published schedule fact", () => {
    const summary = summarizeWorkspace([
      program({ id: "a", publishedSchedule: "Tuesdays" }),
      program({ id: "b" }),
    ])
    assert.equal(summary.programsWithSchedule, 1)
  })
})
