"use client"

import { useActionState, useId } from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { addStudentAction } from "@/app/(portal)/family/students/new/actions"
import { emptyStudentFormState } from "@/app/(portal)/family/students/new/form-state"
import { Button } from "@/components/ui/button"
import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SHORT_TEXT_MAX, STUDENT_NAME_MAX } from "@/lib/family/validation"
import { contact } from "@/content/foundation-content"

/**
 * Demo student profile form (deviation D-FF1; MPS-REQ-001, MPS-RUL-006/008).
 *
 * Three fields, and the shortness is the design. Legal name, date of birth,
 * allergies, medical needs, accommodations, emergency contacts, and authorized
 * pickup are all absent because MPS-RUL-006 forbids collecting them until
 * Samantha confirms necessity and policy, and checklist §7 is unanswered.
 *
 * The checkbox affirms parental authority, which MPS-RUL-008 requires before a
 * profile is created. It is not a consent or waiver acceptance: MPS-RUL-010
 * says no agent may invent that language, so none is shown and the stored
 * version string says `demo-unapproved-v0`.
 */
export function StudentForm() {
  const [state, formAction, pending] = useActionState(
    addStudentAction,
    emptyStudentFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  const announcement =
    state.status === "invalid"
      ? "This student was not added. Check the highlighted fields below."
      : state.status === "forbidden"
        ? "This account is not set up to add a student."
        : state.status === "unavailable"
          ? "Student profiles are not open yet in this review environment."
          : state.status === "failed"
            ? "This student could not be added. Please try again."
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

      {state.status === "invalid" ? (
        <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-error)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
          <CircleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-error)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            This student was not added. Check the highlighted fields below and
            try again.
          </p>
        </div>
      ) : null}

      {state.status === "forbidden" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="student-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              This student was not added
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "unavailable"
                ? "Student profiles are not open yet in this review environment. Nothing you typed was saved."
                : state.status === "forbidden"
                  ? "This account is not set up to add a student yet. Nothing you typed was saved."
                  : "Something went wrong on our side. Nothing you typed was saved. Please try again."}
            </p>
            <a
              href={telHref}
              className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              Call {contact.phone}
            </a>
          </div>
        </div>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-6)]"
      >
        <Field invalid={Boolean(state.fieldErrors.preferredName)}>
          <FieldLabel>Preferred name</FieldLabel>
          <FieldDescription>
            The name your family uses day to day.
          </FieldDescription>
          <Input
            key={state.values.preferredName}
            name="preferredName"
            type="text"
            autoComplete="off"
            maxLength={STUDENT_NAME_MAX}
            defaultValue={state.values.preferredName}
          />
          <FieldError match={Boolean(state.fieldErrors.preferredName)}>
            {state.fieldErrors.preferredName}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.gradeLevel)}>
          <FieldLabel>Grade level (optional)</FieldLabel>
          <Input
            key={state.values.gradeLevel}
            name="gradeLevel"
            type="text"
            autoComplete="off"
            maxLength={SHORT_TEXT_MAX}
            defaultValue={state.values.gradeLevel}
          />
          <FieldError match={Boolean(state.fieldErrors.gradeLevel)}>
            {state.fieldErrors.gradeLevel}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.guardianRelationship)}>
          <FieldLabel>Your relationship to this student (optional)</FieldLabel>
          <FieldDescription>
            For example &ldquo;Parent&rdquo; or &ldquo;Guardian&rdquo;. This is
            recorded for staff reference and does not change who can see or
            manage this profile.
          </FieldDescription>
          <Input
            key={state.values.guardianRelationship}
            name="guardianRelationship"
            type="text"
            autoComplete="off"
            maxLength={SHORT_TEXT_MAX}
            defaultValue={state.values.guardianRelationship}
          />
          <FieldError match={Boolean(state.fieldErrors.guardianRelationship)}>
            {state.fieldErrors.guardianRelationship}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.authority)}>
          <CheckboxRow>
            <Checkbox
              name="authority"
              defaultChecked={state.values.authority}
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

        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Adding student…" : "Add Student"}
        </Button>

        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Please use a sample name rather than a real child&rsquo;s. Student
          records in this review are sample data while Home School Haven
          confirms what information it will keep and for how long.
        </p>
      </form>
    </div>
  )
}
