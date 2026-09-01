import type { Metadata } from "next"

import { ResourceForm } from "@/components/content/resource-form"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"

import { requireProgramAuthor } from "@/lib/content/page-guard"
import { getAssignedProgram } from "@/lib/educator/assignments"

/**
 * Compose a new learning resource for an assigned program (MPS-REQ-019).
 *
 * A file-backed kind saves as a draft first and collects its file on the
 * resource's own page: an upload needs a row to belong to, and an object with
 * nothing referencing it is an object nothing can later find to manage.
 */
export const metadata: Metadata = {
  title: "New resource — Educator — Home School Haven of SWFL",
}

export default async function NewEducatorResourcePage({
  params,
}: {
  params: Promise<{ programId: string }>
}) {
  const { programId } = await params
  const basePath = `/educator/programs/${programId}`
  const viewer = await requireProgramAuthor(
    programId,
    `${basePath}/resources/new`,
  )

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
            { label: "New resource" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            New resource
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            For {programName}. Families enrolled in this program will be able to
            open or download it once it is published.
          </p>
        </header>

        <ResourceForm
          basePath={basePath}
          programId={programId}
          submitLabel="Save draft"
          cancelHref={basePath}
        />
      </main>
    </EducatorPortalShell>
  )
}
