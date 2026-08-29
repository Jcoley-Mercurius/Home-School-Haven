/**
 * Published calendar — Foundation Release staging module.
 *
 * Every entry here comes from the "Calendar inventory" table in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md`, plus the one program range whose
 * published text carries an explicit year. Import rules 1, 3, and 7 apply
 * without exception:
 *
 *   - published detail text is preserved exactly as written;
 *   - an entry is plotted on the month grid ONLY when the source publishes a
 *     day and a year. Ranges such as Sewing's "September 15–October 5" publish
 *     no year, and choosing one would invent a fact, so they are not plotted;
 *   - a chronology the source publishes oddly is preserved for review, never
 *     silently corrected (QA-002).
 *
 * There is no Supabase calendar entity in the Foundation Release. When calendar
 * administration is approved, the `CalendarEntry` shape is what a row will
 * provide, so replacing this module changes no component contract — the same
 * arrangement `src/content/programs.ts` already uses for the catalog.
 */

const INVENTORY = "BETA-CONTENT-IMPORT-INVENTORY — Calendar inventory"
const PROGRAM_INVENTORY =
  "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory"

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
}

/**
 * A range the source publishes at month resolution only. These are never drawn
 * as day cells, because the source does not publish the days.
 */
export type CalendarTermRange = {
  id: string
  title: string
  /** Published range text, preserved as written — including QA-002. */
  publishedRange: string
  /** Set when the published text carries an open content-QA flag. */
  qaNote: string | null
  source: string
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
    program: {
      slug: "ready-set-prep-and-learn",
      name: "Ready Set Prep & Learn",
    },
    source: INVENTORY,
  },
  {
    /* The only program range whose published text states a year. The rest
       ("September 15–October 5", "August 20–September 24", …) do not, and
       assigning them one would invent a fact. */
    id: "art-lab",
    title: "Art Lab",
    publishedDetail: "August 22–September 26, 2026.",
    start: "2026-08-22",
    end: "2026-09-26",
    program: { slug: "art-lab", name: "Art Lab" },
    source: PROGRAM_INVENTORY,
  },
  {
    id: "haven-days-begins",
    title: "Haven Days Enrichment begins",
    publishedDetail: "September 1, 2026.",
    start: "2026-09-01",
    end: "2026-09-01",
    program: { slug: "haven-days-enrichment", name: "Haven Days Enrichment" },
    source: INVENTORY,
  },
]

export const calendarTermRanges: CalendarTermRange[] = [
  {
    id: "ready-set-prep-range",
    title: "Ready Set Prep operating range",
    /* QA-002: preserved verbatim. Writing 2027 here would be a silent
       correction the owner has not authorized. */
    publishedRange: "August 2026–May 2026",
    qaNote:
      "Published as written. The end of this range is under review with Home School Haven.",
    source: INVENTORY,
  },
  {
    id: "haven-days-range",
    title: "Haven Days Enrichment range",
    publishedRange: "September 2026–June 2027",
    qaNote: null,
    source: INVENTORY,
  },
]

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
export function entriesOnDay(iso: string): CalendarEntry[] {
  const time = toUtc(iso)
  return calendarEntries.filter(
    (entry) => toUtc(entry.start) <= time && time <= toUtc(entry.end),
  )
}

/** Entries touching any day of a month, in published order. */
export function entriesInMonth({ year, month }: MonthKey): CalendarEntry[] {
  const first = Date.UTC(year, month, 1)
  const last = Date.UTC(year, month + 1, 0)
  return calendarEntries.filter(
    (entry) => toUtc(entry.start) <= last && toUtc(entry.end) >= first,
  )
}

/** True when the entry spans more than the single day it starts on. */
export function isRange(entry: CalendarEntry): boolean {
  return entry.start !== entry.end
}
