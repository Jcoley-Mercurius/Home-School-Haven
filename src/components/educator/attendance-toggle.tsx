"use client"

import { useActionState } from "react"
import { Check, Undo2 } from "lucide-react"

import { setAttendanceAction } from "@/app/(portal)/educator/programs/[programId]/attendance-actions"
import { emptyAttendanceFormState } from "@/app/(portal)/educator/programs/[programId]/attendance-state"
import { Button } from "@/components/ui/button"

import type { AttendanceEntry } from "@/lib/educator/attendance"

/**
 * The record-present control for one child at one session (MPS-FEA-011).
 *
 * A BUTTON, NOT A CHECKBOX
 *
 * A checkbox has two states that read as opposites — ticked and unticked, yes
 * and no. That is exactly the reading this product must not offer: an unticked
 * box says "absent", and MPS defines no absence (GAP-ADMIN-010). A button that
 * says "Mark present" and, once used, a status that says "Recorded present"
 * with an undo, has only the one claim in it.
 *
 * The state after each action is announced, because the button's own label
 * changes and a screen-reader user acting on a list of names needs to hear
 * which name just changed rather than infer it.
 *
 * Both directions are idempotent in the database, so a double-click or a
 * resubmitted form writes once and records one history entry.
 */
function AttendanceToggle({
  sessionId,
  programId,
  entry,
  sessionTitle,
}: {
  sessionId: string
  programId: string
  entry: AttendanceEntry
  sessionTitle: string
}) {
  const [state, formAction, pending] = useActionState(
    setAttendanceAction,
    emptyAttendanceFormState,
  )

  const name = entry.studentName || "this child"

  const announcement =
    state.status === "recorded"
      ? `${name} recorded present at ${sessionTitle}.`
      : state.status === "cleared"
        ? `${name} is no longer recorded at ${sessionTitle}. This does not record an absence.`
        : state.status === "unchanged"
          ? "Nothing changed."
          : state.status === "forbidden"
            ? "This account is not authorized to record attendance for this program."
            : state.status === "notFound"
              ? "This program is no longer assigned to you."
              : state.status === "unavailable"
                ? "Attendance cannot be recorded in this environment."
                : state.status === "rejected" || state.status === "failed"
                  ? (state.message ?? "Nothing was recorded. Please try again.")
                  : ""

  const failed =
    state.status === "forbidden" ||
    state.status === "notFound" ||
    state.status === "rejected" ||
    state.status === "unavailable" ||
    state.status === "failed"

  return (
    <div className="flex flex-col items-end gap-[var(--hsh-space-1)]">
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      <form action={formAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="enrollmentId" value={entry.enrollmentId} />
        <input
          type="hidden"
          name="present"
          value={entry.attended ? "false" : "true"}
        />

        {entry.attended ? (
          <Button type="submit" variant="quiet" size="md" disabled={pending}>
            <Undo2 aria-hidden="true" strokeWidth={1.75} />
            {pending ? "Saving…" : `Recorded present — undo for ${name}`}
          </Button>
        ) : (
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={pending}
          >
            <Check aria-hidden="true" strokeWidth={1.75} />
            {pending ? "Saving…" : `Mark ${name} present`}
          </Button>
        )}
      </form>

      {/* Said on the row, not only in the announcement: a sighted reader
          scanning the list must not read an unmarked row as an absence. */}
      {!entry.attended ? (
        <span className="hsh-body-sm text-[var(--hsh-text-muted)]">
          Not recorded
        </span>
      ) : null}

      {failed ? (
        <span role="alert" className="hsh-body-sm text-[var(--hsh-error)]">
          {announcement}
        </span>
      ) : null}
    </div>
  )
}

export { AttendanceToggle }
