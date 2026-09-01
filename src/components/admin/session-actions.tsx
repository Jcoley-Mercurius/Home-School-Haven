"use client"

import { useActionState, useId, useState } from "react"
import { CalendarX, CircleCheck, Pencil } from "lucide-react"

import { setSessionStateAction } from "@/app/(portal)/admin/programs/[programId]/actions"
import { emptySessionStateFormState } from "@/app/(portal)/admin/programs/[programId]/form-state"
import { SessionForm } from "@/components/admin/session-form"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPopup,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  allowedSessionTargets,
  isSessionEditable,
} from "@/lib/schedule/sessions"

import type { SessionStateTarget } from "@/lib/schedule/sessions"
import type { ScheduleSession } from "@/lib/schedule/repository"

/**
 * The actions available on one session (MPS-REQ-016, MPS-RUL-004, MPS-RUL-005,
 * MPS-ACC-026/027; MDS `components.dialog` variants `form` and `destructive`).
 *
 * WHY CANCELLING OPENS A DIALOG
 *
 * MDS `components.dialog.specification`: "Destructive, consent, and financial
 * dialogs require explicit action language and safe cancellation." Cancelling a
 * session is read by every enrolled family, and it is the one action here whose
 * consequence a reader could misjudge — so the dialog states, before the click,
 * the two things that are true and the one that is not:
 *
 *   - families see the cancellation on their dashboard;
 *   - the note is shown to them, which is why it is required;
 *   - NO refund, credit, transfer, or enrollment change is decided or issued.
 *     That remains Home School Haven's existing offline policy (MPS-RUL-004,
 *     MPS GAP-010).
 *
 * The confirm button never says "Confirm". It says what will happen, so a
 * dialog read at speed still says which of two similar decisions is being made.
 *
 * WHICH BUTTONS EXIST
 *
 * Only what `allowedSessionTargets` permits, which is a copy of the table the
 * database enforces. A cancelled or completed session offers nothing, because
 * both are terminal: reinstating one is a reversal MPS approves no rule for,
 * and the approved recovery is to author a new session. If the two copies ever
 * disagree the database wins and the administrator sees the refusal, which is
 * the safe direction for a disagreement to fail in.
 *
 * There is no Delete. A session families have already seen is history, and
 * retention is an unanswered owner question (checklist §11).
 */
const ACTION: Record<
  SessionStateTarget,
  {
    label: string
    icon: typeof CalendarX
    variant: "secondary" | "destructive"
    title: string
    body: React.ReactNode
    confirm: string
    noteLabel: string
    noteDescription: string
  }
> = {
  completed: {
    label: "Mark complete",
    icon: CircleCheck,
    variant: "secondary",
    title: "Mark this session complete?",
    body: (
      <>
        <p>
          The session will read as completed on the family, educator, and public
          views. Attendance already recorded for it is kept.
        </p>
        <p>
          A completed session cannot be reopened. If it needs to run again, add
          a new session instead — that keeps both records and both history
          entries.
        </p>
      </>
    ),
    confirm: "Mark this session complete",
    noteLabel: "Note about completing this session",
    noteDescription:
      "Recorded in operations history with your account and the time.",
  },
  canceled: {
    label: "Cancel session",
    icon: CalendarX,
    variant: "destructive",
    title: "Cancel this session?",
    body: (
      <>
        <p>
          Every enrolled family will see this session as cancelled, along with
          the note you write below. Write it for them to read.
        </p>
        <p>
          <strong>
            No refund, credit, transfer, or enrollment change is decided or
            issued here.
          </strong>{" "}
          Those remain Home School Haven&rsquo;s existing policy, handled
          directly with the family. Nothing about anyone&rsquo;s enrollment
          changes because of this.
        </p>
        <p>
          A cancelled session cannot be reinstated. If it goes ahead after all,
          add a new session.
        </p>
      </>
    ),
    confirm: "Cancel this session",
    noteLabel: "Why is this session cancelled?",
    noteDescription:
      "Families will read this. Recorded in operations history with your account and the time.",
  },
}

/**
 * The action rail for one session.
 * @param session - The session to act on.
 * @param programId - The program it belongs to.
 * @returns The actions, or nothing when the session is terminal.
 */
function SessionActions({
  session,
  programId,
}: {
  session: ScheduleSession
  programId: string
}) {
  const [openTarget, setOpenTarget] = useState<SessionStateTarget | null>(null)
  const [editing, setEditing] = useState(false)
  const targets = allowedSessionTargets(session.state)

  if (targets.length === 0 && !isSessionEditable(session.state)) {
    return (
      <p className="hsh-body-sm m-0 text-[var(--hsh-text-muted)]">
        This session is{" "}
        {session.state === "canceled" ? "cancelled" : "complete"} and can no
        longer be changed. Add a new session if it needs to run again.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
      {isSessionEditable(session.state) ? (
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" strokeWidth={1.75} />
            Edit or move
          </Button>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogPopup size="panel">
              <DialogHeader
                title="Edit this session"
                description="Changing the start or end time records the session as rescheduled and shows families the time it moved from."
              />
              <DialogBody>
                <SessionForm
                  programId={programId}
                  session={session}
                  onDone={() => setEditing(false)}
                />
              </DialogBody>
            </DialogPopup>
          </Dialog>
        </>
      ) : null}

      {targets.map((target) => (
        <SessionStateAction
          key={target}
          target={target}
          session={session}
          programId={programId}
          open={openTarget === target}
          onOpenChange={(open) => setOpenTarget(open ? target : null)}
        />
      ))}
    </div>
  )
}

/**
 * One cancel-or-complete action and its confirmation dialog.
 * @param props.target - The state being moved to.
 * @param props.session - The session being changed.
 * @param props.programId - The program it belongs to.
 * @param props.open - Whether this dialog is open.
 * @param props.onOpenChange - Called when the dialog opens or closes.
 * @returns The button and its dialog.
 */
function SessionStateAction({
  target,
  session,
  programId,
  open,
  onOpenChange,
}: {
  target: SessionStateTarget
  session: ScheduleSession
  programId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, formAction, pending] = useActionState(
    setSessionStateAction,
    emptySessionStateFormState,
  )
  const noteId = useId()
  const action = ACTION[target]
  const Icon = action.icon

  return (
    <>
      <Button
        type="button"
        variant={action.variant}
        onClick={() => onOpenChange(true)}
      >
        <Icon aria-hidden="true" strokeWidth={1.75} />
        {action.label}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup>
          <DialogHeader title={action.title} />
          <form action={formAction} noValidate>
            <DialogBody>
              <div className="hsh-body flex flex-col gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
                {action.body}
              </div>

              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="programId" value={programId} />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={session.updatedAt}
              />
              <input type="hidden" name="state" value={target} />

              <Field
                className="mt-[var(--hsh-space-4)]"
                invalid={state.status === "rejected"}
              >
                {/* Base UI's Field associates its label with a REGISTERED
                    Field control, and a native <textarea> is not one. Without
                    the explicit pairing the label attaches to nothing and the
                    control has no accessible name. */}
                <FieldLabel htmlFor={noteId}>{action.noteLabel}</FieldLabel>
                {/* No `required` attribute: native constraint validation would
                    block the submit with a browser bubble instead of the
                    product's own sentence. The note is enforced by the server
                    action and again in SQL (22023). */}
                <Textarea
                  id={noteId}
                  name="note"
                  rows={3}
                  aria-required="true"
                  maxLength={400}
                />
                <FieldDescription>{action.noteDescription}</FieldDescription>
                <FieldError>
                  {state.status === "rejected" ? state.message : undefined}
                </FieldError>
              </Field>

              {state.status === "stale" ||
              state.status === "notFound" ||
              state.status === "forbidden" ||
              state.status === "unavailable" ||
              state.status === "invalidTransition" ||
              state.status === "failed" ? (
                <Alert
                  tone="warning"
                  title="Nothing was changed"
                  live="assertive"
                  className="mt-[var(--hsh-space-4)]"
                >
                  {state.status === "stale"
                    ? "This session changed while this page was open. Nothing was saved and nobody's work was overwritten. Reload the page and decide again."
                    : state.status === "notFound"
                      ? "This session is no longer available. Reload the page."
                      : state.status === "forbidden"
                        ? "This account is not authorized to change a schedule."
                        : state.status === "unavailable"
                          ? "No Supabase project is configured in this environment."
                          : (state.message ??
                            "Something went wrong on our side. Please try again.")}
                </Alert>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="quiet" size="md" type="button">
                    Keep this session as it is
                  </Button>
                }
              />
              <Button type="submit" variant={action.variant} disabled={pending}>
                {pending ? "Saving…" : action.confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </>
  )
}

export { SessionActions }
