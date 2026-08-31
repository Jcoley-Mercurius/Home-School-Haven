import { ExternalLink } from "lucide-react"

import { EmptyState } from "@/components/family/section-states"
import { Badge } from "@/components/ui/badge"

import type {
  EducatorAnnouncement,
  EducatorResource,
} from "@/lib/educator/workspace-state"

/**
 * Announcements and learning resources on assigned programs
 * (MPS-REQ-018, MPS-REQ-019, MPS-ACC-030).
 *
 * READ ONLY. There is no compose, publish, replace, remove, or upload here, and
 * none is withheld behind a disabled control — neither table grants any client
 * role a write, so there is no capability to expose. The authoring half of
 * MPS-REQ-019 is a later slice with its own approved prompt, and the educator
 * Course Builder is future-platform scope that this surface does not begin.
 *
 * DRAFTS APPEAR, LABELLED AS DRAFTS
 *
 * The educator RLS policies, unlike the family ones, do not filter on
 * `published`, so an educator sees unpublished rows for their own programs.
 * Both readings of "tidy that up" are wrong: dropping the row tells an educator
 * their program has no announcement when it has one, and rendering it like a
 * published row tells them families can read it. So every item carries its real
 * content state, which is what MPS-REQ-019 means by "a visible content state",
 * and MDS lists `educator_draft` among the approved announcement variants.
 *
 * The state is a labelled badge, never colour alone (MDS `components.status`).
 */

/**
 * The published/draft state of one piece of content.
 * @param published - Whether families can currently see it.
 * @returns The badge and its explanatory sentence.
 */
function ContentState({ published }: { published: boolean }) {
  return (
    <Badge tone={published ? "open" : "neutral"}>
      {published ? "Published" : "Draft"}
    </Badge>
  )
}

/**
 * Announcements across the programs the educator holds.
 *
 * Program name is on every row because this list spans programs; on the
 * single-program detail page the heading already says which, so the row would
 * be repeating it — but repeating it is cheaper than a reader on the Rosters
 * page mistaking one program's notice for another's.
 *
 * @param props.items - The announcements.
 * @param props.emptyTitle - Heading for the empty state.
 * @param props.emptyBody - Sentence for the empty state.
 * @param props.showProgramName - Whether to label each row with its program.
 * @returns The list.
 */
function AnnouncementList({
  items,
  emptyTitle,
  emptyBody,
  showProgramName = true,
}: {
  items: EducatorAnnouncement[]
  emptyTitle: string
  emptyBody: string
  showProgramName?: boolean
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
            <ContentState published={item.published} />
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
            {item.published && item.publishedAt
              ? `Published ${new Date(item.publishedAt).toLocaleDateString()}`
              : "Not published — families cannot see this yet."}
          </p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Learning resources across the programs the educator holds.
 *
 * Every `url` is `http(s)`: `learning_resources_url_scheme` makes anything else
 * unstorable, so this renderer never has to defend against a scheme the
 * database allowed. `rel="noreferrer"` on an external link keeps the referring
 * URL — which identifies an authenticated educator surface — off the
 * destination's logs.
 *
 * @param props.items - The resources.
 * @param props.emptyTitle - Heading for the empty state.
 * @param props.emptyBody - Sentence for the empty state.
 * @param props.showProgramName - Whether to label each row with its program.
 * @returns The list.
 */
function ResourceList({
  items,
  emptyTitle,
  emptyBody,
  showProgramName = true,
}: {
  items: EducatorResource[]
  emptyTitle: string
  emptyBody: string
  showProgramName?: boolean
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
            <ContentState published={item.published} />
          </div>

          {showProgramName ? (
            <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
              {item.programName ?? "Program not available"}
            </p>
          ) : null}

          {item.description ? (
            <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              {item.description}
            </p>
          ) : null}

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

          {!item.published ? (
            <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
              Not published — families cannot see this yet.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export { AnnouncementList, ContentState, ResourceList }
