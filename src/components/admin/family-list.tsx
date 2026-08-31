"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { DirectorySearch } from "@/components/admin/directory-search"
import { FamilyDrawer } from "@/components/admin/family-drawer"
import { EmptyState } from "@/components/family/section-states"
import { Button } from "@/components/ui/button"
import { matchesSearch } from "@/lib/admin/filters"

import type { AdminFamily } from "@/lib/admin/families"

/**
 * The family directory (MDS-REF-009 admin operations; `components.table`
 * variant `standard`; `responsive.rules.grid` "Operational tables transform to
 * labeled record cards when column integrity cannot be preserved").
 *
 * READ-ONLY BY CONSTRUCTION
 *
 * Every control on this surface either opens a drawer or clears a search box.
 * Family accounts and student profiles belong to the parent (ACT-001), and no
 * approved requirement authorizes an administrator to change one — see the note
 * in `family-drawer.tsx`. There is no write path behind this component to
 * misuse: `src/lib/admin/families.ts` exports a read and nothing else.
 *
 * WHY THE WHOLE LIST IS A CLIENT COMPONENT
 *
 * Two reasons, both the same as the enrollment list. The detail drawer is
 * modal, so it needs focus trapping, Escape, and focus return, which live in
 * the browser. And the search filters in memory rather than through the URL —
 * `directory-search.tsx` explains why a family name must not reach a query
 * string — which requires component state.
 *
 * Every row already carries what its drawer shows, so opening one costs no
 * second authorized read and no request that would carry a family identifier.
 * The viewer is authorized to see all of these records already, so holding them
 * in the page discloses nothing the list did not.
 *
 * WHAT IS SHOWN ABOUT PEOPLE
 *
 * A family name, a guardian name, a count of children, and a count of
 * enrollments. `src/lib/admin/families.ts` reads no contact detail at any
 * depth, so none can appear here.
 *
 * TWO RENDERINGS, ONE ACCESSIBILITY TREE
 *
 * Table from `sm` up, labeled record cards below it. Both are in the DOM, so
 * every test locator over this component must be scoped to one of them
 * (DEFECT-AO3).
 */
function FamilyList({ families }: { families: AdminFamily[] }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /* Guardian names are searchable as well as the family name: an administrator
     taking a phone call knows the parent's name, not necessarily what the
     household record is called. Children are deliberately NOT searchable — a
     child's name is the one thing that should not be typed into a box to find
     an adult's record. */
  const visible = useMemo(
    () =>
      families.filter(
        (family) =>
          matchesSearch(family.name, query) ||
          family.guardians.some((guardian) =>
            matchesSearch(guardian.displayName, query),
          ),
      ),
    [families, query],
  )

  const selected = families.find((family) => family.id === selectedId) ?? null

  const primaryGuardian = (family: AdminFamily) =>
    family.guardians.find(
      (guardian) => guardian.memberRole === "primary_guardian",
    ) ?? family.guardians[0]

  const guardianLabel = (family: AdminFamily) =>
    primaryGuardian(family)?.displayName || "No guardian linked"

  const confirmedCount = (family: AdminFamily) =>
    family.enrollments.filter((enrollment) => enrollment.state === "confirmed")
      .length

  /* The control's accessible name says whose record it opens, so a list of
     controls read out of the row's context is still unambiguous. Applied as
     `aria-label` rather than a visually-hidden span, which would repeat the
     family name in the table's text and make scoped locators ambiguous
     (DEFECT-PE4). */
  const openLabel = (family: AdminFamily) => `View the ${family.name} account`

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      <DirectorySearch
        label="Search families"
        value={query}
        onValueChange={setQuery}
        resultCount={visible.length}
        totalCount={families.length}
        noun="families"
      />

      {visible.length === 0 ? (
        <EmptyState title="No families match that search">
          <p>
            Nothing in the directory matches &ldquo;{query}&rdquo;. Clear the
            search to see all {families.length} families.
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Families, with the primary guardian, how many students are on
                the account, and how many enrollments are confirmed. Select a
                family to view its detail.
              </caption>
              <thead>
                <tr className="border-b border-[var(--hsh-border-default)]">
                  {[
                    "Family",
                    "Primary guardian",
                    "Students",
                    "Confirmed",
                    "Action",
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
                    >
                      <span className={index === 4 ? "sr-only" : undefined}>
                        {heading}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((family) => (
                  <tr
                    key={family.id}
                    className="border-b border-[var(--hsh-border-default)] last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                    >
                      {family.name}
                    </th>
                    <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                      {guardianLabel(family)}
                    </td>
                    <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                      {family.students.length}
                    </td>
                    <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                      {confirmedCount(family)} of {family.enrollments.length}
                    </td>
                    <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={openLabel(family)}
                        onClick={() => setSelectedId(family.id)}
                      >
                        View
                        <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
            {visible.map((family) => (
              <li
                key={family.id}
                className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
              >
                <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                  {family.name}
                </p>

                <dl className="flex flex-col gap-[var(--hsh-space-3)]">
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                      Primary guardian
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {guardianLabel(family)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                      Students
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {family.students.length}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-[var(--hsh-space-1)]">
                    <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                      Confirmed enrollments
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {confirmedCount(family)} of {family.enrollments.length}
                    </dd>
                  </div>
                </dl>

                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  aria-label={openLabel(family)}
                  onClick={() => setSelectedId(family.id)}
                >
                  View
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <FamilyDrawer family={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}

export { FamilyList }
