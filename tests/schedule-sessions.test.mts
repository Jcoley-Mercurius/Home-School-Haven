import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  allowedSessionTargets,
  byStartTime,
  derivePresentationState,
  isSessionEditable,
  isSessionTransitionAllowed,
  isUpcoming,
  sessionVariant,
  SESSION_TRANSITIONS,
} from "../src/lib/schedule/sessions.ts"
import {
  describeCapacity,
  describeWaitlist,
  summarizeCapacity,
} from "../src/lib/schedule/capacity.ts"
import type { SessionState } from "../src/lib/schedule/sessions.ts"
import {
  formatProgramLocal,
  parseProgramLocal,
} from "../src/lib/schedule/timezone.ts"
import type { EnrollmentState } from "../src/lib/admin/transitions.ts"

/**
 * The two pure modules this slice decides from.
 *
 * The transition table is the product's answer to "which session changes are
 * approved". The database holds the authoritative copy and the pgTAP suite pins
 * that one; this pins the copy the UI renders buttons from, because a
 * divergence would offer an administrator an action that is refused — or hide
 * one that is allowed.
 *
 * The presentation derivation is where a stored decision meets the clock. Its
 * boundary cases are the ones a family would notice: a class that finished an
 * hour ago must not vanish from today's view, and a cancelled class must read
 * as cancelled whether its time has passed or not.
 *
 * The capacity module is the one place a number about a program is turned into
 * a sentence. What it must never do is invent one: with no capacity set there
 * is no figure to show, because checklist §1 is unanswered (GAP-ADMIN-004).
 */

/**
 * 2026-09-01, 14:00 UTC — which is 10:00 in Home School Haven's zone.
 *
 * Built from an explicit UTC instant rather than local parts, so these cases
 * mean the same thing whatever zone the test machine is in. Mid-morning ET is
 * chosen deliberately: every offset below then stays inside the same
 * program-zone day, which is the boundary the `today` cases are about.
 */
const now = new Date("2026-09-01T14:00:00Z")

/** Build a session at an offset in hours from `now`. */
function at(
  startHours: number,
  lengthHours = 2,
  state: SessionState = "scheduled",
) {
  const startsAt = new Date(now.getTime() + startHours * 3_600_000)
  const endsAt = new Date(startsAt.getTime() + lengthHours * 3_600_000)
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    state,
  }
}

describe("session transitions", () => {
  it("offers cancel and complete from an open session", () => {
    assert.deepEqual(allowedSessionTargets("scheduled"), [
      "completed",
      "canceled",
    ])
    assert.deepEqual(allowedSessionTargets("rescheduled"), [
      "completed",
      "canceled",
    ])
  })

  it("treats canceled and completed as terminal", () => {
    /* Reinstating a session families were told is off, or reopening one that
       was closed, is a reversal MPS approves no rule for. The approved
       recovery is to author a new session. */
    assert.deepEqual(allowedSessionTargets("canceled"), [])
    assert.deepEqual(allowedSessionTargets("completed"), [])
    assert.equal(isSessionTransitionAllowed("canceled", "scheduled"), false)
    assert.equal(isSessionTransitionAllowed("completed", "scheduled"), false)
    assert.equal(isSessionTransitionAllowed("canceled", "completed"), false)
  })

  it("allows a session to be moved more than once", () => {
    assert.equal(isSessionTransitionAllowed("rescheduled", "rescheduled"), true)
  })

  it("permits editing only an open session", () => {
    assert.equal(isSessionEditable("scheduled"), true)
    assert.equal(isSessionEditable("rescheduled"), true)
    assert.equal(isSessionEditable("canceled"), false)
    assert.equal(isSessionEditable("completed"), false)
  })

  it("names a target for every stored state, so no state is unhandled", () => {
    const states: SessionState[] = [
      "scheduled",
      "rescheduled",
      "canceled",
      "completed",
    ]
    for (const state of states) {
      assert.ok(SESSION_TRANSITIONS[state], `${state} has a transition entry`)
    }
  })
})

describe("presentation state", () => {
  it("lets a stored decision win over the clock", () => {
    /* A cancelled class is cancelled whether or not its time has passed. */
    assert.equal(
      derivePresentationState(at(48, 2, "canceled"), now),
      "cancelled",
    )
    assert.equal(
      derivePresentationState(at(-48, 2, "canceled"), now),
      "cancelled",
    )
    assert.equal(
      derivePresentationState(at(48, 2, "completed"), now),
      "completed",
    )
  })

  it("reads a future session as upcoming, and a moved one as changed", () => {
    assert.equal(derivePresentationState(at(48), now), "upcoming")
    assert.equal(
      derivePresentationState(at(48, 2, "rescheduled"), now),
      "changed",
    )
  })

  it("keeps today's session on today, even after it has finished", () => {
    /* The boundary a family would notice: a class that ended at 09:00 must not
       drop out of today's view at 10:00. */
    assert.equal(derivePresentationState(at(-3, 2), now), "today")
    assert.equal(derivePresentationState(at(2), now), "today")
    /* And a moved session that lands today reads as today, not as changed —
       the day is the more urgent fact. */
    assert.equal(derivePresentationState(at(2, 2, "rescheduled"), now), "today")
  })

  it("reads a past session as completed once its day has passed", () => {
    assert.equal(derivePresentationState(at(-48), now), "completed")
  })

  it("maps each state to its MDS variant", () => {
    assert.equal(sessionVariant("scheduled"), "class")
    assert.equal(sessionVariant("rescheduled"), "rescheduled")
    assert.equal(sessionVariant("canceled"), "cancelled")
    assert.equal(sessionVariant("completed"), "class")
  })

  it("counts a session as upcoming until it ends, and never once called off", () => {
    assert.equal(isUpcoming(at(2), now), true)
    assert.equal(isUpcoming(at(-1, 2), now), true)
    assert.equal(isUpcoming(at(-48), now), false)
    assert.equal(isUpcoming(at(48, 2, "canceled"), now), false)
    assert.equal(isUpcoming(at(48, 2, "completed"), now), false)
  })

  it("orders sessions by real time, which published text never allowed", () => {
    const ordered = byStartTime([at(48), at(2), at(-48)])
    assert.deepEqual(
      ordered.map((session) => session.startsAt),
      [at(-48).startsAt, at(2).startsAt, at(48).startsAt],
    )
  })
})

describe("capacity", () => {
  const states = (...values: EnrollmentState[]): readonly EnrollmentState[] =>
    values

  it("says nothing numeric when no capacity is established", () => {
    const summary = summarizeCapacity(null, states("confirmed", "waitlisted"))
    assert.equal(summary.status, "notEstablished")
    const sentence = describeCapacity(summary)
    /* GAP-ADMIN-004: checklist §1 is unanswered, so there is no number to show
       and none may be implied. A zero or a dash would read as one. */
    assert.match(sentence, /has not set a capacity/)
    assert.doesNotMatch(sentence, /\d/)
  })

  it("counts only confirmed places against capacity", () => {
    /* A waitlisted, pending, or blocked record holds nothing. Counting one
       would turn a waitlist place into a seat, which is exactly what
       MPS-RUL-002 says a waitlist is not. */
    const summary = summarizeCapacity(
      10,
      states(
        "confirmed",
        "confirmed",
        "waitlisted",
        "payment_pending",
        "blocked",
        "canceled",
      ),
    )
    assert.equal(summary.status, "established")
    if (summary.status !== "established") return
    assert.equal(summary.confirmed, 2)
    assert.equal(summary.waitlisted, 1)
    assert.equal(summary.remaining, 8)
    assert.equal(summary.overCapacity, false)
  })

  it("reports over-capacity without ever going negative", () => {
    const summary = summarizeCapacity(1, states("confirmed", "confirmed"))
    assert.equal(summary.status, "established")
    if (summary.status !== "established") return
    assert.equal(summary.overCapacity, true)
    assert.equal(summary.remaining, 0)
    /* GAP-ADMIN-012: the condition is stated and nothing is decided. */
    assert.match(describeCapacity(summary), /No enrollment has been changed/)
  })

  it("says full at exactly capacity", () => {
    const summary = summarizeCapacity(2, states("confirmed", "confirmed"))
    assert.match(describeCapacity(summary), /^Full: 2 of 2 places confirmed\.$/)
  })

  it("always says what a waitlist place is not", () => {
    for (const sentence of [
      describeWaitlist(true, 0),
      describeWaitlist(true, 3),
      describeWaitlist(false, 1),
    ]) {
      assert.ok(sentence)
      assert.match(sentence, /not enrollment/)
    }
  })

  it("says nothing about a waitlist a program does not have", () => {
    assert.equal(describeWaitlist(false, 0), null)
  })
})

describe("program timezone", () => {
  it("reads an authored time as Home School Haven's wall clock", () => {
    /* 10:00 on a September morning in Cape Coral is EDT, UTC-4. If this were
       parsed in the runtime's zone the stored instant would depend on where
       the server runs, and the same submission would mean two moments. */
    assert.equal(
      parseProgramLocal("2026-09-15T10:00"),
      "2026-09-15T14:00:00.000Z",
    )
  })

  it("handles standard time as well as daylight time", () => {
    /* January is EST, UTC-5. The offset comes from the runtime's tz database
       rather than from a constant, which is why both work. */
    assert.equal(
      parseProgramLocal("2026-01-15T10:00"),
      "2026-01-15T15:00:00.000Z",
    )
  })

  it("round-trips an instant back to the field it came from", () => {
    for (const local of [
      "2026-09-15T10:00",
      "2026-01-15T10:00",
      "2026-03-08T14:30",
      "2026-11-01T14:30",
    ]) {
      const iso = parseProgramLocal(local)
      assert.ok(iso, `${local} parses`)
      assert.equal(formatProgramLocal(iso), local)
    }
  })

  it("survives the hour on either side of a daylight saving change", () => {
    /* The two-step offset resolution exists for exactly these. Without it one
       hour twice a year would be stored an hour out. */
    assert.equal(
      parseProgramLocal("2026-03-08T01:30"),
      "2026-03-08T06:30:00.000Z",
    )
    assert.equal(
      parseProgramLocal("2026-03-08T03:30"),
      "2026-03-08T07:30:00.000Z",
    )
  })

  it("refuses a value that is not a moment", () => {
    assert.equal(parseProgramLocal("nonsense"), null)
    assert.equal(parseProgramLocal(""), null)
    assert.equal(parseProgramLocal("2026-13-01T10:00"), null)
    /* Survives the regex and would otherwise roll silently into March, storing
       a different day than the one submitted. */
    assert.equal(parseProgramLocal("2026-02-31T10:00"), null)
    /* 02:30 never occurs on the spring-forward day in America/New_York. */
    assert.equal(parseProgramLocal("2026-03-08T02:30"), null)
    /* The form contract is minute precision; silently dropping seconds would
       store a different wall-clock value than the one submitted. */
    assert.equal(parseProgramLocal("2026-09-15T10:00:30"), null)
  })
})
