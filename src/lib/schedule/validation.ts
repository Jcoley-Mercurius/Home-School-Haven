/**
 * Field shapes for the schedule, capacity, and attendance operations.
 *
 * Kept out of the action modules so the same rule cannot drift between the form
 * and the server, and so it can be unit-tested without a Supabase project.
 *
 * This layer exists to produce a sentence an administrator can act on. It is
 * NOT the control: every bound here is repeated by the SECURITY DEFINER
 * functions in
 * `20260902000000_schedule_capacity_waitlist_attendance.sql`, which are what a
 * request bypassing this application would meet.
 *
 * WHAT IS NOT HERE
 *
 * No attendance status, reason, or note field. MPS-FEA-011 approves attendance
 * tracking and defines no vocabulary for absent, excused, or tardy
 * (GAP-ADMIN-010), so attendance carries exactly two ids and nothing else — the
 * form has nothing to validate beyond them.
 *
 * No waitlist position or promotion field. MPS approves no ordering or
 * promotion rule (GAP-ADMIN-011), and promoting a waitlisted record is the
 * existing enrollment-state decision, validated by `enrollmentStateSchema`.
 *
 * No price, fee, deposit, refund, or payment field of any kind.
 */

import { z } from "zod"

/* A relative import with an explicit `.ts` specifier, not the `@/` alias: this
   is a runtime value import and the Node test runner does not resolve the
   alias. The same constraint `src/lib/admin/validation.ts` records. */
import { SESSION_STATE_TARGETS } from "./sessions.ts"
import { parseProgramLocal } from "./timezone.ts"

const TITLE_MAX = 160
const LOCATION_MAX = 160
const NOTE_MAX = 400

/**
 * The largest capacity this product will store.
 *
 * Not a policy: Home School Haven's real capacities are unconfirmed (checklist
 * §1, GAP-ADMIN-004). It is a typo guard — a mis-keyed "1200" for "12" would
 * otherwise be stored and shown to families as a fact.
 */
const CAPACITY_MAX = 10_000

const recordId = z.uuid("That record could not be identified.")

const concurrencyToken = z
  .string()
  .trim()
  .min(1, "Reload this page and try again.")

const sessionTitle = z
  .string()
  .trim()
  .min(1, "Give this session a title families will recognise.")
  .max(TITLE_MAX, `Use ${TITLE_MAX} characters or fewer.`)

const sessionLocation = z
  .string()
  .trim()
  .max(LOCATION_MAX, `Use ${LOCATION_MAX} characters or fewer.`)
  /* Empty becomes null. The difference matters: null is "no location is
     published for this session"; "" would be a published location whose value
     is nothing. */
  .transform((value) => (value === "" ? null : value))

/**
 * A date-and-time from a `datetime-local` input.
 *
 * The browser sends `YYYY-MM-DDTHH:mm` with no zone, and an administrator
 * authoring it means a wall clock time in Cape Coral. It is therefore parsed in
 * Home School Haven's own zone rather than the server's — see
 * `src/lib/schedule/timezone.ts` for why "whatever zone the runtime is in"
 * would make the same submission mean different instants in development and in
 * production (deviation D-SC3).
 *
 * A malformed value is rejected rather than coerced. `new Date("nonsense")`
 * yields an Invalid Date whose `toISOString()` throws, and a thrown formatter
 * inside a server action is an unexplained failure rather than a field error.
 */
const sessionMoment = z
  .string()
  .trim()
  .min(1, "Choose a date and time.")
  .transform((value) => parseProgramLocal(value))
  .refine((value): value is string => value !== null, {
    message: "That date and time could not be read.",
  })

/**
 * The note explaining a move or a cancellation (MPS-REQ-024, MPS-WFL-005
 * "communicate material changes").
 *
 * Optional here and mandatory in the database when a time actually changes,
 * because only the database knows whether the submitted times differ from the
 * stored ones. Its refusal carries a sentence written for an administrator, and
 * the form renders that sentence rather than a second guess at the rule.
 */
const optionalChangeNote = z
  .string()
  .trim()
  .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))

/** The mandatory note on a cancellation or completion. */
const sessionStateNote = z
  .string()
  .trim()
  .min(1, "Say why this session is changing. Families will read this.")
  .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)

const sessionStateTarget = z.enum(
  SESSION_STATE_TARGETS,
  "That is not an approved session change.",
)

/**
 * Capacity, or the absence of one.
 *
 * An empty field is `null`, which means "not established" and is how capacity
 * is cleared. It is NOT zero: zero is a capacity of no places, which is a
 * different and much stronger claim.
 */
const capacityValue = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || /^\d+$/.test(value), {
    message: "Enter a whole number of places, or leave this empty.",
  })
  .transform((value) => (value === null ? null : Number(value)))
  .refine((value) => value === null || value <= CAPACITY_MAX, {
    message: `Enter ${CAPACITY_MAX} or fewer.`,
  })

const createSessionSchema = z.object({
  programId: recordId,
  title: sessionTitle,
  startsAt: sessionMoment,
  endsAt: sessionMoment,
  location: sessionLocation,
})

const updateSessionSchema = z.object({
  sessionId: recordId,
  programId: recordId,
  expectedUpdatedAt: concurrencyToken,
  title: sessionTitle,
  startsAt: sessionMoment,
  endsAt: sessionMoment,
  location: sessionLocation,
  changeNote: optionalChangeNote,
})

const sessionStateSchema = z.object({
  sessionId: recordId,
  programId: recordId,
  expectedUpdatedAt: concurrencyToken,
  state: sessionStateTarget,
  note: sessionStateNote,
})

const capacitySchema = z.object({
  programId: recordId,
  expectedUpdatedAt: concurrencyToken,
  capacity: capacityValue,
  /* An unchecked checkbox sends nothing at all, so presence is the value. */
  waitlistEnabled: z.boolean(),
})

const attendanceSchema = z.object({
  sessionId: recordId,
  enrollmentId: recordId,
  programId: recordId,
  /* Which way the toggle is going. The database is idempotent either way, so a
     double submission cannot flip a record it did not mean to. */
  present: z.boolean(),
})

/**
 * A session must end after it starts.
 *
 * Checked across two fields, so it lives here rather than on either one. The
 * database applies the identical rule as a table constraint AND inside every
 * write function; this exists so an administrator reads a sentence instead of
 * meeting a refusal.
 *
 * @param values - The parsed start and end instants.
 * @returns True when the range is valid.
 */
function isValidRange(values: { startsAt: string; endsAt: string }) {
  return new Date(values.endsAt).getTime() > new Date(values.startsAt).getTime()
}

const RANGE_MESSAGE = "A session must end after it starts."

export {
  attendanceSchema,
  CAPACITY_MAX,
  capacitySchema,
  createSessionSchema,
  isValidRange,
  RANGE_MESSAGE,
  sessionStateSchema,
  updateSessionSchema,
}
