import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AnnouncementForm } from "@/components/content/announcement-form"
import { ReviewDataBanner } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"

import { requireAdmin } from "@/lib/auth/guards"
import { canTransition } from "@/lib/content/lifecycle"
import { loadAnnouncementForManage } from "@/lib/content/page-data"

/**
 * Publish a replacement for a published announcement, from the administrator area.
 *
 * Same contract as the educator page: the original stays, marked `Replaced` and
 * pointing forward, and the successor starts as a draft that is published as
 * its own separately audited decision.
 */
export const metadata: Metadata = {
  title: "Replace announcement — Operations — Home School Haven of SWFL",
}

export default async function AdminReplaceAnnouncementPage({
  params,
}: {
  params: Promise<{ announcementId: string }>
}) {
  const { announcementId } = await params
  const viewer = await requireAdmin(
    `/admin/communications/announcements/${announcementId}/replace`,
  )

  const { record, canAuthor } = await loadAnnouncementForManage(
    viewer,
    announcementId,
  )
  if (!canAuthor) notFound()

  const replaceable = canTransition(record.state, "replaced")

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Communications", href: "/admin/communications" },
            {
              label: record.title,
              href: `/admin/communications/announcements/${record.id}`,
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
            basePath="/admin/communications"
            replacesId={record.id}
            expectedUpdatedAt={record.updatedAt}
            initialTitle={record.title}
            initialBody={record.body}
            submitLabel="Create replacement draft"
            cancelHref={`/admin/communications/announcements/${record.id}`}
          />
        ) : (
          <Alert tone="warning" title="This cannot be replaced">
            Only a published announcement can be replaced. This one is{" "}
            {record.state}.
          </Alert>
        )}
      </main>
    </AdminPortalShell>
  )
}
