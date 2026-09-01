/**
 * The one timezone this product interprets and displays a session in.
 *
 * WHY A FIXED ZONE AND NOT "LOCAL"
 *
 * Two problems make "whatever zone the runtime is in" wrong, and they are
 * different problems:
 *
 *   1. CORRECTNESS. A session is authored by an administrator who means a wall
 *      clock time in Cape Coral. Parsing that string in the server's zone would
 *      make the stored instant depend on where the server happens to run, so
 *      the same form submission would mean different moments in local
 *      development and on Vercel.
 *
 *   2. HYDRATION. A time formatted in the server's zone during SSR and in the
 *      browser's zone on hydration produces two different strings for the same
 *      instant. React reports that as a mismatch, and a family reading the
 *      pre-hydration string would read a time that then changed under them.
 *
 * Both go away by naming the zone explicitly. Home School Haven operates in
 * Cape Coral, Southwest Florida (MPS-PROJECT-STATE `geography`), which is
 * `America/New_York`. Daylight saving is handled by the runtime's own tz
 * database rather than by an offset constant, so a session in January and one
 * in July are both correct.
 *
 * DEVIATION D-SC3
 *
 * Every session is presented in Home School Haven's zone, to every viewer,
 * wherever they are — the times are labelled ET so a remote family is not
 * misled. A per-viewer zone would need an approved decision about whose clock a
 * program's time is stated in, and MPS makes none. Recorded rather than
 * assumed.
 *
 * No `server-only` and no Supabase import: this is arithmetic over strings, and
 * both the server actions and the client forms need it.
 */

/** Home School Haven's operating timezone (MPS-PROJECT-STATE `geography`). */
const PROGRAM_TIME_ZONE = "America/New_York"

/** How a time is labelled so a viewer elsewhere is not misled. */
const PROGRAM_TIME_ZONE_LABEL = "ET"

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/**
 * The offset between UTC and the program zone at one instant, in milliseconds.
 *
 * Derived by formatting the instant into the zone's own wall-clock parts and
 * reading them back as if they were UTC. The difference is the offset, and it
 * accounts for daylight saving because the formatter does.
 *
 * @param date - The instant to measure at.
 * @returns The offset in milliseconds (negative west of UTC).
 */
function zoneOffsetMs(date: Date): number {
  const parts = PARTS.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")

  /* `hour12: false` renders midnight as hour 24 in some runtimes. */
  const hour = get("hour") % 24

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  )

  return asUtc - date.getTime()
}

/**
 * Read a `datetime-local` value as a wall clock time in the program zone.
 *
 * The offset is applied twice on purpose. The first pass uses the offset at the
 * naive UTC guess, which is wrong for a time within an hour of a daylight
 * saving transition; the second pass measures at the corrected instant and
 * settles it. This is the standard two-step, and without it one hour twice a
 * year would be stored an hour out.
 *
 * @param local - A `YYYY-MM-DDTHH:mm` string from a `datetime-local` input.
 * @returns The ISO instant, or `null` when the string is not a valid moment.
 */
function parseProgramLocal(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim())
  if (!match) return null

  const [, year, month, day, hour, minute] = match.map(Number)

  const guess = Date.UTC(year, month - 1, day, hour, minute)
  if (Number.isNaN(guess)) return null

  const firstPass = guess - zoneOffsetMs(new Date(guess))
  const settled = guess - zoneOffsetMs(new Date(firstPass))

  const result = new Date(settled)
  if (Number.isNaN(result.getTime())) return null

  /* Reject a date the calendar does not have — "2026-02-31" survives the regex
     but `Date.UTC` rolls it into March, which would silently store a different
     day than the one submitted. */
  const roundTrip = formatProgramLocal(result.toISOString())
  if (roundTrip.slice(0, 10) !== local.trim().slice(0, 10)) return null

  return result.toISOString()
}

/**
 * Format a stored instant for a `datetime-local` input, in the program zone.
 *
 * @param iso - The stored ISO timestamp.
 * @returns A `YYYY-MM-DDTHH:mm` string.
 */
function formatProgramLocal(iso: string): string {
  const parts = PARTS.formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00"

  const hour = String(Number(get("hour")) % 24).padStart(2, "0")

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`
}

export {
  formatProgramLocal,
  parseProgramLocal,
  PROGRAM_TIME_ZONE,
  PROGRAM_TIME_ZONE_LABEL,
}
