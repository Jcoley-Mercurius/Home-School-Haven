import { Suspense } from "react"
import type { Metadata } from "next"

import { EnrollmentFilterBar } from "@/components/admin/enrollment-filters"
import { EnrollmentList } from "@/components/admin/enrollment-list"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import {
  EmptyState,
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"
import { TextLink } from "@/components/ui/text-link"
import { requireAdmin } from "@/lib/auth/guards"
import { parseEnrollmentFilters } from "@/lib/admin/filters"
import { listAdminEnrollments } from "@/lib/admin/enrollments"

import type { EnrollmentFilters, RawParams } from "@/lib/admin/filters"

/**
 * Enrollment operations (ACT-004, ACT-006; MPS-REQ-014/017/020/021/024;
 * MPS-RUL-004; MDS `page_shells.admin_operations`, `components.table` variant
 * `enrollment`, MDS-REF-009).
 *
 * AUTHORIZATION, TWICE, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether this page renders: signed out → sign-in
 * carrying the destination; signed in without an `admin` or `owner` grant →
 * `notFound()`, a 404 that does not confirm an administrator area exists here.
 * RLS then decides independently what `listAdminEnrollments()` returns — a
 * parent running the identical query gets their own family's rows and an
 * educator gets their assigned programs' rosters. Neither control is
 * load-bearing alone.
 *
 * NO RECORD IDENTIFIER IN ANY URL
 *
 * This route accepts two query parameters — a state and a program slug — and
 * both are operational facts. There is no enrollment id, student id, family id,
 * or name in the address bar, in a route segment, or in a link. Detail opens in
 * a drawer from data the list already carries, so no second request identifies
 * a child. The mutation takes an id in a POST body, where it is re-validated
 * and re-authorized.
 *
 * WHAT THIS PAGE WILL NOT DO
 *
 * It confirms no payment and holds no payment record: checklist §2 does not
 * define how a successful payment is identified, so there is nothing truthful
 * to store (GAP-ADMIN-002). It decides and issues no scholarship, discount,
 * refund, credit, or transfer (MPS GAP-010, MPS-RUL-004). It creates no
 * enrollment, because MPS-RUL-008 requires a parent's authority affirmation
 * that an administrator cannot give. It deletes nothing.
 */
export const metadata: Metadata = {
  title: "Enrollments — Operations — Home School Haven of SWFL",
}

/**
 * The authorized read and the list it feeds.
 * @param filters - The parsed, validated filters.
 * @returns The list section.
 */
async function EnrollmentSection({ filters }: { filters: EnrollmentFilters }) {
  const result = await listAdminEnrollments()

  if (result.status === "unavailable") {
    return (
      <SectionError>
        Enrollments are not available in this environment because no Supabase
        project is configured. This is a setup state, not an empty roster.
      </SectionError>
    )
  }

  if (result.status === "failed") {
    return (
      <SectionError>
        Enrollments could not be loaded. Nothing has changed — reload the page
        to try again.
      </SectionError>
    )
  }

  const all = result.data

  /* Every program that actually has an enrollment, so the filter never offers
     an option that can only ever produce an empty list. */
  const programs = Array.from(
    new Map(
      all
        .filter((enrollment) => enrollment.program !== null)
        .map((enrollment) => [
          enrollment.program!.slug,
          { slug: enrollment.program!.slug, name: enrollment.program!.name },
        ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const enrollments = all.filter(
    (enrollment) =>
      (filters.state === "all" || enrollment.state === filters.state) &&
      (filters.program === "" || enrollment.program?.slug === filters.program),
  )

  /* An unresolved program join is partial data, not an error: the enrollment is
     real and actionable, and hiding it to tidy up a missing join would hide a
     child's record from the person responsible for it. */
  const partial = enrollments.filter(
    (enrollment) =>
      enrollment.program === null || enrollment.studentName === "",
  ).length

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      <EnrollmentFilterBar filters={filters} programs={programs} />

      {all.length === 0 ? (
        <EmptyState title="No enrollments yet">
          <p>
            No family has registered for a program in this review environment.
            Enrollments appear here as families register; nothing on this page
            creates one.
          </p>
        </EmptyState>
      ) : enrollments.length === 0 ? (
        <EmptyState title="No enrollments match these filters">
          <p>
            {all.length}{" "}
            {all.length === 1 ? "enrollment exists" : "enrollments exist"}, but
            none matches the current state and program.
          </p>
          <TextLink href="/admin/enrollments">Show all enrollments</TextLink>
        </EmptyState>
      ) : (
        <>
          <p
            role="status"
            className="hsh-body-sm text-[var(--hsh-text-secondary)]"
          >
            Showing {enrollments.length} of {all.length}{" "}
            {all.length === 1 ? "enrollment" : "enrollments"}.
          </p>

          {partial > 0 ? (
            <Alert
              tone="warning"
              title={`${partial} ${partial === 1 ? "record is" : "records are"} missing linked information`}
            >
              A student or program could not be read for{" "}
              {partial === 1 ? "this record" : "these records"}. The enrollment
              itself is shown and can still be acted on — nothing is hidden
              because part of it could not be loaded.
            </Alert>
          ) : null}

          <EnrollmentList enrollments={enrollments} />
        </>
      )}
    </div>
  )
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const viewer = await requireAdmin("/admin/enrollments")
  const filters = parseEnrollmentFilters(await searchParams)

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
            { label: "Enrollments" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Enrollments
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Every enrollment and its current authoritative state. Families see
            exactly the state and wording shown here.
          </p>
        </header>

        <Alert tone="info" title="Payment is never confirmed on this platform">
          Checkout happens on Home School Haven&rsquo;s external payment page.
          Leaving for it is not proof of payment, and payment activity is not
          confirmed enrollment. Confirming an enrollment here records an
          administrator&rsquo;s decision — it verifies no payment and issues no
          refund, credit, or transfer.
        </Alert>

        <Suspense
          key={`${filters.state}:${filters.program}`}
          fallback={<ListSkeleton label="Loading enrollments" rows={4} />}
        >
          <EnrollmentSection filters={filters} />
        </Suspense>
      </main>
    </AdminPortalShell>
  )
}
