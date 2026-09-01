"use client"

import { useActionState, useEffect, useId } from "react"

import {
  createSessionAction,
  updateSessionAction,
} from "@/app/(portal)/admin/programs/[programId]/actions"
import { emptySessionFormState } from "@/app/(portal)/admin/programs/[programId]/form-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  formatProgramLocal,
  PROGRAM_TIME_ZONE_LABEL,
} from "@/lib/schedule/timezone"

import type { ScheduleSession } from "@/lib/schedule/repository"

/**
 * Author or edit one session (MPS-WFL-005 step 2, MPS-RUL-005; MDS
 * `patterns.forms`).
 *
 * ONE FORM FOR BOTH, BECAUSE THEY ARE THE SAME DECISION
 *
 * Editing a session and rescheduling one differ only in whether a time changed,
 * and separating them into two forms would let an administrator move a session
 * through the "edit" path without the record saying it moved. So the form is
 * one, and the DATABASE decides which happened: a changed time makes the
 * session `rescheduled`, preserves the original start so families still see the
 * time they planned around, and requires a note. A corrected title does none of
 * those things and needs no note.
 *
 * The note field is therefore always present and its requirement is conditional
 * — stated in its description rather than enforced by hiding it, because a
 * field that appears the moment you change a time is a field an administrator
 * meets as a surprise.
 *
 * WHY DATETIME-LOCAL AND NOT A CUSTOM PICKER
 *
 * The native control is keyboard-operable, screen-reader-labelled, and
 * localised by the browser without a library, which is what MDS
 * `components.input` variant `date` and WCAG 2.2 AA both want. Values are
 * interpreted in the server's timezone, recorded as deviation D-SC3: Home
 * School Haven runs in one place, and a multi-timezone program would need a
 * zone decision MPS has not made.
 */
function SessionForm({
  programId,
  session,
  onDone,
}: {
  programId: string
  /** The session being edited, or `undefined` when authoring a new one. */
  session?: ScheduleSession
  /** Called after a successful save, so a dialog can close itself. */
  onDone?: () => void
}) {
  const editing = session !== undefined
  const [state, formAction, pending] = useActionState(
    editing ? updateSessionAction : createSessionAction,
    emptySessionFormState,
  )
  const ids = useId()

  const value = (key: "title" | "startsAt" | "endsAt" | "location") => {
    if (state.values) return state.values[key]
    if (!session) return ""
    if (key === "title") return session.title
    if (key === "location") return session.location ?? ""
    return formatProgramLocal(
      key === "startsAt" ? session.startsAt : session.endsAt,
    )
  }

  const succeeded =
    state.status === "created" ||
    state.status === "saved" ||
    state.status === "rescheduled" ||
    state.status === "unchanged"

  /* In an effect, not during render: `onDone` closes a parent dialog, and
     setting a parent's state while this component renders is the React error
     that turns a successful save into a crash. */
  useEffect(() => {
    if (succeeded) onDone?.()
  }, [succeeded, onDone])

  const announcement =
    state.status === "created"
      ? "Session added."
      : state.status === "rescheduled"
        ? "Session moved. Families will see the new time and the time it moved from."
        : state.status === "saved"
          ? "Session saved."
          : state.status === "unchanged"
            ? "Nothing changed."
            : state.status === "invalid"
              ? "Nothing was saved. Check the highlighted fields below."
              : state.status === "stale"
                ? "Nothing was saved. This session changed while you were editing it."
                : state.status === "notFound"
                  ? "Nothing was saved. This session is no longer available."
                  : state.status === "forbidden"
                    ? "This account is not authorized to change a schedule."
                    : state.status === "unavailable"
                      ? "Schedules cannot be changed in this environment."
                      : state.status === "failed" || state.status === "rejected"
                        ? "Nothing was saved. Please try again."
                        : ""

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {state.status === "created" ? (
        <Alert tone="success" title="Session added" live="polite">
          It appears on the family and educator schedules, and on the public
          calendar once this program is published. The change is recorded in
          operations history.
        </Alert>
      ) : null}

      {state.status === "rescheduled" ? (
        <Alert tone="success" title="Session moved" live="polite">
          Families see the new time, the time it moved from, and your note. No
          enrollment, refund, credit, or transfer was decided.
        </Alert>
      ) : null}

      {state.status === "saved" ? (
        <Alert tone="success" title="Session saved" live="polite">
          The change is recorded in operations history with your account and the
          time.
        </Alert>
      ) : null}

      {state.status === "unchanged" ? (
        <Alert tone="info" title="Nothing changed" live="polite">
          The session was already exactly as you submitted it, so nothing was
          written and no history entry was recorded.
        </Alert>
      ) : null}

      {state.status === "invalid" ? (
        <Alert tone="error" title="Nothing was saved" live="polite">
          Check the highlighted fields below. Everything you typed is still
          here.
        </Alert>
      ) : null}

      {state.status === "stale" ? (
        <Alert
          tone="warning"
          title="This session changed while you were editing it"
          live="assertive"
        >
          Nothing was saved, and nobody&rsquo;s work was overwritten. Reload the
          page to see the current time, then make your change again.
        </Alert>
      ) : null}

      {state.status === "notFound" ||
      state.status === "forbidden" ||
      state.status === "unavailable" ||
      state.status === "rejected" ||
      state.status === "failed" ? (
        <Alert tone="warning" title="Nothing was saved" live="polite">
          {state.status === "notFound"
            ? "This session is no longer available. Reload the page."
            : state.status === "forbidden"
              ? "This account is not authorized to change a schedule."
              : state.status === "unavailable"
                ? "No Supabase project is configured in this environment."
                : (state.message ??
                  "Something went wrong on our side. Please try again.")}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <input type="hidden" name="programId" value={programId} />
        {session ? (
          <>
            <input type="hidden" name="sessionId" value={session.id} />
            <input
              type="hidden"
              name="expectedUpdatedAt"
              value={session.updatedAt}
            />
          </>
        ) : null}

        <Field invalid={Boolean(state.fieldErrors.title)}>
          <FieldLabel>Session title</FieldLabel>
          <Input
            key={`title-${value("title")}`}
            name="title"
            defaultValue={value("title")}
            maxLength={160}
          />
          <FieldDescription>
            What families will see in their schedule, such as the class name and
            which meeting this is.
          </FieldDescription>
          <FieldError>{state.fieldErrors.title}</FieldError>
        </Field>

        <div className="grid grid-cols-1 gap-[var(--hsh-space-4)] sm:grid-cols-2">
          <Field invalid={Boolean(state.fieldErrors.startsAt)}>
            <FieldLabel>Starts</FieldLabel>
            <Input
              key={`starts-${value("startsAt")}`}
              name="startsAt"
              type="datetime-local"
              defaultValue={value("startsAt")}
            />
            <FieldError>{state.fieldErrors.startsAt}</FieldError>
          </Field>

          <Field invalid={Boolean(state.fieldErrors.endsAt)}>
            <FieldLabel>Ends</FieldLabel>
            <Input
              key={`ends-${value("endsAt")}`}
              name="endsAt"
              type="datetime-local"
              defaultValue={value("endsAt")}
            />
            <FieldError>{state.fieldErrors.endsAt}</FieldError>
          </Field>
        </div>

        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          Times are Home School Haven&rsquo;s local time (
          {PROGRAM_TIME_ZONE_LABEL}), and are shown that way to every family
          wherever they are.
        </p>

        <Field invalid={Boolean(state.fieldErrors.location)}>
          <FieldLabel>Location</FieldLabel>
          <Input
            key={`location-${value("location")}`}
            name="location"
            defaultValue={value("location")}
            maxLength={160}
          />
          <FieldDescription>
            Optional. Leave empty if no location is published for this session.
          </FieldDescription>
          <FieldError>{state.fieldErrors.location}</FieldError>
        </Field>

        {editing ? (
          <Field invalid={Boolean(state.fieldErrors.changeNote)}>
            {/* Base UI's Field associates its label with a REGISTERED Field
                control. `Input` is one; a native <textarea> is not, so without
                an explicit id/htmlFor this label attaches to nothing, the
                control has no accessible name, and `getByLabel` cannot find it.
                Same fix and same reason as `enrollment-drawer.tsx`. */}
            <FieldLabel htmlFor={`${ids}-note`}>
              Note about this change
            </FieldLabel>
            <Textarea
              id={`${ids}-note`}
              name="changeNote"
              rows={3}
              maxLength={400}
              defaultValue={state.values?.changeNote ?? ""}
            />
            <FieldDescription>
              Required if you change the start or end time, because families
              will read it alongside the new time. Not required for a correction
              to the title or location.
            </FieldDescription>
            <FieldError>{state.fieldErrors.changeNote}</FieldError>
          </Field>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : editing
                ? "Save this session"
                : "Add this session"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { SessionForm }
