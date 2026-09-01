import { CircleCheck, FileText, RotateCcw, Slash } from "lucide-react"

import { Badge } from "@/components/ui/badge"

import {
  STATE_LABELS,
  STATE_MEANINGS,
  type ContentState,
} from "@/lib/content/lifecycle"

/**
 * The lifecycle state of one announcement or resource (MPS-REQ-019,
 * MPS-ACC-031).
 *
 * ONE COMPONENT, THREE SURFACES
 *
 * `/admin`, `/educator`, and `/family` all render this. MPS-REQ-020 asks that
 * the same record read consistently everywhere, and three components spelling
 * the same four states three ways is how that requirement is lost — not
 * dramatically, but by one surface saying "Unpublished" where another says
 * "Draft" and a reader concluding they are different things.
 *
 * COLOUR IS NEVER THE MESSAGE
 *
 * Every state carries a word AND an icon. The MDS requires status meaning that
 * does not depend on colour, and this is the component where that is either
 * true or not. `neutral` is the honest tone for a draft: it must not borrow
 * `open`, which would read as "live".
 *
 * `Replaced` and `Removed` share the neutral tone but never the icon or the
 * word, because they are different facts — one was superseded, the other was
 * withdrawn.
 *
 * MDS-GAP-C2: the approved `announcement` and `learning_resource` components
 * each list their own state vocabulary, neither of which is the authoring
 * lifecycle. This is composed from the approved `badge` component rather than
 * invented as a new convention, and is flagged for MDS confirmation.
 */

const STATE_TONE = {
  draft: "neutral",
  published: "success",
  replaced: "info",
  removed: "neutral",
} as const satisfies Record<
  ContentState,
  "neutral" | "success" | "info" | "open"
>

const STATE_ICON = {
  draft: FileText,
  published: CircleCheck,
  replaced: RotateCcw,
  removed: Slash,
} as const satisfies Record<ContentState, typeof FileText>

/**
 * A labelled, icon-bearing badge for a content state.
 * @param props.state - The item's lifecycle state.
 * @returns The badge.
 */
function ContentStateBadge({ state }: { state: ContentState }) {
  const Icon = STATE_ICON[state]

  return (
    <Badge tone={STATE_TONE[state]}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {STATE_LABELS[state]}
    </Badge>
  )
}

/**
 * The sentence that says what a state means for families.
 *
 * Separate from the badge because a list wants the badge alone while a detail
 * page wants both, and because the sentence is what an author acts on: "Draft"
 * is a label, "Families cannot see this yet" is the consequence.
 * @param props.state - The item's lifecycle state.
 * @returns The sentence.
 */
function ContentStateMeaning({ state }: { state: ContentState }) {
  return (
    <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
      {STATE_MEANINGS[state]}
    </p>
  )
}

export { ContentStateBadge, ContentStateMeaning }
