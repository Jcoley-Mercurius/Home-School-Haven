import { Download, ExternalLink } from "lucide-react"
import Link from "next/link"

import {
  ContentStateBadge,
  ContentStateMeaning,
} from "@/components/content/content-state-badge"
import { FileField } from "@/components/content/file-field"
import { LifecycleActions } from "@/components/content/lifecycle-actions"
import { ResourceForm } from "@/components/content/resource-form"
import { RefusalBanner } from "@/components/content/refusal-banner"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"

import { KIND_LABELS, canEdit, isFileBacked } from "@/lib/content/lifecycle"

import type { ResourceRecord } from "@/lib/content/resources"

/**
 * Manage one learning resource (MPS-REQ-019, MPS-REQ-021, MPS-ACC-030).
 *
 * The same shape as `AnnouncementDetail`, with two differences that come from
 * a resource having a medium:
 *
 *   * a file-backed resource collects its file here, after the draft exists,
 *     because an upload needs a row to belong to — an object with nothing
 *     referencing it is an object nothing can later find to manage;
 *   * publishing a file-backed draft with no file attached is refused by the
 *     database, and this page says so before the author reaches that refusal.
 *
 * WHAT IS NOT ON THIS PAGE
 *
 * No storage path and no signed URL, in the markup or in the RSC payload.
 * `ResourceRecord` drops the path in its mapper, so this component could not
 * render one if it tried. The download below is the application route, which
 * re-authorizes and mints a fresh 60-second URL per request.
 */
function ResourceDetail({
  resource,
  basePath,
  canAuthor,
  refused,
}: {
  resource: ResourceRecord
  basePath: string
  canAuthor: boolean
  /** The `?refused=` token from a lifecycle move that did not happen. */
  refused?: string
}) {
  const editable = canAuthor && canEdit(resource.state)
  const fileBacked = isFileBacked(resource.kind)
  const awaitingFile = fileBacked && !resource.hasFile

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <RefusalBanner token={refused} />

      <Card>
        <CardContent className="flex flex-col gap-[var(--hsh-space-4)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
            <h2 className="hsh-h3 m-0 text-[var(--hsh-text-primary)]">
              {resource.title}
            </h2>
            <ContentStateBadge state={resource.state} />
          </div>

          <ContentStateMeaning state={resource.state} />

          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            {KIND_LABELS[resource.kind]} ·{" "}
            {resource.programName ?? "Program not available"}
          </p>

          {resource.state === "replaced" && resource.replacedById ? (
            <Alert tone="info" title="Superseded">
              A newer version of this resource has been created.{" "}
              <Link
                href={`${basePath}/resources/${resource.replacedById}`}
                className="font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                Open the newer version
              </Link>
              .
            </Alert>
          ) : null}

          {resource.description ? (
            <p className="hsh-body m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-primary)]">
              {resource.description}
            </p>
          ) : null}

          {resource.hasFile ? (
            <div className="flex flex-col gap-[var(--hsh-space-2)]">
              <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                {resource.fileName}
                {resource.fileSizeBytes
                  ? ` · ${Math.max(1, Math.round(resource.fileSizeBytes / 1024))} KB`
                  : ""}
              </p>
              {resource.state === "removed" ? (
                <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  The file is no longer downloadable, for anyone.
                </p>
              ) : (
                <a
                  href={`/resources/${resource.id}/file`}
                  className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
                >
                  Download
                  <Download
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                  <span className="sr-only"> — {resource.fileName}</span>
                </a>
              )}
            </div>
          ) : resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              Open resource
              <ExternalLink
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}

          <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
            Last updated {new Date(resource.updatedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {awaitingFile && resource.state === "draft" ? (
        <Alert tone="warning" title="This draft has no file yet">
          Upload the file below. A document or download cannot be published
          until it has one — a published entry that leads nowhere is worse than
          no entry.
        </Alert>
      ) : null}

      {canAuthor && fileBacked && resource.state === "draft" ? (
        <section className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">
            {resource.hasFile ? "Replace the file" : "Upload the file"}
          </h2>
          <FileField
            resourceId={resource.id}
            expectedUpdatedAt={resource.updatedAt}
            basePath={basePath}
            currentFileName={resource.fileName}
          />
        </section>
      ) : null}

      {canAuthor ? (
        <section className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">Actions</h2>
          <LifecycleActions
            kind="resource"
            id={resource.id}
            state={resource.state}
            expectedUpdatedAt={resource.updatedAt}
            basePath={basePath}
            replaceHref={`${basePath}/resources/${resource.id}/replace`}
          />
        </section>
      ) : (
        <Alert tone="info" title="You are not assigned to this program">
          You can read this resource, but only an assigned educator or an
          administrator with authority over this program can change it.
        </Alert>
      )}

      {editable ? (
        <section className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">
            Edit this draft
          </h2>
          <ResourceForm
            basePath={basePath}
            editsId={resource.id}
            expectedUpdatedAt={resource.updatedAt}
            lockedKind={resource.kind}
            initialTitle={resource.title}
            initialDescription={resource.description ?? ""}
            initialUrl={resource.url ?? ""}
            submitLabel="Save draft"
            cancelHref={basePath}
          />
        </section>
      ) : null}
    </div>
  )
}

export { ResourceDetail }
