import type { Metadata } from "next"
import Link from "next/link"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { removeStudentAction } from "@/app/(portal)/family/students/new/actions"
import { Button } from "@/components/ui/button"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Family and student management — the "Family" destination (ACT-001,
 * MPS-REQ-004, MPS-REQ-011, MPS-WFL-002).
 *
 * This is the family *foundation*. It moved here from `/family` when the
 * dashboard took that route, because MDS names both destinations separately:
 * "Overview" is the dashboard, "Family" is this.
 *
 * It renders every state MPS-WFL-002 names, told truthfully:
 * `family_incomplete` invites setup, `family_ready` shows the family and its
 * students, and a failed read says so instead of looking empty. An empty read
 * and a broken read must never look the same — one is a fact about the family,
 * the other is a fact about us.
 *
 * The student list comes back through RLS, which returns only this family's
 * rows. There is no `.eq()` filtering it in the repository, on purpose: the
 * boundary lives in the database, not in a query we could forget to write.
 */
export const metadata: Metadata = {
  title: "Family — Home School Haven of SWFL",
}

export default async function FamilyHouseholdPage() {
  const viewer = await requireRole("parent", "/family/household")
  const state = await getFamilyState()

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-8)] py-[var(--hsh-space-10)]"
      >
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          {state.status === "ready" ? state.family.name : "Your family"}
        </h1>

        {state.status === "failed" || state.status === "unavailable" ? (
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
              {state.status === "unavailable"
                ? "Family records are not connected in this review environment yet."
                : "We could not load your family details just now. Nothing was lost — please refresh in a moment."}
            </p>
          </div>
        ) : null}

        {/* MPS-WFL-002 `family_incomplete`. A truthful empty state with the one
            action that resolves it, rather than a blank page. */}
        {state.status === "incomplete" ? (
          <div className="flex max-w-[var(--hsh-content-reading)] flex-col items-start gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)]">
            <h2 className="hsh-h3 text-[var(--hsh-text-primary)]">
              Let&rsquo;s set up your family
            </h2>
            <p className="hsh-body text-[var(--hsh-text-secondary)]">
              No family record is linked to your account yet. Setting one up
              takes a moment, and you can come back to finish at any time.
            </p>
            <Button
              variant="primary"
              size="lg"
              render={<Link href="/family/setup" />}
            >
              Set Up My Family
            </Button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <>
            <section
              aria-labelledby="students-heading"
              className="flex flex-col gap-[var(--hsh-space-4)]"
            >
              <h2
                id="students-heading"
                className="hsh-h3 text-[var(--hsh-text-primary)]"
              >
                Students
              </h2>

              {/* Deviation D-FF1 made visible. The /resources demo surface set
                  this precedent on 2026-08-28: a demo surface says so on the
                  page, not only in a commit message. */}
              <div className="flex max-w-[var(--hsh-content-reading)] gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]">
                <CircleAlert
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-[var(--hsh-info)]"
                  strokeWidth={1.75}
                />
                <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  Student profiles are sample records for this review. Home
                  School Haven has still to confirm what student information it
                  will keep, who may see it, and how long it is held, so please
                  use sample names rather than a real child&rsquo;s.
                </p>
              </div>

              {state.students.length === 0 ? (
                <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                  No students have been added yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-[var(--hsh-space-3)]">
                  {state.students.map((student) => (
                    <li
                      key={student.id}
                      className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-[var(--hsh-space-1)]">
                        <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                          {student.preferredName}
                        </span>
                        {student.gradeLevel ? (
                          <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                            {student.gradeLevel}
                          </span>
                        ) : null}
                      </div>
                      {/* A recovery path for a mistyped sample record, not a
                          deletion policy — retention and deletion remain
                          Samantha's checklist §11. */}
                      <form action={removeStudentAction}>
                        <input
                          type="hidden"
                          name="studentId"
                          value={student.id}
                        />
                        <Button type="submit" variant="secondary" size="md">
                          Remove {student.preferredName}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="primary"
                size="lg"
                className="self-start"
                render={<Link href="/family/students/new" />}
              >
                Add A Student
              </Button>
            </section>

            <p className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              Enrollments, schedules, announcements, and learning resources for
              your family are on the{" "}
              <Link
                href="/family"
                className="text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                Overview
              </Link>
              .
            </p>
          </>
        ) : null}
      </main>
    </FamilyPortalShell>
  )
}
