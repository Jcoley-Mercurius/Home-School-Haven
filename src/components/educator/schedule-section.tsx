import { PublicationBadge } from "@/components/admin/publication-state"
import { SessionList } from "@/components/schedule/session-list"
import { scheduleFacts } from "@/lib/educator/workspace-state"
import { PROGRAM_TIME_ZONE_LABEL } from "@/lib/schedule/timezone"

import type { ScheduleSession } from "@/lib/schedule/repository"
import type { AssignedProgram } from "@/lib/educator/workspace-state"

/**
 * The schedule for one assigned program (MPS-REQ-018, MPS-REQ-020,
 * MPS-WFL-006 "view assigned schedule and roster").
 *
 * TWO KINDS OF SCHEDULE, BOTH SHOWN, NEITHER DERIVED FROM THE OTHER
 *
 * `public.programs` holds published schedule TEXT — `published_dates`,
 * `published_schedule`, `published_session_length`, `published_duration`,
 * `enrollment_window` — where `NULL` means the source does not publish that
 * fact (QA-005). Most published ranges carry no year, so they cannot be put in
 * order at all.
 *
 * `public.program_sessions` holds DATED sessions an administrator authored
 * (HSH-SLICE-ADM-04). Those carry a real instant, so they can be ordered,
 * plotted, and marked complete.
 *
 * Both are rendered, and neither is computed from the other. Turning "Tuesdays"
 * into a date would invent the fact the beta content import rules forbid, and
 * an educator reading an invented time would plan around it — which is why
 * deviation D-EW2 was recorded in the first place. D-EW2 now narrows: it stands
 * where a program has no authored sessions, which is the state every program
 * starts in.
 *
 * This view stays READ-ONLY. Authoring, moving, cancelling, and completing a
 * session are administrator decisions (MPS-RUL-005), and an educator submitting
 * one is refused by the database, not merely unoffered a button (MPS-ACC-027).
 * Attendance is the one operation an educator does hold, and it has its own
 * section.
 */
function ScheduleSection({
  program,
  sessions,
  headingLevel = "h3",
  headingId,
}: {
  program: AssignedProgram
  /** Authored sessions for this program, or `undefined` when not read. */
  sessions?: readonly ScheduleSession[]
  headingLevel?: "h2" | "h3"
  headingId: string
}) {
  const facts = scheduleFacts(program)
  const Heading = headingLevel

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
        <Heading
          id={headingId}
          className="hsh-h4 m-0 text-[var(--hsh-text-primary)]"
        >
          {program.name}
        </Heading>
        <PublicationBadge state={program.publicationState} />
      </div>

      {facts.length === 0 ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Home School Haven has not published schedule details for this program.
          Nothing is missing from your view — there is no published date, time,
          or session length on record to show.
        </p>
      ) : (
        <dl className="flex flex-col gap-[var(--hsh-space-3)]">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col gap-[var(--hsh-space-1)] sm:flex-row sm:gap-[var(--hsh-space-4)]"
            >
              <dt className="hsh-label text-[var(--hsh-text-secondary)] sm:w-[180px] sm:shrink-0">
                {fact.label}
              </dt>
              <dd className="hsh-body m-0 text-[var(--hsh-text-primary)]">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {sessions ? (
        <div className="flex flex-col gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-4)]">
          <p className="hsh-label m-0 text-[var(--hsh-text-secondary)]">
            Dated sessions ({PROGRAM_TIME_ZONE_LABEL})
          </p>
          <SessionList
            sessions={sessions}
            size="compact"
            emptyMessage="No dated sessions have been added for this program. The published schedule above is everything Home School Haven has set out, and nothing is missing from your view."
            headingLevel="h4"
          />
        </div>
      ) : null}

      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-muted)]">
        This is the schedule as published, exactly as it appears to families.
        Schedules are not edited here.
      </p>
    </section>
  )
}

export { ScheduleSection }
