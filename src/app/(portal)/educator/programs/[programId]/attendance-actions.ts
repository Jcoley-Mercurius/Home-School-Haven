"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth/guards"
import { getAssignedProgram } from "@/lib/educator/assignments"
import { clearAttendance, recordAttendance } from "@/lib/schedule/mutations"
import { attendanceSchema } from "@/lib/schedule/validation"
import { isSupabaseConfigured } from "@/lib/env"

import type { AttendanceFormState } from "./attendance-state"

/**
 * Record or clear one attendance entry (MPS-FEA-011, MPS-REQ-018).
 *
 * WHAT A SUBMISSION MEANS
 *
 * `present: true` records that this enrollment was present at this session.
 * `present: false` clears a record made in error, restoring "not recorded" —
 * which is NOT a claim of absence, because MPS approves no vocabulary in which
 * absence could be claimed (GAP-ADMIN-010). The button says so in words.
 *
 * FOUR INDEPENDENT CONTROLS, AND NOT ONE OF THEM IS THIS FILE
 *
 *   1. `requireRole("educator")` — a server action is a public HTTP endpoint
 *      and can be invoked without ever loading the page whose guard would have
 *      refused.
 *   2. `getAssignedProgram()` — proves this educator holds this program,
 *      through a query already bounded by their own user id.
 *   3. `private.may_record_attendance()` inside the database function, checked
 *      against the SESSION's own program rather than against the program id
 *      submitted here, so a caller cannot pair one program's session with
 *      another's assignment.
 *   4. The `session_attendance_matches_session` trigger, which refuses an
 *      enrollment that is not confirmed or belongs to a different program.
 *
 * Control 3 is the one that holds when no application code is involved.
 * Controls 1 and 2 exist so a refusal arrives as a sentence rather than as an
 * error, and so an educator who has just been unassigned is told what happened.
 *
 * The submitted `enrollmentId` is a client-supplied value and that is safe: it
 * points at a registration rather than at a child, and every control above
 * decides independently whether this caller may touch it.
 */
export async function setAttendanceAction(
  _previous: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const parsed = attendanceSchema.safeParse({
    sessionId: String(formData.get("sessionId") ?? ""),
    enrollmentId: String(formData.get("enrollmentId") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    present: String(formData.get("present") ?? "") === "true",
  })

  if (!parsed.success) {
    return {
      status: "rejected",
      message:
        "That attendance change could not be read. Reload the page and try again.",
    }
  }

  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const viewer = await requireRole(
    "educator",
    `/educator/programs/${parsed.data.programId}`,
  )

  const assignment = await getAssignedProgram(
    viewer.userId,
    parsed.data.programId,
  )

  /* `notFound` covers both "no such program" and "not assigned to you". The
     response must not distinguish them. */
  if (assignment.status === "notFound") return { status: "notFound" }
  if (assignment.status !== "ready") {
    return {
      status: assignment.status === "unavailable" ? "unavailable" : "failed",
    }
  }

  const result = parsed.data.present
    ? await recordAttendance({
        sessionId: parsed.data.sessionId,
        enrollmentId: parsed.data.enrollmentId,
      })
    : await clearAttendance({
        sessionId: parsed.data.sessionId,
        enrollmentId: parsed.data.enrollmentId,
      })

  if (!result.ok) {
    return {
      status:
        result.reason === "forbidden"
          ? "forbidden"
          : result.reason === "notFound"
            ? "notFound"
            : result.reason === "invalidTransition" ||
                result.reason === "rejected"
              ? "rejected"
              : "failed",
      message: result.message,
    }
  }

  revalidatePath(`/educator/programs/${parsed.data.programId}`)

  return {
    status:
      result.outcome === "unchanged"
        ? "unchanged"
        : result.outcome === "cleared"
          ? "cleared"
          : "recorded",
  }
}
