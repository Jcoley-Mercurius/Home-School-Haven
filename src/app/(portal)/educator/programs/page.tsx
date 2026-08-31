import type { Metadata } from "next"

import { ProgramList } from "@/components/educator/program-list"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"

/**
 * Assigned Programs (MPS-REQ-018, MPS-ACC-029).
 *
 * The list is the assignment set and cannot be anything else: the query filters
 * on the verified viewer's id, and `programs_select_assigned_educator` returns
 * only programs they hold. An unassigned program is not filtered out of a
 * larger list on the client — it is never returned.
 *
 * No administrative control appears here. There is no publish, archive, price,
 * capacity, enrollment, assignment, or family action, and none is rendered
 * disabled: `authenticated` holds no write on `public.programs` and no educator
 * write path exists anywhere, so there is no capability being withheld.
 */
export const metadata: Metadata = {
  title: "Assigned Programs — Educator — Home School Haven of SWFL",
}

export default async function EducatorProgramsPage() {
  const viewer = await requireRole("educator", "/educator/programs")
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
            Assigned Programs
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Every program an administrator has assigned to you. Open one to see
            its published schedule, roster, announcements, and resources.
          </p>
        </header>

        {assigned.status !== "ready" ? (
          <ReadFailure
            status={assigned.status}
            subject="Your assigned programs"
          />
        ) : assigned.items.length === 0 ? (
          <NoAssignments surface="programs list" />
        ) : (
          <ProgramList programs={assigned.items} />
        )}
      </main>
    </EducatorPortalShell>
  )
}
