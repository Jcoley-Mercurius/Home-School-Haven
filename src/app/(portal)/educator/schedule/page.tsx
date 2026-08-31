import type { Metadata } from "next"

import { ScheduleSection } from "@/components/educator/schedule-section"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"

/**
 * Schedule, scoped to assignment and read-only (MPS-REQ-018, MPS-REQ-020).
 *
 * WHAT THIS PAGE CAN HONESTLY SHOW
 *
 * There is no schedule table in this release. Schedule is published text on
 * `public.programs`, and `NULL` means Home School Haven does not publish that
 * fact. So this lists the assigned programs and, for each, the schedule facts
 * that actually exist — no computed session, no generated calendar, no
 * "upcoming" ordering over ranges that carry no year (deviation D-EW2, the
 * educator counterpart of the family area's D-FD1).
 *
 * Schedule creation, capacity changes, waitlist operations, attendance,
 * cancellation, transfers, and notifications are not deferred UI on this page.
 * None of them exists as a capability for any role in this release, so there is
 * nothing here to disable or hide.
 */
export const metadata: Metadata = {
  title: "Schedule — Educator — Home School Haven of SWFL",
}

export default async function EducatorSchedulePage() {
  const viewer = await requireRole("educator", "/educator/schedule")
  const assigned = await listAssignedPrograms(viewer.userId)

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
            are assigned to, exactly as families see it.
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
