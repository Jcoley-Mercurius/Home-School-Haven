/**
 * The session vocabulary — approved transitions, and the presentation state
 * derived from the clock.
 *
 * THIS FILE IS NOT THE CONTROL.
 *
 * `supabase/migrations/20260902000000_schedule_capacity_waitlist_attendance.sql`
 * is. `private.session_transition_allowed` decides every real write, for a
 * caller composing their own PostgREST request just as much as for this
 * application. What lives here decides only which buttons are worth rendering,
 * so an administrator is not offered an action that will be refused.
 *
 * The two must agree, and a divergence would be a defect in whichever was
 * changed alone. `tests/schedule-sessions.test.mts` pins this copy; the pgTAP
 * suite pins the SQL one — the arrangement `src/lib/admin/transitions.ts`
 * already uses, and for the same reason.
 *
 * No Supabase import and no `server-only` here on purpose: the Node test runner
 * cannot resolve the `@/` alias inside a `server-only` module, so a rule that
 * lived in the repository would be a rule nothing could test.
 *
 * WHY FOUR STORED STATES AND FIVE PRESENTED ONES
 *
 * Two approved vocabularies exist and they are not the same list, so they are
 * resolved by subject authority rather than by picking one:
 *
 *   - MPS owns the STATE. MPS-WFL-005's alternate paths name Rescheduled and
 *     Canceled; MPS-WFL-007's states name canceled and completed. Those four
 *     are decisions a person makes, and those four are what the database
 *     stores.
 *   - MDS `components.schedule_item` owns the PRESENTATION: states [upcoming,
 *     today, completed, changed, cancelled]. `upcoming` and `today` are facts
 *     about the clock, not decisions, so they are derived here and never
 *     stored. Storing them would need a scheduled job nothing approves, and
 *     would be wrong between its runs.
 */

import { PROGRAM_TIME_ZONE } from "./timezone.ts"

import type { Enums } from "@/lib/supabase/types"

/** The four states an authorized administrator decides. */
type SessionState = Enums<"session_state">

/** MDS `components.schedule_item.states`, which is what a reader sees. */
type SessionPresentationState =
  "upcoming" | "today" | "completed" | "changed" | "cancelled"

/** MDS `components.schedule_item.variants`, narrowed to what this release has. */
type SessionVariant = "class" | "cancelled" | "rescheduled"

/**
 * The states an administrator may move a session to, from each current state.
 *
 * `canceled` and `completed` are terminal, and that is a decision rather than
 * an omission. Reinstating a session Home School Haven has told families is
 * off, or reopening one it has closed, arrives at those families as a second
 * reversal with no approved notice behind it, and MPS defines no rule for it.
 * The approved recovery is to author a new session, which leaves both records
 * and both audit rows standing.
 *
 * `rescheduled → rescheduled` is legal: a session may be moved more than once,
 * and each move keeps the ORIGINAL time so a family still sees the time they
 * first planned around.
 */
const SESSION_TRANSITIONS = {
  scheduled: ["rescheduled", "canceled", "completed"],
  rescheduled: ["rescheduled", "canceled", "completed"],
  canceled: [],
  completed: [],
} as const satisfies Record<SessionState, readonly SessionState[]>

/** The two states an administrator sets directly, in the order offered. */
const SESSION_STATE_TARGETS = ["completed", "canceled"] as const

type SessionStateTarget = (typeof SESSION_STATE_TARGETS)[number]

/**
 * Whether one session transition is approved.
 * @param from - The session's current state.
 * @param to - The proposed state.
 * @returns True when the transition is approved.
 */
function isSessionTransitionAllowed(from: SessionState, to: SessionState) {
  return (SESSION_TRANSITIONS[from] as readonly SessionState[]).includes(to)
}

/**
 * The state targets worth offering for a session.
 * @param from - The session's current state.
 * @returns The approved targets, in the order they are offered.
 */
function allowedSessionTargets(
  from: SessionState,
): readonly SessionStateTarget[] {
  return SESSION_STATE_TARGETS.filter((target) =>
    isSessionTransitionAllowed(from, target),
  )
}

/**
 * Whether a session can still be edited at all.
 *
 * A canceled or completed session cannot, and the database refuses it. Knowing
 * that here means the edit form is not offered and then rejected.
 *
 * @param state - The session's current state.
 * @returns True when editing is approved.
 */
function isSessionEditable(state: SessionState) {
  return state === "scheduled" || state === "rescheduled"
}

/** The minimum a session must carry to be presented. */
type PresentableSession = {
  startsAt: string
  endsAt: string
  state: SessionState
}

/**
 * The MDS presentation state for one session, at one moment.
 *
 * The stored state wins wherever it says something: a cancelled session is
 * cancelled whether or not its time has passed, and a session an administrator
 * marked complete is complete. Only where the stored state says nothing about
 * time does the clock decide — and `today` is deliberately checked before
 * `completed`, so a class that finished an hour ago still reads as today's
 * rather than dropping out of a family's view on the afternoon it happened.
 *
 * @param session - The session's times and stored state.
 * @param now - The moment to judge against. Passed in rather than read, so this
 *   is a pure function and the boundary cases are testable.
 * @returns The MDS `schedule_item` state to render.
 */
function derivePresentationState(
  session: PresentableSession,
  now: Date,
): SessionPresentationState {
  if (session.state === "canceled") return "cancelled"
  if (session.state === "completed") return "completed"

  const starts = new Date(session.startsAt)
  const ends = new Date(session.endsAt)

  if (isSameProgramDay(starts, now)) return "today"
  if (ends.getTime() < now.getTime()) return "completed"
  if (session.state === "rescheduled") return "changed"
  return "upcoming"
}

/**
 * The MDS variant for one session.
 *
 * `deadline` and `event` are approved variants this release has no source of:
 * every session is a program meeting. They are not rendered rather than being
 * guessed at from a title.
 *
 * @param state - The session's stored state.
 * @returns The MDS `schedule_item` variant.
 */
function sessionVariant(state: SessionState): SessionVariant {
  if (state === "canceled") return "cancelled"
  if (state === "rescheduled") return "rescheduled"
  return "class"
}

/* `en-CA` yields `YYYY-MM-DD`, which compares as a string. The zone is named
   explicitly so "today" means today in Cape Coral rather than today wherever
   the runtime happens to be — a 7pm ET class is already tomorrow in UTC, and a
   family would otherwise lose it from their view mid-afternoon. */
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROGRAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Whether two moments fall on the same calendar day in Home School Haven's
 * timezone.
 *
 * @param a - The first moment.
 * @param b - The second moment.
 * @returns True when both fall on the same program-zone day.
 */
function isSameProgramDay(a: Date, b: Date) {
  return DAY_KEY.format(a) === DAY_KEY.format(b)
}

/**
 * Whether a session is still ahead — the test the "upcoming" surfaces use.
 * @param session - The session's times and stored state.
 * @param now - The moment to judge against.
 * @returns True when the session has not finished and was not called off.
 */
function isUpcoming(session: PresentableSession, now: Date) {
  if (session.state === "canceled" || session.state === "completed")
    return false
  return new Date(session.endsAt).getTime() >= now.getTime()
}

/**
 * Sort sessions by start time, soonest first.
 *
 * A real comparison on a real timestamp, which is the whole reason this slice
 * exists: the published schedule TEXT could never be ordered, because most
 * published ranges carry no year (deviations D-EW2 and D-FD1).
 *
 * @param sessions - The sessions to order.
 * @returns A new array in chronological order.
 */
function byStartTime<T extends { startsAt: string }>(sessions: readonly T[]) {
  return [...sessions].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
}

export {
  allowedSessionTargets,
  byStartTime,
  derivePresentationState,
  isSessionEditable,
  isSessionTransitionAllowed,
  isUpcoming,
  SESSION_STATE_TARGETS,
  SESSION_TRANSITIONS,
  sessionVariant,
}
export type {
  PresentableSession,
  SessionPresentationState,
  SessionState,
  SessionStateTarget,
  SessionVariant,
}
