import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AnnouncementForm } from "@/components/content/announcement-form"
import { ReviewDataBanner } from "@/components/family/section-states"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { Alert } from "@/components/ui/alert"

import { canTransition } from "@/lib/content/lifecycle"
import { loadAnnouncementForManage } from "@/lib/content/page-data"
import { requireProgramAuthor } from "@/lib/content/page-guard"

/**
 * Publish a replacement for a published announcement (MPS-REQ-019, MPS-ACC-030).
 *
 * REPLACEMENT IS NOT EDITING, AND THE DIFFERENCE IS THE POINT
 *
 * Editing published text in place would change what a family already read with
 * no record that it changed. A replacement leaves the original standing, marked
 * `Replaced` and pointing forward, and creates a NEW DRAFT — which is then
 * published as its own separately audited decision. So this page pre-fills from
 * the original as a starting point, and publishing is still a further step.
 *
 * Reachable only from a state that can be replaced. The check mirrors the
 * database, which refuses the transition regardless of what this page allowed.
 */
export const metadata: Metadata = {
  title: "Replace announcement — Educator — Home School Haven of SWFL",
}

export default async function ReplaceAnnouncementPage({
  params,
}: {
  params: Promise<{ programId: string; announcementId: string }>
}) {
  const { programId, announcementId } = await params
  const basePath = `/educator/programs/${programId}`
  const viewer = await requireProgramAuthor(
    programId,
    `${basePath}/announcements/${announcementId}/replace`,
  )

  const { record, canAuthor } = await loadAnnouncementForManage(
    viewer,
    announcementId,
  )
  if (record.programId !== programId) notFound()
  if (!canAuthor) notFound()

  const replaceable = canTransition(record.state, "replaced")

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
            {
              label: record.title,
              href: `${basePath}/announcements/${record.id}`,
            },
            { label: "Replace" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Publish a replacement
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            This creates a new draft. The current version stays in place, marked
            as replaced, until you publish the new one.
          </p>
        </header>

        {replaceable ? (
          <AnnouncementForm
            basePath={basePath}
            replacesId={record.id}
            expectedUpdatedAt={record.updatedAt}
            initialTitle={record.title}
            initialBody={record.body}
            submitLabel="Create replacement draft"
            cancelHref={`${basePath}/announcements/${record.id}`}
          />
        ) : (
          <Alert tone="warning" title="This cannot be replaced">
            Only a published announcement can be replaced. This one is{" "}
            {record.state}.
          </Alert>
        )}
      </main>
    </EducatorPortalShell>
  )
}
