"use client"

import { useActionState, useId } from "react"
import Link from "next/link"
import { CircleAlert, Phone } from "lucide-react"

import { requestEnrollmentAction } from "@/app/(portal)/family/enroll/[slug]/actions"
import { emptyEnrollFormState } from "@/app/(portal)/family/enroll/[slug]/form-state"
import { CONFIRMATION_MODE } from "@/lib/enrollment/confirmation-mode"
import { HANDOFF_NOTICE } from "@/components/program/checkout-handoff"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { contact, guidanceHref } from "@/content/foundation-content"
import { presentOutcome } from "@/lib/enrollment/eligibility"
import type { EnrollableProgram } from "@/lib/enrollment/repository"
import type { Student } from "@/lib/family/repository"

/**
 * Parent registration form (MPS-REQ-012, MPS-WFL-003 "Select student",
 * MPS-RUL-008, MPS-ACC-002/018).
 *
 * WHAT THIS FORM DOES NOT DO
 *
 * It takes no money, and its submit button does not say it does. Nothing here
 * evaluates eligibility either: capacity, waitlist, confirmation mode,
 * duplicates, and publication state are decided by
 * `public.family_request_enrollment` on a locked row. This form collects two
 * choices and an affirmation and shows what the database decided.
 *
 * WHY THE HANDOFF SENTENCE IS SHOWN BEFORE THE BUTTON
 *
 * A parent has to know what pressing it means before they press it. The same
 * sentence the public program page shows appears here, above the action, in
 * every case — including the cases that will never reach checkout — so its
 * meaning never has to be inferred from which variant rendered (DO-DONT
 * "Trust states").
 *
 * The students come from the viewer's own family; RLS returned them. Choosing
 * one creates no session and no student identity — students have no Foundation
 * Release login (ACT-002).
 */
function EnrollForm({
  program,
  students,
}: {
  program: EnrollableProgram
  students: Student[]
}) {
  const [state, formAction, pending] = useActionState(
    requestEnrollmentAction,
    emptyEnrollFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`
  const blocked = state.status === "blocked" ? state.outcome : undefined
  const blockedPresentation = blocked ? presentOutcome(blocked) : null

  const announcement = blockedPresentation
    ? `${blockedPresentation.heading}. ${blockedPresentation.sentence}`
    : state.status === "invalid"
      ? "Nothing was registered. Check the highlighted fields below."
      : state.status === "forbidden"
        ? "This account is not set up to register a student."
        : state.status === "unavailable"
          ? "Registration is not open yet in this review environment."
          : state.status === "failed"
            ? "This registration could not be sent. Please try again."
            : ""

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <p
        role="status"
        aria-live="assertive"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {blockedPresentation ? (
        <Alert tone="warning" title={blockedPresentation.heading}>
          <p>{blockedPresentation.sentence}</p>
          {blockedPresentation.recovery === "guidance" ? (
            <p>
              Ask us about other options through{" "}
              <Link href={guidanceHref} data-inline-link="true">
                Request Guidance
              </Link>
              , or call {contact.phone}.
            </p>
          ) : null}
          {blockedPresentation.recovery === "programs" ? (
            <p>
              <Link href="/programs" data-inline-link="true">
                See the programs open now
              </Link>
              .
            </p>
          ) : null}
        </Alert>
      ) : null}

      {state.status === "failed" || state.status === "unavailable" ? (
        <Alert tone="warning" title="Nothing was registered">
          <p>
            {state.status === "unavailable"
              ? "Registration is not open yet in this review environment. Nothing was recorded and no payment was started."
              : "This registration could not be sent, so nothing was recorded and no payment was started. Please try again."}
          </p>
        </Alert>
      ) : null}

      <form
        action={formAction}
        className="flex flex-col gap-[var(--hsh-space-5)]"
      >
        <input type="hidden" name="slug" value={program.slug} />

        <Field invalid={Boolean(state.fieldErrors.studentId)}>
          <FieldLabel htmlFor={`${ids}-student`}>
            Which student are you registering?
          </FieldLabel>
          {/* A plain select, so the whole form works without JavaScript and is
              keyboard-operable by construction. */}
          <select
            id={`${ids}-student`}
            name="studentId"
            defaultValue={state.values.studentId}
            className="hsh-body min-h-[var(--hsh-touch-target)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)] focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid"
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.preferredName}
              </option>
            ))}
          </select>
          <FieldError match={Boolean(state.fieldErrors.studentId)}>
            {state.fieldErrors.studentId}
          </FieldError>
        </Field>

        <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
          <h2 className="hsh-label text-[var(--hsh-text-primary)]">
            What happens when you register
          </h2>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {CONFIRMATION_MODE[program.confirmationMode].familyNote}
          </p>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {HANDOFF_NOTICE}
          </p>
        </div>

        <Field invalid={Boolean(state.fieldErrors.authority)}>
          <CheckboxRow>
            <Checkbox
              name="authority"
              defaultChecked={state.values.authority === "on"}
              aria-describedby={`${ids}-authority-error`}
            />
            I am this student&rsquo;s parent or legal guardian.
          </CheckboxRow>
          <FieldError
            id={`${ids}-authority-error`}
            match={Boolean(state.fieldErrors.authority)}
          >
            {state.fieldErrors.authority}
          </FieldError>
        </Field>

        {/* "Request registration", not "Pay" or "Enroll". Nothing here takes
            money and nothing here confirms a place. */}
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Sending registration…" : "Request Registration"}
        </Button>

        <p className="hsh-body-sm flex items-start gap-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
          <CircleAlert
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-[2px] size-4 shrink-0"
          />
          Registration records in this review are sample data. Prefer to talk it
          through? Call{" "}
          <a href={telHref} data-inline-link="true">
            <Phone
              aria-hidden="true"
              strokeWidth={1.75}
              className="inline size-4"
            />{" "}
            {contact.phone}
          </a>
          .
        </p>
      </form>
    </div>
  )
}

export { EnrollForm }
