"use client"

import { Check, CircleAlert, Circle } from "lucide-react"

import { STEPS, type StepNumber } from "@/lib/registration/form"
import { cn } from "@/lib/utils"

/**
 * The registration progress and review rail (MDS DESIGN-SYSTEM §9.1
 * "Responsive"; `patterns.forms` "progress when multi-step").
 *
 * On desktop and wide it is the 4-column sticky rail beside the 8-column form.
 * Below 1024 px it renders in normal flow after the step, as the detail action
 * rail does (§8). Each step shows its state with an icon and a word, so none
 * depends on colour. A step the parent has reached is a button that returns to
 * it. Later steps are plain text: a step that was never opened cannot be edited
 * yet, and a link that goes nowhere useful would be a dead end.
 */
export type StepStatus = "complete" | "current" | "attention" | "upcoming"

const STATUS = {
  complete: { icon: Check, word: "Done" },
  current: { icon: Circle, word: "Current step" },
  attention: { icon: CircleAlert, word: "Needs attention" },
  upcoming: { icon: Circle, word: "Not started" },
} as const

export function ProgressRail({
  current,
  statusOf,
  reachable,
  onSelect,
  summary,
  disabled,
}: {
  current: StepNumber
  statusOf: (step: StepNumber) => StepStatus
  reachable: (step: StepNumber) => boolean
  onSelect: (step: StepNumber) => void
  summary: string
  disabled: boolean
}) {
  return (
    <aside
      aria-labelledby="reg-progress-heading"
      className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] lg:sticky lg:top-[96px]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-1)]">
        <h2
          id="reg-progress-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Your registration
        </h2>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          {summary}
        </p>
      </div>
      <ol className="flex flex-col">
        {STEPS.map((name, i) => {
          const step = (i + 1) as StepNumber
          const status = statusOf(step)
          const { icon: Icon, word } = STATUS[status]
          const content = (
            <>
              <Icon
                aria-hidden="true"
                strokeWidth={1.75}
                className={cn(
                  "size-5 shrink-0",
                  status === "complete" && "text-[var(--hsh-success)]",
                  status === "attention" && "text-[var(--hsh-error)]",
                  status === "current" &&
                    "fill-[var(--hsh-forest-600)] text-[var(--hsh-forest-600)]",
                  status === "upcoming" && "text-[var(--hsh-neutral-400)]",
                )}
              />
              <span className="flex min-w-0 flex-col text-left">
                <span
                  className={cn(
                    "hsh-body-sm",
                    step === current
                      ? "font-semibold text-[var(--hsh-text-primary)]"
                      : "text-[var(--hsh-text-secondary)]",
                  )}
                >
                  {step}. {name}
                </span>
                <span className="hsh-caption text-[var(--hsh-text-muted)]">
                  {word}
                </span>
              </span>
            </>
          )
          return (
            <li key={name}>
              {reachable(step) && step !== current ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(step)}
                  className="flex min-h-[var(--hsh-touch-target)] w-full items-center gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-control)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)] outline-none hover:bg-[var(--hsh-forest-50)] focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-solid disabled:opacity-50"
                >
                  {content}
                  <span className="sr-only">, go to this step</span>
                </button>
              ) : (
                <div
                  aria-current={step === current ? "step" : undefined}
                  className={cn(
                    "flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-control)] px-[var(--hsh-space-2)] py-[var(--hsh-space-1)]",
                    step === current && "bg-[var(--hsh-forest-50)]",
                  )}
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
