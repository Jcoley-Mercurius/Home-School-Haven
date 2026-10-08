"use client"

import { useId } from "react"
import { CircleAlert } from "lucide-react"

import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Radio, RadioGroup, RadioRow } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { describedBy, errorId } from "./registration-context"

/**
 * The registration form's field scaffolding, composed from the MDS primitives.
 *
 * COMPOSE, not CREATE: every control is the approved Input, Textarea, Radio, or
 * Checkbox, and every message uses the approved type roles and the Error token
 * with an icon, so no state rests on colour (DESIGN-SYSTEM §10).
 *
 * The ids are explicit rather than generated because the error summary links to
 * them, and a link needs a target it can name before the field renders.
 */

/** An inline field error, associated with its control by id. */
export function InlineError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p
      id={errorId(id)}
      className="hsh-body-sm flex gap-[var(--hsh-space-2)] text-[var(--hsh-error)]"
    >
      <CircleAlert
        aria-hidden="true"
        className="mt-[3px] size-4 shrink-0"
        strokeWidth={1.75}
      />
      <span>{message}</span>
    </p>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  optional = false,
  maxLength,
  type = "text",
  autoComplete = "off",
  inputMode,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  optional?: boolean
  maxLength: number
  type?: "text" | "tel" | "email"
  autoComplete?: string
  inputMode?: "tel" | "email" | "text"
  disabled?: boolean
}) {
  const hintId = `${id}-hint`
  return (
    <div className="flex flex-col gap-[var(--hsh-space-2)]">
      <label htmlFor={id} className="hsh-label text-[var(--hsh-text-primary)]">
        {label}
        {optional ? (
          <span className="font-normal text-[var(--hsh-text-muted)]">
            {" "}
            (optional)
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="hsh-body-sm text-[var(--hsh-text-muted)]">
          {hint}
        </p>
      ) : null}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        aria-required={optional ? undefined : true}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && hintId, error && errorId(id))}
        className="aria-invalid:border-[var(--hsh-error)]"
      />
      <InlineError id={id} message={error} />
    </div>
  )
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  maxLength: number
  disabled?: boolean
}) {
  const hintId = `${id}-hint`
  return (
    <div className="flex flex-col gap-[var(--hsh-space-2)]">
      <label htmlFor={id} className="hsh-label text-[var(--hsh-text-primary)]">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="hsh-body-sm text-[var(--hsh-text-muted)]">
          {hint}
        </p>
      ) : null}
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        maxLength={maxLength}
        rows={3}
        disabled={disabled}
        aria-required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && hintId, error && errorId(id))}
      />
      <InlineError id={id} message={error} />
    </div>
  )
}

export type ChoiceOption = { value: string; label: string }

/**
 * A radio group in a fieldset with a legend.
 *
 * `value` "" means no answer: neither option is checked, and nothing is
 * preselected (DEC-026, DEC-030). The fieldset carries `id` so an error link can
 * land on the group; `focusField` then moves focus to its checked or first
 * radio.
 */
export function ChoiceField({
  id,
  legend,
  legendClassName,
  hint,
  options,
  value,
  onChange,
  error,
  controls,
  disabled,
  orientation = "vertical",
}: {
  id: string
  legend: React.ReactNode
  legendClassName?: string
  hint?: React.ReactNode
  options: ChoiceOption[]
  value: string
  onChange: (value: string) => void
  error?: string
  /** The id of a region this choice reveals (conditional details). */
  controls?: string
  disabled?: boolean
  orientation?: "vertical" | "horizontal"
}) {
  const legendId = `${id}-legend`
  const hintId = `${id}-hint`
  const uid = useId()
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-[var(--hsh-space-2)] outline-none"
    >
      <legend
        id={legendId}
        className={cn(
          "hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]",
          legendClassName,
        )}
      >
        {legend}
      </legend>
      {hint ? (
        <p id={hintId} className="hsh-body-sm text-[var(--hsh-text-muted)]">
          {hint}
        </p>
      ) : null}
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(String(next))}
        aria-labelledby={legendId}
        aria-describedby={describedBy(
          hint ? hintId : null,
          error && errorId(id),
        )}
        aria-invalid={error ? true : undefined}
        aria-required
        disabled={disabled}
        className={cn(
          orientation === "horizontal" &&
            "flex-row flex-wrap gap-x-[var(--hsh-space-6)]",
        )}
      >
        {options.map((option) => (
          <RadioRow
            key={option.value}
            className="text-[var(--hsh-text-primary)]"
          >
            <Radio
              value={option.value}
              aria-controls={
                controls && option.value === "yes" ? controls : undefined
              }
              /* Named by its own text. The wrapping label makes the whole
                 44 px row clickable; this makes the name explicit. */
              aria-labelledby={`${uid}-${option.value}`}
            />
            <span id={`${uid}-${option.value}`}>{option.label}</span>
          </RadioRow>
        ))}
      </RadioGroup>
      <InlineError id={id} message={error} />
    </fieldset>
  )
}

/** A single checkbox with its own label, for an acknowledgment or affirmation. */
export function CheckField({
  id,
  label,
  checked,
  onChange,
  error,
  disabled,
}: {
  id: string
  label: React.ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string
  disabled?: boolean
}) {
  const labelId = `${id}-label`
  return (
    <div
      id={id}
      tabIndex={-1}
      className="flex flex-col gap-[var(--hsh-space-1)] outline-none"
    >
      <CheckboxRow className="items-start py-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]">
        <Checkbox
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId(id) : undefined}
          className="mt-[2px]"
        />
        <span id={labelId}>{label}</span>
      </CheckboxRow>
      <InlineError id={id} message={error} />
    </div>
  )
}

/**
 * Moves focus to a field by id. A group container (fieldset, or a checkbox or
 * radio wrapper) hands focus to its checked or first control, so a keyboard
 * user lands where they can act.
 */
export function focusField(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  const tag = el.tagName
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "BUTTON" ||
    tag === "A"
  ) {
    el.focus()
    return true
  }
  const target =
    el.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
    el.querySelector<HTMLElement>(
      '[role="radio"]:not([aria-disabled="true"]), [role="checkbox"]:not([aria-disabled="true"]), input:not([type="hidden"]):not([tabindex="-1"]), textarea, button:not([disabled])',
    )
  ;(target ?? el).focus()
  return true
}
