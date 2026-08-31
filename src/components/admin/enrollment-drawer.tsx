"use client"

import { useActionState, useId, useState } from "react"
import { CircleCheck, CircleSlash, PauseCircle, Users } from "lucide-react"

import { setEnrollmentStateAction } from "@/app/(portal)/admin/enrollments/actions"
import { emptyEnrollmentActionFormState } from "@/app/(portal)/admin/enrollments/form-state"
import {
  ENROLLMENT_STATE,
  EnrollmentStateBadge,
} from "@/components/enrollment/enrollment-state"
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
import { allowedEnrollmentTargets } from "@/lib/admin/transitions"
import { NOTE_MAX } from "@/lib/admin/validation"

import type { AdminEnrollment } from "@/lib/admin/enrollments"
import type { AdminEnrollmentTarget } from "@/lib/admin/transitions"

/**
 * Enrollment detail drawer and the approved administrative actions
 * (MPS-REQ-017, MPS-REQ-021, MPS-REQ-024; MPS-RUL-004; MDS
 * `page_shells.admin_operations` detail drawer, `components.dialog`).
 *
 * WHAT EACH ACTION MEANS, IN THE WORDS THE ADMINISTRATOR READS
 *
 * The four below are the only enrollment decisions this release grants. Each
 * one names its actual consequence rather than saying "Confirm", because two
 * similar dialogs read at speed must not be mistakable for each other.
 *
 * THE LINE THIS COMPONENT EXISTS TO HOLD
 *
 * Confirming an enrollment is an administrator's decision that a child has a
 * place. It is NOT a payment verification, and this drawer says so in words
 * next to the button. Checklist §2 does not define how a successful payment is
 * identified, so nothing here records that one was, and there is no payment
 * control anywhere on this surface (GAP-ADMIN-002).
 *
 * Cancelling records a status and nothing more (MPS-RUL-004). No refund,
 * credit, or transfer is decided or issued — the dialog states that plainly,
 * because an administrator pressing Cancel needs to know the money is still
 * their offline job.
 *
 * A CONFIRMATION CANNOT BE UNDONE, AND THE DIALOG SAYS SO FIRST
 *
 * `confirmed` can only go to `canceled` (GAP-ADMIN-008): the correction path
 * through `blocked` was proposed and declined, so there is no approved way to
 * quietly reverse a confirmation. Warning before the decision is the only
 * honest place to put that, because after it there is nothing to offer.
 */

const ACTIONS: Record<
  AdminEnrollmentTarget,
  {
    label: string
    icon: typeof CircleCheck
    variant: "primary" | "secondary" | "destructive"
    title: string
    body: React.ReactNode
    confirm: string
    noteHint: string
  }
> = {
  confirmed: {
    label: "Confirm enrollment",
    icon: CircleCheck,
    variant: "primary",
    title: "Confirm this enrollment?",
    body: (
      <>
        <p>
          This records <strong>your</strong> decision that this student has a
          place in this program. The family&rsquo;s dashboard will show
          &ldquo;Enrolled&rdquo;.
        </p>
        <p>
          It does <strong>not</strong> verify a payment and does not say anyone
          has paid. Home School Haven&rsquo;s payment records remain the only
          evidence of payment, and this product holds none.
        </p>
        <p>
          A confirmation cannot be reversed here. The only change available
          afterwards is cancelling the enrollment, which means something
          different to the family.
        </p>
      </>
    ),
    confirm: "Confirm this enrollment",
    noteHint:
      "What did you check before confirming? For example, which record you verified this against.",
  },
  waitlisted: {
    label: "Place on waitlist",
    icon: Users,
    variant: "secondary",
    title: "Place this enrollment on the waitlist?",
    body: (
      <>
        <p>
          The family&rsquo;s dashboard will show that this student is on the
          waitlist, and that a waitlist place is not enrollment.
        </p>
        <p>No payment is collected and no charge is made by this.</p>
      </>
    ),
    confirm: "Place on waitlist",
    noteHint: "Why is this student going on the waitlist?",
  },
  blocked: {
    label: "Hold for review",
    icon: PauseCircle,
    variant: "secondary",
    title: "Hold this enrollment for review?",
    body: (
      <>
        <p>
          The family&rsquo;s dashboard will say Home School Haven needs to look
          at this registration before it can go ahead, and that it is not
          confirmed.
        </p>
        <p>
          Use this while something needs checking. You can confirm, waitlist, or
          cancel it afterwards.
        </p>
      </>
    ),
    confirm: "Hold for review",
    noteHint: "What needs checking before this can go ahead?",
  },
  canceled: {
    label: "Cancel enrollment",
    icon: CircleSlash,
    variant: "destructive",
    title: "Cancel this enrollment?",
    body: (
      <>
        <p>
          The family&rsquo;s dashboard will show this registration as cancelled,
          and the program&rsquo;s ongoing announcements and resources will stop
          reaching them.
        </p>
        <p>
          This records a status only. It decides and issues{" "}
          <strong>no refund, credit, or transfer</strong> — those remain Home
          School Haven&rsquo;s existing policy, handled with the family
          directly.
        </p>
        <p>
          A cancelled enrollment cannot be reinstated here. The record and its
          history are kept.
        </p>
      </>
    ),
    confirm: "Cancel this enrollment",
    noteHint: "Why is this enrollment being cancelled?",
  },
}

function EnrollmentDrawer({
  enrollment,
  onClose,
}: {
  enrollment: AdminEnrollment | null
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState(
    setEnrollmentStateAction,
    emptyEnrollmentActionFormState,
  )
  const [confirming, setConfirming] = useState<AdminEnrollmentTarget | null>(
    null,
  )
  const noteId = useId()
  const noteHintId = useId()

  /* React's "adjust state during render" pattern rather than an effect, so the
     confirmation dialog never flashes open over a settled result. `settled`
     records which action state was already handled, so opening a different
     dialog afterwards is not immediately closed by the previous outcome. */
  const [settled, setSettled] = useState(state)
  if (state !== settled) {
    setSettled(state)
    if (state.status === "updated" || state.status === "unchanged") {
      setConfirming(null)
    }
  }

  if (!enrollment) return null

  /* An outcome from a different record must not be shown against this one —
     the drawer is reused, and a stale success would attach a change to the
     wrong child. */
  const outcome = state.enrollmentId === enrollment.id ? state.status : "idle"

  const targets = allowedEnrollmentTargets(enrollment.state)
  const meaning = ENROLLMENT_STATE[enrollment.state]

  const message =
    outcome === "updated"
      ? "The enrollment state was changed. The family sees the new state, and the change is recorded with your account and the time."
      : outcome === "unchanged"
        ? "This enrollment was already in that state. Nothing was changed and nothing was recorded."
        : outcome === "stale"
          ? "This enrollment changed while this panel was open. Nothing was changed. Close and reopen it to see the current state."
          : outcome === "invalidTransition"
            ? "That change is not approved from this enrollment's current state."
            : outcome === "notFound"
              ? "This enrollment is no longer available."
              : outcome === "forbidden"
                ? "This account is not authorized to change an enrollment."
                : outcome === "unavailable"
                  ? "No Supabase project is configured in this environment."
                  : outcome === "failed"
                    ? "Something went wrong on our side. Nothing was changed."
                    : outcome === "invalid"
                      ? "Nothing was changed. Check the note below."
                      : ""

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup size="panel">
        <DialogHeader
          title={enrollment.studentName || "Student not available"}
          description={enrollment.program?.name ?? "Program not available"}
          closeLabel="Close enrollment detail"
        />

        <DialogBody>
          {message ? (
            <Alert
              tone={
                outcome === "updated"
                  ? "success"
                  : outcome === "unchanged"
                    ? "info"
                    : "warning"
              }
              title={
                outcome === "updated"
                  ? "Enrollment updated"
                  : outcome === "unchanged"
                    ? "No change"
                    : "Nothing was changed"
              }
              live="polite"
            >
              {message}
            </Alert>
          ) : null}

          <section
            aria-labelledby="enrollment-current-state"
            className="flex flex-col gap-[var(--hsh-space-3)]"
          >
            <h3
              id="enrollment-current-state"
              className="hsh-label text-[var(--hsh-text-secondary)]"
            >
              Current state
            </h3>
            <EnrollmentStateBadge state={enrollment.state} withSentence />
          </section>

          <dl className="flex flex-col gap-[var(--hsh-space-3)]">
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Family
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {enrollment.familyName || "Family not available"}
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                State last changed
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                <time dateTime={enrollment.stateChangedAt}>
                  {new Date(enrollment.stateChangedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </dd>
            </div>
            {enrollment.stateNote ? (
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Last note
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                  {enrollment.stateNote}
                </dd>
              </div>
            ) : null}
          </dl>

          {/* The payment position, stated rather than left to be inferred from
              the absence of a control. DO-DONT: say when enrollment is not
              confirmed, and never let payment activity imply enrollment. */}
          <Alert tone="info" title="Payment is not managed here">
            This product holds no payment record and cannot verify a payment.
            Checkout happens on Home School Haven&rsquo;s external payment page,
            and leaving for it is never proof that anyone paid. Confirming an
            enrollment records your decision, not a payment.
          </Alert>

          <section
            aria-labelledby="enrollment-actions"
            className="flex flex-col gap-[var(--hsh-space-3)]"
          >
            <h3
              id="enrollment-actions"
              className="hsh-label text-[var(--hsh-text-secondary)]"
            >
              Available decisions
            </h3>

            {targets.length === 0 ? (
              <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                {meaning.label} is a final state. There is no approved change
                from here, and the record and its history are kept.
              </p>
            ) : (
              <div className="flex flex-col gap-[var(--hsh-space-2)]">
                {targets.map((target) => {
                  const config = ACTIONS[target]
                  const Icon = config.icon
                  return (
                    <Dialog
                      key={target}
                      open={confirming === target}
                      onOpenChange={(open) =>
                        setConfirming(open ? target : null)
                      }
                    >
                      <Button
                        variant={config.variant}
                        size="md"
                        className="w-full justify-start"
                        onClick={() => setConfirming(target)}
                      >
                        <Icon aria-hidden="true" strokeWidth={1.75} />
                        {config.label}
                      </Button>

                      <DialogPopup size="small">
                        <DialogHeader
                          title={config.title}
                          description={`${enrollment.studentName || "This student"} — ${enrollment.program?.name ?? "program not available"}`}
                        />
                        <form action={formAction}>
                          <input
                            type="hidden"
                            name="enrollmentId"
                            value={enrollment.id}
                          />
                          <input
                            type="hidden"
                            name="expectedUpdatedAt"
                            value={enrollment.updatedAt}
                          />
                          <input type="hidden" name="state" value={target} />

                          <DialogBody>
                            <div className="hsh-body-sm flex flex-col gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
                              {config.body}
                            </div>

                            <Field
                              invalid={Boolean(
                                outcome === "invalid" && state.fieldErrors.note,
                              )}
                            >
                              {/* Base UI's Field associates its label and
                                  messages with a REGISTERED Field control. A
                                  native <textarea> is not one, so without an
                                  explicit id/htmlFor the label is attached to
                                  nothing: the control has no accessible name
                                  and `getByLabel` cannot find it. Same fix, and
                                  the same reason, as contact-form.tsx. */}
                              <FieldLabel htmlFor={noteId}>
                                Reason (recorded)
                              </FieldLabel>
                              <FieldDescription id={noteHintId}>
                                {config.noteHint} This is kept with the
                                enrollment. Do not include anything about a
                                family beyond what this decision needs.
                              </FieldDescription>
                              {/* No `required` attribute: native constraint
                                  validation blocks the submit in the browser
                                  and shows a transient bubble, so the server's
                                  refusal never renders and the announced
                                  FieldError below is never reached. Every other
                                  form in this product validates on the server
                                  and renders the message; the note is enforced
                                  there and again in SQL (22023). */}
                              <Textarea
                                id={noteId}
                                name="note"
                                rows={3}
                                aria-required="true"
                                aria-describedby={noteHintId}
                                maxLength={NOTE_MAX}
                                defaultValue=""
                              />
                              <FieldError
                                match={Boolean(
                                  outcome === "invalid" &&
                                  state.fieldErrors.note,
                                )}
                              >
                                {state.fieldErrors.note}
                              </FieldError>
                            </Field>
                          </DialogBody>

                          <DialogFooter>
                            <DialogClose
                              render={
                                <Button variant="quiet" size="md" type="button">
                                  Cancel
                                </Button>
                              }
                            />
                            <Button
                              type="submit"
                              variant={config.variant}
                              size="md"
                              disabled={pending}
                            >
                              {pending ? "Working…" : config.confirm}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogPopup>
                    </Dialog>
                  )
                })}
              </div>
            )}
          </section>

          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Scholarships, discounts, refunds, credits, and transfers are not
            available here. Home School Haven has not confirmed that policy, so
            this product neither decides nor issues any of them.
          </p>
        </DialogBody>
      </DialogPopup>
    </Dialog>
  )
}

export { EnrollmentDrawer }
