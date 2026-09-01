"use client"

import { useState, useSyncExternalStore } from "react"
import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react"

import { EventList } from "@/components/calendar/event-list"
import { MonthGrid } from "@/components/calendar/month-grid"
import { Button } from "@/components/ui/button"
import {
  addMonths,
  entriesInMonth,
  monthKeyOf,
  monthLabel,
  type CalendarEntry,
  type MonthKey,
} from "@/content/calendar"
import { cn } from "@/lib/utils"

/**
 * Public calendar: month navigation, a Month/List view switch, and the notes
 * rail that keeps the published-detail promise visible beside the grid.
 *
 * **Why the visitor's date arrives through `useSyncExternalStore`.** This page
 * is statically prerendered, so the server's "now" is the build time, not the
 * visitor's — marking a build-time date as "today" would be wrong for every
 * visitor after the deploy. The clock is exactly the external system that hook
 * exists for: the server snapshot is `null`, so the prerendered HTML and the
 * hydration render agree, and the real date arrives on the render straight
 * after. Reading it in an effect instead would mean a cascading `setState`.
 */

type ViewMode = "month" | "list"

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** The clock never notifies us, so nothing to subscribe to — but the hook needs
    a stable unsubscribe. Defined once, outside the component. */
const subscribeToClock = () => () => {}

/**
 * The `lg` breakpoint, read once rather than rendered twice.
 *
 * Rendering both the grid and the list and hiding one with `lg:hidden` puts
 * every entry in the DOM twice — a screen-reader user hears the month read out
 * two times, and every `getByText` matches two nodes. So the breakpoint is read
 * as state and only one view is rendered.
 *
 * The server snapshot is `true`: the prerendered HTML is the desktop grid, the
 * layout this page is designed around, and a narrow viewport swaps to the list
 * on the render immediately after hydration.
 */
const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribeToBreakpoint(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function CalendarView({
  initialMonth,
  entries,
}: {
  initialMonth: MonthKey
  /**
   * Every entry the calendar may draw — the published inventory merged with the
   * dated sessions of published programs, assembled on the server so this
   * client component reads one list and never queries anything itself.
   */
  entries: readonly CalendarEntry[]
}) {
  const today = useSyncExternalStore(
    subscribeToClock,
    () => todayIso(),
    () => null,
  )

  /* `null` until the visitor navigates. The month shown is derived, so it
     follows the visitor's clock on first paint without an effect, and stops
     following it the moment they choose a month themselves. */
  const [chosenMonth, setChosenMonth] = useState<MonthKey | null>(null)
  const [view, setView] = useState<ViewMode>("month")

  const isDesktop = useSyncExternalStore(
    subscribeToBreakpoint,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )

  const currentMonth = today
    ? monthKeyOf(new Date(`${today}T00:00:00Z`))
    : initialMonth
  const month = chosenMonth ?? currentMonth
  const setMonth = setChosenMonth

  const label = monthLabel(month)
  const count = entriesInMonth(month, entries).length
  const summary =
    count === 0
      ? `${label}. Nothing published.`
      : `${label}. ${count} published ${count === 1 ? "entry" : "entries"}.`

  return (
    <section
      aria-labelledby="calendar-heading"
      className="flex flex-col gap-[var(--hsh-space-6)]"
    >
      <h2 id="calendar-heading" className="sr-only">
        Published calendar
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-4)]">
        <div className="flex items-center gap-[var(--hsh-space-3)]">
          <Button
            variant="secondary"
            size="icon"
            aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setMonth(currentMonth)}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </div>

        <p
          aria-hidden="true"
          className="hsh-h3 font-[family-name:var(--hsh-font-display)] text-[var(--hsh-text-primary)]"
        >
          {label}
        </p>

        {/* One announcement carries the month change for both views, so the
            heading above can stay decorative rather than being re-read. */}
        <p aria-live="polite" className="sr-only">
          {summary}
        </p>

        <ToggleGroup
          value={[view]}
          onValueChange={(next) => {
            if (next[0]) setView(next[0] as ViewMode)
          }}
          aria-label="Calendar view"
          className="hidden items-center gap-[var(--hsh-space-1)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-1)] lg:flex"
        >
          {(
            [
              { value: "month", label: "Month", Icon: CalendarDays },
              { value: "list", label: "List", Icon: List },
            ] as const
          ).map(({ value, label: itemLabel, Icon }) => (
            <Toggle
              key={value}
              value={value}
              className={cn(
                "inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)]",
                "rounded-[var(--hsh-radius-small)] px-[var(--hsh-space-4)]",
                "font-[family-name:var(--hsh-font-ui)] text-[length:var(--hsh-size-body)] font-semibold",
                "outline-none focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
                "focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)]",
                "text-[var(--hsh-text-secondary)] hover:bg-[var(--hsh-forest-50)]",
                "data-[pressed]:bg-[var(--hsh-forest-600)] data-[pressed]:text-[var(--hsh-text-inverse)]",
              )}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              {itemLabel}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-[var(--hsh-space-6)] lg:grid-cols-[minmax(0,1fr)_180px]">
        {/* Below `lg` the grid becomes the list — the approved table-to-card
            transformation, not a different data set (DESIGN-SYSTEM.md §8). */}
        <div>
          {isDesktop && view === "month" ? (
            <MonthGrid month={month} today={today} entries={entries} />
          ) : (
            <EventList month={month} allEntries={entries} />
          )}
        </div>

        <aside
          aria-label="About these details"
          className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-4)] text-center"
        >
          <p className="hsh-label text-[var(--hsh-text-primary)]">Notes</p>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Not all details are published here. Contact Home School Haven for
            details on programs and events.
          </p>
        </aside>
      </div>
    </section>
  )
}

export { CalendarView }
