/**
 * Capacity, as a sentence rather than as a number (MPS-RUL-002, MPS-FEA-012).
 *
 * WHAT THIS IS ALLOWED TO SAY
 *
 * MDS `components.enrollment_state` specifies `limited_spaces` as "limited
 * availability; exact capacity only when verified". So this module has exactly
 * two modes:
 *
 *   - capacity is NULL — "not established". No number, no "spaces left", no
 *     "nearly full", nothing. Home School Haven has not set a capacity for this
 *     program, and checklist §1 remains unanswered (GAP-ADMIN-004), so any
 *     figure shown here would be one this product made up.
 *   - capacity is set — the number came from an authorized administrator, so it
 *     can be stated, and so can the count of confirmed places against it.
 *
 * WHAT IT NEVER DOES
 *
 * It never decides an enrollment, an availability state, or a waitlist
 * outcome. `programs.availability` stays an administrator-set state and is not
 * recomputed from these numbers: MPS-RUL-002 makes capacity behavior
 * program-specific, and inferring "closed" from a count would be this product
 * choosing a policy on Samantha's behalf.
 *
 * No `server-only` and no Supabase import: this is arithmetic over values a
 * caller already read, so it is testable under the Node runner.
 */

import type { EnrollmentState } from "@/lib/admin/transitions"

/** What a surface may say about one program's capacity. */
type CapacitySummary =
  /**
   * No capacity has been established. Every surface renders this as words, not
   * as a zero, a dash, or an empty progress bar — all three read as a number.
   */
  | { status: "notEstablished"; confirmed: number; waitlisted: number }
  | {
      status: "established"
      capacity: number
      confirmed: number
      waitlisted: number
      /** Never negative. `0` means full. */
      remaining: number
      /** Confirmed places exceed the capacity that was set (GAP-ADMIN-012). */
      overCapacity: boolean
    }

/**
 * Summarize one program's capacity against its enrollment states.
 *
 * `confirmed` counts only `confirmed`, because that is the only state that
 * holds a place. A waitlisted, pending, or blocked record occupies nothing —
 * counting one against capacity would quietly turn a waitlist place into a
 * seat, which is the exact thing MPS-RUL-002 says a waitlist is not.
 *
 * @param capacity - The established capacity, or `null` when none is set.
 * @param states - The enrollment states recorded against this program.
 * @returns What may truthfully be said about the program's capacity.
 */
function summarizeCapacity(
  capacity: number | null,
  states: readonly EnrollmentState[],
): CapacitySummary {
  const confirmed = states.filter((state) => state === "confirmed").length
  const waitlisted = states.filter((state) => state === "waitlisted").length

  if (capacity === null) {
    return { status: "notEstablished", confirmed, waitlisted }
  }

  return {
    status: "established",
    capacity,
    confirmed,
    waitlisted,
    remaining: Math.max(0, capacity - confirmed),
    overCapacity: confirmed > capacity,
  }
}

/**
 * The sentence a surface shows for a capacity summary.
 *
 * Returned as text rather than assembled in a component so that the family,
 * educator, administrator, and public surfaces cannot drift into saying
 * different things about the same program (MPS-REQ-020).
 *
 * @param summary - The summary to describe.
 * @returns A complete sentence, safe to render anywhere.
 */
function describeCapacity(summary: CapacitySummary): string {
  if (summary.status === "notEstablished") {
    return "Home School Haven has not set a capacity for this program."
  }

  if (summary.overCapacity) {
    return `${summary.confirmed} confirmed ${plural(summary.confirmed, "place", "places")} against a capacity of ${summary.capacity}. No enrollment has been changed.`
  }

  if (summary.remaining === 0) {
    return `Full: ${summary.confirmed} of ${summary.capacity} ${plural(summary.capacity, "place", "places")} confirmed.`
  }

  return `${summary.confirmed} of ${summary.capacity} ${plural(summary.capacity, "place", "places")} confirmed.`
}

/**
 * The sentence describing a program's waitlist, if it has one.
 *
 * Says what a waitlist IS every time it says how many are on it, because
 * MPS-RUL-002 and the MDS `waitlist` rule both turn on a family not reading a
 * waitlist place as a seat.
 *
 * @param waitlistEnabled - Whether this program accepts waitlist placements.
 * @param waitlisted - How many records are waitlisted.
 * @returns A complete sentence, or `null` when there is nothing to say.
 */
function describeWaitlist(
  waitlistEnabled: boolean,
  waitlisted: number,
): string | null {
  if (!waitlistEnabled && waitlisted === 0) return null

  if (!waitlistEnabled) {
    return `${waitlisted} ${plural(waitlisted, "record is", "records are")} waitlisted, and this program is not currently accepting waitlist placements. A waitlist place is not enrollment.`
  }

  if (waitlisted === 0) {
    return "This program accepts waitlist placements. A waitlist place is not enrollment and collects no payment."
  }

  return `${waitlisted} ${plural(waitlisted, "record is", "records are")} waitlisted. A waitlist place is not enrollment and collects no payment.`
}

/**
 * Pick a singular or plural form.
 * @param count - The count deciding the form.
 * @param one - The singular form.
 * @param many - The plural form.
 * @returns The matching form.
 */
function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many
}

export { describeCapacity, describeWaitlist, summarizeCapacity }
export type { CapacitySummary }
