"use client"

import { CalendarDays } from "lucide-react"

import { AvailabilityBadge } from "@/components/program/availability-badge"
import { Checkbox, CheckboxRow } from "@/components/ui/checkbox"
import { contact } from "@/content/foundation-content"
import type { AttendanceDay } from "@/lib/registration/contract"
import {
  attendanceRequirement,
  childHeading,
  emptySelection,
  fieldId,
  formatDays,
  LIMITS,
  selectability,
  type CatalogProgram,
  type ChildDraft,
  type SelectionDraft,
} from "@/lib/registration/form"
import { OFFERING_GROUPS, OFFERING_ORDER } from "@/lib/programs/offering-groups"

import { ChildCard } from "./child-card"
import { ChoiceField, InlineError } from "./fields"
import { describedBy, errorId, useRegistration } from "./registration-context"

/**
 * Step 5: programs and attendance, inside each child's card (DEC-032; MDS
 * DESIGN-SYSTEM §9.1 "Attendance, per selection").
 *
 * What a selection asks for comes from the program's stored attendance rule,
 * not from its published schedule text:
 *
 *   * fixed: the configured days, as read-only text. No control, because the
 *     family has nothing to choose and the database refuses any day sent.
 *   * a plan (Haven Days): the one-, two-, or three-day plan first, then that
 *     many of the available days.
 *   * choose (Tutoring): at least one of the available days.
 *   * no rule: shown, marked, and not selectable.
 *
 * Programs are grouped by offering, so Haven Days never reads as one class
 * among many (DEC-024). A mismatch is reported on the selection and never
 * corrected for the parent: a plan change leaves the chosen days alone.
 */

function DayChecks({
  id,
  legend,
  hint,
  days,
  chosen,
  onChange,
  error,
  disabled,
}: {
  id: string
  legend: string
  hint: string
  days: AttendanceDay[]
  chosen: AttendanceDay[]
  onChange: (days: AttendanceDay[]) => void
  error?: string
  disabled?: boolean
}) {
  const hintId = `${id}-hint`
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-[var(--hsh-space-1)] outline-none"
    >
      <legend className="hsh-label mb-[var(--hsh-space-1)] text-[var(--hsh-text-primary)]">
        {legend}
      </legend>
      <p id={hintId} className="hsh-body-sm text-[var(--hsh-text-muted)]">
        {hint}
      </p>
      <div className="flex flex-wrap gap-x-[var(--hsh-space-6)]">
        {days.map((day) => {
          const labelId = `${id}-${day}`
          return (
            <CheckboxRow key={day} className="text-[var(--hsh-text-primary)]">
              <Checkbox
                checked={chosen.includes(day)}
                onCheckedChange={(next) =>
                  onChange(
                    next
                      ? [...chosen.filter((d) => d !== day), day]
                      : chosen.filter((d) => d !== day),
                  )
                }
                disabled={disabled}
                aria-labelledby={labelId}
                aria-describedby={describedBy(hintId, error && errorId(id))}
                aria-invalid={error ? true : undefined}
              />
              <span id={labelId}>{formatDays([day])}</span>
            </CheckboxRow>
          )
        })}
      </div>
      <InlineError id={id} message={error} />
    </fieldset>
  )
}

function Attendance({
  child,
  program,
  selection,
}: {
  child: ChildDraft
  program: CatalogProgram
  selection: SelectionDraft
}) {
  const { updateChild, errorFor, busy } = useRegistration()
  const need = attendanceRequirement(program)

  const setSelection = (change: Partial<SelectionDraft>) =>
    updateChild(child.key, (c) => ({
      ...c,
      selections: c.selections.map((s) =>
        s.programId === program.id ? { ...s, ...change } : s,
      ),
    }))

  if (need.kind === "fixed") {
    return (
      <p className="hsh-body-sm flex items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
        <CalendarDays
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={1.75}
        />
        Meets {formatDays(need.days)}. There are no days to choose.
      </p>
    )
  }

  if (need.kind === "plan") {
    const plan = Number(selection.plan)
    return (
      <div className="flex flex-col gap-[var(--hsh-space-4)]">
        <ChoiceField
          id={fieldId.plan(child.key, program.id)}
          legend={`How many days a week for ${program.name}?`}
          options={need.plans.map((n) => ({
            value: String(n),
            label: n === 1 ? "1 day a week" : `${n} days a week`,
          }))}
          value={selection.plan}
          onChange={(value) => setSelection({ plan: value })}
          error={errorFor(fieldId.plan(child.key, program.id))}
          orientation="horizontal"
          disabled={busy}
        />
        {need.plans.includes(plan) ? (
          <DayChecks
            id={fieldId.days(child.key, program.id)}
            legend={`Which days for ${program.name}?`}
            hint={`Choose ${plan} ${plan === 1 ? "day" : "days"}.`}
            days={need.days}
            chosen={selection.days}
            onChange={(days) => setSelection({ days })}
            error={errorFor(fieldId.days(child.key, program.id))}
            disabled={busy}
          />
        ) : null}
      </div>
    )
  }

  if (need.kind === "choose") {
    return (
      <DayChecks
        id={fieldId.days(child.key, program.id)}
        legend={`Which days for ${program.name}?`}
        hint="Choose at least one day."
        days={need.days}
        chosen={selection.days}
        onChange={(days) => setSelection({ days })}
        error={errorFor(fieldId.days(child.key, program.id))}
        disabled={busy}
      />
    )
  }

  return null
}

function ProgramOption({
  child,
  program,
}: {
  child: ChildDraft
  program: CatalogProgram
}) {
  const { updateChild, busy } = useRegistration()
  const status = selectability(program)
  const selection = child.selections.find((s) => s.programId === program.id)
  const atLimit = child.selections.length >= LIMITS.selections && !selection
  const labelId = `reg-child-${child.key}-program-${program.id}-label`
  const noteId = `reg-child-${child.key}-program-${program.id}-note`

  return (
    <li className="flex flex-col gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] py-[var(--hsh-space-3)] first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-[var(--hsh-space-4)] gap-y-[var(--hsh-space-2)]">
        <CheckboxRow className="items-start text-[var(--hsh-text-primary)]">
          <Checkbox
            checked={Boolean(selection)}
            disabled={busy || status !== "selectable" || atLimit}
            onCheckedChange={(next) =>
              updateChild(child.key, (c) => ({
                ...c,
                selections: next
                  ? [...c.selections, emptySelection(program.id)]
                  : c.selections.filter((s) => s.programId !== program.id),
              }))
            }
            aria-labelledby={labelId}
            aria-describedby={noteId}
            className="mt-[12px]"
          />
          <span className="flex flex-col py-[var(--hsh-space-2)]">
            <span id={labelId} className="font-semibold">
              {program.name}
            </span>
            <span
              id={noteId}
              className="hsh-body-sm text-[var(--hsh-text-secondary)]"
            >
              {status === "unconfigured"
                ? `Attendance days are not set up for this program yet, so it cannot be registered online. Call ${contact.phone} to register.`
                : status === "closed"
                  ? "Registration is closed for this program."
                  : (program.publishedSchedule ?? "Schedule not published.")}
            </span>
          </span>
        </CheckboxRow>
        <AvailabilityBadge
          state={status === "unconfigured" ? "unknown" : program.availability}
        />
      </div>
      {selection ? (
        <div className="ml-[var(--hsh-space-8)] flex flex-col gap-[var(--hsh-space-3)]">
          <Attendance child={child} program={program} selection={selection} />
        </div>
      ) : null}
    </li>
  )
}

function ChildPrograms({ child }: { child: ChildDraft }) {
  const { catalog, students, errorFor } = useRegistration()
  const id = fieldId.child(child.key, "programs")
  const error = errorFor(id)
  const groups = OFFERING_ORDER.map((type) => ({
    type,
    heading: OFFERING_GROUPS[type].heading,
    programs: catalog.programs.filter((p) => p.offeringType === type),
  })).filter((g) => g.programs.length > 0)
  const ungrouped = catalog.programs.filter((p) => !p.offeringType)

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-[var(--hsh-space-4)] outline-none"
      aria-describedby={error ? errorId(id) : undefined}
    >
      <legend className="hsh-label mb-[var(--hsh-space-2)] text-[var(--hsh-text-primary)]">
        Programs for {childHeading(child, students)}
      </legend>
      <InlineError id={id} message={error} />
      {[
        ...groups,
        ...(ungrouped.length
          ? [{ type: "other", heading: "Other programs", programs: ungrouped }]
          : []),
      ].map((group) => (
        <div key={group.type} className="flex flex-col">
          <h4 className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
            {group.heading}
          </h4>
          <ul className="flex flex-col">
            {group.programs.map((program) => (
              <ProgramOption key={program.id} child={child} program={program} />
            ))}
          </ul>
        </div>
      ))}
    </fieldset>
  )
}

export function ProgramsStep() {
  const { draft, catalog } = useRegistration()

  const summary = (child: ChildDraft) => {
    const names = child.selections
      .map((s) => catalog.programs.find((p) => p.id === s.programId)?.name)
      .filter(Boolean)
    return names.length
      ? `Programs: ${names.join(", ")}`
      : "No programs chosen yet"
  }

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        Choose each child&rsquo;s programs. Programs that meet on set days show
        those days. Haven Days and Tutoring ask which days your child will
        attend.
      </p>
      <ol className="flex flex-col gap-[var(--hsh-space-5)]">
        {draft.children.map((child, index) => (
          <li key={child.key}>
            <ChildCard
              child={child}
              index={index}
              step={5}
              summary={summary(child)}
            >
              <ChildPrograms child={child} />
            </ChildCard>
          </li>
        ))}
      </ol>
    </div>
  )
}
