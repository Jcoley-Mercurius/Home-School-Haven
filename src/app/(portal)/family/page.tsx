import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { TriangleAlert } from "lucide-react"

import {
  AnnouncementsCard,
  AssistanceCard,
  EnrollmentsCard,
  NextActionCard,
  ResourcesCard,
  ScheduleCard,
} from "@/components/family/dashboard-cards"
import {
  EmptyState,
  ReviewDataBanner,
} from "@/components/family/section-states"
import { DashboardSkeleton } from "@/components/family/dashboard-skeleton"
import { StudentSelector } from "@/components/family/student-selector"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { Button } from "@/components/ui/button"
import { requireRole } from "@/lib/auth/guards"
import {
  enrollmentsForStudent,
  getFamilyEnrollments,
} from "@/lib/enrollment/repository"
import {
  getFamilyAnnouncements,
  getFamilyResources,
} from "@/lib/family/content"
import { nextAction, selectStudent } from "@/lib/family/dashboard-state"
import { getFamilyState, type Student } from "@/lib/family/repository"

/**
 * Family dashboard — the "Overview" destination (MPS-REQ-015, MPS-WFL-007,
 * MPS-ACC-024/025; MDS `page_shells.family_dashboard`, MDS-REF-007).
 *
 * WHERE AUTHORIZATION LIVES
 *
 * `requireRole` decides whether this page renders. RLS decides what each of the
 * four reads returns. Neither depends on the other, and neither depends on
 * anything the browser sent: the family is derived from the session, and the
 * only client-supplied value on this route is `?student=`, which
 * `selectStudent()` validates against rows RLS already filtered. UI visibility
 * is not authorization, so nothing here is the control — both halves are.
 *
 * WHY THE READS ARE SEPARATE
 *
 * Four independent reads, four independent states. A failed announcements query
 * renders a recoverable error inside the announcements card while enrollments
 * still render, which is the "partial data" state the release needs. A single
 * combined query would make one failure remove four sections, and would tell
 * the family less than a page that says which part is missing.
 *
 * WHAT IT REFUSES TO SAY
 *
 * Only `confirmed` reads as enrolled. `payment_pending` states in its own
 * sentence that enrollment is not yet confirmed. No schedule time is invented
 * (deviation D-FD1). No financial, consent, or administrative decision is made
 * or implied anywhere on this page.
 */
export const metadata: Metadata = {
  title: "Family Overview — Home School Haven of SWFL",
}

/**
 * The four authorized reads and the section grid they feed.
 *
 * Separated from the page so it can suspend on its own: the page decides
 * authorization and renders the header immediately, and only this waits.
 *
 * @param students - The family's authorized student profiles.
 * @param selectedStudentId - The student whose context is in view.
 * @returns The dashboard section grid.
 */
async function DashboardSections({
  students,
  selectedStudentId,
}: {
  students: Student[]
  selectedStudentId: string | null
}) {
  const [enrollments, announcements, resources] = await Promise.all([
    getFamilyEnrollments(),
    getFamilyAnnouncements(3),
    getFamilyResources(3),
  ])

  /* Scoped to the selected child. Enrollments the parent may see, narrowed to
     the one they are looking at — a presentation choice on top of a boundary
     the database already applied. */
  const scopedEnrollments =
    enrollments.status === "ready"
      ? {
          ...enrollments,
          items: enrollmentsForStudent(enrollments.items, selectedStudentId),
        }
      : enrollments

  /* The action is derived from the whole family, not the selected child: a
     pending payment on the other child is still this family's next step. */
  const action = nextAction(
    students,
    enrollments.status === "ready" ? enrollments.items : null,
  )

  return (
    /* MDS responsive.rules.grid: multi-column on desktop, one prioritized feed
       on mobile. The order below IS the mobile priority order — next action,
       enrollments, schedule, announcements, resources. */
    <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-3 lg:gap-[var(--hsh-grid-gap-desktop)]">
      <NextActionCard action={action} />
      <EnrollmentsCard
        state={scopedEnrollments}
        heading="My Enrollments"
        viewAllHref="/family/schedule"
      />
      <ScheduleCard
        state={scopedEnrollments}
        heading="Your Schedule"
        viewAllHref="/family/schedule"
      />
      <AnnouncementsCard
        state={announcements}
        viewAllHref="/family/announcements"
      />
      <ResourcesCard state={resources} viewAllHref="/family/resources" />
      <AssistanceCard />
    </div>
  )
}

export default async function FamilyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const viewer = await requireRole("parent", "/family")
  const family = await getFamilyState()

  /* No family is a setup state, not an empty dashboard. Sending the parent to
     the one action that resolves it beats rendering six empty cards. */
  if (family.status === "incomplete") redirect("/family/setup")

  const { student: requestedStudent } = await searchParams

  const students = family.status === "ready" ? family.students : []
  const selected = selectStudent(students, requestedStudent)

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        {/* A failed family read is not an empty family. It is said plainly,
            because the two must never look the same. */}
        {family.status === "failed" || family.status === "unavailable" ? (
          <div
            role="alert"
            className="flex max-w-[var(--hsh-content-reading)] gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
              strokeWidth={1.75}
            />
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {family.status === "unavailable"
                ? "Family records are not connected in this review environment yet."
                : "We could not load your family details just now. Nothing was lost — please refresh in a moment."}
            </p>
          </div>
        ) : null}

        <header className="flex flex-wrap items-end justify-between gap-[var(--hsh-space-4)]">
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
              Family Overview
            </h1>
            <p className="hsh-body-lg text-[var(--hsh-text-secondary)]">
              {family.status === "ready"
                ? `Here's what's happening with ${family.family.name} at Home School Haven.`
                : "Here's what's happening with your family at Home School Haven."}
            </p>
          </div>

          <StudentSelector
            students={students}
            selectedId={selected?.id ?? ""}
          />
        </header>

        {family.status === "ready" && students.length === 0 ? (
          <EmptyState
            title="No student profiles yet"
            className="max-w-[var(--hsh-content-reading)]"
          >
            <p>
              Your family is set up. Adding a student profile is the next step,
              and you can change or remove it at any time.
            </p>
            <Button
              variant="primary"
              size="lg"
              render={<Link href="/family/students/new" />}
            >
              Add A Student
            </Button>
          </EmptyState>
        ) : null}

        {/* Only the four section reads suspend. The guard and the family read
            have already resolved above, so the response status is settled
            before anything streams — see the header of DashboardSkeleton. */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardSections
            students={students}
            selectedStudentId={selected?.id ?? null}
          />
        </Suspense>
      </main>
    </FamilyPortalShell>
  )
}
