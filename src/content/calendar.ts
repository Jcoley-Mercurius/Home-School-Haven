/**
 * Published calendar — Foundation Release staging module.
 *
 * Every dated entry here comes from the "Calendar inventory" table in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md`. Import rules 1, 3, and 7 apply
 * without exception:
 *
 *   - published detail text is preserved exactly as written;
 *   - an entry is plotted on the month grid ONLY when the source publishes a
 *     day and a year. A weekly schedule ("Wednesday, 4:45–6:15 PM") or a month
 *     range ("October–June") publishes neither, and choosing one would invent a
 *     fact, so those are listed beside the grid instead;
 *   - a chronology the source publishes oddly is never silently corrected.
 *
 * WHAT CHANGED WITH THE OWNER EVIDENCE OF 2026-09-14
 *
 * The Art Lab range left with the offering, which is archived. The month-level
 * "term ranges" that used to live here as a second copy of program facts are
 * gone too: `scheduleAndSeasons` derives them from the published programs
 * themselves, so the calendar and the program pages can never disagree
 * (MPS-REQ-020). That also retires QA-002's "August 2026–May 2026": the owner
 * evidence gives Ready Set as "August–May", with no year.
 *
 * WHAT CHANGED IN HSH-SLICE-ADM-04
 *
 * `public.program_sessions` now exists, and a session carries a real date and a
 * real year — which is precisely the condition rule 2 above requires before
 * anything may be plotted. So the calendar now draws two kinds of entry: the
 * published inventory below, unchanged, and the dated sessions an administrator
 * authored for a PUBLISHED program.
 *
 * Neither is derived from the other, and the merge happens in the page rather
 * than in this module: this file stays the record of what the approved source
 * publishes, and `entriesOnDay`/`entriesInMonth` take the entries to search as
 * a parameter so a caller can pass either set or both.
 */

import type { Program } from "./programs"
import { OFFERING_ORDER } from "../lib/programs/offering-groups.ts"

const INVENTORY = "BETA-CONTENT-IMPORT-INVENTORY — Calendar inventory"

/**
 * A dated entry. `start` and `end` are inclusive ISO `YYYY-MM-DD` dates and are
 * only ever set from a published day + year. `end` equals `start` for a
 * single-day entry.
 */
export type CalendarEntry = {
  id: string
  title: string
  /** Published detail, preserved as written in the source. */
  publishedDetail: string
  start: string
  end: string
  /** The program this entry belongs to, when the source proves the link. */
  program: { slug: string; name: string } | null
  source: string
  /**
   * The administrative state of the session behind this entry, for entries
   * that come from `public.program_sessions` (HSH-SLICE-ADM-04).
   *
   * `undefined` for every entry from the published inventory, which has no
   * such state: the inventory records what Home School Haven publishes, not a
   * decision anyone made about a meeting. A cancelled or moved session is
   * named as such in text on the grid and in the list, never by colour alone.
   */
  state?: "scheduled" | "rescheduled" | "canceled" | "completed"
}

export const calendarEntries: CalendarEntry[] = [
  {
    id: "summer-break",
    title: "Summer Break",
    publishedDetail: "June 26, 2026–September 7, 2026; Enrichment only.",
    start: "2026-06-26",
    end: "2026-09-07",
    program: null,
    source: INVENTORY,
  },
  {
    id: "fall-preview-day",
    title: "Fall Preview Day / Open House",
    publishedDetail: "August 3, 2026; Enrichment and Ready Set Prep.",
    start: "2026-08-03",
    end: "2026-08-03",
    program: null,
    source: INVENTORY,
  },
  {
    id: "ready-set-prep-begins",
    title: "Ready Set Prep begins",
    publishedDetail: "August 4, 2026.",
    start: "2026-08-04",
    end: "2026-08-04",
    /* The published title names Ready Set Prep, which is now its own
       offering. */
    program: { slug: "ready-set-prep", name: "Ready Set Prep" },
    source: INVENTORY,
  },
  {
    id: "haven-days-begins",
    /* Title kept as published; the offering is now named Haven Days. */
    title: "Haven Days Enrichment begins",
    publishedDetail: "September 1, 2026.",
    start: "2026-09-01",
    end: "2026-09-01",
    program: { slug: "haven-days-enrichment", name: "Haven Days" },
    source: INVENTORY,
  },
]

/**
 * A published offering that recurs by weekday or runs by month, as the calendar
 * lists it beside the grid.
 */
export type ScheduleAndSeason = {
  slug: string
  name: string
  /** Published weekday and time text, verbatim, or `null`. */
  schedule: string | null
  /** Published month range, verbatim, or `null`. Never carries an invented year. */
  season: string | null
}

/**
 * Every published program with a weekly schedule or a month range, ordered by
 * offering group and then by the order the caller passed.
 *
 * Derived rather than stored, so the calendar shows exactly the text the
 * program pages show. Nothing here is plotted on a day: none of it publishes a
 * day and a year.
 *
 * @param programs - Published programs, in display order.
 * @returns One entry per program that publishes a schedule or a season.
 */
export function scheduleAndSeasons(
  programs: readonly Program[],
): ScheduleAndSeason[] {
  const rank = (program: Program) =>
    program.offeringType === null
      ? OFFERING_ORDER.length
      : OFFERING_ORDER.indexOf(program.offeringType)

  return programs
    .map((program, index) => ({ program, index }))
    .filter(
      ({ program }) => program.publishedSchedule || program.publishedDates,
    )
    .sort((a, b) => rank(a.program) - rank(b.program) || a.index - b.index)
    .map(({ program }) => ({
      slug: program.slug,
      name: program.name,
      schedule: program.publishedSchedule,
      season: program.publishedDates,
    }))
}

/** A month, identified the way the grid navigates it. `month` is 0-indexed. */
export type MonthKey = { year: number; month: number }

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export const weekdayNames = [
  { short: "Sun", long: "Sunday" },
  { short: "Mon", long: "Monday" },
  { short: "Tue", long: "Tuesday" },
  { short: "Wed", long: "Wednesday" },
  { short: "Thu", long: "Thursday" },
  { short: "Fri", long: "Friday" },
  { short: "Sat", long: "Saturday" },
] as const

/**
 * Every date helper here works in UTC on `YYYY-MM-DD` strings.
 *
 * Local-time arithmetic would shift a published date across a day boundary for
 * viewers west of UTC — an August 3 open house rendering on August 2 is an
 * invented fact, not a rounding error.
 */
function toUtc(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number)
  return Date.UTC(year, month - 1, day)
}

function isoFrom(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

export function monthLabel({ year, month }: MonthKey): string {
  return `${MONTH_NAMES[month]} ${year}`
}

/** Long, spoken form of a date: "Monday, August 3, 2026". */
export function longDateLabel(iso: string): string {
  const date = new Date(toUtc(iso))
  const weekday = weekdayNames[date.getUTCDay()].long
  return `${weekday}, ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const total = year * 12 + month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

export function monthKeyOf(date: Date): MonthKey {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

export type CalendarDay = {
  iso: string
  dayOfMonth: number
  /** False for the leading and trailing days borrowed from adjacent months. */
  inMonth: boolean
}

/**
 * The Sunday-aligned weeks covering a month. Five or six rows, never a fixed
 * six, so a short month does not render an empty trailing week.
 */
export function monthWeeks({ year, month }: MonthKey): CalendarDay[][] {
  const firstOfMonth = Date.UTC(year, month, 1)
  const lastOfMonth = Date.UTC(year, month + 1, 0)
  const gridStart = firstOfMonth - new Date(firstOfMonth).getUTCDay() * DAY_MS
  const gridEnd = lastOfMonth + (6 - new Date(lastOfMonth).getUTCDay()) * DAY_MS

  const weeks: CalendarDay[][] = []
  for (let time = gridStart; time <= gridEnd; time += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const day = new Date(time + offset * DAY_MS)
        return {
          iso: isoFrom(day.getTime()),
          dayOfMonth: day.getUTCDate(),
          inMonth: day.getUTCMonth() === month,
        }
      }),
    )
  }
  return weeks
}

/** Entries covering a single day, in published order. */
export function entriesOnDay(
  iso: string,
  entries: readonly CalendarEntry[] = calendarEntries,
): CalendarEntry[] {
  const time = toUtc(iso)
  return entries.filter(
    (entry) => toUtc(entry.start) <= time && time <= toUtc(entry.end),
  )
}

/** Entries touching any day of a month, in published order. */
export function entriesInMonth(
  { year, month }: MonthKey,
  entries: readonly CalendarEntry[] = calendarEntries,
): CalendarEntry[] {
  const first = Date.UTC(year, month, 1)
  const last = Date.UTC(year, month + 1, 0)
  return entries.filter(
    (entry) => toUtc(entry.start) <= last && toUtc(entry.end) >= first,
  )
}

/** True when the entry spans more than the single day it starts on. */
export function isRange(entry: CalendarEntry): boolean {
  return entry.start !== entry.end
}
