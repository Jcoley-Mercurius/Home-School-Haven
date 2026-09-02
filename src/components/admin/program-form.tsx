"use client"

import { useActionState, useId } from "react"
import Link from "next/link"

import { saveProgramFactsAction } from "@/app/(portal)/admin/programs/[programId]/actions"
import { emptyProgramFactsFormState } from "@/app/(portal)/admin/programs/[programId]/form-state"
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
  CHECKOUT_HOST,
  CHECKOUT_URL_MAX,
  FACT_MAX,
  PROGRAM_NAME_MAX,
  SUMMARY_MAX,
} from "@/lib/admin/validation"
import { CONFIRMATION_MODE } from "@/lib/enrollment/confirmation-mode"
import { AVAILABILITY } from "@/components/program/availability-badge"

import type { ProgramFactsValues } from "@/app/(portal)/admin/programs/[programId]/form-state"
import type { AdminProgram } from "@/lib/admin/programs"

/**
 * Program facts, availability, and the external checkout link (MPS-REQ-008,
 * MPS-REQ-013, MPS-REQ-016; MDS `patterns.forms`).
 *
 * EVERY FIELD IS OPTIONAL EXCEPT THE NAME
 *
 * That is the import rule made into a form. A published fact Home School Haven
 * does not publish must stay unset, where it renders to families as "Contact
 * for details" — an honest absence. Clearing a field here writes NULL, not an
 * empty string, so clearing is a real way to correct a fact that should never
 * have been there.
 *
 * WHAT IS NOT ON THIS FORM
 *
 * Capacity, seat counts, deposits, fees, discounts, and scholarship
 * eligibility. Checklist §1 does not confirm capacity and MPS GAP-010 leaves
 * every financial rule open, so there is no field, no column, and nothing to
 * fill in (GAP-ADMIN-004). Availability is a *state*, not a number: "Limited
 * spaces" says what is true without claiming how many.
 *
 * THE CONCURRENCY TOKEN
 *
 * `expectedUpdatedAt` is the row's `updated_at` at the moment this form
 * rendered. The database compares it before writing, so if someone else changed
 * this program in the meantime the save is refused rather than silently
 * flattening their change. It is a hidden field and it is not a secret — a
 * forged or omitted value fails the comparison, which is the safe direction.
 */

const FACTS: {
  name: keyof ProgramFactsValues
  label: string
  description: string
}[] = [
  {
    name: "audience",
    label: "Audience",
    description:
      "Ages or grades, exactly as published. Leave empty if none is published.",
  },
  {
    name: "format",
    label: "Format",
    description: "For example, in-person multi-week enrichment.",
  },
  { name: "location", label: "Location", description: "As published." },
  {
    name: "educator",
    label: "Educator",
    description:
      "The educator named in published material. This does not grant portal access.",
  },
  { name: "dates", label: "Dates", description: "As published, verbatim." },
  {
    name: "schedule",
    label: "Schedule",
    description: "Days and times, as published.",
  },
  {
    name: "duration",
    label: "Duration",
    description: "For example, 8 weeks.",
  },
  {
    name: "sessionLength",
    label: "Session length",
    description: "For example, 90 minutes.",
  },
  {
    name: "price",
    label: "Price presentation",
    description:
      "Exactly as published, including any currency symbol. This is presentation text, not a payment amount — nothing here charges anyone.",
  },
]

function ProgramFactsForm({ program }: { program: AdminProgram }) {
  const [state, formAction, pending] = useActionState(
    saveProgramFactsAction,
    emptyProgramFactsFormState,
  )
  const ids = useId()

  /* On failure the echoed values win, so nothing typed is lost. On success and
     on first render the freshly read row wins, so the form never shows a stale
     copy of what was just saved. */
  const value = (key: keyof ProgramFactsValues): string => {
    if (state.values) return state.values[key]
    const fromRow: Record<keyof ProgramFactsValues, string | null> = {
      name: program.name,
      summary: program.summary,
      audience: program.audience,
      format: program.format,
      location: program.location,
      educator: program.educator,
      dates: program.publishedDates,
      schedule: program.publishedSchedule,
      duration: program.publishedDuration,
      sessionLength: program.publishedSessionLength,
      price: program.publishedPrice,
      availability: program.availability,
      checkoutUrl: program.checkoutUrl,
      confirmationMode: program.confirmationMode,
    }
    return fromRow[key] ?? ""
  }

  const announcement =
    state.status === "saved"
      ? "Program details saved."
      : state.status === "invalid"
        ? "Nothing was saved. Check the highlighted fields below."
        : state.status === "stale"
          ? "Nothing was saved. This program changed while you were editing it."
          : state.status === "notFound"
            ? "Nothing was saved. This program is no longer available."
            : state.status === "forbidden"
              ? "This account is not authorized to change a program."
              : state.status === "unavailable"
                ? "Programs cannot be changed in this environment."
                : state.status === "failed"
                  ? "Nothing was saved. Please try again."
                  : ""

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {state.status === "saved" ? (
        <Alert tone="success" title="Program details saved" live="polite">
          The change is recorded in operations history with your account and the
          time.
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
          title="This program changed while you were editing it"
          live="assertive"
        >
          Nothing was saved, and nobody&rsquo;s work was overwritten. Reload the
          page to see the current details, then make your change again.
        </Alert>
      ) : null}

      {state.status === "notFound" ||
      state.status === "forbidden" ||
      state.status === "unavailable" ||
      state.status === "failed" ? (
        <Alert tone="warning" title="Nothing was saved" live="polite">
          {state.status === "notFound"
            ? "This program is no longer available. Return to the program list."
            : state.status === "forbidden"
              ? "This account is not authorized to change a program."
              : state.status === "unavailable"
                ? "No Supabase project is configured in this environment."
                : "Something went wrong on our side. Please try again."}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-6)]"
      >
        <input type="hidden" name="programId" value={program.id} />
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value={program.updatedAt}
        />

        <Field invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel>Program name</FieldLabel>
          <Input
            key={`name-${value("name")}`}
            name="name"
            type="text"
            autoComplete="off"
            maxLength={PROGRAM_NAME_MAX}
            defaultValue={value("name")}
          />
          <FieldError match={Boolean(state.fieldErrors.name)}>
            {state.fieldErrors.name}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.summary)}>
          {/* Explicit id/htmlFor: Base UI's Field associates its label with a
              REGISTERED Field control, and a native <textarea> is not one, so
              without this the label attaches to nothing — the control has no
              accessible name at all. Same trap, and the same fix, as
              contact-form.tsx and the enrollment drawer's note. axe rates it
              critical ("Form elements must have labels"); it was found by the
              roster slice's axe check on this page, which is the first to
              exercise the program detail form. */}
          <FieldLabel htmlFor={`${ids}-summary`}>Summary</FieldLabel>
          <FieldDescription>
            Required before this program can be published. Use the approved
            published description.
          </FieldDescription>
          <Textarea
            id={`${ids}-summary`}
            key={`summary-${value("summary")}`}
            name="summary"
            rows={4}
            maxLength={SUMMARY_MAX}
            defaultValue={value("summary")}
          />
          <FieldError match={Boolean(state.fieldErrors.summary)}>
            {state.fieldErrors.summary}
          </FieldError>
        </Field>

        <fieldset className="flex flex-col gap-[var(--hsh-space-5)]">
          <legend className="hsh-h4 mb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]">
            Published details
          </legend>
          <p
            id={`${ids}-facts-help`}
            className="hsh-body-sm text-[var(--hsh-text-secondary)]"
          >
            Leave a field empty when Home School Haven does not publish it.
            Families see &ldquo;Contact for details&rdquo; rather than a guess.
          </p>

          <div className="grid grid-cols-1 gap-[var(--hsh-space-5)] lg:grid-cols-2">
            {FACTS.map((fact) => (
              <Field
                key={fact.name}
                invalid={Boolean(state.fieldErrors[fact.name])}
              >
                <FieldLabel>{fact.label}</FieldLabel>
                <FieldDescription>{fact.description}</FieldDescription>
                <Input
                  key={`${fact.name}-${value(fact.name)}`}
                  name={fact.name}
                  type="text"
                  autoComplete="off"
                  maxLength={FACT_MAX}
                  defaultValue={value(fact.name)}
                />
                <FieldError match={Boolean(state.fieldErrors[fact.name])}>
                  {state.fieldErrors[fact.name]}
                </FieldError>
              </Field>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-[var(--hsh-space-3)]">
          <legend className="hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]">
            Availability
          </legend>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            A state, not a number. Home School Haven has not confirmed capacity
            figures, so none is stored or shown.
          </p>
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            {(Object.keys(AVAILABILITY) as (keyof typeof AVAILABILITY)[]).map(
              (option) => (
                <label
                  key={option}
                  className="hsh-body-sm flex min-h-[var(--hsh-touch-target)] cursor-pointer items-center gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] px-[var(--hsh-space-4)] has-[:checked]:border-[var(--hsh-forest-600)] has-[:checked]:bg-[var(--hsh-forest-50)] has-[:focus-visible]:outline-[length:var(--hsh-focus-width)] has-[:focus-visible]:outline-offset-[var(--hsh-focus-offset)] has-[:focus-visible]:outline-[color:var(--hsh-focus)] has-[:focus-visible]:outline-solid"
                >
                  <input
                    type="radio"
                    name="availability"
                    value={option}
                    defaultChecked={value("availability") === option}
                    className="size-4 accent-[var(--hsh-forest-600)]"
                  />
                  <span className="flex flex-col">
                    <span className="font-semibold text-[var(--hsh-text-primary)]">
                      {AVAILABILITY[option].label}
                    </span>
                    <span className="text-[var(--hsh-text-secondary)]">
                      {AVAILABILITY[option].description}
                    </span>
                  </span>
                </label>
              ),
            )}
          </div>
          {/* A plain paragraph, not `FieldError`: this is a radio GROUP, not a
              Base UI `Field.Root`, and a Field part rendered outside one throws
              at render time. It is associated with the group through the
              fieldset rather than through Field's context. */}
          {state.fieldErrors.availability ? (
            <p role="alert" className="hsh-body-sm text-[var(--hsh-error)]">
              {state.fieldErrors.availability}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-[var(--hsh-space-3)]">
          <legend className="hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]">
            How registrations are confirmed
          </legend>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            MPS-RUL-001 gives every program one of these two modes. Neither one
            confirms an enrollment: confirmation comes from Home School Haven
            verifying the outcome, and only from that.
          </p>
          <div className="flex flex-col gap-[var(--hsh-space-2)]">
            {(
              Object.keys(
                CONFIRMATION_MODE,
              ) as (keyof typeof CONFIRMATION_MODE)[]
            ).map((option) => (
              <label
                key={option}
                className="hsh-body-sm flex min-h-[var(--hsh-touch-target)] cursor-pointer items-center gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)] has-[:checked]:border-[var(--hsh-forest-600)] has-[:checked]:bg-[var(--hsh-forest-50)] has-[:focus-visible]:outline-[length:var(--hsh-focus-width)] has-[:focus-visible]:outline-offset-[var(--hsh-focus-offset)] has-[:focus-visible]:outline-[color:var(--hsh-focus)] has-[:focus-visible]:outline-solid"
              >
                <input
                  type="radio"
                  name="confirmationMode"
                  value={option}
                  defaultChecked={value("confirmationMode") === option}
                  className="size-4 accent-[var(--hsh-forest-600)]"
                />
                <span className="flex flex-col">
                  <span className="font-semibold text-[var(--hsh-text-primary)]">
                    {CONFIRMATION_MODE[option].label}
                  </span>
                  <span className="text-[var(--hsh-text-secondary)]">
                    {CONFIRMATION_MODE[option].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {/* A plain paragraph for the same reason the availability group uses
              one: this is a radio group, not a Base UI `Field.Root`. */}
          {state.fieldErrors.confirmationMode ? (
            <p role="alert" className="hsh-body-sm text-[var(--hsh-error)]">
              {state.fieldErrors.confirmationMode}
            </p>
          ) : null}
        </fieldset>

        <Field invalid={Boolean(state.fieldErrors.checkoutUrl)}>
          <FieldLabel>External checkout link</FieldLabel>
          <FieldDescription>
            The program&rsquo;s own https://{CHECKOUT_HOST} address. Leaving for
            checkout is a handoff: it is not payment and it is not enrollment.
            Do not add anything after a ? or # — nothing about a family may
            travel in this link.
          </FieldDescription>
          <Input
            key={`checkoutUrl-${value("checkoutUrl")}`}
            name="checkoutUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={CHECKOUT_URL_MAX}
            defaultValue={value("checkoutUrl")}
            placeholder={`https://${CHECKOUT_HOST}/…`}
          />
          <FieldError match={Boolean(state.fieldErrors.checkoutUrl)}>
            {state.fieldErrors.checkoutUrl}
          </FieldError>
        </Field>

        <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row">
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Saving…" : "Save program details"}
          </Button>
          <Button
            variant="quiet"
            size="md"
            render={<Link href="/admin/programs" />}
          >
            Back to programs
          </Button>
        </div>
      </form>
    </div>
  )
}

export { ProgramFactsForm }
