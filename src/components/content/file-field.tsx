"use client"

import { useActionState, useId, useState } from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

import { uploadResourceFileAction } from "@/lib/content/actions"
import { emptyResourceFormState, statusMessage } from "@/lib/content/form-state"
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from "@/lib/content/validation"

/**
 * Upload a file for a file-backed learning resource (MPS-REQ-019).
 *
 * MDS-GAP-C1: the approved MDS has no file-upload control at Foundation
 * horizon — `content_builder.resource_upload` is Future LMS and grants no
 * behaviour here. This is composed from the approved `field`, `button`, and
 * `alert` components rather than invented as a new visual language, and it is
 * flagged for MDS confirmation as a new reusable convention.
 *
 * THE CLIENT-SIDE CHECKS ARE COURTESY, NOT CONTROL
 *
 * `accept` and the pre-submit size check exist so an educator learns in a
 * moment rather than after a slow upload. Neither is trusted: the action
 * measures the REAL byte length of what arrived and checks the type against the
 * same allowlist, `content_attach_resource_file` checks both again inside the
 * writing transaction, the column constraints check them a third time, and the
 * bucket carries its own `allowed_mime_types`. A hand-composed request meets
 * every one of those and none of this.
 *
 * ACCESSIBLE PROGRESS AND FAILURE
 *
 * `pending` is announced through a polite live region with words, not a bare
 * spinner, and a failure is announced assertively — an upload that failed
 * silently leaves a screen-reader user believing it worked. There is no
 * determinate percentage: a server action gives no progress events, so showing
 * a moving bar would be inventing a number. "Uploading…" is what is actually
 * known.
 */
function FileField({
  resourceId,
  expectedUpdatedAt,
  basePath,
  currentFileName,
}: {
  resourceId: string
  expectedUpdatedAt: string
  basePath: string
  /** The attached file's original name, when one is already attached. */
  currentFileName: string | null
}) {
  const [state, formAction, pending] = useActionState(
    uploadResourceFileAction,
    emptyResourceFormState,
  )
  const ids = useId()
  const [clientError, setClientError] = useState<string | null>(null)

  const banner = statusMessage(state.status, state.message)
  const fieldError = clientError ?? state.fieldErrors.file

  const announcement = pending
    ? "Uploading the file."
    : fieldError
      ? `The file was not uploaded. ${fieldError}`
      : (banner ?? "")

  return (
    <div className="flex flex-col gap-[var(--hsh-space-4)]">
      <p
        role={fieldError || banner ? "alert" : "status"}
        aria-live={fieldError || banner ? "assertive" : "polite"}
        className="sr-only"
        key={`${state.status}-${pending}-${announcement}`}
      >
        {announcement}
      </p>

      {banner ? (
        <Alert tone="warning" title="The file was not uploaded">
          {banner}
        </Alert>
      ) : null}

      {currentFileName ? (
        <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
          Attached: <span className="font-semibold">{currentFileName}</span>.
          Uploading again replaces what families will download.
        </p>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <input type="hidden" name="resourceId" value={resourceId} />
        <input type="hidden" name="basePath" value={basePath} />
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value={expectedUpdatedAt}
        />

        <Field invalid={Boolean(fieldError)}>
          <FieldLabel htmlFor={`${ids}-file`}>File</FieldLabel>
          <FieldDescription>
            PDF, PNG, JPEG, or plain text, up to {MAX_FILE_LABEL}. Families
            download this through Home School Haven — it is never a public link.
          </FieldDescription>
          <input
            id={`${ids}-file`}
            name="file"
            type="file"
            accept={ALLOWED_CONTENT_TYPES.join(",")}
            aria-describedby={fieldError ? `${ids}-file-error` : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) {
                setClientError(null)
                return
              }
              /* Told here so a large file is not uploaded before being
                 refused. The server measures it again regardless. */
              setClientError(
                file.size > MAX_FILE_BYTES
                  ? `That file is larger than ${MAX_FILE_LABEL}. Choose a smaller file.`
                  : null,
              )
            }}
            className="hsh-body-sm min-h-[var(--hsh-touch-target)] rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-2)] text-[var(--hsh-text-primary)] file:mr-[var(--hsh-space-3)] file:min-h-[var(--hsh-touch-target)] file:rounded-[var(--hsh-radius-control)] file:border-0 file:bg-[var(--hsh-surface-quiet)] file:px-[var(--hsh-space-4)] file:font-semibold file:text-[var(--hsh-text-primary)]"
          />
          <FieldError match={Boolean(fieldError)}>
            <span id={`${ids}-file-error`}>{fieldError}</span>
          </FieldError>
        </Field>

        <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row">
          <Button
            type="submit"
            variant="secondary"
            size="md"
            disabled={pending || Boolean(clientError)}
          >
            {pending ? "Uploading…" : "Upload file"}
          </Button>
        </div>

        {pending ? (
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            Uploading. This can take a moment for a large file — leaving this
            page will cancel it.
          </p>
        ) : null}
      </form>
    </div>
  )
}

export { FileField }
