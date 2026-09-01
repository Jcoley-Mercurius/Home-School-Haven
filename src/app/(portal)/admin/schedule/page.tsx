import type { Metadata } from "next"

import {
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { SessionList } from "@/components/schedule/session-list"
import { TextLink } from "@/components/ui/text-link"
import { requireAdmin } from "@/lib/auth/guards"
import { listVisibleSessions } from "@/lib/schedule/repository"
import { PROGRAM_TIME_ZONE_LABEL } from "@/lib/schedule/timezone"
import { isUpcoming } from "@/lib/schedule/sessions"

import type { ScheduleSessionWithProgram } from "@/lib/schedule/repository"

/**
 * The administrator agenda — every program's schedule on one screen
 * (MPS-REQ-016, MPS-REQ-020, MPS-WFL-005; MDS
 * `navigation.specification.admin` "Schedule",
 * `components.schedule_item` size `agenda`).
 *
 * WHY THIS PAGE IS READ-ONLY
 *
 * Every schedule change belongs to one program, and the program detail page is
 * where a program's facts, capacity, roster, and schedule already sit together.
 * Offering the same edit from two places would give one decision two routes
 * that could drift, and would separate an administrator from the roster and
 * capacity that make a cancellation or a move a considered decision rather than
 * a click. So this page answers "what is happening, across everything" and
 * links to the program for "change it".
 *
 * UPCOMING FIRST, THEN THE REST
 *
 * The split is by the clock, not by a stored flag: a session's time is a real
 * instant, so "still to come" is computable. That is the whole difference this
 * slice made — the published schedule TEXT could never be ordered, because most
 * published ranges carry no year at all (deviations D-EW2 and D-FD1).
 */
export const metadata: Metadata = {
  title: "Schedule — Operations — Home School Haven of SWFL",
}

export default async function AdminSchedulePage() {
  const viewer = await requireAdmin("/admin/schedule")
  const sessions = await listVisibleSessions()

  const now = new Date()
  const upcoming =
    sessions.status === "ready"
      ? sessions.items.filter((session) => isUpcoming(session, now))
      : []
  const past =
    sessions.status === "ready"
      ? sessions.items.filter((session) => !isUpcoming(session, now)).reverse()
      : []

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Operations", href: "/admin" },
            { label: "Schedule" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Schedule
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Every dated session across all programs, in Home School
            Haven&rsquo;s local time ({PROGRAM_TIME_ZONE_LABEL}). Sessions are
            added, moved, cancelled, and completed on each program&rsquo;s own
            page, where the roster and capacity are in view.
          </p>
        </header>

        {sessions.status !== "ready" ? (
          <SectionError>
            {sessions.status === "unavailable"
              ? "The schedule is not available in this environment because no Supabase project is configured."
              : "The schedule could not be loaded. Nothing has changed — reload the page to try again."}
          </SectionError>
        ) : (
          <>
            <AgendaSection
              heading="Still to come"
              headingId="upcoming-heading"
              sessions={upcoming}
              emptyMessage="No session is scheduled ahead of now. Add sessions from a program's page."
            />
            <AgendaSection
              heading="Past, cancelled, and completed"
              headingId="past-heading"
              sessions={past}
              emptyMessage="No session has taken place or been cancelled yet."
            />
          </>
        )}
      </main>
    </AdminPortalShell>
  )
}

/**
 * One agenda group, with each session's program named above it.
 *
 * @param props.heading - The section heading.
 * @param props.headingId - The id the section is labelled by.
 * @param props.sessions - The sessions in this group, already ordered.
 * @param props.emptyMessage - What to say when the group is empty.
 * @returns The section.
 */
function AgendaSection({
  heading,
  headingId,
  sessions,
  emptyMessage,
}: {
  heading: string
  headingId: string
  sessions: ScheduleSessionWithProgram[]
  emptyMessage: string
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-4)]"
    >
      <h2 id={headingId} className="hsh-h3 text-[var(--hsh-text-primary)]">
        {heading}
      </h2>

      {sessions.length === 0 ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--hsh-space-4)]">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-[var(--hsh-space-2)]"
            >
              <p className="hsh-label m-0 text-[var(--hsh-text-secondary)]">
                {/* An unresolved join reads as an explicit absence, never as a
                    session belonging to no program. */}
                {session.program ? (
                  <TextLink href={`/admin/programs/${session.programId}`}>
                    {session.program.name}
                  </TextLink>
                ) : (
                  "Program not available"
                )}
              </p>
              <SessionList
                sessions={[session]}
                size="agenda"
                emptyMessage=""
                headingLevel="h3"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
