import { Download, ExternalLink, Pencil } from "lucide-react"
import Link from "next/link"

import { ContentStateBadge } from "@/components/content/content-state-badge"
import { EmptyState } from "@/components/family/section-states"

import { KIND_LABELS } from "@/lib/content/lifecycle"

import type {
  EducatorAnnouncement,
  EducatorResource,
} from "@/lib/educator/workspace-state"

/**
 * Announcements and learning resources on assigned programs
 * (MPS-REQ-018, MPS-REQ-019, MPS-ACC-030).
 *
 * EVERY STATE APPEARS, LABELLED AS ITSELF
 *
 * The educator RLS policies, unlike the family ones, filter on no state at all,
 * so an educator sees drafts and withdrawn items for their own programs. Both
 * readings of "tidy that up" are wrong: dropping the row tells an educator
 * their program has no announcement when it has one, and rendering it like a
 * published row tells them families can read it. So every item carries its real
 * content state, which is what MPS-REQ-019 means by "a visible content state".
 *
 * The state is a labelled, icon-bearing badge, never colour alone
 * (MDS `components.status`), and it is the SAME component the family and
 * administrator surfaces use, so one row cannot read three ways.
 *
 * MANAGE LINKS APPEAR ONLY WHERE AUTHORING IS REACHABLE
 *
 * `manageBase` is optional. On the cross-program Announcements and Resources
 * pages it is absent, because authoring is program-scoped and a manage link
 * there would have to guess which program's authoring surface to open. On a
 * program's own page it is present. A missing link is not a permission check —
 * the routes it would point at re-authorize on their own.
 */

/**
 * Announcements across the programs the educator holds.
 *
 * Program name is on every row because this list spans programs; on the
 * single-program detail page the heading already says which, so the row would
 * be repeating it — but repeating it is cheaper than a reader mistaking one
 * program's notice for another's.
 *
 * @param props.items - The announcements.
 * @param props.emptyTitle - Heading for the empty state.
 * @param props.emptyBody - Sentence for the empty state.
 * @param props.showProgramName - Whether to label each row with its program.
 * @param props.manageBase - Path prefix for authoring links, when reachable.
 * @returns The list.
 */
function AnnouncementList({
  items,
  emptyTitle,
  emptyBody,
  showProgramName = true,
  manageBase,
}: {
  items: EducatorAnnouncement[]
  emptyTitle: string
  emptyBody: string
  showProgramName?: boolean
  manageBase?: string
}) {
  if (items.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        <p>{emptyBody}</p>
      </EmptyState>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
            <p className="hsh-body m-0 font-semibold text-[var(--hsh-text-primary)]">
              {item.title}
            </p>
            <ContentStateBadge state={item.state} />
          </div>

          {showProgramName ? (
            <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
              {item.programName ?? "Program not available"}
            </p>
          ) : null}

          <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            {item.body}
          </p>

          <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
            {item.familyVisible && item.publishedAt
              ? `Published ${new Date(item.publishedAt).toLocaleDateString()}`
              : item.state === "removed"
                ? "Withdrawn. Families can no longer see this."
                : "Families cannot see this yet."}
          </p>

          {manageBase ? (
            <Link
              href={`${manageBase}/announcements/${item.id}`}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              <Pencil
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Manage
              <span className="sr-only"> — {item.title}</span>
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * Learning resources across the programs the educator holds.
 *
 * A LINK AND A FILE ARE NOT SPELLED THE SAME WAY
 *
 * A link leaves the platform and opens in a new tab; `rel="noreferrer"` keeps
 * the referring URL — which identifies an authenticated educator surface — off
 * the destination's logs. Every `url` is `http(s)`, because
 * `learning_resources_url_scheme` makes anything else unstorable.
 *
 * A file stays here and goes through `/resources/[id]/file`, which re-derives
 * the viewer, re-checks authority, and mints a 60-second signed URL. This
 * component never sees a storage path or a signed URL, and neither does the
 * browser: `ResourceRecord` drops the path before a component can receive it.
 *
 * @param props.items - The resources.
 * @param props.emptyTitle - Heading for the empty state.
 * @param props.emptyBody - Sentence for the empty state.
 * @param props.showProgramName - Whether to label each row with its program.
 * @param props.manageBase - Path prefix for authoring links, when reachable.
 * @returns The list.
 */
function ResourceList({
  items,
  emptyTitle,
  emptyBody,
  showProgramName = true,
  manageBase,
}: {
  items: EducatorResource[]
  emptyTitle: string
  emptyBody: string
  showProgramName?: boolean
  manageBase?: string
}) {
  if (items.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        <p>{emptyBody}</p>
      </EmptyState>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
            <p className="hsh-body m-0 font-semibold text-[var(--hsh-text-primary)]">
              {item.title}
            </p>
            <ContentStateBadge state={item.state} />
          </div>

          <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
            {KIND_LABELS[item.kind]}
            {showProgramName
              ? ` · ${item.programName ?? "Program not available"}`
              : ""}
          </p>

          {item.description ? (
            <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              {item.description}
            </p>
          ) : null}

          {item.downloadPath ? (
            <a
              href={item.downloadPath}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              Download
              <Download
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              <span className="sr-only"> — {item.fileName ?? item.title}</span>
            </a>
          ) : item.url ? (
            <a
              href={item.url}
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
          ) : (
            <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
              No file attached yet.
            </p>
          )}

          {!item.familyVisible ? (
            <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
              {item.state === "removed"
                ? "Withdrawn. Families can no longer see this."
                : "Families cannot see this yet."}
            </p>
          ) : null}

          {manageBase ? (
            <Link
              href={`${manageBase}/resources/${item.id}`}
              className="hsh-body-sm inline-flex min-h-[var(--hsh-touch-target)] items-center gap-[var(--hsh-space-2)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
            >
              <Pencil
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Manage
              <span className="sr-only"> — {item.title}</span>
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export { AnnouncementList, ResourceList }
