import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { partitionRoster } from "../src/lib/admin/roster-state.ts"
import { assignmentSchema } from "../src/lib/admin/validation.ts"
import type { RosterEntry } from "../src/lib/admin/roster-state.ts"
import type { EnrollmentState } from "../src/lib/admin/transitions.ts"

/**
 * The roster rule, exercised directly.
 *
 * MPS-ACC-028 is the acceptance criterion this slice exists to satisfy: "given
 * a confirmed enrollment, when the roster is viewed, then the student appears
 * exactly once in the correct program". The database proves the scoping and the
 * authorization half of that in `80_admin_family_educator_roster.test.sql`.
 * What is left is the judgement — which of a program's enrollments constitute
 * its roster — and that is worth pinning without a database, because it is the
 * one place a mistake would present an unconfirmed child as enrolled.
 *
 * The tests below are deliberately paranoid about the ONE failure mode that
 * matters: something that is not `confirmed` appearing in `confirmed`.
 */

function entry(
  id: string,
  state: EnrollmentState,
  studentName = `Sample Student ${id}`,
  familyName = "Sample Family A",
): RosterEntry {
  return {
    enrollmentId: id,
    state,
    stateChangedAt: `2026-08-0${id}T00:00:00Z`,
    studentName,
    familyName,
  }
}

describe("partitionRoster", () => {
  it("puts a confirmed enrollment on the roster", () => {
    const roster = partitionRoster([entry("1", "confirmed")])

    assert.equal(roster.confirmed.length, 1)
    assert.equal(roster.notConfirmed.length, 0)
    assert.equal(roster.confirmed[0]?.enrollmentId, "1")
  })

  /* The whole point of the surface. Each of these is a state that a careless
     "not cancelled" rule would have let onto a roster. */
  const NEVER_ON_A_ROSTER: EnrollmentState[] = [
    "started",
    "approval_pending",
    "payment_pending",
    "waitlisted",
    "payment_failed",
    "canceled",
    "blocked",
  ]

  for (const state of NEVER_ON_A_ROSTER) {
    it(`keeps a ${state} enrollment off the roster`, () => {
      const roster = partitionRoster([entry("1", state)])

      assert.equal(
        roster.confirmed.length,
        0,
        `${state} must never be presented as enrolled`,
      )
      assert.equal(roster.notConfirmed.length, 1)
      assert.equal(roster.notConfirmed[0]?.state, state)
    })
  }

  /* The seeded shape: one program carrying a confirmed child and an
     unconfirmed one. If these ever merge, a family that has not been confirmed
     appears to have a place. */
  it("separates a confirmed and a payment-pending child on one program", () => {
    const roster = partitionRoster([
      entry("1", "payment_pending", "Sample Student A1"),
      entry("2", "confirmed", "Sample Student A2"),
    ])

    assert.deepEqual(
      roster.confirmed.map((line) => line.studentName),
      ["Sample Student A2"],
    )
    assert.deepEqual(
      roster.notConfirmed.map((line) => line.studentName),
      ["Sample Student A1"],
    )
  })

  it("counts every enrollment exactly once across the two lists", () => {
    const entries = [
      entry("1", "confirmed"),
      entry("2", "waitlisted"),
      entry("3", "confirmed"),
      entry("4", "canceled"),
    ]
    const roster = partitionRoster(entries)

    assert.equal(
      roster.confirmed.length + roster.notConfirmed.length,
      entries.length,
      "no enrollment may be dropped or duplicated by the split",
    )

    const ids = [...roster.confirmed, ...roster.notConfirmed].map(
      (line) => line.enrollmentId,
    )
    assert.equal(new Set(ids).size, ids.length, "no enrollment appears twice")
  })

  it("orders the roster by student name, not by recency", () => {
    const roster = partitionRoster([
      entry("1", "confirmed", "Sample Student C"),
      entry("2", "confirmed", "Sample Student A"),
      entry("3", "confirmed", "Sample Student B"),
    ])

    assert.deepEqual(
      roster.confirmed.map((line) => line.studentName),
      ["Sample Student A", "Sample Student B", "Sample Student C"],
    )
  })

  it("keeps the unconfirmed list in the order it was given", () => {
    const roster = partitionRoster([
      entry("1", "waitlisted", "Sample Student C"),
      entry("2", "approval_pending", "Sample Student A"),
    ])

    assert.deepEqual(
      roster.notConfirmed.map((line) => line.enrollmentId),
      ["1", "2"],
      "recency ordering from the query survives the split",
    )
  })

  /* Partial data is reported, never hidden: an enrollment whose join failed is
     still a real record that an administrator is accountable for. */
  it("reports an unresolved student join without dropping the row", () => {
    const roster = partitionRoster([entry("1", "confirmed", "")])

    assert.equal(roster.partial, 1)
    assert.equal(roster.confirmed.length, 1, "the row is still shown")
  })

  it("reports an unresolved family join", () => {
    const roster = partitionRoster([
      entry("1", "confirmed", "Sample Student A1", ""),
    ])

    assert.equal(roster.partial, 1)
  })

  it("counts a row with both joins unresolved once", () => {
    const roster = partitionRoster([entry("1", "waitlisted", "", "")])

    assert.equal(roster.partial, 1)
  })

  it("reports an empty program as empty rather than as a failure", () => {
    const roster = partitionRoster([])

    assert.deepEqual(roster, { confirmed: [], notConfirmed: [], partial: 0 })
  })

  /* The state an empty roster page must render correctly: nobody confirmed,
     but the program is not idle. */
  it("reports an empty roster while unconfirmed records exist", () => {
    const roster = partitionRoster([
      entry("1", "waitlisted"),
      entry("2", "payment_pending"),
    ])

    assert.equal(roster.confirmed.length, 0)
    assert.equal(roster.notConfirmed.length, 2)
  })
})

describe("assignmentSchema", () => {
  const valid = {
    educatorUserId: "20000000-0000-4000-8000-00000000000e",
    programId: "10000000-0000-4000-8000-000000000004",
    note: "Assigning for the autumn term.",
  }

  it("accepts a well-formed assignment", () => {
    assert.equal(assignmentSchema.safeParse(valid).success, true)
  })

  it("refuses a non-uuid educator id", () => {
    const result = assignmentSchema.safeParse({
      ...valid,
      educatorUserId: "sample.educator@example.com",
    })
    assert.equal(result.success, false)
  })

  it("refuses a non-uuid program id", () => {
    const result = assignmentSchema.safeParse({
      ...valid,
      programId: "art-lab",
    })
    assert.equal(result.success, false)
  })

  /* MPS-REQ-024: history is only useful if it says why. The database applies
     the same rule, so a request that never reaches this schema still meets it. */
  it("refuses an empty note", () => {
    assert.equal(
      assignmentSchema.safeParse({ ...valid, note: "   " }).success,
      false,
    )
  })

  it("refuses a note over 400 characters", () => {
    const result = assignmentSchema.safeParse({
      ...valid,
      note: "x".repeat(401),
    })
    assert.equal(result.success, false)
  })

  it("trims the note it accepts", () => {
    const result = assignmentSchema.safeParse({ ...valid, note: "  Autumn.  " })
    assert.equal(result.success && result.data.note, "Autumn.")
  })
})
