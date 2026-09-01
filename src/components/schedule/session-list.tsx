import { MapPin } from "lucide-react"

import {
  presentationStateOf,
  SessionStateBadge,
  sessionStateSentence,
} from "@/components/schedule/session-state"
import { byStartTime, sessionVariant } from "@/lib/schedule/sessions"
import {
  PROGRAM_TIME_ZONE,
  PROGRAM_TIME_ZONE_LABEL,
} from "@/lib/schedule/timezone"

import type { ScheduleSession } from "@/lib/schedule/repository"

/**
 * MDS `components.schedule_item` — the one session presentation in the product.
 *
 * Sizes `compact`, `standard`, and `agenda` are the approved set. Variants
 * `class`, `cancelled`, and `rescheduled` are the three this release has a
 * source for; `event` and `deadline` are approved variants nothing here can
 * distinguish, so they are not rendered rather than guessed at from a title.
 *
 * WHY TWO TIME MODES
 *
 * `derived` judges each session against the current moment, so a reader sees
 * Today, Upcoming, Rescheduled, Completed, or Cancelled. It is correct only
 * where the page renders per request, which the portal surfaces do.
 *
 * `stored` shows only what an administrator decided — Rescheduled, Cancelled,
 * Completed — and no time-derived claim at all. The public catalog and calendar
 * are statically rendered, so a "Today" baked at build time would be a claim
 * about a day that has since passed. The date is printed either way; what the
 * static surfaces decline to do is characterise it.
 *
 * MPS-ACC-025 is why a moved session prints the time it moved FROM: the current
 * state replaces the stale guidance "without erasing history".
 */
type SessionListSize = "compact" | "standard" | "agenda"

/**
 * A list of sessions, in chronological order.
 * @param sessions - The sessions to render.
 * @param size - The MDS size token.
 * @param timeMode - `derived` for per-request surfaces, `stored` for static.
 * @param emptyMessage - What to say when there are no sessions.
 * @param headingLevel - The heading level for each session title.
 * @returns The list.
 */
function SessionList({
  sessions,
  size = "standard",
  timeMode = "derived",
  emptyMessage,
  headingLevel = "h3",
}: {
  sessions: readonly ScheduleSession[]
  size?: SessionListSize
  timeMode?: "derived" | "stored"
  emptyMessage: string
  headingLevel?: "h3" | "h4"
}) {
  if (sessions.length === 0) {
    return (
      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
      {byStartTime(sessions).map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          size={size}
          timeMode={timeMode}
          headingLevel={headingLevel}
        />
      ))}
    </ul>
  )
}

/**
 * One session.
 * @param session - The session to render.
 * @param size - The MDS size token.
 * @param timeMode - `derived` for per-request surfaces, `stored` for static.
 * @param headingLevel - The heading level for the session title.
 * @returns The list item.
 */
function SessionItem({
  session,
  size = "standard",
  timeMode = "derived",
  headingLevel = "h3",
}: {
  session: ScheduleSession
  size?: SessionListSize
  timeMode?: "derived" | "stored"
  headingLevel?: "h3" | "h4"
}) {
  const Heading = headingLevel
  const variant = sessionVariant(session.state)
  /* In `stored` mode a scheduled session gets no state badge at all: its date
     is the fact, and characterising it as "upcoming" at build time would be a
     claim about a day that may already have passed. */
  const state =
    timeMode === "derived"
      ? presentationStateOf(session)
      : session.state === "canceled"
        ? "cancelled"
        : session.state === "completed"
          ? "completed"
          : session.state === "rescheduled"
            ? "changed"
            : null

  return (
    <li
      data-variant={variant}
      data-size={size}
      className={[
        "flex flex-col gap-[var(--hsh-space-2)]",
        "rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)]",
        "bg-[var(--hsh-surface-card)]",
        size === "compact"
          ? "p-[var(--hsh-space-3)]"
          : "p-[var(--hsh-space-4)]",
        /* A cancelled session stays fully legible. Fading it would make the one
           state a family most needs to read the hardest one to read. */
        session.state === "canceled" ? "border-[var(--hsh-coral-300)]" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-2)]">
        <Heading className="hsh-h5 m-0 text-[var(--hsh-text-primary)]">
          {session.title}
        </Heading>
        {state ? <SessionStateBadge state={state} /> : null}
      </div>

      <p className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
        <time dateTime={session.startsAt}>{formatSessionTime(session)}</time>
      </p>

      {session.location ? (
        <p className="hsh-body-sm m-0 flex items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          {session.location}
        </p>
      ) : null}

      {/* MPS-ACC-025: the current state replaces the stale guidance, and the
          time it moved from is preserved rather than erased. */}
      {session.state === "rescheduled" && session.rescheduledFrom ? (
        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          Previously{" "}
          <time dateTime={session.rescheduledFrom}>
            {formatDateTime(session.rescheduledFrom)}
          </time>
          .
        </p>
      ) : null}

      {state ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          {sessionStateSentence(state)}
        </p>
      ) : null}

      {session.changeNote ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          {session.changeNote}
        </p>
      ) : null}
    </li>
  )
}

/**
 * A session's date and time range, as one readable phrase.
 *
 * Rendered from the stored instants with a fixed locale, so the server and
 * client markup match and no hydration mismatch appears. The times are real
 * instants — which is the whole reason this slice exists, and the reason the
 * published schedule TEXT could never be formatted this way.
 *
 * @param session - The session whose time is wanted.
 * @returns The formatted phrase.
 */
function formatSessionTime(session: ScheduleSession) {
  const ends = new Date(session.endsAt)
  /* Compared in the program zone, not the runtime's: a session running to
     8pm ET spans two UTC days, and `toDateString()` would print the end date
     redundantly for every evening class. */
  const sameDay =
    DAY_KEY.format(new Date(session.startsAt)) === DAY_KEY.format(ends)

  const range = sameDay
    ? `${formatDateTime(session.startsAt)} – ${TIME.format(ends)}`
    : `${formatDateTime(session.startsAt)} – ${formatDateTime(session.endsAt)}`

  return `${range} ${PROGRAM_TIME_ZONE_LABEL}`
}

/* Both formatters name the zone explicitly. Without `timeZone`, the server
   renders in the runtime's zone and the browser re-renders in the viewer's,
   producing two different strings for one instant — a hydration mismatch, and
   a family reading a time that changes under them. The zone is Home School
   Haven's own; see `src/lib/schedule/timezone.ts` (deviation D-SC3). */
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROGRAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * One instant, formatted for reading.
 * @param iso - The ISO timestamp.
 * @returns The formatted phrase.
 */
function formatDateTime(iso: string) {
  return DATE_TIME.format(new Date(iso))
}

export { formatDateTime, formatSessionTime, SessionItem, SessionList }
export type { SessionListSize }
