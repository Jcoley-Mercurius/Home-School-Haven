import type { Metadata } from "next"

import { OverviewCards } from "@/components/educator/overview-cards"
import { ProgramList } from "@/components/educator/program-list"
import {
  AnnouncementList,
  ResourceList,
} from "@/components/educator/content-lists"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { TextLink } from "@/components/ui/text-link"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"
import {
  listEducatorAnnouncements,
  listEducatorResources,
} from "@/lib/educator/content"

/**
 * The educator Overview (ACT-003; MPS-REQ-018, MPS-REQ-021; MDS
 * `page_shells.educator_workspace`, MDS-REF-009 composition).
 *
 * ASSIGNMENT SCOPE IS THE WHOLE PAGE
 *
 * Every section reads from one authorized list: the programs this viewer is
 * assigned to, filtered on `viewer.userId`, which comes from a verified JWT
 * claim and never from the browser. Announcements and resources are then
 * narrowed to those program ids. Nothing on this page can widen past the
 * assignment set, and RLS refuses independently if anything tried.
 *
 * "An educator's program access does not imply access to every family, student,
 * or administrator record" (AGENTS.md §12). There is no family query here, no
 * organization-wide count, and no administrator link.
 *
 * NO ROSTER NAMES ON THE OVERVIEW
 *
 * The tiles are counts. A child's preferred name appears on the Rosters
 * destination and on a program's detail, where an educator has navigated to
 * look at a roster on purpose — not on the landing page of the workspace.
 */
export const metadata: Metadata = {
  title: "Educator — Home School Haven of SWFL",
}

export default async function EducatorOverviewPage() {
  const viewer = await requireRole("educator", "/educator")
  const assigned = await listAssignedPrograms(viewer.userId)

  const shell = (children: React.ReactNode) => (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />
        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Overview
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            The programs you are assigned to, the schedule Home School Haven has
            published for them, and who has a confirmed place.
          </p>
        </header>
        {children}
      </main>
    </EducatorPortalShell>
  )

  if (assigned.status !== "ready") {
    return shell(
      <ReadFailure status={assigned.status} subject="Your assigned programs" />,
    )
  }

  if (assigned.items.length === 0)
    return shell(<NoAssignments surface="overview" />)

  const programIds = assigned.items.map((program) => program.id)
  const [announcements, resources] = await Promise.all([
    listEducatorAnnouncements(programIds),
    listEducatorResources(programIds),
  ])

  return shell(
    <>
      <OverviewCards programs={assigned.items} />

      <section
        aria-labelledby="assigned-heading"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)]">
          <h2
            id="assigned-heading"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Assigned programs
          </h2>
          <TextLink href="/educator/programs">See all programs</TextLink>
        </div>
        <ProgramList programs={assigned.items} />
      </section>

      <section
        aria-labelledby="announcements-heading"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)]">
          <h2
            id="announcements-heading"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Recent announcements
          </h2>
          <TextLink href="/educator/announcements">All announcements</TextLink>
        </div>
        {announcements.status !== "ready" ? (
          <ReadFailure
            status={announcements.status}
            subject="Your programs' announcements"
          />
        ) : (
          <AnnouncementList
            items={announcements.items.slice(0, 3)}
            emptyTitle="No announcements yet"
            emptyBody="There are no announcements on the programs you are assigned to. Announcements are written by an administrator in this release; when one is added, it appears here."
          />
        )}
      </section>

      <section
        aria-labelledby="resources-heading"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)]">
          <h2
            id="resources-heading"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Available resources
          </h2>
          <TextLink href="/educator/resources">All resources</TextLink>
        </div>
        {resources.status !== "ready" ? (
          <ReadFailure
            status={resources.status}
            subject="Your programs' resources"
          />
        ) : (
          <ResourceList
            items={resources.items.slice(0, 3)}
            emptyTitle="No resources yet"
            emptyBody="There are no learning resources on the programs you are assigned to. Resources are added by an administrator in this release."
          />
        )}
      </section>
    </>,
  )
}
