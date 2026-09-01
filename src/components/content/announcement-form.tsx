"use client"

import { useActionState, useId } from "react"
import Link from "next/link"

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

import { saveAnnouncementAction } from "@/lib/content/actions"
import {
  emptyAnnouncementFormState,
  statusMessage,
} from "@/lib/content/form-state"
import { BODY_MAX, TITLE_MAX } from "@/lib/content/validation"

import type { AuthorableProgram } from "@/lib/content/authority"

/**
 * Compose or revise a program announcement (MPS-REQ-019, MDS `patterns.forms`).
 *
 * ONE FORM, THREE JOBS, AND THE HIDDEN FIELDS ARE THE DIFFERENCE
 *
 * Creating, editing a draft, and replacing a published announcement ask for
 * exactly the same two things, so they share a form rather than three
 * near-identical ones drifting apart. `editsId` and `replacesId` are mutually
 * exclusive hidden fields; the action decides from them which verb to call.
 *
 * NONE OF THOSE HIDDEN FIELDS IS TRUSTED
 *
 * The action re-reads the row behind whichever id arrives and takes the program
 * FROM THAT ROW, then re-authorizes. `programId` here fills the create case
 * only, and is checked against the viewer's own assignments before anything is
 * written. `expectedUpdatedAt` is a concurrency token: it can cause a refusal
 * and nothing else.
 *
 * `noValidate` keeps a native constraint bubble from hiding the server
 * boundary, matching every other form in this repository. The server's answer
 * is the answer.
 */
function AnnouncementForm({
  basePath,
  programId,
  programs,
  editsId,
  replacesId,
  expectedUpdatedAt,
  initialTitle = "",
  initialBody = "",
  submitLabel,
  cancelHref,
}: {
  basePath: string
  /** Fixed program, on a program-scoped surface. Omitted when a choice is offered. */
  programId?: string
  /** The programs this viewer may author for. Only for the cross-program surface. */
  programs?: AuthorableProgram[]
  editsId?: string
  replacesId?: string
  expectedUpdatedAt?: string
  initialTitle?: string
  initialBody?: string
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(saveAnnouncementAction, {
    ...emptyAnnouncementFormState,
    values: {
      title: initialTitle,
      body: initialBody,
      programId: programId ?? "",
    },
  })
  const ids = useId()

  const banner = statusMessage(state.status, state.message)
  const invalid = state.status === "invalid"

  const announcement = invalid
    ? "The announcement was not saved. Check the highlighted fields below."
    : (banner ?? "")

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      {/* The single live region for this form. Assertive because a submission
          that failed must interrupt: a screen-reader user who does not hear it
          has no other signal that the page did not move on. */}
      <p
        role="status"
        aria-live="assertive"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {invalid ? (
        <Alert tone="error" title="The announcement was not saved">
          Check the highlighted fields below. Everything you typed is still
          here.
        </Alert>
      ) : null}

      {banner ? (
        <Alert tone="warning" title="The announcement was not saved">
          {banner}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-6)]"
      >
        <input type="hidden" name="basePath" value={basePath} />
        {editsId ? (
          <input type="hidden" name="editsId" value={editsId} />
        ) : null}
        {replacesId ? (
          <input type="hidden" name="replacesId" value={replacesId} />
        ) : null}
        {expectedUpdatedAt ? (
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={expectedUpdatedAt}
          />
        ) : null}

        {programId ? (
          <input type="hidden" name="programId" value={programId} />
        ) : programs ? (
          <Field invalid={Boolean(state.fieldErrors.programId)}>
            <FieldLabel htmlFor={`${ids}-program`}>Program</FieldLabel>
            <FieldDescription>
              Only the programs you are assigned to appear here.
            </FieldDescription>
            {/* A native select, deliberately: this is a plain single choice
                inside a plain form, and the approved Select primitive earns its
                complexity on filter rails, not here. Native keeps keyboard and
                screen-reader behaviour that costs nothing to keep. */}
            <select
              id={`${ids}-program`}
              name="programId"
              defaultValue={state.values.programId}
              className="hsh-body min-h-[var(--hsh-touch-target)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]"
            >
              <option value="">Choose a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <FieldError match={Boolean(state.fieldErrors.programId)}>
              {state.fieldErrors.programId}
            </FieldError>
          </Field>
        ) : null}

        <Field invalid={Boolean(state.fieldErrors.title)}>
          <FieldLabel>Title</FieldLabel>
          <FieldDescription>
            What families will see first. Keep it to the point.
          </FieldDescription>
          <Input
            key={state.values.title}
            name="title"
            type="text"
            autoComplete="off"
            maxLength={TITLE_MAX}
            defaultValue={state.values.title}
          />
          <FieldError match={Boolean(state.fieldErrors.title)}>
            {state.fieldErrors.title}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.body)}>
          {/* `Textarea` is a plain <textarea>, not a Base UI Field.Control, so
              Field cannot associate the label with it on its own. The explicit
              id/htmlFor pair is the convention every other textarea in this
              repository follows, and without it a screen reader announces an
              unlabelled control. */}
          <FieldLabel htmlFor={`${ids}-body`}>Announcement</FieldLabel>
          <FieldDescription>
            Program news for the families enrolled in this program. Keep
            anything about one family&rsquo;s circumstances out of it —
            announcements go to everyone enrolled.
          </FieldDescription>
          <Textarea
            id={`${ids}-body`}
            key={state.values.body}
            name="body"
            rows={8}
            maxLength={BODY_MAX}
            defaultValue={state.values.body}
          />
          <FieldError match={Boolean(state.fieldErrors.body)}>
            {state.fieldErrors.body}
          </FieldError>
        </Field>

        <Alert tone="info" title="This saves a draft">
          A draft is not visible to families. You will preview it and publish it
          from its own page.
        </Alert>

        <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row">
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <Button render={<Link href={cancelHref} />} variant="quiet" size="md">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export { AnnouncementForm }
