import {
  entriesOnDay,
  longDateLabel,
  monthLabel,
  monthWeeks,
  weekdayNames,
  type CalendarDay,
  type CalendarEntry,
  type MonthKey,
} from "@/content/calendar"
import { cn } from "@/lib/utils"

/**
 * Month grid for the public calendar.
 *
 * A real `<table>` with a caption and column headers, because a month is
 * tabular data: a screen-reader user needs the weekday of a cell, and a grid of
 * divs cannot supply it (DESIGN-SYSTEM.md §10).
 *
 * Meaning never rests on a dot or a colour. Every day that carries a published
 * entry names it in text, and today is marked with `aria-current="date"` plus a
 * visually hidden "Today" (DO-DONT.md "Trust states").
 */

type EntryLabel = { key: string; text: string; isStart: boolean }

/**
 * Which entries a cell names.
 *
 * A long range — Summer Break runs 74 days — is not repeated in every cell;
 * that is noise, not information, and it buries the days that actually mark
 * something. A range is named where it starts, where it ends, and once at the
 * opening of the month for a reader who arrives mid-range, marked "continues"
 * so a continuation is never mistaken for a start date.
 */
function labelsForDay(day: CalendarDay, isMonthOpening: boolean): EntryLabel[] {
  if (!day.inMonth) return []

  return entriesOnDay(day.iso).flatMap((entry: CalendarEntry) => {
    const isStart = entry.start === day.iso
    const isEnd = entry.end === day.iso
    if (!isStart && !isEnd && !isMonthOpening) return []

    const text = isStart
      ? entry.title
      : isEnd
        ? `${entry.title} ends`
        : `${entry.title} continues`

    return [{ key: `${entry.id}-${day.iso}`, text, isStart }]
  })
}

function MonthGrid({
  month,
  today,
}: {
  month: MonthKey
  today: string | null
}) {
  const weeks = monthWeeks(month)
  const label = monthLabel(month)

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">
        {label}. Published classes, workshops, and community events.
      </caption>
      <thead>
        <tr>
          {weekdayNames.map((weekday) => (
            <th
              key={weekday.short}
              scope="col"
              className="hsh-label border-b border-[var(--hsh-border-default)] px-[var(--hsh-space-2)] pb-[var(--hsh-space-3)] text-center font-semibold text-[var(--hsh-text-muted)]"
            >
              <abbr title={weekday.long} className="no-underline">
                {weekday.short}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0].iso}>
            {week.map((day) => {
              const labels = labelsForDay(day, day.dayOfMonth === 1)
              const isToday = day.inMonth && day.iso === today

              return (
                <td
                  key={day.iso}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "h-[104px] border border-[var(--hsh-border-default)] align-top",
                    "p-[var(--hsh-space-2)]",
                    day.inMonth
                      ? "bg-[var(--hsh-surface-card)]"
                      : "bg-[var(--hsh-surface-elevated)]",
                  )}
                >
                  <span
                    className={cn(
                      "hsh-body-sm flex size-8 items-center justify-center rounded-[var(--hsh-radius-pill)]",
                      day.inMonth
                        ? "text-[var(--hsh-text-primary)]"
                        : /* Muted, not Neutral 400: #9aa29e on the elevated
                           surface is 2.48:1 and fails AA (§10). */
                          "text-[var(--hsh-text-muted)]",
                      isToday &&
                        "bg-[var(--hsh-forest-100)] font-semibold text-[var(--hsh-forest-700)]",
                    )}
                  >
                    {day.dayOfMonth}
                    {isToday ? <span className="sr-only"> — Today</span> : null}
                  </span>

                  {labels.length > 0 ? (
                    <ul className="mt-[var(--hsh-space-1)] flex flex-col gap-[var(--hsh-space-1)]">
                      {labels.map((entry) => (
                        <li
                          key={entry.key}
                          className={cn(
                            "hsh-caption rounded-[var(--hsh-radius-small)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]",
                            entry.isStart
                              ? "bg-[var(--hsh-forest-100)] font-semibold text-[var(--hsh-forest-700)]"
                              : "bg-[var(--hsh-surface-quiet)] text-[var(--hsh-text-secondary)]",
                          )}
                        >
                          <span className="sr-only">
                            {longDateLabel(day.iso)}:{" "}
                          </span>
                          {entry.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export { MonthGrid }
