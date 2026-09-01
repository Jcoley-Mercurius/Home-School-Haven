import type { Metadata } from "next"

import { AnnouncementDetail } from "@/components/content/announcement-detail"
import { ReviewDataBanner } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

import { requireAdmin } from "@/lib/auth/guards"
import { loadAnnouncementForManage } from "@/lib/content/page-data"

/**
 * Manage one announcement from the administrator area (MPS-REQ-019, MPS-ACC-030).
 *
 * `requireAdmin` is the route guard, and `canAuthor` is derived separately by
 * the loader. The two are not the same question: administrator authority over
 * this product's content is broad, but the component still renders actions from
 * what the database would actually permit rather than from the role that got
 * through the door.
 */
export const metadata: Metadata = {
  title: "Announcement — Operations — Home School Haven of SWFL",
}

export default async function AdminAnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ announcementId: string }>
  searchParams: Promise<{ refused?: string }>
}) {
  const { announcementId } = await params
  const { refused } = await searchParams
  const viewer = await requireAdmin(
    `/admin/communications/announcements/${announcementId}`,
  )

  const { record, canAuthor } = await loadAnnouncementForManage(
    viewer,
    announcementId,
  )

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
          basePath="/admin/communications"
          canAuthor={canAuthor}
          refused={refused}
        />
      </main>
    </AdminPortalShell>
  )
}
