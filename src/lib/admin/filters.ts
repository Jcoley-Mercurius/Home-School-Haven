/**
 * List filters, parsed from `searchParams`.
 *
 * Pure and dependency-free so it can be unit-tested directly, and because
 * parsing untrusted query values is exactly the kind of thing that should be
 * testable rather than trusted.
 *
 * EVERY VALUE HERE IS UNTRUSTED. A query string is whatever someone typed into
 * the address bar. Nothing below throws on a bad value: an unrecognised filter
 * falls back to "all", which shows the viewer a list they are already
 * authorized to see rather than an error page. RLS decides what is in that
 * list; these decide only how it is narrowed.
 *
 * WHY THERE IS NO FREE-TEXT SEARCH OVER ENROLLMENTS
 *
 * A search box puts what was typed into the URL, and the useful thing to type
 * about an enrollment is a child's name. That would place child data in a URL,
 * a browser history, a referrer header, and every screenshot of the address bar
 * — which AGENTS.md §11 forbids. Enrollments are therefore filtered by program
 * and by state, both of which are operational facts, and the program filter is
 * where the "search" need actually lands. Programs, whose names are public,
 * carry an ordinary text search.
 */

const PROGRAM_STATUS_VALUES = ["all", "draft", "published", "archived"] as const
type ProgramStatusFilter = (typeof PROGRAM_STATUS_VALUES)[number]

const ENROLLMENT_STATE_VALUES = [
  "all",
  "started",
  "approval_pending",
  "payment_pending",
  "waitlisted",
  "confirmed",
  "payment_failed",
  "canceled",
  "blocked",
] as const
type EnrollmentStateFilter = (typeof ENROLLMENT_STATE_VALUES)[number]

/** Long enough for any program name; short enough that nothing else fits. */
const SEARCH_MAX = 80

type RawParams = Record<string, string | string[] | undefined>

/**
 * The first value of a repeated parameter, or `""`.
 *
 * `?status=draft&status=published` arrives as an array. Taking the first is a
 * choice rather than an accident: it keeps a repeated parameter deterministic
 * instead of letting it depend on how the framework happened to collapse it.
 *
 * @param value - The raw `searchParams` entry.
 * @returns A single trimmed string.
 */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim()
  return (value ?? "").trim()
}

type ProgramFilters = {
  status: ProgramStatusFilter
  search: string
  /** True when any filter narrows the list — drives the no-results state. */
  active: boolean
}

/**
 * Parse the program list filters.
 * @param params - Raw `searchParams`.
 * @returns Validated filters, defaulting to an unnarrowed list.
 */
function parseProgramFilters(params: RawParams): ProgramFilters {
  const rawStatus = first(params.status)
  const status = (PROGRAM_STATUS_VALUES as readonly string[]).includes(
    rawStatus,
  )
    ? (rawStatus as ProgramStatusFilter)
    : "all"

  /* Clamped, not rejected: an over-long value is someone pasting, and
     truncating searches for what they probably meant. */
  const search = first(params.q).slice(0, SEARCH_MAX)

  return { status, search, active: status !== "all" || search !== "" }
}

type EnrollmentFilters = {
  state: EnrollmentStateFilter
  /** A program slug, or `""` for every program. Slugs are public facts. */
  program: string
  active: boolean
}

/**
 * Parse the enrollment list filters.
 * @param params - Raw `searchParams`.
 * @returns Validated filters, defaulting to an unnarrowed list.
 */
function parseEnrollmentFilters(params: RawParams): EnrollmentFilters {
  const rawState = first(params.state)
  const state = (ENROLLMENT_STATE_VALUES as readonly string[]).includes(
    rawState,
  )
    ? (rawState as EnrollmentStateFilter)
    : "all"

  /* Matched against the slugs actually read from the database by the caller, so
     an unknown value simply matches nothing rather than reaching a query. */
  const program = first(params.program).slice(0, SEARCH_MAX)

  return { state, program, active: state !== "all" || program !== "" }
}

/**
 * Case- and accent-insensitive substring match for the program search.
 *
 * Done in the application over an already-authorized list rather than as a
 * database `ilike`, because the list is small, and because a filter that never
 * becomes part of a query cannot become part of an injection.
 *
 * @param haystack - The text to search.
 * @param needle - The search term.
 * @returns True when the term is empty or found.
 */
function matchesSearch(haystack: string, needle: string): boolean {
  if (needle === "") return true
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase()
  return normalize(haystack).includes(normalize(needle))
}

export {
  ENROLLMENT_STATE_VALUES,
  PROGRAM_STATUS_VALUES,
  SEARCH_MAX,
  matchesSearch,
  parseEnrollmentFilters,
  parseProgramFilters,
}
export type {
  EnrollmentFilters,
  EnrollmentStateFilter,
  ProgramFilters,
  ProgramStatusFilter,
  RawParams,
}
