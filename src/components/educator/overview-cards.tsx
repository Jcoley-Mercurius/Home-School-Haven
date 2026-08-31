import Link from "next/link"
import { BookOpen, CalendarDays, Users } from "lucide-react"

import { summarizeWorkspace } from "@/lib/educator/workspace-state"

import type { AssignedProgram } from "@/lib/educator/workspace-state"

/**
 * The educator Overview's summary tiles (MPS-REQ-018, MPS-REQ-021).
 *
 * COUNTS, NEVER NAMES
 *
 * The Overview is the page most likely to be open on a shared screen or caught
 * in a screenshot, so it says how many and not who. `summarizeWorkspace()`
 * takes programs and returns three integers; no child's name reaches this
 * component at all. That is the same rule `admin/repository.ts` follows for the
 * operations overview, and it is the cheapest possible way to keep a name out
 * of a screenshot, a log, and an analytics payload.
 *
 * Each tile is a link to the destination that shows the detail, so the count is
 * a way in rather than a decoration.
 */
function OverviewCards({ programs }: { programs: AssignedProgram[] }) {
  const summary = summarizeWorkspace(programs)

  const tiles = [
    {
      label: "Assigned programs",
      value: summary.assignedPrograms,
      href: "/educator/programs",
      icon: BookOpen,
      note:
        summary.publishedPrograms === summary.assignedPrograms
          ? "All published"
          : `${summary.publishedPrograms} published`,
    },
    {
      label: "With a published schedule",
      value: summary.programsWithSchedule,
      href: "/educator/schedule",
      icon: CalendarDays,
      note: "Published details only",
    },
    {
      label: "Rosters",
      value: summary.assignedPrograms,
      href: "/educator/rosters",
      icon: Users,
      note: "Confirmed enrollments",
    },
  ]

  return (
    <ul className="grid list-none grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] p-0 sm:grid-cols-3 sm:gap-[var(--hsh-grid-gap-tablet)] lg:gap-[var(--hsh-grid-gap-desktop)]">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="flex min-h-[var(--hsh-touch-target)] flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] transition-colors hover:border-[var(--hsh-border-strong)] hover:bg-[var(--hsh-surface-elevated)]"
            >
              <Icon
                aria-hidden="true"
                className="size-5 text-[var(--hsh-forest-600)]"
                strokeWidth={1.75}
              />
              <span className="hsh-display-sm text-[var(--hsh-text-primary)]">
                {tile.value}
              </span>
              <span className="hsh-label text-[var(--hsh-text-secondary)]">
                {tile.label}
              </span>
              <span className="hsh-caption text-[var(--hsh-text-muted)]">
                {tile.note}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export { OverviewCards }
