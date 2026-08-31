import { Suspense } from "react"
import type { Metadata } from "next"

import {
  AttentionPanel,
  OwnerAuthorityBand,
  QuickActions,
  SummaryTiles,
} from "@/components/admin/overview-cards"
import { OverviewSkeleton } from "@/components/admin/overview-skeleton"
import { ProgramOperations } from "@/components/admin/program-operations-table"
import { RecentActivity } from "@/components/admin/recent-activity"
import { ReviewDataBanner } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { requireAdmin } from "@/lib/auth/guards"
import { getAdminOverview } from "@/lib/admin/repository"

/**
 * Administrator operations overview (ACT-004, ACT-006; MPS-REQ-016/017/020/021/
 * 024, MPS-RUL-004/005; MDS `page_shells.admin_operations`,
 * `custom.admin_operations`, MDS-REF-009).
 *
 * WHERE AUTHORIZATION LIVES
 *
 * `requireAdmin()` decides whether this page renders: a signed-out visitor is
 * redirected to sign-in carrying their destination, and a signed-in viewer
 * without an `admin` or `owner` grant gets `notFound()` — a 404, so the
 * existence of an administrator area is not confirmed to the wrong person. RLS
 * then decides independently what every read returns. Neither control depends
 * on the other, and neither depends on anything the browser sent: this route
 * accepts no route parameter and no query parameter at all, which removes the
 * validation surface rather than defending it.
 *
 * Because the role is read from `public.user_roles` on every request and is
 * never cached in a cookie or a token claim, revoking a grant denies the very
 * next request. `tests/e2e/authorization.spec.ts` asserts that rather than
 * assuming it.
 *
 * WHAT THIS PAGE REFUSES TO DO
 *
 * It remains read-only, by boundary and not by omission. The links added above
 * navigate; they change nothing. Every mutation in this release lives on
 * `/admin/programs/[id]` or `/admin/enrollments`, behind its own guard and its
 * own database authorization check. It confirms no payment,
 * confirms no enrollment, approves no consent, and decides no scholarship,
 * refund, cancellation, credit, or transfer (MPS-RUL-004). Every count comes
 * from an authoritative query; nothing is estimated or padded to make the
 * dashboard look populated. Capacity, revenue, and consent-acceptance figures
 * are absent because no authoritative source for them exists — an absent figure
 * is honest, an invented one is not.
 *
 * WHAT IT SHOWS ABOUT PEOPLE
 *
 * Aggregates. No student name, family name, parent email, or enrollment note
 * reaches this page; `src/lib/admin/repository.ts` never selects them. An
 * operator learns how many, not who, which is also the cheapest way to keep a
 * child's name off a screenshot.
 *
 * DEVIATIONS FROM MDS-REF-009
 *
 * The program-and-enrollment-operations slice closed two of them by building
 * their destinations. The NEXT ACTION column is back and D-AO2 is resolved.
 * Quick Actions is back with the two of four actions that exist, narrowing
 * D-AO1. The sidebar now carries four of nine destinations, narrowing D-AO3.
 * The remaining absences are still workflows this release does not implement,
 * and a control that leads nowhere would imply one that it does.
 *
 * The time-of-day greeting is still replaced with a fixed heading (D-AO5),
 * because a server-rendered greeting is wrong for any viewer outside the
 * server's timezone and a client-rendered one hydrates differently than it
 * rendered. All are recorded in `prompts/admin-operations-foundation.md` §9
 * and `prompts/admin-program-enrollment-operations.md`.
 */
export const metadata: Metadata = {
  title: "Operations Overview — Home School Haven of SWFL",
}

/**
 * The authorized reads and the sections they feed.
 *
 * Separated from the page so it can suspend on its own: the guard resolves
 * first and the page header renders immediately, so the response status is
 * settled before anything streams (see the header of `OverviewSkeleton`).
 *
 * @returns The overview sections.
 */
async function OverviewSections() {
  const overview = await getAdminOverview()

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <SummaryTiles
        programs={overview.programSummary}
        enrollments={overview.enrollments}
        families={overview.families}
        educators={overview.educators}
      />

      {/* MDS-REF-009 pairs the program table with the Quick Actions rail at
          desktop width and stacks them below it. */}
      <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-[1fr_320px] lg:gap-[var(--hsh-grid-gap-desktop)]">
        <ProgramOperations state={overview.programs} />
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-2 lg:gap-[var(--hsh-grid-gap-desktop)]">
        <AttentionPanel state={overview.attention} />
        <RecentActivity state={overview.activity} />
      </div>
    </div>
  )
}

export default async function AdminOverviewPage() {
  const viewer = await requireAdmin("/admin")

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Operations Overview
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Here&rsquo;s what needs attention across Home School Haven. This
            review is read-only: nothing on this page changes a record.
          </p>
        </header>

        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewSections />
        </Suspense>

        <OwnerAuthorityBand />

        <p className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Schedule, communication, report, and settings operations are not part
          of this review yet. They arrive in later slices, and no link to them
          is shown until they work.
        </p>
      </main>
    </AdminPortalShell>
  )
}
