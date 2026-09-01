import type { Metadata } from "next"

import { AnnouncementForm } from "@/components/content/announcement-form"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"

import { requireProgramAuthor } from "@/lib/content/page-guard"
import { getAssignedProgram } from "@/lib/educator/assignments"

/**
 * Compose a new announcement for an assigned program (MPS-REQ-019,
 * MPS-WFL-006 step 2).
 *
 * The program comes from the route and is proven before this page renders, so
 * the form carries it as a fixed hidden field rather than offering a choice —
 * an educator composing from a program's own page has already chosen, and a
 * selector here would be a second place for the program to be decided.
 */
export const metadata: Metadata = {
  title: "New announcement — Educator — Home School Haven of SWFL",
}

export default async function NewEducatorAnnouncementPage({
  params,
}: {
  params: Promise<{ programId: string }>
}) {
  const { programId } = await params
  const basePath = `/educator/programs/${programId}`
  const viewer = await requireProgramAuthor(
    programId,
    `${basePath}/announcements/new`,
  )

  /* An administrator passes the guard and may author but holds no assignment,
     so there is no assigned-program row to name. The heading falls back rather
     than the page failing — the authority question was already settled. */
  const program = await getAssignedProgram(viewer.userId, programId)
  const programName =
    program.status === "ready" ? program.data.name : "this program"

  return (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Assigned Programs", href: "/educator/programs" },
            { label: programName, href: basePath },
            { label: "New announcement" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            New announcement
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            For {programName}. Every family enrolled in this program will be
            able to read it once it is published.
          </p>
        </header>

        <AnnouncementForm
          basePath={basePath}
          programId={programId}
          submitLabel="Save draft"
          cancelHref={basePath}
        />
      </main>
    </EducatorPortalShell>
  )
}
