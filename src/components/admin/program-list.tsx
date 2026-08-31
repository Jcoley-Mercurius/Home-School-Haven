import Link from "next/link"
import { BookOpen, ChevronRight, ExternalLink } from "lucide-react"

import { PublicationBadge } from "@/components/admin/publication-state"
import { AVAILABILITY } from "@/components/program/availability-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import type { AdminProgram } from "@/lib/admin/programs"

/**
 * The program operations list (MDS-REF-009 "Programs" table;
 * `components.table` variant `standard`; `responsive.rules.grid` "Operational
 * tables transform to labeled record cards when column integrity cannot be
 * preserved").
 *
 * TWO RENDERINGS, ONE AT A TIME
 *
 * Five columns of operational meaning do not survive 375 px, and a horizontally
 * scrolling table hides columns behind a gesture. Below `sm` the same rows
 * render as record cards where every field carries its own visible label, so no
 * column meaning is lost — it is re-laid out. Only one rendering is in the
 * accessibility tree at a time, so a screen-reader user is not offered every
 * program twice.
 *
 * Both are in the DOM, which is what broke three test locators in the previous
 * slice (DEFECT-AO3). Every locator over this component must be scoped to one
 * rendering or the other.
 *
 * WHAT THE COLUMNS DO NOT CLAIM
 *
 * "Registration path" reports whether a program-specific external checkout URL
 * is published. It is not a payment state and not an enrollment state
 * (MPS-REQ-013). "Educator" reports that an assignment row exists, not that
 * anyone has taught anything. No capacity, price, or seat figure appears
 * anywhere, because none is verified (GAP-ADMIN-004).
 */

function RegistrationPath({ program }: { program: AdminProgram }) {
  return program.checkoutUrl ? (
    <span className="hsh-body-sm inline-flex items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
      <ExternalLink
        aria-hidden="true"
        className="size-4 shrink-0"
        strokeWidth={1.75}
      />
      External checkout
    </span>
  ) : (
    <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
      No checkout link published
    </span>
  )
}

function EducatorCell({ program }: { program: AdminProgram }) {
  return (
    <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
      {program.educatorAssigned ? "Assigned" : "Not assigned"}
    </span>
  )
}

function AvailabilityCell({ program }: { program: AdminProgram }) {
  const { tone, label } = AVAILABILITY[program.availability]
  return <Badge tone={tone}>{label}</Badge>
}

/** Desktop and tablet: a real table with real header associations. */
function ProgramTable({ programs }: { programs: AdminProgram[] }) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Programs, with publication status, availability, educator assignment,
          and registration path. Select a program to open its detail.
        </caption>
        <thead>
          <tr className="border-b border-[var(--hsh-border-default)]">
            {[
              "Program",
              "Publication",
              "Availability",
              "Educator",
              "Registration path",
              "Action",
            ].map((heading, index) => (
              <th
                key={heading}
                scope="col"
                className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
              >
                {/* The action column's header is present for the table's
                    structure but says nothing useful aloud, so it is hidden
                    visually rather than left blank in the markup. */}
                <span className={index === 5 ? "sr-only" : undefined}>
                  {heading}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr
              key={program.id}
              className="border-b border-[var(--hsh-border-default)] last:border-b-0"
            >
              <th
                scope="row"
                className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-normal"
              >
                <span className="flex items-center gap-[var(--hsh-space-3)]">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-500)]"
                  >
                    <BookOpen className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-col">
                    <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
                      {program.name}
                    </span>
                    <span className="hsh-body-sm text-[var(--hsh-text-muted)]">
                      /{program.slug}
                    </span>
                  </span>
                </span>
              </th>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <PublicationBadge state={program.publicationState} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <AvailabilityCell program={program} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <EducatorCell program={program} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                <RegistrationPath program={program} />
              </td>
              <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-right">
                {/* The program name is in the accessible name, so a list of
                    controls read out of the table's row context still says
                    which program each one opens. `aria-label`, not an sr-only
                    span: a hidden span would repeat the name in the table's
                    text and make every scoped text locator ambiguous
                    (DEFECT-PE4). */}
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Review ${program.name}`}
                  render={<Link href={`/admin/programs/${program.id}`} />}
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
  )
}

/** Mobile: the same fields as labeled record cards. */
function ProgramCards({ programs }: { programs: AdminProgram[] }) {
  return (
    <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
      {programs.map((program) => (
        <li
          key={program.id}
          className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
        >
          <div className="flex flex-col gap-[var(--hsh-space-1)]">
            <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {program.name}
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
              /{program.slug}
            </p>
          </div>

          <dl className="flex flex-col gap-[var(--hsh-space-3)]">
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Publication
              </dt>
              <dd className="m-0">
                <PublicationBadge state={program.publicationState} />
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Availability
              </dt>
              <dd className="m-0">
                <AvailabilityCell program={program} />
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Educator
              </dt>
              <dd className="m-0">
                <EducatorCell program={program} />
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Registration path
              </dt>
              <dd className="m-0">
                <RegistrationPath program={program} />
              </dd>
            </div>
          </dl>

          <Button
            variant="secondary"
            size="md"
            className="w-full"
            aria-label={`Review ${program.name}`}
            render={<Link href={`/admin/programs/${program.id}`} />}
          >
            Review
            <ChevronRight aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </li>
      ))}
    </ul>
  )
}

/**
 * The program list in both renderings.
 * @param programs - The authorized, already-filtered programs.
 * @returns The list.
 */
function ProgramList({ programs }: { programs: AdminProgram[] }) {
  return (
    <>
      <ProgramTable programs={programs} />
      <ProgramCards programs={programs} />
    </>
  )
}

export { ProgramList }
