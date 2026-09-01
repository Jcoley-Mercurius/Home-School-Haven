import {
  CalendarClock,
  CalendarDays,
  CalendarX,
  CircleCheck,
  Sun,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { derivePresentationState } from "@/lib/schedule/sessions"

import type {
  PresentableSession,
  SessionPresentationState,
} from "@/lib/schedule/sessions"

/**
 * The single place a session's state becomes something a person reads (MDS
 * `components.schedule_item.states`).
 *
 * Every surface — public calendar, family schedule, educator workspace,
 * administrator agenda — renders from this one table, so a change to a label or
 * a sentence cannot reach one audience and not another. That is MPS-REQ-020's
 * consistency made structural rather than promised.
 *
 * Three rules hold it honest, the same three the enrollment-state table keeps:
 *
 *   1. Every entry carries an icon and an explicit label, so no state depends
 *      on colour to be understood (DESIGN-SYSTEM §10, WCAG 2.2 AA).
 *   2. `cancelled` and `changed` state their meaning in a sentence. Leaving a
 *      family to infer "this is not happening" from a grey badge is exactly the
 *      inference DO-DONT forbids.
 *   3. No entry claims a financial or enrollment consequence. Cancelling a
 *      session decides no refund, credit, or transfer (MPS-RUL-004), so no
 *      sentence here hints at one.
 */
const SESSION_STATE = {
  upcoming: {
    icon: CalendarDays,
    tone: "info",
    label: "Upcoming",
    sentence: "This session is scheduled.",
  },
  today: {
    icon: Sun,
    tone: "open",
    label: "Today",
    sentence: "This session is today.",
  },
  completed: {
    icon: CircleCheck,
    tone: "neutral",
    label: "Completed",
    sentence: "This session has taken place.",
  },
  changed: {
    icon: CalendarClock,
    tone: "limited",
    label: "Rescheduled",
    sentence: "Home School Haven has moved this session to a new time.",
  },
  cancelled: {
    icon: CalendarX,
    tone: "waitlist",
    label: "Cancelled",
    sentence:
      "Home School Haven has cancelled this session. No refund, credit, or transfer is decided here.",
  },
} as const satisfies Record<
  SessionPresentationState,
  {
    icon: typeof CalendarDays
    tone: "info" | "open" | "neutral" | "limited" | "waitlist"
    label: string
    sentence: string
  }
>

/**
 * The badge for one session's presentation state.
 * @param state - The derived presentation state.
 * @returns The badge.
 */
function SessionStateBadge({ state }: { state: SessionPresentationState }) {
  const entry = SESSION_STATE[state]
  const Icon = entry.icon

  return (
    <Badge tone={entry.tone}>
      <Icon aria-hidden="true" />
      {entry.label}
    </Badge>
  )
}

/**
 * The sentence for one session's presentation state.
 * @param state - The derived presentation state.
 * @returns The sentence, safe to render anywhere.
 */
function sessionStateSentence(state: SessionPresentationState) {
  return SESSION_STATE[state].sentence
}

/**
 * The presentation state for one session, judged against the current moment.
 *
 * A thin wrapper so components do not each construct their own `new Date()` and
 * disagree about "today" at a boundary.
 *
 * @param session - The session's times and stored state.
 * @returns The MDS state to render.
 */
function presentationStateOf(session: PresentableSession) {
  return derivePresentationState(session, new Date())
}

export {
  presentationStateOf,
  SESSION_STATE,
  SessionStateBadge,
  sessionStateSentence,
}
