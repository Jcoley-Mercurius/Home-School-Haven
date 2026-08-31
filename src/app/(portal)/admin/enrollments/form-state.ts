/**
 * Enrollment state-change form state.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 *
 * WHAT IS NOT ECHOED HERE
 *
 * No student name, no family name, no enrollment identifier beyond the one the
 * form already holds. The note is echoed because losing an administrator's
 * typed reason would make them retype it, and it is the only field. Every other
 * value the drawer shows comes from the freshly read record rather than from
 * this state, so a failure cannot leave a child's name sitting in a stale
 * client-side object.
 */

type EnrollmentActionStatus =
  | "idle"
  | "invalid"
  /** The record already had that state. Nothing was written, nothing audited. */
  | "unchanged"
  | "updated"
  | "invalidTransition"
  | "stale"
  | "notFound"
  | "forbidden"
  | "unavailable"
  | "failed"

type EnrollmentActionFormState = {
  status: EnrollmentActionStatus
  /** Which record this outcome belongs to, so the right drawer reacts to it. */
  enrollmentId: string | null
  fieldErrors: { note?: string; state?: string }
  values: { note: string }
}

const emptyEnrollmentActionFormState: EnrollmentActionFormState = {
  status: "idle",
  enrollmentId: null,
  fieldErrors: {},
  values: { note: "" },
}

export { emptyEnrollmentActionFormState }
export type { EnrollmentActionFormState, EnrollmentActionStatus }
