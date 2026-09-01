import type { Metadata } from "next"

import { AnnouncementList } from "@/components/educator/content-lists"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"
import { listEducatorAnnouncements } from "@/lib/educator/content"

/**
 * Program announcements across every assigned program (MPS-REQ-018,
 * MPS-REQ-019, MPS-ACC-030).
 *
 * WHY AUTHORING IS NOT REACHED FROM HERE
 *
 * An educator can author now — HSH-SLICE-CONTENT-01 built it — but an
 * announcement belongs to ONE program, and this list spans several. A "new
 * announcement" button here would have to guess which, or ask, which is the
 * program selector the administrator surface has and this one does not need:
 * composing starts from a program's own page, one tap away. So this page reads,
 * and the manage links live where the program is unambiguous.
 *
 * Program-scoped by definition. An educator has no organization-wide
 * communication reach; an announcement belongs to a program, and the only
 * programs readable here are the ones they are assigned to.
 *
 * Every state appears, labelled as itself. See `content-lists.tsx` for why
 * dropping drafts and rendering them as published are both worse.
 */
export const metadata: Metadata = {
  title: "Announcements — Educator — Home School Haven of SWFL",
}

export default async function EducatorAnnouncementsPage() {
  const viewer = await requireRole("educator", "/educator/announcements")
  const assigned = await listAssignedPrograms(viewer.userId)

  const announcements =
    assigned.status === "ready"
      ? await listEducatorAnnouncements(
          assigned.items.map((program) => program.id),
        )
      : null

  return (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
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
            Announcements on the programs you are assigned to, with whether
            families can currently see each one. Open a program to write a new
            announcement or change an existing one.
          </p>
        </header>

        {assigned.status !== "ready" ? (
          <ReadFailure
            status={assigned.status}
            subject="Your assigned programs"
          />
        ) : assigned.items.length === 0 ? (
          <NoAssignments surface="announcements" />
        ) : announcements === null || announcements.status !== "ready" ? (
          <ReadFailure
            status={announcements?.status ?? "failed"}
            subject="Your programs' announcements"
          />
        ) : (
          <AnnouncementList
            items={announcements.items}
            emptyTitle="No announcements yet"
            emptyBody="There are no announcements on the programs you are assigned to. Open one of your programs to write the first one."
          />
        )}
      </main>
    </EducatorPortalShell>
  )
}
