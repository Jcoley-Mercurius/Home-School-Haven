"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { DirectorySearch } from "@/components/admin/directory-search"
import { EducatorDrawer } from "@/components/admin/educator-drawer"
import { EmptyState } from "@/components/family/section-states"
import { Button } from "@/components/ui/button"
import { matchesSearch } from "@/lib/admin/filters"

import type { AdminEducator } from "@/lib/admin/educators"

/**
 * A program an educator may be assigned to.
 *
 * Archived programs are excluded before this type is built — `admin_assign_
 * educator` refuses them, and offering a choice the database will reject is a
 * control that exists to fail.
 */
type AssignableProgram = { id: string; name: string }

/**
 * The educator directory (MDS-REF-009 admin operations; `components.table`
 * variant `standard`; `responsive.rules.grid` "Operational tables transform to
 * labeled record cards when column integrity cannot be preserved").
 *
 * WHAT AN EDUCATOR ROW IS MADE OF
 *
 * A display name from `profiles`, a role grant from `user_roles`, and the
 * assignments from `educator_assignments`. There is no educators table — see
 * the note in `src/lib/admin/educators.ts` — so what a row shows is exactly
 * what the authorization model already knows about that person, and nothing
 * invented to fill a column.
 *
 * No email, no credential, no token, no editable metadata: none of it is read,
 * so none of it can be rendered.
 *
 * WHY THE WHOLE LIST IS A CLIENT COMPONENT
 *
 * The detail drawer is modal — focus trap, Escape, focus return — and the
 * search filters in memory rather than through the URL. Both need the browser.
 * Every row already carries what its drawer shows, so opening one costs no
 * second authorized read.
 *
 * TWO RENDERINGS, ONE ACCESSIBILITY TREE
 *
 * Table from `sm` up, labeled record cards below it. Both are in the DOM, so
 * every test locator over this component must be scoped to one of them
 * (DEFECT-AO3).
 */
function EducatorList({
  educators,
  programs,
}: {
  educators: AdminEducator[]
  programs: AssignableProgram[]
}) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /* Educator names and the programs they hold are both searchable: "who
     teaches Art Lab" is as common an operational question as "where is Sample
     Educator assigned", and both are answered from data already on the page. */
  const visible = useMemo(
    () =>
      educators.filter(
        (educator) =>
          matchesSearch(educator.displayName, query) ||
          educator.assignments.some((assignment) =>
            matchesSearch(assignment.programName, query),
          ),
      ),
    [educators, query],
  )

  const selected =
    educators.find((educator) => educator.userId === selectedId) ?? null

  const nameLabel = (educator: AdminEducator) =>
    educator.displayName || "Name not available"

  const assignmentLabel = (educator: AdminEducator) =>
    educator.assignments.length === 0
      ? "No assigned programs"
      : educator.assignments
          .map((assignment) => assignment.programName)
          .join(", ")

  /* The control's accessible name says whose record it opens, so a list of
     controls read out of the row's context is still unambiguous. Applied as
     `aria-label` rather than a visually-hidden span, which would repeat the
     name in the table's text and make scoped locators ambiguous (DEFECT-PE4). */
  const openLabel = (educator: AdminEducator) =>
    `Manage ${nameLabel(educator)}'s program assignments`

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      <DirectorySearch
        label="Search educators"
        value={query}
        onValueChange={setQuery}
        resultCount={visible.length}
        totalCount={educators.length}
        noun="educators"
      />

      {visible.length === 0 ? (
        <EmptyState title="No educators match that search">
          <p>
            Nothing in the directory matches &ldquo;{query}&rdquo;. Clear the
            search to see all {educators.length} educators.
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Educators, with whether an account is linked and which programs
                they are assigned to. Select an educator to manage their
                assignments.
              </caption>
              <thead>
                <tr className="border-b border-[var(--hsh-border-default)]">
                  {["Educator", "Account", "Assigned programs", "Action"].map(
                    (heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
                      >
                        <span className={index === 3 ? "sr-only" : undefined}>
                          {heading}
                        </span>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((educator) => (
                  <tr
                    key={educator.userId}
                    className="border-b border-[var(--hsh-border-default)] last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                    >
                      {nameLabel(educator)}
                    </th>
                    <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                      {educator.accountLinked ? "Linked" : "No linked account"}
                    </td>
                    <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                      {assignmentLabel(educator)}
                    </td>
                    <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={openLabel(educator)}
                        onClick={() => setSelectedId(educator.userId)}
                      >
                        Manage
                        <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
            {visible.map((educator) => (
              <li
                key={educator.userId}
                className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
              >
                <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                  {nameLabel(educator)}
                </p>

                <dl className="flex flex-col gap-[var(--hsh-space-3)]">
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                      Account
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {educator.accountLinked ? "Linked" : "No linked account"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                      Assigned programs
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {assignmentLabel(educator)}
                    </dd>
                  </div>
                </dl>

                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  aria-label={openLabel(educator)}
                  onClick={() => setSelectedId(educator.userId)}
                >
                  Manage
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <EducatorDrawer
        educator={selected}
        programs={programs}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

export { EducatorList }
export type { AssignableProgram }
