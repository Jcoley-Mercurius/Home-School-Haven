/**
 * Educator assignment form state.
 *
 * Separate from `actions.ts` because a `"use server"` module may export only
 * async functions.
 *
 * WHAT IS NOT ECHOED HERE
 *
 * No educator name, no program name, and nothing about a family or a student.
 * The note is echoed because losing an administrator's typed reason would make
 * them retype it after a failure, and it is the only free-text field. Every
 * other value the drawer shows comes from the freshly read record rather than
 * from this state.
 *
 * `educatorUserId` identifies which drawer an outcome belongs to, exactly as
 * `enrollmentId` does on the enrollment form: one drawer instance is reused
 * across rows, and an outcome from a different educator must not be shown
 * against this one.
 */

type AssignmentActionStatus =
  | "idle"
  | "invalid"
  /** The assignment already existed, or was already absent. Nothing written. */
  | "unchanged"
  | "assigned"
  | "unassigned"
  /** Target does not hold the educator role, or the program is archived. */
  | "notEligible"
  | "notFound"
  | "forbidden"
  | "unavailable"
  | "failed"

type AssignmentActionFormState = {
  status: AssignmentActionStatus
  /** Which educator this outcome belongs to, so the right drawer reacts. */
  educatorUserId: string | null
  fieldErrors: { note?: string; program?: string }
  values: { note: string }
}

const emptyAssignmentActionFormState: AssignmentActionFormState = {
  status: "idle",
  educatorUserId: null,
  fieldErrors: {},
  values: { note: "" },
}

export { emptyAssignmentActionFormState }
export type { AssignmentActionFormState, AssignmentActionStatus }
