"use client"

import { useActionState, useId, useState } from "react"
import { ChevronDown, ChevronUp, Gavel, Plus } from "lucide-react"

import {
  approveDispositionAction,
  classifyFeedbackAction,
  recordEvidenceAction,
  recordFeedbackAction,
} from "@/app/(portal)/admin/reports/actions"
import { emptyReviewActionFormState } from "@/app/(portal)/admin/reports/form-state"
import {
  ReviewResultBadge,
  ReviewResultMeaning,
  ReviewStateBadge,
  ReviewStateMeaning,
} from "@/components/admin/review-state"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  REVIEW_DISPOSITION_LABELS,
  REVIEW_DISPOSITION_MEANINGS,
  REVIEW_RESULT_LABELS,
  REVIEW_STATE_LABELS,
  nextReviewStates,
  type ReviewDisposition,
  type ReviewResult,
} from "@/lib/admin/review-transitions"

import type { ReviewSignal } from "@/lib/admin/review"

/**
 * One beta success signal, its recorded evidence, and its feedback
 * (MPS-REQ-022, MPS-REQ-024, MPS-WFL-008, MPS-ACC-032).
 *
 * WHY A CARD PER SIGNAL AND NOT A TABLE WITH A DRAWER
 *
 * There are exactly eight, they are read in order, and each carries a
 * paragraph of the owner's words. A table row cannot hold that, and a drawer
 * would hide the thing being walked behind a click during the walkthrough
 * itself. This is the one admin surface where the content is the point rather
 * than the row count.
 *
 * THE LINE THIS COMPONENT HOLDS
 *
 * Every control records something. None of them changes scope. Approving a
 * disposition attributes the owner's judgment and says, in words next to the
 * button, that carrying it into the MPS is still a person's job
 * (GAP-EVIDENCE-002). There is no control that accepts an item into this
 * release, because MPS-WFL-008's recovery forbids letting anything enter
 * launch scope silently.
 *
 * `not_tested` IS NOT A SOFT PASS
 *
 * The result badge and its sentence say so explicitly. A reviewer skimming
 * eight cards must not be able to mistake "nobody has walked this" for
 * "walked and fine".
 */
const DISPOSITIONS: ReviewDisposition[] = [
  "must_fix_beta_defect",
  "launch_requirement",
  "next_idea",
  "later_idea",
  "rejected_change",
]

const RESULTS: ReviewResult[] = ["pass", "fail", "blocked", "not_tested"]

function ReviewSignalCard({ signal }: { signal: ReviewSignal }) {
  const ids = useId()
  const [open, setOpen] = useState(false)

  const [evidenceState, evidenceAction, evidencePending] = useActionState(
    recordEvidenceAction,
    emptyReviewActionFormState,
  )
  const [feedbackState, feedbackAction, feedbackPending] = useActionState(
    recordFeedbackAction,
    emptyReviewActionFormState,
  )
  const [classifyState, classifyAction] = useActionState(
    classifyFeedbackAction,
    emptyReviewActionFormState,
  )
  const [approveState, approveAction] = useActionState(
    approveDispositionAction,
    emptyReviewActionFormState,
  )

  /* An outcome from another card must never be shown against this one. */
  const outcomeFor = (state: typeof evidenceState) =>
    state.signalId === signal.id ? state.status : "idle"

  const messages: string[] = []
  for (const state of [evidenceState, feedbackState, classifyState, approveState]) {
    const status = outcomeFor(state)
    if (status === "idle" || status === "updated") continue
    messages.push(
      status === "invalidTransition"
        ? "That step is not approved from where this signal currently stands."
        : status === "rejected"
          ? "Nothing was recorded. Classify the feedback before approving its disposition."
          : status === "notFound"
            ? "That record is no longer available."
            : status === "forbidden"
              ? "This account is not authorized to record a review."
              : status === "unavailable"
                ? "No Supabase project is configured in this environment. Nothing was recorded."
                : status === "invalid"
                  ? "That request was not understood. Nothing was recorded."
                  : "Something went wrong on our side. Nothing was recorded.",
    )
  }

  const anyUpdated = [
    evidenceState,
    feedbackState,
    classifyState,
    approveState,
  ].some((state) => outcomeFor(state) === "updated")

  const unclassified = signal.feedback.filter((item) => !item.disposition).length
  const unapproved = signal.feedback.filter(
    (item) => item.disposition && !item.approvedAt,
  ).length

  const targets = nextReviewStates(signal.state)

  return (
    <li className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-5)]">
      <div className="flex flex-col gap-[var(--hsh-space-2)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
          <p className="hsh-label m-0 text-[var(--hsh-text-secondary)]">
            {signal.id}
          </p>
          <div className="flex flex-wrap gap-[var(--hsh-space-2)]">
            <ReviewStateBadge state={signal.state} />
            <ReviewResultBadge result={signal.result} />
          </div>
        </div>

        {/* The approved statement, quoted. Never paraphrased on screen. */}
        <h3 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">
          {signal.statement}
        </h3>
        <ReviewStateMeaning state={signal.state} />
        <ReviewResultMeaning result={signal.result} />
      </div>

      {anyUpdated ? (
        <Alert tone="success" title="Recorded" live="polite">
          The change is recorded with your account and the time. Nothing was
          added to any release, and no approved requirement changed.
        </Alert>
      ) : null}

      {messages.length > 0 ? (
        <Alert tone="warning" title="Nothing was recorded" live="polite">
          {messages[0]}
        </Alert>
      ) : null}

      {signal.actor || signal.buildIdentifier ? (
        <dl className="grid gap-[var(--hsh-space-3)] sm:grid-cols-2">
          {signal.buildIdentifier ? (
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Build
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {signal.buildIdentifier}
                {signal.environment ? ` · ${signal.environment}` : null}
              </dd>
            </div>
          ) : null}
          {signal.actor ? (
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Recorded by
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {signal.actor}
              </dd>
            </div>
          ) : null}
          {signal.method ? (
            <div className="flex flex-col gap-[var(--hsh-space-1)] sm:col-span-2">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Method
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {signal.method}
              </dd>
            </div>
          ) : null}
          {signal.evidence ? (
            <div className="flex flex-col gap-[var(--hsh-space-1)] sm:col-span-2">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Evidence
              </dt>
              <dd className="hsh-body-sm m-0 whitespace-pre-wrap text-[var(--hsh-text-primary)]">
                {signal.evidence}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {signal.feedback.length > 0 ? (
        <section
          aria-labelledby={`${ids}-feedback`}
          className="flex flex-col gap-[var(--hsh-space-3)]"
        >
          <h4
            id={`${ids}-feedback`}
            className="hsh-label m-0 text-[var(--hsh-text-secondary)]"
          >
            Feedback ({signal.feedback.length})
          </h4>
          <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
            {signal.feedback.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-4)]"
              >
                <p className="hsh-body-sm m-0 whitespace-pre-wrap text-[var(--hsh-text-primary)]">
                  {item.note}
                </p>

                <div className="flex flex-wrap items-center gap-[var(--hsh-space-2)]">
                  {item.disposition ? (
                    <Badge tone={item.approvedAt ? "success" : "pending"}>
                      {REVIEW_DISPOSITION_LABELS[item.disposition]}
                      {item.approvedAt ? " · approved" : " · not yet approved"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not classified</Badge>
                  )}
                </div>

                {item.disposition ? (
                  <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
                    {REVIEW_DISPOSITION_MEANINGS[item.disposition]}
                  </p>
                ) : null}

                {!item.approvedAt ? (
                  <div className="flex flex-col gap-[var(--hsh-space-2)]">
                    <form
                      action={classifyAction}
                      className="flex flex-wrap items-end gap-[var(--hsh-space-2)]"
                    >
                      <input type="hidden" name="signalId" value={signal.id} />
                      <input type="hidden" name="feedbackId" value={item.id} />
                      <Field>
                        <FieldLabel htmlFor={`${ids}-${item.id}-disposition`}>
                          Classify this
                        </FieldLabel>
                        <select
                          id={`${ids}-${item.id}-disposition`}
                          name="disposition"
                          defaultValue={item.disposition ?? ""}
                          className="hsh-body h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]"
                        >
                          <option value="">Choose a classification</option>
                          {DISPOSITIONS.map((disposition) => (
                            <option key={disposition} value={disposition}>
                              {REVIEW_DISPOSITION_LABELS[disposition]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Button type="submit" variant="secondary" size="md">
                        Save classification
                      </Button>
                    </form>

                    {item.disposition ? (
                      <form action={approveAction}>
                        <input type="hidden" name="signalId" value={signal.id} />
                        <input type="hidden" name="feedbackId" value={item.id} />
                        <Button type="submit" variant="primary" size="md">
                          <Gavel aria-hidden="true" strokeWidth={1.75} />
                          Approve this disposition
                        </Button>
                        {/* A plain paragraph, not `FieldDescription`: that is
                            Base UI's `Field.Description` and throws error #28
                            outside a `Field.Root`, which breaks hydration for
                            the whole card and silently stops every form in it
                            from submitting. */}
                        <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
                          Records that you accept this classification, with your
                          account and the time. It adds nothing to any release
                          &mdash; updating the MPS is still a separate step.
                        </p>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {unclassified > 0 || unapproved > 0 ? (
        <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
          {unclassified > 0
            ? `${unclassified} item${unclassified === 1 ? "" : "s"} still to classify. `
            : null}
          {unapproved > 0
            ? `${unapproved} classified item${unapproved === 1 ? "" : "s"} waiting for approval.`
            : null}
        </p>
      ) : null}

      <Button
        variant="quiet"
        size="md"
        aria-expanded={open}
        aria-controls={`${ids}-panel`}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronUp aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <ChevronDown aria-hidden="true" strokeWidth={1.75} />
        )}
        {open ? "Hide" : "Record evidence or feedback"}
      </Button>

      <div id={`${ids}-panel`} hidden={!open}>
        <div className="flex flex-col gap-[var(--hsh-space-5)]">
          <form
            action={evidenceAction}
            className="flex flex-col gap-[var(--hsh-space-3)]"
          >
            <input type="hidden" name="signalId" value={signal.id} />

            {/* The error lives INSIDE this Field root. A `Field.Error`
                rendered outside one throws Base UI error #28 at runtime, which
                breaks hydration for the whole card and silently stops every
                form in it from submitting. */}
            <Field
              invalid={Boolean(
                outcomeFor(evidenceState) === "invalid" &&
                  evidenceState.fieldErrors.result,
              )}
            >
              <FieldLabel htmlFor={`${ids}-result`}>Result</FieldLabel>
              <select
                id={`${ids}-result`}
                name="result"
                defaultValue={signal.result}
                className="hsh-body h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]"
              >
                {RESULTS.map((result) => (
                  <option key={result} value={result}>
                    {REVIEW_RESULT_LABELS[result]}
                  </option>
                ))}
              </select>
              <FieldDescription>
                &ldquo;Not tested&rdquo; is the honest answer until this signal
                has actually been walked. It is not counted as demonstrated.
              </FieldDescription>
              {outcomeFor(evidenceState) === "invalid" &&
              evidenceState.fieldErrors.result ? (
                <FieldError>{evidenceState.fieldErrors.result}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor={`${ids}-build`}>
                Build identifier
              </FieldLabel>
              <Input
                id={`${ids}-build`}
                name="buildIdentifier"
                defaultValue={signal.buildIdentifier ?? ""}
                placeholder="commit SHA or preview deployment"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${ids}-environment`}>
                Environment
              </FieldLabel>
              <Input
                id={`${ids}-environment`}
                name="environment"
                defaultValue={signal.environment ?? ""}
                placeholder="local, preview"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${ids}-method`}>Method</FieldLabel>
              <Input
                id={`${ids}-method`}
                name="method"
                defaultValue={signal.method ?? ""}
                placeholder="Manual walkthrough, end-to-end test"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${ids}-evidence`}>Evidence</FieldLabel>
              <Textarea
                id={`${ids}-evidence`}
                name="evidence"
                rows={3}
                defaultValue={signal.evidence ?? ""}
                placeholder="What was checked, and what happened."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${ids}-next`}>
                Move this signal (optional)
              </FieldLabel>
              <select
                id={`${ids}-next`}
                name="nextState"
                defaultValue=""
                className="hsh-body h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-4)] text-[var(--hsh-text-primary)]"
              >
                <option value="">Leave it where it is</option>
                {targets.map((target) => (
                  <option key={target} value={target}>
                    {REVIEW_STATE_LABELS[target]}
                  </option>
                ))}
              </select>
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={evidencePending}
            >
              Record evidence
            </Button>
          </form>

          <form
            action={feedbackAction}
            className="flex flex-col gap-[var(--hsh-space-3)]"
          >
            <input type="hidden" name="signalId" value={signal.id} />
            <Field
              invalid={Boolean(
                outcomeFor(feedbackState) === "invalid" &&
                  feedbackState.fieldErrors.note,
              )}
            >
              <FieldLabel htmlFor={`${ids}-note`}>
                What was said about this signal
              </FieldLabel>
              <Textarea
                id={`${ids}-note`}
                name="note"
                rows={3}
                aria-invalid={
                  Boolean(
                    outcomeFor(feedbackState) === "invalid" &&
                      feedbackState.fieldErrors.note,
                  ) || undefined
                }
                placeholder="Samantha's words, as close to verbatim as you can."
              />
              <FieldDescription>
                Recorded privately for administrators. Educators and families
                never see this.
              </FieldDescription>
              {outcomeFor(feedbackState) === "invalid" &&
              feedbackState.fieldErrors.note ? (
                <FieldError>{feedbackState.fieldErrors.note}</FieldError>
              ) : null}
            </Field>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={feedbackPending}
            >
              <Plus aria-hidden="true" strokeWidth={1.75} />
              Record feedback
            </Button>
          </form>
        </div>
      </div>
    </li>
  )
}

export { ReviewSignalCard }
