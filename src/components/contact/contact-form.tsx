"use client"

import { useActionState, useId, type RefObject } from "react"
import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { submitGuidanceRequest } from "@/app/contact/actions"
import {
  emptyGuidanceFormState,
  MESSAGE_MAX_LENGTH,
} from "@/app/contact/form-state"
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
import type { GuidanceRequestType } from "@/lib/contact/recorder"

/**
 * Contact request form (MPS-REQ-009, MPS-REQ-010; DESIGN-SYSTEM.md §6
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
 * The request type is a native `<select>`, not the Base UI `Select`: this form
 * posts a `FormData` payload to a server action, and a native control is what
 * carries a value into it. Its value is owned by `ContactRequest` above, so the
 * four pathway cards and this control are always the same answer to the same
 * question.
 *
 * The consent checkbox drawn in the reference is deliberately absent: recorded
 * consent is a policy decision that remains Samantha's (owner decision
 * 2026-08-28, `prompts/public-contact-page.md` §12.3). The email field's own
 * description carries the honest statement instead.
 */
const REQUEST_TYPE_OPTIONS: { value: GuidanceRequestType; label: string }[] = [
  { value: "guidance", label: "Guidance choosing a program" },
  { value: "visit", label: "A visit to Home School Haven" },
  { value: "question", label: "A general question" },
  { value: "assistance", label: "Help with the cost of a class" },
]

function ContactForm({
  type,
  onTypeChange,
  typeRef,
  messageLength,
  onMessageLengthChange,
}: {
  type: GuidanceRequestType
  onTypeChange: (type: GuidanceRequestType) => void
  /** Focus target when a pathway card is activated above. */
  typeRef: RefObject<HTMLSelectElement | null>
  messageLength: number
  onMessageLengthChange: (length: number) => void
}) {
  const [state, formAction, pending] = useActionState(
    submitGuidanceRequest,
    emptyGuidanceFormState,
  )
  const ids = useId()
  const telHref = `tel:${contact.phone.replace(/-/g, "")}`
  const remaining = MESSAGE_MAX_LENGTH - messageLength

  /* One announcement for the whole submission outcome. Assertive so a blocked
     or failed result is not missed after the button returns to rest. */
  const announcement =
    state.status === "invalid"
      ? "Your request was not sent. Check the highlighted fields below."
      : state.status === "recorded"
        ? "Request received. Home School Haven will be in touch."
        : state.status === "unavailable"
          ? `Your request was not sent, because online requests are not open yet in this review environment. Nothing was recorded. Please call ${contact.phone}.`
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

      {/* The reference draws this panel as a resting section at the foot of the
          page. It is a submission state, not scenery (D-C4, MPS-ACC-014): it
          appears only when the server confirms a record was created, which
          cannot happen until a destination is approved and configured. */}
      {state.status === "recorded" ? (
        <div
          data-slot="submission-received"
          className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)]"
        >
          <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
            Request received. We&apos;ll be in touch.
          </h3>
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            Thank you for reaching out to Home School Haven. We&apos;ve received
            your message and will respond personally. This is not an enrollment
            and no place is reserved.
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
            <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
              Your request was not sent
            </h3>
            <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
              {state.status === "unavailable"
                ? "Online requests are not open yet in this review environment, so nothing was recorded and nobody has been notified. Your answers are still below — please call and we will pick up right where you left off."
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
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-5)]"
      >
        {/* Paired fields from md, stacked below — DESIGN-SYSTEM.md §8. */}
        <div className="grid gap-[var(--hsh-space-5)] md:grid-cols-2">
          <Field invalid={Boolean(state.fieldErrors.name)}>
            <FieldLabel>Parent or guardian name</FieldLabel>
            {/* Keyed on the echoed value: Base UI warns when the default value
                of an uncontrolled control changes after mount, so a re-render
                carrying new echoed values remounts the control instead. */}
            <Input
              key={state.values.name}
              name="name"
              autoComplete="name"
              placeholder="Your full name"
              defaultValue={state.values.name}
            />
            <FieldError match={Boolean(state.fieldErrors.name)}>
              {state.fieldErrors.name}
            </FieldError>
          </Field>

          <Field invalid={Boolean(state.fieldErrors.email)}>
            <FieldLabel>Email</FieldLabel>
            <Input
              key={state.values.email}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={state.values.email}
            />
            <FieldDescription>
              We use this only to reply to this request.
            </FieldDescription>
            <FieldError match={Boolean(state.fieldErrors.email)}>
              {state.fieldErrors.email}
            </FieldError>
          </Field>

          <Field invalid={Boolean(state.fieldErrors.phone)}>
            <FieldLabel>Phone (optional)</FieldLabel>
            <Input
              key={state.values.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(000) 000-0000"
              defaultValue={state.values.phone}
            />
            <FieldError match={Boolean(state.fieldErrors.phone)}>
              {state.fieldErrors.phone}
            </FieldError>
          </Field>

          {/* Base UI's Field associates its label and messages with a registered
              Field control. A native <select> and <textarea> are not registered
              parts, so these fields carry explicit ids, `htmlFor`, and
              `aria-describedby` rather than relying on that wiring. */}
          <Field invalid={Boolean(state.fieldErrors.type)}>
            <FieldLabel htmlFor={`${ids}-type`}>
              What can we help with?
            </FieldLabel>
            <select
              id={`${ids}-type`}
              name="type"
              ref={typeRef}
              value={type}
              onChange={(event) =>
                onTypeChange(event.target.value as GuidanceRequestType)
              }
              aria-invalid={Boolean(state.fieldErrors.type) || undefined}
              aria-describedby={
                state.fieldErrors.type ? `${ids}-type-error` : undefined
              }
              className="hsh-body h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)] hover:border-[var(--hsh-border-strong)] focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid"
            >
              {REQUEST_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {state.fieldErrors.type ? (
              <p
                id={`${ids}-type-error`}
                className="hsh-body-sm text-[var(--hsh-error)]"
              >
                {state.fieldErrors.type}
              </p>
            ) : null}
          </Field>
        </div>

        {/* Kept from the approved form and not drawn in the reference (D-C7):
            it is how the program action rail's "ask about this program" path
            arrives with context worth recording (MPS-REQ-010). */}
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
            className="hsh-body h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)] hover:border-[var(--hsh-border-strong)] focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid"
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
          <FieldLabel htmlFor={`${ids}-message`}>Message</FieldLabel>
          <Textarea
            id={`${ids}-message`}
            name="message"
            rows={5}
            placeholder="Tell us a little more so we can best support you…"
            defaultValue={state.values.message}
            onChange={(event) =>
              onMessageLengthChange(event.target.value.length)
            }
            aria-invalid={Boolean(state.fieldErrors.message) || undefined}
            aria-describedby={
              state.fieldErrors.message
                ? `${ids}-message-count ${ids}-message-error`
                : `${ids}-message-count`
            }
          />
          <div className="flex justify-end">
            {/* The count itself is not announced on every keystroke; the polite
                region below speaks only near and past the limit. */}
            <p
              id={`${ids}-message-count`}
              className="hsh-body-sm text-[var(--hsh-text-muted)]"
            >
              {messageLength} / {MESSAGE_MAX_LENGTH}
            </p>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {remaining < 0
              ? `You are ${Math.abs(remaining)} characters over the limit.`
              : remaining <= 100
                ? `${remaining} characters remaining.`
                : ""}
          </p>
          {state.fieldErrors.message ? (
            <p
              id={`${ids}-message-error`}
              className="hsh-body-sm text-[var(--hsh-error)]"
            >
              {state.fieldErrors.message}
            </p>
          ) : null}
        </Field>

        <div className="flex items-start gap-[var(--hsh-space-3)]">
          <Info
            aria-hidden="true"
            className="mt-[2px] size-5 shrink-0 text-[var(--hsh-forest-500)]"
            strokeWidth={1.75}
          />
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Please share only necessary information. Do not include sensitive
            child information — we will gather anything we need when we speak
            with you.
          </p>
        </div>

        <div className="flex flex-col gap-[var(--hsh-space-4)] sm:flex-row sm:items-start sm:justify-between">
          <p className="hsh-body-sm max-w-[46ch] text-[var(--hsh-text-secondary)]">
            Requests for help with the cost of a class are read privately by
            Home School Haven and reviewed by a person. Sending one does not
            create an enrollment and does not decide any discount — we will talk
            it through with you.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            className="shrink-0"
          >
            {pending ? "Sending…" : "Send Request"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { ContactForm }
