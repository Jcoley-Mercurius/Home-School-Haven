/**
 * The educator workspace's judgements, kept free of the database so they can be
 * exercised directly (MPS-REQ-018, MPS-REQ-020, MPS-ACC-028, MPS-ACC-029).
 *
 * Same separation as `family/dashboard-state.ts` and `admin/roster-state.ts`:
 * the reads live in sibling modules, and what is worth arguing about lives
 * here, where a test can reach it without a Supabase project.
 *
 * WHAT AN EDUCATOR IS SHOWN OF A PROGRAM, AND WHAT IS LEFT OUT
 *
 * MDS-REF-008's written applicability note governs the educator workspace and
 * "limits educator context to assigned programs and excludes pricing,
 * availability, and direct publishing controls". So `AssignedProgram` carries
 * no `publishedPrice`, no `checkoutUrl`, and no `availability` — not hidden in
 * the markup, but absent from the type, so no surface can render what no read
 * returns. `publicationState` IS carried: an educator assigned to a draft
 * program needs to know families cannot see it. Showing a state is not offering
 * a control, and no educator route has a publish action to reach.
 */

/* Type-only, deliberately. This module must stay loadable by `node --test`
   without a bundler, and a value import of a path alias is not resolvable
   there. The allowlist is used in a type position only; the runtime check
   that the select literal matches it lives in the test, which imports both
   by relative path. */
import type { EDUCATOR_ROSTER_COLUMNS } from "@/lib/admin/roster-state"

import type { EnrollmentState } from "@/lib/admin/transitions"
import type { Enums } from "@/lib/supabase/types"

type PublicationState = Enums<"program_publication_state">

/**
 * One program the authenticated educator is assigned to.
 *
 * Every field is published program truth read from `public.programs` — the same
 * row the public catalog and the administrator operations list read, so
 * MPS-REQ-020's consistency is a property of there being one record rather than
 * of three surfaces agreeing to copy it faithfully.
 */
type AssignedProgram = {
  id: string
  slug: string
  name: string
  summary: string | null
  audience: string | null
  format: string | null
  location: string | null
  educator: string | null
  publishedDates: string | null
  publishedSchedule: string | null
  publishedDuration: string | null
  publishedSessionLength: string | null
  enrollmentWindow: string | null
  publicationState: PublicationState
}

/**
 * One confirmed roster line as an educator is shown it.
 *
 * A preferred name and nothing else — no family name, no state, no date, no
 * enrollment id. Every row that reaches this type came out of
 * `public.educator_roster_students`, whose WHERE clause is
 * `state = 'confirmed'`, so "confirmed" is a property of the row's existence
 * rather than a field a renderer has to check.
 */
type EducatorRosterEntry = {
  /** Preferred name. `""` when the view returned no value for it. */
  studentName: string
}

/**
 * What an educator is told about the records on their program that are NOT
 * confirmed enrollments.
 *
 * COUNTS, NOT NAMES, AND THAT IS THE DATABASE'S DECISION
 *
 * `educator_roster_students` exposes confirmed children only, so an
 * unconfirmed child's name is not merely omitted here — it is unreadable to an
 * educator at all. That is MPS-RUL-003 in the schema: a family whose place is
 * unsettled has an arrangement with Home School Haven that is not an
 * educator's business.
 *
 * The count is still shown, because an educator planning for a session needs
 * to know that two more children may or may not join it. A number carries that
 * without disclosing whose it is.
 */
type UnconfirmedSummary = {
  total: number
  /** One entry per state actually present, in first-seen order. */
  byState: { state: EnrollmentState; count: number }[]
}

/**
 * Count the records on a program that are not confirmed enrollments.
 *
 * The test is an explicit equality against `confirmed`, never an exclusion of
 * a list of states — the same rule `admin/roster-state.ts` states at length. An
 * enum value added later would silently join the roster under an exclusion
 * rule, and presenting an unconfirmed child as enrolled is the one thing this
 * surface must never do.
 *
 * @param states - The state of every enrollment on the program.
 * @returns The total and the per-state breakdown.
 */
function summarizeUnconfirmed(states: EnrollmentState[]): UnconfirmedSummary {
  const unconfirmed = states.filter((state) => state !== "confirmed")

  const byState: UnconfirmedSummary["byState"] = []
  for (const state of unconfirmed) {
    const existing = byState.find((entry) => entry.state === state)
    if (existing) existing.count += 1
    else byState.push({ state, count: 1 })
  }

  return { total: unconfirmed.length, byState }
}

/** One announcement on an assigned program, with its real content state. */
type EducatorAnnouncement = {
  id: string
  title: string
  body: string
  published: boolean
  publishedAt: string | null
  programId: string
  programName: string | null
}

/** One learning resource on an assigned program, with its real content state. */
type EducatorResource = {
  id: string
  title: string
  description: string | null
  /** Always `http(s)`; the table's check constraint is what guarantees it. */
  url: string
  published: boolean
  programId: string
  programName: string | null
}

/* ---------------------------------------------------------------------------
   The roster select, and the guard that keeps it honest
   --------------------------------------------------------------------------- */

/**
 * THE ONE STUDENT PROJECTION AN EDUCATOR ROSTER MAY USE.
 *
 * `EDUCATOR_ROSTER_COLUMNS` in `admin/roster-state.ts` is the canonical
 * allowlist and this module does not restate it, extend it, or keep a rival
 * copy. It restates only the PostgREST literal, because PostgREST infers the
 * row type from an unbroken string and a runtime-built one degrades every
 * column to `GenericStringError` — the constraint `admin/roster.ts` records.
 *
 * TWO CONTROLS, NOT ONE
 *
 * The narrowing is enforced first by the database:
 * `public.educator_roster_students` is a security-barrier view that selects
 * `program_id` and `preferred_name` and nothing else, and it is the ONLY route
 * an educator has to a child's name — `public.students` itself carries no
 * educator policy, so grade level, guardian relationship, and the affirmation
 * bookkeeping are unreadable to an educator whatever query is composed, in the
 * application or by hand against PostgREST.
 *
 * This literal is the second control, and it is not redundant: a view can gain
 * a column in a later migration, and an application that asks for `*` would
 * start returning it. Asking for the allowlist by name means a widened view
 * changes nothing here until someone widens the allowlist too.
 *
 * `ALLOWLIST_MATCHES_SELECT` below binds the literal to the allowlist in both
 * directions at compile time:
 *
 *   * a column added to the allowlist and not to the literal leaves a missing
 *     key, and typecheck fails;
 *   * a column added to the literal and not to the allowlist is an excess
 *     property, and typecheck fails.
 *
 * `tests/educator-workspace.test.mts` closes the last gap by asserting at
 * runtime that the literal is exactly the allowlist joined. So widening what an
 * educator sees of a child cannot be done quietly: it breaks the build, then it
 * breaks a test, and only then would it need the checklist §9 answer
 * (GAP-ADMIN-014) that does not yet exist.
 */
// prettier-ignore
const EDUCATOR_ROSTER_SELECT = "preferred_name"

/**
 * The bidirectional compile-time binding described above. Its keys are exactly
 * the student columns `EDUCATOR_ROSTER_SELECT` asks for.
 */
const ALLOWLIST_MATCHES_SELECT: Record<
  (typeof EDUCATOR_ROSTER_COLUMNS)[number],
  true
> = { preferred_name: true }

/* ---------------------------------------------------------------------------
   Schedule
   --------------------------------------------------------------------------- */

/** One published schedule fact, ready to render as a term and its value. */
type ScheduleFact = { label: string; value: string }

/**
 * The published schedule facts a program actually states.
 *
 * THERE IS NO SCHEDULE MODEL, AND THIS DOES NOT INVENT ONE.
 *
 * `public.programs` holds published schedule *text* — no sessions, no dates, no
 * times. `NULL` means the source does not publish that fact (QA-005), and most
 * published ranges carry no year, so they cannot be ordered in time at all.
 * This returns only the facts that exist, in a fixed reading order, and the
 * caller renders an explicit "nothing published" when the list is empty. An
 * educator is never shown a date Home School Haven has not published
 * (deviation D-EW2, matching the family area's D-FD1).
 *
 * @param program - The assigned program.
 * @returns The stated facts, in reading order. Empty when none are stated.
 */
function scheduleFacts(program: AssignedProgram): ScheduleFact[] {
  const candidates: ScheduleFact[] = [
    { label: "Dates", value: program.publishedDates ?? "" },
    { label: "Schedule", value: program.publishedSchedule ?? "" },
    { label: "Session length", value: program.publishedSessionLength ?? "" },
    { label: "Duration", value: program.publishedDuration ?? "" },
    { label: "Registration window", value: program.enrollmentWindow ?? "" },
  ]

  /* An empty string is not a published fact. Trimming first means a row of
     whitespace does not render as a value with nothing in it. */
  return candidates.filter((fact) => fact.value.trim() !== "")
}

/* ---------------------------------------------------------------------------
   Summaries
   --------------------------------------------------------------------------- */

/** What the Overview says about the workspace, without naming a child. */
type WorkspaceSummary = {
  assignedPrograms: number
  publishedPrograms: number
  /** Programs stating at least one published schedule fact. */
  programsWithSchedule: number
}

/**
 * The Overview's counts.
 *
 * Counts, never names. The Overview is the page most likely to be shown on a
 * shared screen or in a screenshot, and it does not need to know which child to
 * say how many (the `admin/repository.ts` "aggregates, not people" rule).
 *
 * @param programs - The viewer's assigned programs.
 * @returns The summary.
 */
function summarizeWorkspace(programs: AssignedProgram[]): WorkspaceSummary {
  return {
    assignedPrograms: programs.length,
    publishedPrograms: programs.filter(
      (program) => program.publicationState === "published",
    ).length,
    programsWithSchedule: programs.filter(
      (program) => scheduleFacts(program).length > 0,
    ).length,
  }
}

export {
  ALLOWLIST_MATCHES_SELECT,
  EDUCATOR_ROSTER_SELECT,
  scheduleFacts,
  summarizeUnconfirmed,
  summarizeWorkspace,
}
export type {
  AssignedProgram,
  EducatorAnnouncement,
  EducatorResource,
  EducatorRosterEntry,
  ScheduleFact,
  UnconfirmedSummary,
  WorkspaceSummary,
}
