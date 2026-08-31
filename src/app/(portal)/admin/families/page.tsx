import { Suspense } from "react"
import type { Metadata } from "next"

import { FamilyList } from "@/components/admin/family-list"
import { ListSkeleton } from "@/components/admin/list-skeleton"
import {
  EmptyState,
  ReviewDataBanner,
  SectionError,
} from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"
import { requireAdmin } from "@/lib/auth/guards"
import { listAdminFamilies } from "@/lib/admin/families"

/**
 * Family operations (ACT-004, ACT-006; MPS-REQ-004/005/017/020/021;
 * MPS-RUL-003/006/007; MPS-ACC-003/004/005; MDS
 * `page_shells.admin_operations`, MDS-REF-009).
 *
 * AUTHORIZATION, TWICE, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether this page renders: signed out → sign-in
 * carrying the destination; signed in without an `admin` or `owner` grant →
 * `notFound()`, a 404 that does not confirm a family directory exists here.
 * RLS then decides independently what `listAdminFamilies()` returns — a parent
 * running the identical query gets their own family and their own children.
 * Neither control is load-bearing alone.
 *
 * THIS PAGE READS. IT DOES NOT WRITE.
 *
 * A family account and its student profiles are the parent's (ACT-001). An
 * administrator seeing them here acquires no authority over them, and checklist
 * §11 leaves correction, retention, and deletion unanswered, so there is
 * nothing approved to build (GAP-ADMIN-009/010/011). The absence is enforced
 * three deep: no mutation is offered in the UI, `src/lib/admin/families.ts`
 * exports no write, and `families`, `family_members`, and `students` hold no
 * write policy or grant for any client role.
 *
 * NO RECORD IDENTIFIER IN ANY URL
 *
 * This route takes no parameters at all. Detail opens in a drawer from data the
 * list already carries, and the search filters in the browser rather than
 * through a query string, so no family name and no family, student, or
 * guardian identifier reaches the address bar, browser history, a referrer
 * header, or a server access log.
 *
 * WHAT THIS PAGE WILL NOT SHOW
 *
 * No guardian email or phone — `auth.users` is never read and there is no
 * service-role client in this path. No assistance-request detail (MPS-RUL-003).
 * No medical, behavioral, accommodation, demographic, emergency-contact, legal
 * name, or date-of-birth field: MPS-RUL-006 kept those columns from being
 * created, so there is nothing to withhold.
 */
export const metadata: Metadata = {
  title: "Families — Operations — Home School Haven of SWFL",
}

/**
 * The authorized read and the directory it feeds.
 * @returns The directory section.
 */
async function FamilySection() {
  const result = await listAdminFamilies()

  if (result.status === "unavailable") {
    return (
      <SectionError>
        Families are not available in this environment because no Supabase
        project is configured. This is a setup state, not an empty directory.
      </SectionError>
    )
  }

  if (result.status === "failed") {
    return (
      <SectionError>
        Families could not be loaded. Nothing has changed — reload the page to
        try again.
      </SectionError>
    )
  }

  const families = result.data

  if (families.length === 0) {
    return (
      <EmptyState title="No families yet">
        <p>
          No family account has been created. A family appears here once a
          parent or guardian creates one — an administrator cannot create a
          family on a parent&rsquo;s behalf.
        </p>
      </EmptyState>
    )
  }

  /* Partial data is reported rather than hidden: a family whose guardian
     profile could not be read is still a real account an administrator is
     responsible for, and dropping it to tidy the table would hide it from the
     person accountable for it. */
  const missingGuardian = families.filter(
    (family) => family.guardians.length === 0,
  ).length

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      {missingGuardian > 0 ? (
        <Alert tone="warning" title="Some accounts have no linked guardian">
          {missingGuardian === 1 ? "One family" : `${missingGuardian} families`}{" "}
          {missingGuardian === 1 ? "has" : "have"} no parent or guardian account
          linked. The {missingGuardian === 1 ? "record is" : "records are"}{" "}
          shown below — nothing is hidden because part of it could not be
          loaded.
        </Alert>
      ) : null}

      <FamilyList families={families} />
    </div>
  )
}

export default async function AdminFamiliesPage() {
  const viewer = await requireAdmin("/admin/families")

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
            { label: "Families" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Families
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Every family account, its guardians, its students, and what each
            student is enrolled in.
          </p>
        </header>

        <Alert tone="info" title="Families control their own records">
          This directory is read-only. A parent or guardian adds, changes, and
          removes their family&rsquo;s details and student profiles; an
          administrator cannot edit or delete them here. Enrollment states are
          changed on the Enrollments page, where each decision is recorded with
          a reason.
        </Alert>

        <Suspense fallback={<ListSkeleton label="Loading families" rows={4} />}>
          <FamilySection />
        </Suspense>
      </main>
    </AdminPortalShell>
  )
}
