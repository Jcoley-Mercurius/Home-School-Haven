import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ResourceDetail } from "@/components/content/resource-detail"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"

import { requireProgramAuthor } from "@/lib/content/page-guard"
import { loadResourceForManage } from "@/lib/content/page-data"
import { getAssignedProgram } from "@/lib/educator/assignments"

/**
 * Manage one resource on an assigned program (MPS-REQ-019, MPS-ACC-030).
 *
 * TWO IDS, TWO CHECKS, AND THE SECOND ONE IS THE ONE THAT MATTERS
 *
 * The route carries a program id and a resource id. Passing the program is not
 * enough: the resource is loaded and its OWN `program_id` is what authority is
 * then derived from, so a viewer who holds program A cannot reach program B's
 * resource by pairing B's id with A's in the URL. The mismatch is caught below
 * and answered with the same 404 a nonexistent id gets.
 */
export const metadata: Metadata = {
  title: "Resource — Educator — Home School Haven of SWFL",
}

export default async function EducatorResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string; resourceId: string }>
  searchParams: Promise<{ refused?: string }>
}) {
  const { programId, resourceId } = await params
  const { refused } = await searchParams
  const basePath = `/educator/programs/${programId}`
  const viewer = await requireProgramAuthor(
    programId,
    `${basePath}/resources/${resourceId}`,
  )

  const { record, canAuthor } = await loadResourceForManage(viewer, resourceId)

  /* The resource must belong to the program in the URL. Without this, a valid
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
            Resource
          </h1>
        </header>

        <ResourceDetail
          resource={record}
          basePath={basePath}
          canAuthor={canAuthor}
          refused={refused}
        />
      </main>
    </EducatorPortalShell>
  )
}
