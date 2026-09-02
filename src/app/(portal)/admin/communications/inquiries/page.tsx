import type { Metadata } from "next"

import { InquiryList } from "@/components/admin/inquiry-list"
import {
  EmptyState,
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"
import { requireAdmin } from "@/lib/auth/guards"
import { listAdminInquiries } from "@/lib/admin/inquiries"

/**
 * Inquiry triage (ACT-004, ACT-006; MPS-REQ-009/010/021/024; MPS-WFL-001,
 * MPS-WFL-004; MPS-RUL-003, MPS-RUL-004; MDS `page_shells.admin_operations`).
 *
 * WHY THIS LIVES UNDER COMMUNICATIONS
 *
 * MDS `navigation.specification.admin` names nine administrator destinations —
 * Overview, Programs, Enrollments, Families, Educators, Schedule,
 * Communications, Reports, Settings — and Inquiries is not among them. Adding
 * a tenth top-level destination is a navigation decision the MDS owns, not one
 * this slice may make (AGENTS.md §3). So the queue sits inside the approved
 * Communications destination, which is already where family-facing
 * correspondence lives, and no new navigation entry is invented. Flagged as
 * MDS-GAP-P2 for confirmation: if Inquiries should be its own destination, the
 * move is a route change and a nav entry, and nothing here depends on the
 * current placement.
 *
 * AUTHORIZATION, TWICE, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether this page renders: signed out → sign-in
 * carrying the destination; signed in without an `admin` or `owner` grant →
 * `notFound()`, a 404 that does not confirm an administrator area exists here.
 * RLS then decides independently what `listAdminInquiries()` returns — and
 * `public.inquiries` has no educator policy and no family policy at all, so
 * the identical query run by anyone else returns nothing (MPS-ACC-013).
 * Neither control is load-bearing alone.
 *
 * NO RECORD IDENTIFIER IN ANY URL
 *
 * There is no inquiry id in the address bar, in a route segment, or in a link.
 * Detail opens in a drawer from data the list already carries. A private
 * request about the cost of a class does not need a shareable address, and one
 * left in a browser history or pasted into a message is a disclosure route
 * worth not creating.
 *
 * WHAT THIS PAGE WILL NOT DO
 *
 * It sends nothing to the family: MPS names no confirmation channel for
 * MPS-ACC-012 or the MPS-WFL-004 notification "Confirm receipt privately", and
 * Resend is unconfigured, so replying is the administrator's own job by email
 * or phone (GAP-PUBLIC-001). It decides and issues no discount, scholarship,
 * price, or eligibility (MPS-RUL-004). It creates no inquiry — that is the
 * public form — and it deletes none, because retention is an unresolved owner
 * decision (GAP-PUBLIC-004).
 */
export const metadata: Metadata = {
  title: "Inquiries — Communications — Operations — Home School Haven of SWFL",
}

export default async function AdminInquiriesPage() {
  const viewer = await requireAdmin("/admin/communications/inquiries")
  const result = await listAdminInquiries()

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Operations", href: "/admin" },
            { label: "Communications", href: "/admin/communications" },
            { label: "Inquiries" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Inquiries
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Every request sent from the public site — guidance, visits, general
            questions, and help with the cost of a class — with who owns it and
            where it stands.
          </p>
        </header>

        <Alert
          tone="info"
          title="Requests about cost are private, and nothing here replies for you"
        >
          A request for help with the cost of a class is visible only to
          administrators. Educators cannot see any inquiry, and no part of it
          appears on a roster or in a program announcement. Moving an inquiry
          records where your review stands; it sends the family nothing, and it
          decides no discount, scholarship, or price. Replying is still yours to
          do, by email or phone.
        </Alert>

        {result.status === "unavailable" ? (
          <SectionError>
            Inquiries are not available in this environment because no Supabase
            project is configured. This is a setup state, not an empty queue.
          </SectionError>
        ) : result.status === "failed" ? (
          <SectionError>
            Inquiries could not be loaded. This is not the same as none waiting
            — reload the page to try again.
          </SectionError>
        ) : result.data.length === 0 ? (
          <EmptyState title="No inquiries yet">
            <p>
              Nobody has sent a request from the public site in this review
              environment. Requests appear here the moment one is submitted, and
              nothing on this page creates one.
            </p>
          </EmptyState>
        ) : (
          <>
            <p
              role="status"
              className="hsh-body-sm text-[var(--hsh-text-secondary)]"
            >
              {result.data.length}{" "}
              {result.data.length === 1 ? "inquiry" : "inquiries"}, newest
              first.
            </p>

            <InquiryList inquiries={result.data} viewerId={viewer.userId} />
          </>
        )}
      </main>
    </AdminPortalShell>
  )
}
