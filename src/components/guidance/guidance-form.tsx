"use client"

import { useActionState, useId } from "react"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { submitGuidanceRequest } from "@/app/guidance/actions"
import { emptyGuidanceFormState } from "@/app/guidance/form-state"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { contact, programs } from "@/content/foundation-content"

/**
 * Request Guidance form (MPS-REQ-009, MPS-REQ-010; DESIGN-SYSTEM.md §6
 * "Assistance request: private, dignified, manually reviewed, no promised
 * outcome"; MDS-REF-005 §6 interaction states).
 *
 * What this form does NOT do is as important as what it does:
 *
 *   - it collects no child or student information (AGENTS.md §11, MPS-RUL-006);
 *   - it never claims a submission succeeded unless the server says a record
 *     was actually created (MPS-ACC-014);
 *   - it promises no outcome for a discounted-class assistance request
 *     (MPS-RUL-004, DO-DONT.md "Trust states").
 *
 * Validation is server-side only, so no native constraint can hide a code path
 * from the server boundary. Errors are rendered per field, announced through a
 * status region, and the sender's typing survives every failure state.
 *
 * The radio group is a plain fieldset of native radios rather than the Base UI
 * primitive: this form posts a `FormData` payload to a server action, and
 * native inputs are what carry a value into it without client state.
 */
const REQUEST_TYPES = [
  {
    value: "guidance",
    label: "General guidance choosing a program",
  },
  {
    value: "visit",
    label: "A visit to Home School Haven",
  },
  {
    value: "assistance",
    label: "Help with the cost of a class",
  },
] as const

function GuidanceForm() {
  const [state, formAction, pending] = useActionState(
    submitGuidanceRequest,
    emptyGuidanceFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`

  /* One announcement for the whole submission outcome. Assertive so a blocked
     or failed result is not missed after the button returns to rest. */
  const announcement =
    state.status === "invalid"
      ? "Your request was not sent. Check the highlighted fields below."
      : state.status === "recorded"
        ? "Request received. Home School Haven will be in touch."
        : state.status === "unavailable"
          ? `Your request was not sent, because online guidance requests are not open yet in this review environment. Nothing was recorded. Please call ${contact.phone}.`
          : state.status === "failed"
            ? `Your request could not be sent. Nothing was recorded. Please try again, or call ${contact.phone}.`
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

      {state.status === "recorded" ? (
        <div className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)]">
          <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
            Request received
          </h2>
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            Thank you — Home School Haven has your request and will be in touch.
            This is not an enrollment and no place is reserved.
          </p>
        </div>
      ) : null}

      {state.status === "unavailable" || state.status === "failed" ? (
        <div
          className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-5)]"
          data-slot="submission-blocked"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-warning)]"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            <h2 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Your request was not sent
            </h2>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "unavailable"
                ? "Online guidance requests are not open yet in this review environment, so nothing was recorded and nobody has been notified. Your answers are still below — please call and we will pick up right where you left off."
                : "Something went wrong on our side, so nothing was recorded. Your answers are still below. Please try again, or call us."}
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

      {state.status === "invalid" ? (
        <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-error)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]">
          <CircleAlert
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-error)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Your request was not sent. Check the highlighted fields below and
            try again.
          </p>
        </div>
      ) : null}

      <form
        key={state.status === "recorded" ? "reset" : "active"}
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-6)]"
      >
        <fieldset
          className="flex flex-col gap-[var(--hsh-space-2)]"
          aria-describedby={
            state.fieldErrors.type ? `${ids}-type-error` : undefined
          }
        >
          <legend className="hsh-label pb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]">
            What would you like help with?
          </legend>
          {REQUEST_TYPES.map((option) => (
            <label
              key={option.value}
              className="hsh-body flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
            >
              <input
                type="radio"
                name="type"
                value={option.value}
                defaultChecked={state.values.type === option.value}
                className="size-5 shrink-0 accent-[var(--hsh-forest-600)]"
              />
              {option.label}
            </label>
          ))}
          {state.fieldErrors.type ? (
            <p
              id={`${ids}-type-error`}
              className="hsh-body-sm text-[var(--hsh-error)]"
            >
              {state.fieldErrors.type}
            </p>
          ) : null}
        </fieldset>

        <Field invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel>Your name</FieldLabel>
          <Input
            name="name"
            autoComplete="name"
            defaultValue={state.values.name}
          />
          <FieldError match={Boolean(state.fieldErrors.name)}>
            {state.fieldErrors.name}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.email)}>
          <FieldLabel>Email</FieldLabel>
          <FieldDescription>
            When requests are open, we use this only to reply.
          </FieldDescription>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values.email}
          />
          <FieldError match={Boolean(state.fieldErrors.email)}>
            {state.fieldErrors.email}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.phone)}>
          <FieldLabel>Phone (optional)</FieldLabel>
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={state.values.phone}
          />
          <FieldError match={Boolean(state.fieldErrors.phone)}>
            {state.fieldErrors.phone}
          </FieldError>
        </Field>

        {/* Base UI's Field associates its label and messages with a registered
            Field control. A native <select> and <textarea> are not registered
            parts, so these two fields carry explicit ids, `htmlFor`, and
            `aria-describedby` rather than relying on that wiring. */}
        <Field invalid={Boolean(state.fieldErrors.programSlug)}>
          <FieldLabel htmlFor={`${ids}-program`}>
            Program you are asking about (optional)
          </FieldLabel>
          <select
            id={`${ids}-program`}
            name="programSlug"
            defaultValue={state.values.programSlug}
            aria-invalid={Boolean(state.fieldErrors.programSlug) || undefined}
            aria-describedby={
              state.fieldErrors.programSlug ? `${ids}-program-error` : undefined
            }
            className="hsh-body h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]"
          >
            <option value="">No particular program</option>
            {programs.map((program) => (
              <option key={program.slug} value={program.slug}>
                {program.name}
              </option>
            ))}
          </select>
          {state.fieldErrors.programSlug ? (
            <p
              id={`${ids}-program-error`}
              className="hsh-body-sm text-[var(--hsh-error)]"
            >
              {state.fieldErrors.programSlug}
            </p>
          ) : null}
        </Field>

        <Field invalid={Boolean(state.fieldErrors.message)}>
          <FieldLabel htmlFor={`${ids}-message`}>How can we help?</FieldLabel>
          <p
            id={`${ids}-message-description`}
            className="hsh-body-sm text-[var(--hsh-text-muted)]"
          >
            Please do not include your child&apos;s personal details here. We
            will gather anything we need when we speak with you.
          </p>
          <Textarea
            id={`${ids}-message`}
            name="message"
            rows={5}
            defaultValue={state.values.message}
            aria-invalid={Boolean(state.fieldErrors.message) || undefined}
            aria-describedby={
              state.fieldErrors.message
                ? `${ids}-message-description ${ids}-message-error`
                : `${ids}-message-description`
            }
          />
          {state.fieldErrors.message ? (
            <p
              id={`${ids}-message-error`}
              className="hsh-body-sm text-[var(--hsh-error)]"
            >
              {state.fieldErrors.message}
            </p>
          ) : null}
        </Field>

        <div className="flex items-start gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-4)]">
          <Info
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-[var(--hsh-forest-500)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            When requests are open, they are read privately by Home School Haven
            and reviewed by a person. Sending one does not create an enrollment
            and does not decide any discount — we will talk it through with you.
          </p>
        </div>

        <div>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            {pending ? "Sending…" : "Send request"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { GuidanceForm }
