"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { EnrollmentDrawer } from "@/components/admin/enrollment-drawer"
import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { Button } from "@/components/ui/button"

import type { AdminEnrollment } from "@/lib/admin/enrollments"

/**
 * The enrollment operations list (MDS-REF-009 enrollment operations;
 * `components.table` variant `enrollment`; `responsive.rules.grid`
 * "Operational tables transform to labeled record cards when column integrity
 * cannot be preserved").
 *
 * WHY THE WHOLE LIST IS A CLIENT COMPONENT
 *
 * The detail drawer is modal: it needs focus trapping, Escape, and focus
 * return, which live in the browser. Rather than fetch a record when a drawer
 * opens, every row already carries the four facts the drawer shows, so opening
 * one is instant and needs no second authorized read. The dataset is small
 * enough that this costs nothing, and it removes an entire request path that
 * would have taken a record identifier from the browser.
 *
 * ONE DRAWER, NOT ONE PER ROW
 *
 * A single drawer instance renders whichever record is selected. A drawer per
 * row would put every enrollment's detail into the DOM at once — including
 * every child's name — which is more of a family's information present on the
 * page than the operator asked to see.
 *
 * WHAT IS SHOWN ABOUT PEOPLE
 *
 * A student's preferred name and the family's name. Nothing else about either
 * is read from the database (`src/lib/admin/enrollments.ts`), so nothing else
 * can appear here. There is no legal name to leak because none is collected.
 *
 * TWO RENDERINGS, ONE ACCESSIBILITY TREE
 *
 * Table from `sm` up, labeled record cards below it. Both are in the DOM, so
 * every test locator over this component must be scoped to one of them
 * (DEFECT-AO3).
 */
function EnrollmentList({ enrollments }: { enrollments: AdminEnrollment[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    enrollments.find((enrollment) => enrollment.id === selectedId) ?? null

  const programName = (enrollment: AdminEnrollment) =>
    enrollment.program?.name ?? "Program not available"

  /* The control's accessible name says whose enrollment it opens, so a list of
     controls read out of the row's context is still unambiguous. Applied as
     `aria-label`, not a visually-hidden span: a hidden span would repeat a
     student's name in the table's text, making scoped locators ambiguous and
     putting the name on the page twice for no reader's benefit (DEFECT-PE4). */
  const openLabel = (enrollment: AdminEnrollment) =>
    `Review ${enrollment.studentName || "this student"}'s enrollment in ${programName(enrollment)}`

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Enrollments, with student, family, program, current state, and when
            that state last changed. Select an enrollment to open its detail.
          </caption>
          <thead>
            <tr className="border-b border-[var(--hsh-border-default)]">
              {["Student", "Family", "Program", "State", "Action"].map(
                (heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
                  >
                    <span className={index === 4 ? "sr-only" : undefined}>
                      {heading}
                    </span>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr
                key={enrollment.id}
                className="border-b border-[var(--hsh-border-default)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                >
                  {enrollment.studentName || "Student not available"}
                </th>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {enrollment.familyName || "Family not available"}
                </td>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {programName(enrollment)}
                </td>
                <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                  <EnrollmentStateBadge state={enrollment.state} />
                </td>
                <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={openLabel(enrollment)}
                    onClick={() => setSelectedId(enrollment.id)}
                  >
                    Review
                    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
        {enrollments.map((enrollment) => (
          <li
            key={enrollment.id}
            className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
          >
            <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {enrollment.studentName || "Student not available"}
            </p>

            <dl className="flex flex-col gap-[var(--hsh-space-3)]">
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Family
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {enrollment.familyName || "Family not available"}
                </dd>
              </div>
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Program
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {programName(enrollment)}
                </dd>
              </div>
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  State
                </dt>
                <dd className="m-0">
                  <EnrollmentStateBadge state={enrollment.state} />
                </dd>
              </div>
            </dl>

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              aria-label={openLabel(enrollment)}
              onClick={() => setSelectedId(enrollment.id)}
            >
              Review
              <ChevronRight aria-hidden="true" strokeWidth={1.75} />
            </Button>
          </li>
        ))}
      </ul>

      <EnrollmentDrawer
        enrollment={selected}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

export { EnrollmentList }
