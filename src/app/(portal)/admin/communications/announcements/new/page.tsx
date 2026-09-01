import type { Metadata } from "next"

import { AnnouncementForm } from "@/components/content/announcement-form"
import {
  EmptyState,
  ReviewDataBanner,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

import { requireAdmin } from "@/lib/auth/guards"
import { listAuthorablePrograms } from "@/lib/content/authority"

/**
 * Compose a new announcement from the administrator area (MPS-REQ-019).
 *
 * WHY THIS PAGE HAS A PROGRAM SELECTOR AND THE EDUCATOR PAGE DOES NOT
 *
 * An educator arrives from one program's own page, so the program is already
 * decided and carrying a selector would be a second place to decide it. An
 * administrator arrives from a cross-program list and has to say which.
 *
 * The selector is filled by `listAuthorablePrograms`, which returns what THIS
 * viewer may author for — so it can never offer a program the write would then
 * be refused on. That is a courtesy, not the control: the action re-checks the
 * chosen id against the viewer's authority, and the database checks it again.
 */
export const metadata: Metadata = {
  title: "New announcement — Operations — Home School Haven of SWFL",
}

export default async function NewAdminAnnouncementPage() {
  const viewer = await requireAdmin("/admin/communications/announcements/new")
  const programs = await listAuthorablePrograms(viewer)

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
            { label: "New announcement" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            New announcement
          </h1>
        </header>

        {programs.length === 0 ? (
          <EmptyState title="There are no programs yet">
            <p>
              A announcement belongs to a program. Create a program first, then
              come back.
            </p>
          </EmptyState>
        ) : (
          <AnnouncementForm
            basePath="/admin/communications"
            programs={programs}
            submitLabel="Save draft"
            cancelHref="/admin/communications"
          />
        )}
      </main>
    </AdminPortalShell>
  )
}
