import Link from "next/link"
import { CalendarDays, Leaf } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  entriesInMonth,
  isRange,
  longDateLabel,
  monthLabel,
  type CalendarEntry,
  type MonthKey,
} from "@/content/calendar"
import { guidanceHref, programHref } from "@/content/foundation-content"

/**
 * List view of the same published entries the month grid shows.
 *
 * This is also what the grid becomes below the `lg` breakpoint — the approved
 * table-to-card transformation (DESIGN-SYSTEM.md §8), not a second data set.
 *
 * Each entry shows its published detail exactly as the source publishes it. No
 * date is reformatted into a claim the source does not make.
 */
function EventList({
  month,
  allEntries,
}: {
  month: MonthKey
  /** Every entry the list may show: the published inventory plus any sessions. */
  allEntries: readonly CalendarEntry[]
}) {
  const entries = entriesInMonth(month, allEntries)

  if (entries.length === 0) {
    /* MPS-ACC-010: an empty result offers a path, never a dead end. */
    return (
      <div className="flex flex-col items-center gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] px-[var(--hsh-space-6)] py-[var(--hsh-space-12)] text-center">
        <Leaf
          aria-hidden="true"
          className="size-8 text-[var(--hsh-forest-500)]"
          strokeWidth={1.75}
        />
        <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
          Nothing is published for {monthLabel(month)}
        </h3>
        <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Details not published here are confirmed directly with Home School
          Haven. Tell us about your family and we will help you plan the term.
        </p>
        <Button
          variant="primary"
          size="md"
          render={<Link href={guidanceHref} />}
        >
          Request Guidance
        </Button>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-[var(--hsh-space-3)]">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
        >
          <CalendarDays
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-forest-500)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-1)]">
            <p className="hsh-h4 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]">
              {entry.title}
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {longDateLabel(entry.start)}
              {isRange(entry) ? ` – ${longDateLabel(entry.end)}` : null}
            </p>
            <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
              Published as: {entry.publishedDetail}
            </p>
            {/* A cancelled or moved session states it in its own sentence.
                MPS-ACC-031: a material change shows consistently on the public
                view as well as the authenticated ones. */}
            {entry.state === "canceled" ? (
              <p className="hsh-body-sm font-semibold text-[var(--hsh-coral-700)]">
                Cancelled. Contact Home School Haven about this session.
              </p>
            ) : entry.state === "rescheduled" ? (
              <p className="hsh-body-sm font-semibold text-[var(--hsh-gold-700)]">
                Rescheduled. The date and time shown here are the current ones.
              </p>
            ) : null}
            {entry.program ? (
              <Link
                href={programHref(entry.program.slug)}
                className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                View {entry.program.name}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export { EventList }
