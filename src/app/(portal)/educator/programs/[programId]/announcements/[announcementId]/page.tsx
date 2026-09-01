import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AnnouncementDetail } from "@/components/content/announcement-detail"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"

import { requireProgramAuthor } from "@/lib/content/page-guard"
import { loadAnnouncementForManage } from "@/lib/content/page-data"
import { getAssignedProgram } from "@/lib/educator/assignments"

/**
 * Manage one announcement on an assigned program (MPS-REQ-019, MPS-ACC-030).
 *
 * TWO IDS, TWO CHECKS, AND THE SECOND ONE IS THE ONE THAT MATTERS
 *
 * The route carries a program id and a announcement id. Passing the program is not
 * enough: the announcement is loaded and its OWN `program_id` is what authority is
 * then derived from, so a viewer who holds program A cannot reach program B's
 * announcement by pairing B's id with A's in the URL. The mismatch is caught below
 * and answered with the same 404 a nonexistent id gets.
 */
export const metadata: Metadata = {
  title: "Announcement — Educator — Home School Haven of SWFL",
}

export default async function EducatorAnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string; announcementId: string }>
  searchParams: Promise<{ refused?: string }>
}) {
  const { programId, announcementId } = await params
  const { refused } = await searchParams
  const basePath = `/educator/programs/${programId}`
  const viewer = await requireProgramAuthor(
    programId,
    `${basePath}/announcements/${announcementId}`,
  )

  const { record, canAuthor } = await loadAnnouncementForManage(
    viewer,
    announcementId,
  )

  /* The announcement must belong to the program in the URL. Without this, a valid
     id from a program the viewer DOES hold would render under a program they
     do not, and the breadcrumb would then assert something untrue. */
  if (record.programId !== programId) notFound()

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
            { label: record.title },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Announcement
          </h1>
        </header>

        <AnnouncementDetail
          announcement={record}
          basePath={basePath}
          canAuthor={canAuthor}
          refused={refused}
        />
      </main>
    </EducatorPortalShell>
  )
}
