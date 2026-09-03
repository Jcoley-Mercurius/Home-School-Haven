import { Suspense } from "react"
import type { Metadata } from "next"

import { FamilyList } from "@/components/admin/family-list"
import {
  InvitationList,
  InvitationListError,
} from "@/components/admin/invitation-list"
import { InviteFamilyForm } from "@/components/admin/invite-family-form"
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
import { listInvitations } from "@/lib/admin/invitations"

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
 * THE DIRECTORY READS. IT DOES NOT WRITE.
 *
 * A family account and its student profiles are the parent's (ACT-001). An
 * administrator seeing them here acquires no authority over them, and checklist
 * §11 leaves correction, retention, and deletion unanswered, so there is
 * nothing approved to build (GAP-ADMIN-009/010/011). The absence is enforced
 * three deep: no mutation is offered in the directory UI,
 * `src/lib/admin/families.ts` exports no write, and `families`,
 * `family_members`, and `students` hold no write policy or grant for any client
 * role.
 *
 * THE ONE WRITE ON THIS PAGE IS THE INVITATION SECTION
 *
 * Family provisioning is invite-only by the owner decision of 2026-09-02
 * (MPS-REQ-011): only an authorized administrator may invite a family, there is
 * no public self-service signup, and an invitation grants the `parent` role and
 * nothing else. Inviting creates an ACCOUNT, not a family record — the parent
 * still names their own family during setup, so nothing above changes.
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
 * No guardian email or phone in the DIRECTORY — `src/lib/admin/families.ts`
 * reads no contact detail at any depth. The invitation section shows the
 * addresses an administrator themselves typed, which is a different fact from
 * a family's contact record and is never joined to one. No assistance-request detail (MPS-RUL-003).
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

  const { data: families, gaps } = result

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
  const missingGuardian = gaps.includes("guardians")
    ? 0
    : families.filter((family) => family.guardians.length === 0).length

  const gapLabels = gaps.map((gap) => {
    switch (gap) {
      case "guardians":
        return "guardian information"
      case "students":
        return "student information"
      case "enrollments":
        return "enrollment information"
    }
  })

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      {gapLabels.length > 0 ? (
        <Alert tone="warning" title="Some family details could not be loaded">
          {gapLabels.join(", ")} {gapLabels.length === 1 ? "is" : "are"}{" "}
          unavailable. Reload the page to try again; unavailable relationships
          are labeled below instead of being reported as empty.
        </Alert>
      ) : null}

      {missingGuardian > 0 ? (
        <Alert tone="warning" title="Some accounts have no linked guardian">
          {missingGuardian === 1 ? "One family" : `${missingGuardian} families`}{" "}
          {missingGuardian === 1 ? "has" : "have"} no parent or guardian account
          linked. The {missingGuardian === 1 ? "record is" : "records are"}{" "}
          shown below — nothing is hidden because part of it could not be
          loaded.
        </Alert>
      ) : null}

      <FamilyList families={families} gaps={gaps} />
    </div>
  )
}

/**
 * The invitation section: the form, and the state of every invitation issued.
 * @returns The invitation section.
 */
async function InvitationSection() {
  const result = await listInvitations()

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <InviteFamilyForm />

      {result.status === "unavailable" ? (
        <SectionError>
          Invitations are not available in this environment because no Supabase
          project is configured. This is a setup state, not an empty list.
        </SectionError>
      ) : result.status === "failed" ? (
        <InvitationListError />
      ) : (
        <InvitationList invitations={result.data} />
      )}
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

        <section
          aria-labelledby="invitations-heading"
          className="flex flex-col gap-[var(--hsh-space-4)]"
        >
          <header className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2
              id="invitations-heading"
              className="hsh-h3 text-[var(--hsh-text-primary)]"
            >
              Invitations
            </h2>
            <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              A parent cannot create their own account. Inviting one here sends
              a link that lets them set a password and start their family setup.
            </p>
          </header>

          <Suspense
            fallback={<ListSkeleton label="Loading invitations" rows={2} />}
          >
            <InvitationSection />
          </Suspense>
        </section>

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
