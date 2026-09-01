import { AttendanceToggle } from "@/components/educator/attendance-toggle"
import { formatSessionTime } from "@/components/schedule/session-list"
import {
  presentationStateOf,
  SessionStateBadge,
} from "@/components/schedule/session-state"
import { ReadFailure } from "@/components/educator/states"
import { byStartTime } from "@/lib/schedule/sessions"
import { getSessionAttendanceRosters } from "@/lib/educator/attendance"
import { listProgramSessions } from "@/lib/schedule/repository"

import type { ScheduleSession } from "@/lib/schedule/repository"
import type { AttendanceEntry } from "@/lib/educator/attendance"

/**
 * Per-session attendance for one assigned program (MPS-FEA-011, MPS-REQ-018,
 * MPS-ACC-028; MDS `components.table` variant `roster`, `patterns.forms`).
 *
 * TWO OUTCOMES, AND THE SECOND ONE IS NOT "ABSENT"
 *
 * A child is either *recorded present* or *not recorded*. MPS approves
 * attendance tracking and defines no vocabulary for absent, excused, or tardy
 * (GAP-ADMIN-010), so this surface will not put those words on a screen or
 * store the states behind them. "Not recorded" is said in those words on every
 * row, so nobody reads an unticked box as a claim that a child did not come.
 *
 * WHICH CHILDREN APPEAR
 *
 * Confirmed enrollments only, by preferred name — the same rule and the same
 * single field the roster uses (MPS-RUL-003). A pending, waitlisted, or blocked
 * child is not disclosed here any more than they are there: that family's
 * arrangement with Home School Haven is unsettled and is not an educator's
 * business.
 *
 * WHAT AN EDUCATOR HOLDS WHILE DOING THIS
 *
 * An enrollment id, which points at a registration, and a preferred name. No
 * student id, family id, grade level, or guardian field exists in this payload,
 * because `public.educator_session_roster` does not expose one and
 * `public.students` carries no educator policy at all.
 *
 * A cancelled session accepts no attendance: recording someone present at a
 * session that did not happen is a false record, and the database refuses it.
 */
async function AttendanceSection({
  programId,
  headingId,
}: {
  programId: string
  headingId: string
}) {
  const sessions = await listProgramSessions(programId)

  if (sessions.status !== "ready") {
    return (
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <h3
          id={headingId}
          className="hsh-h4 m-0 text-[var(--hsh-text-primary)]"
        >
          Attendance
        </h3>
        <ReadFailure status={sessions.status} subject="The schedule" />
      </section>
    )
  }

  const rosters = await getSessionAttendanceRosters(
    sessions.items.map((session) => session.id),
  )

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-4)]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-2)]">
        <h3
          id={headingId}
          className="hsh-h4 m-0 text-[var(--hsh-text-primary)]"
        >
          Attendance
        </h3>
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Mark each child who was present. A child who is not marked reads as{" "}
          <strong>not recorded</strong>, which is not the same as absent — Home
          School Haven has not set out what an absence means or how one is
          recorded, so this product does not claim one.
        </p>
      </div>

      {sessions.items.length === 0 ? (
        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          This program has no dated sessions yet, so there is nothing to record
          attendance against.
        </p>
      ) : rosters.status !== "ready" ? (
        <ReadFailure status={rosters.status} subject="Attendance" />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[var(--hsh-space-4)] p-0">
          {byStartTime(sessions.items).map((session) => (
            <SessionAttendance
              key={session.id}
              session={session}
              programId={programId}
              entries={rosters.rosters.get(session.id) ?? []}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * One session's attendance list.
 * @param props.session - The session.
 * @param props.programId - The program it belongs to.
 * @param props.entries - The confirmed children and their recorded state.
 * @returns The list item.
 */
function SessionAttendance({
  session,
  programId,
  entries,
}: {
  session: ScheduleSession
  programId: string
  entries: AttendanceEntry[]
}) {
  const cancelled = session.state === "canceled"
  const recorded = entries.filter((entry) => entry.attended).length

  return (
    <li className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
        <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
          <h4 className="hsh-h5 m-0 text-[var(--hsh-text-primary)]">
            {session.title}
          </h4>
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            <time dateTime={session.startsAt}>
              {formatSessionTime(session)}
            </time>
          </p>
        </div>
        <SessionStateBadge state={presentationStateOf(session)} />
      </div>

      {cancelled ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          This session was cancelled, so attendance cannot be recorded for it.
        </p>
      ) : entries.length === 0 ? (
        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          No confirmed enrollment is on this program yet, so there is nobody to
          record.
        </p>
      ) : (
        <>
          {/* A count, not a fraction of an expected number: "3 of 8" would
              imply the other five were absent, which is the claim this product
              cannot make (GAP-ADMIN-010). */}
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            {recorded} recorded present. {entries.length - recorded} not
            recorded.
          </p>
          <ul className="m-0 flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
            {entries.map((entry) => (
              <li
                key={entry.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)]"
              >
                <span className="hsh-body text-[var(--hsh-text-primary)]">
                  {entry.studentName || "Name not available"}
                </span>
                <AttendanceToggle
                  sessionId={session.id}
                  programId={programId}
                  entry={entry}
                  sessionTitle={session.title}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  )
}

export { AttendanceSection }
