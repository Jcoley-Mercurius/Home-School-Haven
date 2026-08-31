import { Suspense } from "react"
import type { Metadata } from "next"

import { EducatorRosterSection } from "@/components/educator/roster-section"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"

/**
 * Rosters across every assigned program (MPS-REQ-018, MPS-ACC-028).
 *
 * One section per program rather than one combined list. A merged roster would
 * need a program column on every row, and the row a reader is most likely to
 * misread is a child who is confirmed in one program and waitlisted in another
 * — two rows, same name, different meaning. A heading per program removes the
 * ambiguity before any name is read.
 *
 * Each section streams behind its own skeleton, so one slow or failed roster
 * does not withhold the others (MPS-REQ-021).
 *
 * Every name on this page comes through `EDUCATOR_ROSTER_COLUMNS`, which is
 * `preferred_name` and nothing else. No family name, grade level, guardian
 * relationship, contact detail, or state note is fetched for any of it.
 */
export const metadata: Metadata = {
  title: "Rosters — Educator — Home School Haven of SWFL",
}

export default async function EducatorRostersPage() {
  const viewer = await requireRole("educator", "/educator/rosters")
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
            Rosters
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Who has a confirmed place in each program you are assigned to. A
            student&rsquo;s preferred name is the only detail shown.
          </p>
        </header>

        {assigned.status !== "ready" ? (
          <ReadFailure
            status={assigned.status}
            subject="Your assigned programs"
          />
        ) : assigned.items.length === 0 ? (
          <NoAssignments surface="rosters" />
        ) : (
          <div className="flex flex-col gap-[var(--hsh-space-5)]">
            {assigned.items.map((program) => (
              <Suspense
                key={program.id}
                fallback={
                  <ListSkeleton
                    label={`Loading the roster for ${program.name}`}
                    rows={3}
                  />
                }
              >
                <EducatorRosterSection
                  programId={program.id}
                  programName={program.name}
                  headingId={`roster-${program.id}`}
                  headingLevel="h2"
                />
              </Suspense>
            ))}
          </div>
        )}
      </main>
    </EducatorPortalShell>
  )
}
