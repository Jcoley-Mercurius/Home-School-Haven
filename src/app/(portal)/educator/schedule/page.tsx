import type { Metadata } from "next"

import { ScheduleSection } from "@/components/educator/schedule-section"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"
import {
  listVisibleSessions,
  sessionsForProgram,
} from "@/lib/schedule/repository"
import { PROGRAM_TIME_ZONE_LABEL } from "@/lib/schedule/timezone"

/**
 * Schedule, scoped to assignment and read-only (MPS-REQ-018, MPS-REQ-020).
 *
 * WHAT THIS PAGE SHOWS
 *
 * For each assigned program: the schedule text Home School Haven publishes,
 * where `NULL` means it publishes no such fact, AND the dated sessions an
 * administrator has authored (HSH-SLICE-ADM-04). Neither is derived from the
 * other — turning "Tuesdays" into a date would invent a fact, and an educator
 * would plan around it. Deviation D-EW2 therefore narrows rather than closing:
 * it stands for every program that has no authored sessions.
 *
 * The sessions are read ONCE for the whole page rather than per program. The
 * RLS policies already bound the result to what this educator may see, so one
 * query and an in-memory split is both fewer round trips and one fewer place a
 * per-program filter could be written wrongly.
 *
 * Schedule creation, capacity changes, waitlist operations, cancellation, and
 * transfers are administrator decisions (MPS-RUL-005) and are not on this page.
 * Attendance is an educator operation and lives on each program's own page,
 * beside the roster it is recorded against.
 */
export const metadata: Metadata = {
  title: "Schedule — Educator — Home School Haven of SWFL",
}

export default async function EducatorSchedulePage() {
  const viewer = await requireRole("educator", "/educator/schedule")
  const [assigned, sessions] = await Promise.all([
    listAssignedPrograms(viewer.userId),
    listVisibleSessions(),
  ])

  return (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Schedule
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            The schedule Home School Haven has published for each program you
            are assigned to, exactly as families see it. Session times are Home
            School Haven&rsquo;s local time ({PROGRAM_TIME_ZONE_LABEL}).
          </p>
        </header>

        {assigned.status !== "ready" ? (
          <ReadFailure
            status={assigned.status}
            subject="Your assigned programs"
          />
        ) : assigned.items.length === 0 ? (
          <NoAssignments surface="schedule" />
        ) : (
          <div className="flex flex-col gap-[var(--hsh-space-5)]">
            {assigned.items.map((program) => (
              <ScheduleSection
                key={program.id}
                program={program}
                /* A failed session read leaves the published text standing:
                   it is still true, and it is what this page showed before
                   sessions existed. */
                sessions={
                  sessions.status === "ready"
                    ? sessionsForProgram(sessions.items, program.id)
                    : undefined
                }
                headingId={`schedule-${program.id}`}
                headingLevel="h2"
              />
            ))}
          </div>
        )}
      </main>
    </EducatorPortalShell>
  )
}
