import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { PublicationBadge } from "@/components/admin/publication-state"

import type { AssignedProgram } from "@/lib/educator/workspace-state"

/**
 * The educator's assigned programs (MPS-REQ-018, MPS-ACC-029).
 *
 * WHAT IS ON A ROW, AND WHAT DELIBERATELY IS NOT
 *
 * Name, publication state, summary, format, audience, location, and the
 * educator of record. No price, no availability, no capacity, no enrollment
 * count, no publish control, no archive control, no assignment control, no
 * family. MDS-REF-008's applicability note governs the educator workspace and
 * "limits educator context to assigned programs and excludes pricing,
 * availability, and direct publishing controls", so those fields are absent
 * from `AssignedProgram` itself — not styled away, not disabled, not fetched.
 *
 * A disabled control would have been the worse choice: it says the capability
 * exists and is being withheld from you, when in fact no educator write path to
 * `programs` exists at all.
 *
 * Publication state IS shown. An educator assigned to a draft needs to know
 * families cannot see it, and reading a state is not holding a control.
 */
function ProgramList({ programs }: { programs: AssignedProgram[] }) {
  return (
    <ul className="flex list-none flex-col gap-[var(--hsh-space-4)] p-0">
      {programs.map((program) => (
        <li key={program.id}>
          <Link
            href={`/educator/programs/${program.id}`}
            className="flex min-h-[var(--hsh-touch-target)] flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] transition-colors hover:border-[var(--hsh-border-strong)] hover:bg-[var(--hsh-surface-elevated)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
              <span className="hsh-h4 text-[var(--hsh-text-primary)]">
                {program.name}
              </span>
              <PublicationBadge state={program.publicationState} />
            </div>

            {program.summary ? (
              <span className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                {program.summary}
              </span>
            ) : null}

            <dl className="flex flex-wrap gap-x-[var(--hsh-space-6)] gap-y-[var(--hsh-space-2)]">
              {[
                { label: "Format", value: program.format },
                { label: "Ages", value: program.audience },
                { label: "Location", value: program.location },
                { label: "Educator", value: program.educator },
              ]
                /* A fact the source does not publish is left out rather than
                   rendered as an empty term (QA-005). A dangling label reads
                   as missing data; an absent one reads as an unpublished
                   fact, which is what it is. */
                .filter((fact) => fact.value)
                .map((fact) => (
                  <div
                    key={fact.label}
                    className="flex flex-col gap-[var(--hsh-space-1)]"
                  >
                    <dt className="hsh-caption text-[var(--hsh-text-muted)]">
                      {fact.label}
                    </dt>
                    <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
            </dl>

            <span className="hsh-body-sm inline-flex items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)]">
              Open program
              <ChevronRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export { ProgramList }
