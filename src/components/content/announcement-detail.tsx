import Link from "next/link"

import {
  ContentStateBadge,
  ContentStateMeaning,
} from "@/components/content/content-state-badge"
import { AnnouncementForm } from "@/components/content/announcement-form"
import { LifecycleActions } from "@/components/content/lifecycle-actions"
import { RefusalBanner } from "@/components/content/refusal-banner"
import { Alert } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"

import { canEdit } from "@/lib/content/lifecycle"

import type { AnnouncementRecord } from "@/lib/content/announcements"

/**
 * Manage one announcement: what it says, what state it is in, and what may be
 * done to it next (MPS-REQ-019, MPS-REQ-021, MPS-ACC-030).
 *
 * PREVIEW IS NOT A SEPARATE MODE, AND NEEDS NO ENDPOINT
 *
 * The body below IS the preview: it is rendered from the same record, in the
 * same typography a family reads it in, on a page that already had to authorize
 * the reader. A separate "preview" route would be a second access path to the
 * same row, and a second thing to get wrong — MPS-REQ-019 asks that an author
 * can see what they are about to publish, not that there be a preview mode.
 *
 * The draft banner is what makes it a preview rather than a lie: an author must
 * never be unsure whether what they are looking at is live.
 *
 * EDITING IS OFFERED ONLY FOR A DRAFT
 *
 * `canEdit` mirrors the database, which refuses an edit to anything but a
 * draft. Changing published text in place would change what a family already
 * read with no record that it changed; revision after publication is a
 * replacement, which preserves the original and is offered as such.
 */
function AnnouncementDetail({
  announcement,
  basePath,
  canAuthor,
  refused,
}: {
  announcement: AnnouncementRecord
  basePath: string
  /** False for an administrator viewing a program they may not author for. */
  canAuthor: boolean
  /** The `?refused=` token from a lifecycle move that did not happen. */
  refused?: string
}) {
  const editable = canAuthor && canEdit(announcement.state)

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <RefusalBanner token={refused} />

      <Card>
        <CardContent className="flex flex-col gap-[var(--hsh-space-4)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
            <h2 className="hsh-h3 m-0 text-[var(--hsh-text-primary)]">
              {announcement.title}
            </h2>
            <ContentStateBadge state={announcement.state} />
          </div>

          <ContentStateMeaning state={announcement.state} />

          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            {announcement.programName ?? "Program not available"}
          </p>

          {announcement.state === "draft" ? (
            <Alert tone="info" title="This is how families will see it">
              Nothing below is visible to families yet. Publishing is what makes
              it visible.
            </Alert>
          ) : null}

          {announcement.state === "replaced" && announcement.replacedById ? (
            <Alert tone="info" title="Superseded">
              A newer version of this announcement has been created.{" "}
              <Link
                href={`${basePath}/announcements/${announcement.replacedById}`}
                className="font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
              >
                Open the newer version
              </Link>
              .
            </Alert>
          ) : null}

          <p className="hsh-body m-0 max-w-[var(--hsh-content-reading)] whitespace-pre-line text-[var(--hsh-text-primary)]">
            {announcement.body}
          </p>

          <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
            {announcement.publishedAt
              ? `Published ${new Date(announcement.publishedAt).toLocaleString()} · `
              : ""}
            Last updated {new Date(announcement.updatedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {canAuthor ? (
        <section className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">Actions</h2>
          <LifecycleActions
            kind="announcement"
            id={announcement.id}
            state={announcement.state}
            expectedUpdatedAt={announcement.updatedAt}
            basePath={basePath}
            replaceHref={`${basePath}/announcements/${announcement.id}/replace`}
          />
        </section>
      ) : (
        <Alert tone="info" title="You are not assigned to this program">
          You can read this announcement, but only an assigned educator or an
          administrator with authority over this program can change it.
        </Alert>
      )}

      {editable ? (
        <section className="flex flex-col gap-[var(--hsh-space-3)]">
          <h2 className="hsh-h4 m-0 text-[var(--hsh-text-primary)]">
            Edit this draft
          </h2>
          <AnnouncementForm
            basePath={basePath}
            editsId={announcement.id}
            expectedUpdatedAt={announcement.updatedAt}
            initialTitle={announcement.title}
            initialBody={announcement.body}
            submitLabel="Save draft"
            cancelHref={basePath}
          />
        </section>
      ) : null}
    </div>
  )
}

export { AnnouncementDetail }
