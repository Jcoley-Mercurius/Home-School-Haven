import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AnnouncementsCard } from "@/components/family/dashboard-cards"
import { ReviewDataBanner } from "@/components/family/section-states"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyAnnouncements } from "@/lib/family/content"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Announcements for the programs this family is enrolled in (MPS-REQ-019,
 * MPS-ACC-030).
 *
 * No `limit`, unlike the Overview card. The scoping is identical either way,
 * because it is in RLS: a family reaches published announcements for programs
 * it holds a non-cancelled enrollment in, and nothing else. Another family's
 * announcements are not filtered out here — they never arrive.
 */
export const metadata: Metadata = {
  title: "Announcements — Home School Haven of SWFL",
}

export default async function FamilyAnnouncementsPage() {
  const viewer = await requireRole("parent", "/family/announcements")
  const family = await getFamilyState()

  if (family.status === "incomplete") redirect("/family/setup")

  const announcements = await getFamilyAnnouncements()

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Announcements
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Notices published for the programs your family is registered for.
          </p>
        </header>

        <div className="max-w-[var(--hsh-content-reading)]">
          <AnnouncementsCard
            state={announcements}
            heading="All Announcements"
          />
        </div>
      </main>
    </FamilyPortalShell>
  )
}
