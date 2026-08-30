import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  EnrollmentsCard,
  ScheduleCard,
} from "@/components/family/dashboard-cards"
import { ReviewDataBanner } from "@/components/family/section-states"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyEnrollments } from "@/lib/enrollment/repository"
import { getFamilyState } from "@/lib/family/repository"

/**
 * The full schedule and enrollment list — the "Schedule" destination, and where
 * the Overview's "View all enrollments" and "View full schedule" links land.
 *
 * Unscoped by student on purpose: the Overview narrows to one child, and this
 * is the place the parent sees the whole family at once (MPS-ACC-024, "each
 * student's ... status ... are distinguishable" — the student's name is on
 * every row).
 *
 * Deviation D-FD1 applies here as it does on the Overview: published schedule
 * text, never an invented date, time, or location.
 */
export const metadata: Metadata = {
  title: "Schedule — Home School Haven of SWFL",
}

export default async function FamilySchedulePage() {
  const viewer = await requireRole("parent", "/family/schedule")
  const family = await getFamilyState()

  if (family.status === "incomplete") redirect("/family/setup")

  const enrollments = await getFamilyEnrollments()

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
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
            Every registration your family holds, with its current state and the
            schedule Home School Haven has published for it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-2 lg:gap-[var(--hsh-grid-gap-desktop)]">
          <EnrollmentsCard state={enrollments} heading="All Enrollments" />
          <ScheduleCard state={enrollments} heading="Published Schedule" />
        </div>
      </main>
    </FamilyPortalShell>
  )
}
