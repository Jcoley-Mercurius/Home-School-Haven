"use client"

import { Plus } from "lucide-react"

import { EmptyState } from "@/components/family/section-states"
import { Button } from "@/components/ui/button"
import {
  emptyChild,
  emptySelection,
  fieldId,
  LIMITS,
  type ChildDraft,
  type YesNo,
} from "@/lib/registration/form"

import { ChildCard } from "./child-card"
import { ChoiceField, TextAreaField, TextField } from "./fields"
import { useRegistration } from "./registration-context"

/**
 * Step 4: who each child is, and the three health questions (DEC-026).
 *
 * Each answer is an explicit Yes or No with neither preselected. A blank is an
 * unanswered question, never a No. The details box is inserted directly after
 * its question, only after Yes, and is announced when it appears. If the answer
 * goes back to No, the box is hidden and its text is kept in this page's memory
 * so an accidental click loses nothing, but hidden text is never submitted
 * (`draftToInput`). Nothing here is copied to the student profile.
 */

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
]

const HEALTH = [
  {
    answer: "allergies",
    details: "allergyDetails",
    question: "Does this child have any allergies?",
    detailsLabel:
      "Describe the allergies and what to do if there is a reaction",
    name: "Allergy details",
  },
  {
    answer: "medical",
    details: "medicalDetails",
    question: "Does this child have any medical needs?",
    detailsLabel:
      "Describe the medical needs Home School Haven should know about",
    name: "Medical details",
  },
  {
    answer: "accommodation",
    details: "accommodationDetails",
    question: "Does this child need any accommodations?",
    detailsLabel: "Describe the accommodations that help this child",
    name: "Accommodation details",
  },
] as const

function healthSummary(child: ChildDraft): string {
  const answered = [child.allergies, child.medical, child.accommodation].filter(
    Boolean,
  ).length
  return `Health questions: ${answered} of 3 answered`
}

function ChildDetails({ child }: { child: ChildDraft }) {
  const { students, updateChild, errorFor, announce, busy } = useRegistration()
  const set = <K extends keyof ChildDraft>(field: K, value: ChildDraft[K]) =>
    updateChild(child.key, (c) => ({ ...c, [field]: value }))

  const whoValue =
    child.source === "existing"
      ? child.studentId
      : child.source === "new"
        ? "new"
        : ""

  return (
    <>
      {students.length > 0 ? (
        <ChoiceField
          id={fieldId.child(child.key, "who")}
          legend="Which child is this?"
          hint="Choose a child already on your family profile, or add a new one."
          options={[
            ...students.map((s) => ({ value: s.id, label: s.preferredName })),
            { value: "new", label: "A child who is not listed here" },
          ]}
          value={whoValue}
          onChange={(value) =>
            updateChild(child.key, (c) =>
              value === "new"
                ? { ...c, source: "new", studentId: "" }
                : { ...c, source: "existing", studentId: value },
            )
          }
          error={errorFor(fieldId.child(child.key, "who"))}
          disabled={busy}
        />
      ) : null}

      {child.source === "new" ? (
        <div className="grid grid-cols-1 gap-[var(--hsh-space-4)] sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id={fieldId.child(child.key, "preferredName")}
              label="Preferred name"
              hint="The name your family uses day to day."
              value={child.preferredName}
              onChange={(v) => set("preferredName", v)}
              error={errorFor(fieldId.child(child.key, "preferredName"))}
              maxLength={LIMITS.studentName}
              disabled={busy}
            />
          </div>
          <TextField
            id={fieldId.child(child.key, "gradeLevel")}
            label="Grade level"
            optional
            value={child.gradeLevel}
            onChange={(v) => set("gradeLevel", v)}
            error={errorFor(fieldId.child(child.key, "gradeLevel"))}
            maxLength={LIMITS.shortText}
            disabled={busy}
          />
          <TextField
            id={fieldId.child(child.key, "relationship")}
            label="Your relationship to this child"
            optional
            value={child.relationship}
            onChange={(v) => set("relationship", v)}
            error={errorFor(fieldId.child(child.key, "relationship"))}
            maxLength={LIMITS.shortText}
            disabled={busy}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-[var(--hsh-space-5)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-5)]">
        <h4 className="hsh-h4 text-[var(--hsh-text-primary)]">
          Health and support
        </h4>
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Answer each question Yes or No. Home School Haven uses these answers
          to care for your child. Only the allergy answer and details are shared
          with your child&rsquo;s assigned educators.
        </p>
        {HEALTH.map((h) => {
          const regionId = `${fieldId.child(child.key, h.details)}-region`
          const answer = child[h.answer]
          return (
            <div
              key={h.answer}
              className="flex flex-col gap-[var(--hsh-space-3)]"
            >
              <ChoiceField
                id={fieldId.child(child.key, h.answer)}
                legend={h.question}
                options={YES_NO}
                value={answer}
                orientation="horizontal"
                controls={regionId}
                onChange={(value) => {
                  const next = value as YesNo
                  set(h.answer, next)
                  if (next === "yes" && answer !== "yes") {
                    announce(`${h.name} field added below.`)
                  } else if (next === "no" && answer === "yes") {
                    announce(
                      `${h.name} hidden. They will not be sent while the answer is No.`,
                    )
                  }
                }}
                error={errorFor(fieldId.child(child.key, h.answer))}
                disabled={busy}
              />
              <div id={regionId} hidden={answer !== "yes"}>
                <TextAreaField
                  id={fieldId.child(child.key, h.details)}
                  label={h.detailsLabel}
                  value={child[h.details]}
                  onChange={(v) => set(h.details, v)}
                  error={errorFor(fieldId.child(child.key, h.details))}
                  maxLength={LIMITS.healthText}
                  disabled={busy}
                />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function ChildrenStep({
  initialProgramId,
}: {
  initialProgramId: string | null
}) {
  const {
    draft,
    update,
    students,
    announce,
    focusLater,
    nextKey,
    setExpanded,
    errorFor,
    busy,
  } = useRegistration()

  const addChild = () => {
    const key = nextKey()
    const child = emptyChild(key, students.length > 0)
    /* A program chosen on the program page arrives as a public slug, already
       matched to the catalog. It preselects that program for the first child
       only; the parent can still change it on the next step. */
    if (draft.children.length === 0 && initialProgramId) {
      child.selections = [emptySelection(initialProgramId)]
    }
    update((d) => ({ ...d, children: [...d.children, child] }))
    setExpanded(key, true)
    announce(`Child ${draft.children.length + 1} added.`)
    focusLater(
      students.length > 0
        ? fieldId.child(key, "who")
        : fieldId.child(key, "preferredName"),
    )
  }

  const atLimit = draft.children.length >= LIMITS.children
  const addError = errorFor(fieldId.addChild)

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        Add each child you are registering. You will choose their programs on
        the next step.
      </p>

      {draft.children.length === 0 ? (
        <EmptyState title="No children added yet">
          <p>
            Add the first child you are registering. You can add up to{" "}
            {LIMITS.children} children in one registration.
          </p>
          <Button
            id={fieldId.addChild}
            variant="primary"
            size="md"
            onClick={addChild}
            disabled={busy}
            aria-describedby={
              addError ? `${fieldId.addChild}-error` : undefined
            }
          >
            <Plus aria-hidden="true" strokeWidth={1.75} />
            Add a child
          </Button>
          {addError ? (
            <p
              id={`${fieldId.addChild}-error`}
              className="hsh-body-sm text-[var(--hsh-error)]"
            >
              {addError}
            </p>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <ol className="flex flex-col gap-[var(--hsh-space-5)]">
            {draft.children.map((child, index) => (
              <li key={child.key}>
                <ChildCard
                  child={child}
                  index={index}
                  step={4}
                  summary={healthSummary(child)}
                  removable
                >
                  <ChildDetails child={child} />
                </ChildCard>
              </li>
            ))}
          </ol>
          {atLimit ? (
            <p
              id={fieldId.addChild}
              tabIndex={-1}
              className="hsh-body-sm text-[var(--hsh-text-muted)] outline-none"
            >
              One registration takes up to {LIMITS.children} children. Submit
              this one, then start another for more.
            </p>
          ) : (
            <Button
              id={fieldId.addChild}
              variant="secondary"
              size="md"
              className="self-start"
              onClick={addChild}
              disabled={busy}
            >
              <Plus aria-hidden="true" strokeWidth={1.75} />
              Add another child
            </Button>
          )}
        </>
      )}
    </div>
  )
}
