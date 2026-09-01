/**
 * Attendance form state.
 *
 * Separate from the action module because a `"use server"` module may export
 * only async functions.
 *
 * There is no "absent" status here, and there is none anywhere else either.
 * MPS-FEA-011 approves attendance tracking and defines no vocabulary for
 * absent, excused, or tardy (GAP-ADMIN-010), so the only two outcomes this
 * product can report truthfully are "recorded present" and "not recorded".
 */
type AttendanceFormState = {
  status:
    | "idle"
    | "recorded"
    | "cleared"
    /** The record already was what was submitted. Nothing was written. */
    | "unchanged"
    | "forbidden"
    | "notFound"
    | "rejected"
    | "unavailable"
    | "failed"
  /** Safe to display. Never echoes a database detail. */
  message?: string
}

const emptyAttendanceFormState: AttendanceFormState = { status: "idle" }

export { emptyAttendanceFormState }
export type { AttendanceFormState }
