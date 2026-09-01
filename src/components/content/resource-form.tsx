"use client"

import { useActionState, useId, useState } from "react"
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

import { saveResourceAction } from "@/lib/content/actions"
import { emptyResourceFormState, statusMessage } from "@/lib/content/form-state"
import { KIND_LABELS, isFileBacked } from "@/lib/content/lifecycle"
import {
  DESCRIPTION_MAX,
  MAX_FILE_LABEL,
  TITLE_MAX,
  URL_MAX,
} from "@/lib/content/validation"

import type { AuthorableProgram } from "@/lib/content/authority"
import type { ResourceKind } from "@/lib/content/lifecycle"

/**
 * Compose or revise a learning resource (MPS-REQ-019, MDS `patterns.forms`).
 *
 * THE KIND DECIDES WHICH MEDIUM IS ASKED FOR
 *
 * A resource is either an external link or a file in private Storage, never
 * both — `learning_resources_one_medium` enforces that in the database. So the
 * web-address field appears for link, video, and activity, and disappears for
 * document and download, which collect their file in a second step on the
 * resource's own page.
 *
 * The swap is progressive, not gating: with JavaScript unavailable the field is
 * simply present, and the server refuses a file-backed kind that carried a URL
 * with a sentence saying so. The client behaviour saves a round trip; it is not
 * the rule.
 *
 * THE KIND IS FIXED AFTER CREATION
 *
 * On an edit, `lockedKind` is passed and no kind control is rendered. Switching
 * a link into a file would strand an uploaded object or a published address;
 * the honest move is a new resource, which is one action away.
 */
const KINDS: ResourceKind[] = [
  "link",
  "document",
  "video",
  "activity",
  "download",
]

function ResourceForm({
  basePath,
  programId,
  programs,
  editsId,
  replacesId,
  expectedUpdatedAt,
  lockedKind,
  initialTitle = "",
  initialDescription = "",
  initialUrl = "",
  submitLabel,
  cancelHref,
}: {
  basePath: string
  programId?: string
  programs?: AuthorableProgram[]
  editsId?: string
  replacesId?: string
  expectedUpdatedAt?: string
  /** Set on edit and replace: the kind cannot change once a resource exists. */
  lockedKind?: ResourceKind
  initialTitle?: string
  initialDescription?: string
  initialUrl?: string
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(saveResourceAction, {
    ...emptyResourceFormState,
    values: {
      title: initialTitle,
      description: initialDescription,
      url: initialUrl,
      kind: lockedKind ?? "link",
      programId: programId ?? "",
    },
  })
  const ids = useId()
  const [kind, setKind] = useState<ResourceKind>(
    (state.values.kind as ResourceKind) ?? "link",
  )

  const effectiveKind = lockedKind ?? kind
  const fileBacked = isFileBacked(effectiveKind)

  const banner = statusMessage(state.status, state.message)
  const invalid = state.status === "invalid"

  const announcement = invalid
    ? "The resource was not saved. Check the highlighted fields below."
    : (banner ?? "")

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

      {invalid ? (
        <Alert tone="error" title="The resource was not saved">
          Check the highlighted fields below. Everything you typed is still
          here.
        </Alert>
      ) : null}

      {banner ? (
        <Alert tone="warning" title="The resource was not saved">
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

        {lockedKind ? (
          <>
            <input type="hidden" name="kind" value={lockedKind} />
            <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
              This is a {KIND_LABELS[lockedKind].toLowerCase()} resource. The
              kind cannot be changed — create a new resource instead.
            </p>
          </>
        ) : (
          <Field invalid={Boolean(state.fieldErrors.kind)}>
            <FieldLabel htmlFor={`${ids}-kind`}>Kind</FieldLabel>
            <FieldDescription>
              A document or download is a file you upload. Everything else is a
              web address.
            </FieldDescription>
            <select
              id={`${ids}-kind`}
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as ResourceKind)}
              className="hsh-body min-h-[var(--hsh-touch-target)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] px-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]"
            >
              {KINDS.map((option) => (
                <option key={option} value={option}>
                  {KIND_LABELS[option]}
                </option>
              ))}
            </select>
            <FieldError match={Boolean(state.fieldErrors.kind)}>
              {state.fieldErrors.kind}
            </FieldError>
          </Field>
        )}

        <Field invalid={Boolean(state.fieldErrors.title)}>
          <FieldLabel>Title</FieldLabel>
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

        <Field invalid={Boolean(state.fieldErrors.description)}>
          {/* Explicit association: see the note in `announcement-form.tsx`. */}
          <FieldLabel htmlFor={`${ids}-description`}>Description</FieldLabel>
          <FieldDescription>
            Optional. What this is and when a family would use it.
          </FieldDescription>
          <Textarea
            id={`${ids}-description`}
            key={state.values.description}
            name="description"
            rows={4}
            maxLength={DESCRIPTION_MAX}
            defaultValue={state.values.description}
          />
          <FieldError match={Boolean(state.fieldErrors.description)}>
            {state.fieldErrors.description}
          </FieldError>
        </Field>

        {fileBacked ? (
          <>
            {/* The field is not rendered, so nothing can be typed into it, and
                the server refuses a file-backed kind carrying a URL anyway. */}
            <input type="hidden" name="url" value="" />
            <Alert tone="info" title="You will upload the file next">
              Save this draft first, then upload the file from the
              resource&rsquo;s own page. PDF, PNG, JPEG, or plain text, up to{" "}
              {MAX_FILE_LABEL}.
            </Alert>
          </>
        ) : (
          <Field invalid={Boolean(state.fieldErrors.url)}>
            <FieldLabel>Web address</FieldLabel>
            <FieldDescription>
              Must start with http:// or https://. Families open this in a new
              tab.
            </FieldDescription>
            <Input
              key={state.values.url}
              name="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              maxLength={URL_MAX}
              defaultValue={state.values.url}
            />
            <FieldError match={Boolean(state.fieldErrors.url)}>
              {state.fieldErrors.url}
            </FieldError>
          </Field>
        )}

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

export { ResourceForm }
