/**
 * Dated sessions, as public calendar entries.
 *
 * WHY THIS MAPPER EXISTS AT ALL
 *
 * `src/content/calendar.ts` plots an entry only where the source publishes a
 * day AND a year. Most of Home School Haven's published ranges carry no year —
 * "September 15–October 5" — so choosing one would invent a fact, and those
 * ranges are listed as term ranges rather than drawn on the grid.
 *
 * A session carries a real instant. It therefore satisfies that rule outright,
 * which is what makes it plottable where the published text never was. This
 * module is the join, and it is deliberately the only place a session becomes a
 * calendar entry: the published inventory stays untouched, and the two sets
 * meet in the page rather than in either source.
 *
 * WHICH SESSIONS REACH A VISITOR
 *
 * Whichever ones RLS returned. `program_sessions_select_published_anon` admits
 * only sessions of a PUBLISHED program, so a draft or archived program's
 * schedule reaches nobody and this module needs no filter of its own. A filter
 * here would be a second rule that could disagree with the first.
 *
 * A cancelled session IS shown, marked cancelled. Removing it would leave a
 * family who had planned around it with no way to learn it was called off from
 * the public page (MPS-ACC-031), which is the opposite of what a cancellation
 * is for.
 */

import { PROGRAM_TIME_ZONE } from "@/lib/schedule/timezone"

import type { CalendarEntry } from "@/content/calendar"
import type { ScheduleSessionWithProgram } from "@/lib/schedule/repository"

/* `en-CA` yields `YYYY-MM-DD`, which is the ISO day key the calendar indexes
   by. The zone is Home School Haven's own: a 7pm ET session is already the next
   day in UTC, and plotting it there would put an evening class on the wrong
   square of the grid. */
const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROGRAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

/**
 * Map dated sessions onto public calendar entries.
 *
 * `publishedDetail` is assembled from the stored instants rather than copied
 * from any published text, and the entry's `source` says so — this is an
 * authored session, not a quotation from Home School Haven's website, and the
 * two must stay distinguishable in a later content audit.
 *
 * @param sessions - Sessions the viewer is authorized to read.
 * @returns The calendar entries for them.
 */
function sessionCalendarEntries(
  sessions: readonly ScheduleSessionWithProgram[],
): CalendarEntry[] {
  return sessions.map((session) => {
    const day = DAY_KEY.format(new Date(session.startsAt))

    return {
      id: `session-${session.id}`,
      title: session.title,
      publishedDetail: `${TIME.format(new Date(session.startsAt))}–${TIME.format(
        new Date(session.endsAt),
      )} ET${session.location ? `, ${session.location}` : ""}`,
      /* A session is a single day on the grid. A meeting that runs past
         midnight is not something this product has, and spanning two squares
         for a late finish would read as a two-day event. */
      start: day,
      end: day,
      program: session.program
        ? { slug: session.program.slug, name: session.program.name }
        : null,
      source: "Program schedule authored in the operations portal",
      state: session.state,
    }
  })
}

export { sessionCalendarEntries }
