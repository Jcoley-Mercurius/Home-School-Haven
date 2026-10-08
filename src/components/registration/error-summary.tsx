"use client"

import { CircleAlert } from "lucide-react"

import type { FormError } from "@/lib/registration/form"

/**
 * The validation error summary (MDS DESIGN-SYSTEM §9.1 "Validation error";
 * `patterns.error`).
 *
 * An alert region at the top of the current step, headed by a sentence that
 * says nothing was sent, listing each problem as a link to its field. The
 * orchestrator moves focus to the heading when the summary appears. Activating
 * a link switches to that field's step, expands a collapsed child card, and
 * focuses the field. Every value the parent entered is kept.
 */
export const ERROR_SUMMARY_HEADING_ID = "reg-error-summary-heading"

export function ErrorSummary({
  title,
  errors,
  onSelect,
}: {
  title: string
  errors: FormError[]
  onSelect: (error: FormError) => void
}) {
  return (
    <div
      role="alert"
      aria-labelledby={ERROR_SUMMARY_HEADING_ID}
      className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-coral-500)] bg-[var(--hsh-coral-100)] p-[var(--hsh-space-5)]"
    >
      <CircleAlert
        aria-hidden="true"
        className="mt-[4px] size-5 shrink-0 text-[var(--hsh-error)]"
        strokeWidth={1.75}
      />
      <div className="flex min-w-0 flex-col gap-[var(--hsh-space-3)]">
        <h2
          id={ERROR_SUMMARY_HEADING_ID}
          tabIndex={-1}
          className="hsh-h4 text-[var(--hsh-text-primary)] outline-none focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid"
        >
          {title}
        </h2>
        {errors.length ? (
          <ul className="flex flex-col gap-[var(--hsh-space-1)]">
            {errors.map((error) => (
              <li key={`${error.id}-${error.message}`}>
                <a
                  href={`#${error.id}`}
                  data-inline-link="true"
                  onClick={(event) => {
                    event.preventDefault()
                    onSelect(error)
                  }}
                  className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
