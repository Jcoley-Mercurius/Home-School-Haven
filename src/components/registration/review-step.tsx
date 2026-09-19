"use client"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  attendanceRequirement,
  childHeading,
  DOCUMENT_NAMES,
  formatDays,
  stepName,
  type ChildDraft,
  type StepNumber,
  type YesNo,
} from "@/lib/registration/form"

import { useRegistration } from "./registration-context"

/**
 * Step 8: a read-only summary, grouped by section, each group with its own Edit
 * action (MDS DESIGN-SYSTEM §9.1 "Review and submit").
 *
 * It shows what the form will send, including that hidden health details are
 * NOT sent: an answer of No reads "No" whatever text was typed before it.
 */

function Group({
  step,
  children,
}: {
  step: StepNumber
  children: React.ReactNode
}) {
  const { goToStep, busy } = useRegistration()
  const headingId = `reg-review-${step}-heading`
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] py-[var(--hsh-space-5)] first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
        <h3 id={headingId} className="hsh-h4 text-[var(--hsh-text-primary)]">
          {stepName(step)}
        </h3>
        <Button
          variant="text"
          size="md"
          disabled={busy}
          onClick={() => goToStep(step)}
        >
          <Pencil aria-hidden="true" strokeWidth={1.75} />
          Edit
          <span className="sr-only"> {stepName(step).toLowerCase()}</span>
        </Button>
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-[var(--hsh-space-6)] gap-y-[var(--hsh-space-2)] sm:grid-cols-[minmax(10rem,auto)_1fr]">
      {rows.map(([term, detail], i) => (
        <div key={i} className="contents">
          <dt className="hsh-label text-[var(--hsh-text-secondary)]">{term}</dt>
          <dd className="hsh-body break-words text-[var(--hsh-text-primary)]">
            {detail}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function answer(value: YesNo, details: string): string {
  if (value === "yes") return `Yes — ${details.trim()}`
  if (value === "no") return "No"
  return "Not answered"
}

function blankAs(value: string, fallback = "Not given"): string {
  return value.trim() || fallback
}

export function ReviewStep() {
  const { draft, catalog, students } = useRegistration()

  const selectionsFor = (child: ChildDraft) =>
    child.selections.map((s) => {
      const program = catalog.programs.find((p) => p.id === s.programId)
      if (!program) return "A program that is no longer listed"
      const need = attendanceRequirement(program)
      if (need.kind === "fixed") {
        return `${program.name} — meets ${formatDays(need.days)}`
      }
      if (need.kind === "plan") {
        const plan = s.plan
          ? `${s.plan} ${s.plan === "1" ? "day" : "days"} a week`
          : "plan not chosen"
        return `${program.name} — ${plan}${s.days.length ? `: ${formatDays(s.days)}` : ""}`
      }
      return `${program.name} — ${s.days.length ? formatDays(s.days) : "no days chosen"}`
    })

  return (
    <div id="reg-review" tabIndex={-1} className="flex flex-col outline-none">
      <p className="hsh-body pb-[var(--hsh-space-5)] text-[var(--hsh-text-secondary)]">
        Check everything below. Nothing has been sent yet. When you submit, Home
        School Haven records the whole registration at once.
      </p>

      <Group step={1}>
        {draft.guardians.map((g, i) => (
          <Rows
            key={g.key}
            rows={[
              [
                i === 0 ? "You" : `Parent or guardian ${i + 1}`,
                blankAs(g.fullName),
              ],
              ["Phone", blankAs(g.phone)],
              ["Email", blankAs(g.email)],
              ["Relationship", blankAs(g.relationship)],
            ]}
          />
        ))}
      </Group>

      <Group step={2}>
        <Rows
          rows={draft.emergencies.map((p, i) => [
            `Emergency contact ${i + 1}`,
            `${blankAs(p.fullName)} (${blankAs(p.relationship, "relationship not given")}) · ${blankAs(p.phone)}`,
          ])}
        />
      </Group>

      <Group step={3}>
        <Rows
          rows={draft.pickups.map((p, i) => [
            `Pickup person ${i + 1}`,
            `${blankAs(p.fullName)} (${blankAs(p.relationship, "relationship not given")})${p.phone.trim() ? ` · ${p.phone.trim()}` : ""}`,
          ])}
        />
      </Group>

      <Group step={4}>
        {draft.children.length === 0 ? (
          <p className="hsh-body text-[var(--hsh-text-muted)]">
            No children added.
          </p>
        ) : (
          draft.children.map((child) => (
            <Rows
              key={child.key}
              rows={[
                [
                  "Child",
                  `${childHeading(child, students)}${child.source === "new" ? " (new profile)" : ""}`,
                ],
                ["Allergies", answer(child.allergies, child.allergyDetails)],
                ["Medical needs", answer(child.medical, child.medicalDetails)],
                [
                  "Accommodations",
                  answer(child.accommodation, child.accommodationDetails),
                ],
              ]}
            />
          ))
        )}
      </Group>

      <Group step={5}>
        {draft.children.map((child) => (
          <Rows
            key={child.key}
            rows={[
              [
                childHeading(child, students),
                child.selections.length ? (
                  <ul className="flex flex-col gap-[var(--hsh-space-1)]">
                    {selectionsFor(child).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  "No programs chosen"
                ),
              ],
            ]}
          />
        ))}
      </Group>

      <Group step={6}>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Payment happens on Home School Haven&rsquo;s own checkout page, after
          you submit and only for programs that are ready for it. Submitting
          this form is not payment and does not confirm enrollment.
        </p>
      </Group>

      <Group step={7}>
        <Rows
          rows={[
            [
              DOCUMENT_NAMES.liability_waiver,
              draft.waiverSignature.trim()
                ? `Signed as “${draft.waiverSignature.trim()}”`
                : "Not signed",
            ],
            [
              DOCUMENT_NAMES.code_of_conduct,
              draft.conductSignature.trim()
                ? `Signed as “${draft.conductSignature.trim()}”`
                : "Not signed",
            ],
            [
              DOCUMENT_NAMES.parent_handbook,
              draft.handbookAcknowledged ? "Acknowledged" : "Not acknowledged",
            ],
            ...draft.children.map((child): [string, string] => [
              `Photos and videos: ${childHeading(child, students)}`,
              child.media === "yes"
                ? "Yes, permission given"
                : child.media === "no"
                  ? "No, permission not given"
                  : "Not answered",
            ]),
            [
              "Parent or guardian",
              draft.authorityAffirmed ? "Confirmed" : "Not confirmed",
            ],
          ]}
        />
      </Group>
    </div>
  )
}
