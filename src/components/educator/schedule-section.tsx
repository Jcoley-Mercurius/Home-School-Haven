import { PublicationBadge } from "@/components/admin/publication-state"
import { scheduleFacts } from "@/lib/educator/workspace-state"

import type { AssignedProgram } from "@/lib/educator/workspace-state"

/**
 * The published schedule for one assigned program (MPS-REQ-018, MPS-REQ-020).
 *
 * WHAT A "SCHEDULE" IS IN THIS RELEASE
 *
 * There is no schedule model. `public.programs` holds published schedule text —
 * `published_dates`, `published_schedule`, `published_session_length`,
 * `published_duration`, `enrollment_window` — and `NULL` means the source does
 * not publish that fact (QA-005). No session, date, or time is stored anywhere,
 * and most published ranges carry no year at all, so they cannot even be put in
 * order.
 *
 * So this renders the facts Home School Haven has actually published and says
 * plainly when there are none. It does not compute an "upcoming" session, fill
 * a calendar grid, or turn "Tuesdays" into a date. An educator reading an
 * invented time would plan around it. That is deviation D-EW2, and it is the
 * same call the family area already made as D-FD1.
 *
 * Schedule creation, capacity, waitlists, attendance, cancellation, and
 * transfers are not here and are not deferred UI — none of them exists as a
 * capability in this release, for any role.
 */
function ScheduleSection({
  program,
  headingLevel = "h3",
  headingId,
}: {
  program: AssignedProgram
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

      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-muted)]">
        This is the schedule as published, exactly as it appears to families.
        Schedules are not edited here.
      </p>
    </section>
  )
}

export { ScheduleSection }
