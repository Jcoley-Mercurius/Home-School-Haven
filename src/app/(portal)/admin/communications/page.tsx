import type { Metadata } from "next"
import Link from "next/link"

import { ContentStateBadge } from "@/components/content/content-state-badge"
import {
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { EmptyState } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { requireAdmin } from "@/lib/auth/guards"
import {
  listAnnouncements,
  listResources,
} from "@/lib/content/announcements-index"
import { KIND_LABELS } from "@/lib/content/lifecycle"

/**
 * Administrator content operations across every program (MPS-REQ-019,
 * MPS-REQ-020, MPS-ACC-031).
 *
 * WHY THIS DESTINATION EXISTS
 *
 * MDS `navigation.specification.admin` names Communications among the
 * administrator destinations, and the shell had none of Schedule,
 * Communications, Reports, or Settings (deviation D-AO3). This adds
 * Communications for content, narrowing that deviation. The other three remain
 * missing and remain recorded.
 *
 * THE SAME ROWS, NOT A SECOND COPY
 *
 * The lists below read `public.announcements` and `public.learning_resources`
 * with no state filter and no program filter — `announcements_select_admin` and
 * `learning_resources_select_admin` are what return everything. So an
 * administrator sees exactly what an educator sees on their own programs, in
 * exactly the same state, because it is the same row (MPS-REQ-020).
 */
export const metadata: Metadata = {
  title: "Communications — Operations — Home School Haven of SWFL",
}

export default async function AdminCommunicationsPage() {
  const viewer = await requireAdmin("/admin/communications")

  const [announcements, resources] = await Promise.all([
    listAnnouncements(),
    listResources(),
  ])

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Communications
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Announcements and learning resources across every program, with the
            state each one is in. Assigned educators author for their own
            programs; you can author for any.
          </p>
        </header>

        {/* Inbound family requests, alongside the outbound announcements and
            resources below. The queue lives here because MDS
            `navigation.specification.admin` names no Inquiries destination and
            adding one is the MDS's decision, not this slice's (MDS-GAP-P2, see
            `./inquiries/page.tsx`). */}
        <section
          aria-labelledby="inquiries-heading"
          className="flex flex-col gap-[var(--hsh-space-3)]"
        >
          <h2
            id="inquiries-heading"
            className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
          >
            Inquiries
          </h2>
          <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Requests sent from the public site: guidance, visits, general
            questions, and help with the cost of a class. Requests about cost
            are private to administrators and are never shown to educators.
          </p>
          <div>
            <Button
              render={<Link href="/admin/communications/inquiries" />}
              variant="secondary"
              size="md"
            >
              Open inquiries
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="announcements-heading"
          className="flex flex-col gap-[var(--hsh-space-4)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
            <h2
              id="announcements-heading"
              className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
            >
              Announcements
            </h2>
            <Button
              render={<Link href="/admin/communications/announcements/new" />}
              variant="primary"
              size="md"
            >
              New announcement
            </Button>
          </div>

          {announcements.status !== "ready" ? (
            <SectionError>
              {announcements.status === "unavailable"
                ? "Announcements are not connected in this review environment yet."
                : "We could not load announcements just now. Nothing was lost — please refresh in a moment."}
            </SectionError>
          ) : announcements.items.length === 0 ? (
            <EmptyState title="No announcements yet">
              <p>
                Nothing has been written for any program. Create the first one
                above.
              </p>
            </EmptyState>
          ) : (
            <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
              {announcements.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-[var(--hsh-space-2)]">
                      <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
                        <Link
                          href={`/admin/communications/announcements/${item.id}`}
                          className="hsh-body font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
                        >
                          {item.title}
                        </Link>
                        <ContentStateBadge state={item.state} />
                      </div>
                      <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                        {item.programName ?? "Program not available"}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="resources-heading"
          className="flex flex-col gap-[var(--hsh-space-4)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
            <h2
              id="resources-heading"
              className="hsh-h3 m-0 text-[var(--hsh-text-primary)]"
            >
              Learning resources
            </h2>
            <Button
              render={<Link href="/admin/communications/resources/new" />}
              variant="primary"
              size="md"
            >
              New resource
            </Button>
          </div>

          {resources.status !== "ready" ? (
            <SectionError>
              {resources.status === "unavailable"
                ? "Learning resources are not connected in this review environment yet."
                : "We could not load learning resources just now. Nothing was lost — please refresh in a moment."}
            </SectionError>
          ) : resources.items.length === 0 ? (
            <EmptyState title="No resources yet">
              <p>
                Nothing has been published for any program. Create the first one
                above.
              </p>
            </EmptyState>
          ) : (
            <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
              {resources.items.map((item) => (
                <li key={item.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-[var(--hsh-space-2)]">
                      <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
                        <Link
                          href={`/admin/communications/resources/${item.id}`}
                          className="hsh-body font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
                        >
                          {item.title}
                        </Link>
                        <ContentStateBadge state={item.state} />
                      </div>
                      <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                        {KIND_LABELS[item.kind]} ·{" "}
                        {item.programName ?? "Program not available"}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AdminPortalShell>
  )
}
