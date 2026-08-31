import { Suspense } from "react"
import type { Metadata } from "next"

import { EducatorList } from "@/components/admin/educator-list"
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
import { listAdminEducators } from "@/lib/admin/educators"
import { listAdminPrograms } from "@/lib/admin/programs"

/**
 * Educator operations (ACT-004, ACT-006; MPS-REQ-017/018/021/024;
 * MPS-WFL-005, MPS-WFL-006; MDS `page_shells.admin_operations`, MDS-REF-009).
 *
 * AUTHORIZATION, THREE TIMES, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether the page renders — signed out redirects to
 * sign-in carrying the destination, signed in without an `admin` or `owner`
 * grant gets `notFound()`. The server action re-checks it before every write.
 * `admin_assign_educator` checks it a third time against the verified session,
 * inside the database, where a request that never touched this application
 * still meets it. No one of the three is load-bearing alone.
 *
 * THE TWO OPERATIONS THIS PAGE OFFERS
 *
 * Assign an educator to a program, and remove that assignment. There is no
 * invite, activate, suspend, promote, or delete — none is approved, and each
 * would need something this release does not have: an invitation capability
 * (GAP-ADMIN-012), an approved answer to what happens when an educator leaves
 * (GAP-ADMIN-013), or the owner's authority over administrator access, which is
 * Samantha's and is not delegated to a screen (ACT-006).
 *
 * `public.user_roles` holds no client write policy and no write grant, so no
 * path from this page can change anyone's role even if one were added by
 * mistake.
 *
 * NO RECORD IDENTIFIER IN ANY URL
 *
 * This route takes no parameters. Detail opens in a drawer from data the list
 * already carries, the search filters in the browser, and both mutations carry
 * their identifiers in a POST body where they are re-validated and
 * re-authorized.
 */
export const metadata: Metadata = {
  title: "Educators — Operations — Home School Haven of SWFL",
}

/**
 * The authorized reads and the directory they feed.
 * @returns The directory section.
 */
async function EducatorSection() {
  /* Two independent reads. The program list only supplies the assignment
     control's options, so its failure costs the page that control rather than
     the directory — an administrator can still see who is assigned to what. */
  const [educatorResult, programResult] = await Promise.all([
    listAdminEducators(),
    listAdminPrograms(),
  ])

  if (educatorResult.status === "unavailable") {
    return (
      <SectionError>
        Educators are not available in this environment because no Supabase
        project is configured. This is a setup state, not an empty directory.
      </SectionError>
    )
  }

  if (educatorResult.status === "failed") {
    return (
      <SectionError>
        Educators could not be loaded. Nothing has changed — reload the page to
        try again.
      </SectionError>
    )
  }

  const educators = educatorResult.data

  if (educators.length === 0) {
    return (
      <EmptyState title="No educators yet">
        <p>
          No account holds the educator role. Educator accounts are created and
          granted their role outside the platform — Home School Haven has no
          educator invitation in this release.
        </p>
      </EmptyState>
    )
  }

  /* Archived programs are excluded here rather than filtered in the drawer:
     `admin_assign_educator` refuses them, and offering a choice the database
     will reject is a control that exists to fail. */
  const programs =
    programResult.status === "ready"
      ? programResult.data
          .filter((program) => program.publicationState !== "archived")
          .map((program) => ({ id: program.id, name: program.name }))
      : []

  const unlinked = educators.filter(
    (educator) => !educator.accountLinked,
  ).length
  const unassigned = educators.filter(
    (educator) => educator.assignments.length === 0,
  ).length

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      {programResult.status !== "ready" ? (
        <Alert tone="warning" title="Programs could not be loaded">
          Assignments below are shown as recorded, but no new assignment can be
          made until the program list loads. Reload the page to try again.
        </Alert>
      ) : null}

      {unlinked > 0 ? (
        <Alert
          tone="warning"
          title="Some educator grants have no linked account"
        >
          {unlinked === 1
            ? "One educator role is"
            : `${unlinked} educator roles are`}{" "}
          granted to {unlinked === 1 ? "an account" : "accounts"} with no
          profile. Assigning a program to{" "}
          {unlinked === 1 ? "that grant" : "those grants"} would give access to
          nobody.
        </Alert>
      ) : null}

      {unassigned > 0 ? (
        <Alert tone="info" title="Some educators have no assigned program">
          {unassigned === 1 ? "One educator is" : `${unassigned} educators are`}{" "}
          not assigned to any program, so{" "}
          {unassigned === 1 ? "they reach" : "they reach"} no roster, resource,
          or announcement. This is a safe default, not an error.
        </Alert>
      ) : null}

      <EducatorList educators={educators} programs={programs} />
    </div>
  )
}

export default async function AdminEducatorsPage() {
  const viewer = await requireAdmin("/admin/educators")

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
            { label: "Educators" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Educators
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Who holds the educator role, which programs each of them is assigned
            to, and the two changes an administrator may make to that.
          </p>
        </header>

        <Alert
          tone="info"
          title="An assignment is program access, nothing more"
        >
          Assigning an educator gives them one program&rsquo;s roster,
          resources, and announcements. It grants no control over pricing,
          availability, or cancellation, no reach into an unassigned program,
          and no administrator authority. Samantha Dodson controls administrator
          access, and it is not granted from this page.
        </Alert>

        <Suspense
          fallback={<ListSkeleton label="Loading educators" rows={3} />}
        >
          <EducatorSection />
        </Suspense>
      </main>
    </AdminPortalShell>
  )
}
