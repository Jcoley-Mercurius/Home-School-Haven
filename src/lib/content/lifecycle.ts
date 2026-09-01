/**
 * The content lifecycle's judgements, kept free of the database so they can be
 * exercised directly (MPS-REQ-019, MPS-ACC-030, MPS-ACC-031).
 *
 * Same separation as `educator/workspace-state.ts` and `admin/transitions.ts`:
 * the reads and writes live in sibling modules, and what is worth arguing about
 * lives here, where a test can reach it without a Supabase project.
 *
 * THE TABLE IS DUPLICATED, DELIBERATELY, AND PINNED BY A TEST
 *
 * `private.content_transition_allowed` in
 * `20260901000000_program_content_authoring.sql` is the ENFORCING copy. This
 * one exists so a surface can decide which buttons to offer without a round
 * trip, and `tests/content-lifecycle.test.mts` asserts the two agree edge for
 * edge. If they ever drift, the database wins and the test fails first — a
 * button that should not have been offered is a bug in this file, never a
 * permission the database granted.
 *
 * WHY THERE IS NO WAY BACK
 *
 * `replaced` and `removed` are terminal. Un-removing is a restoration with
 * retention implications nobody has approved (GAP-CONTENT-03), and un-replacing
 * would orphan a successor that families may already have read.
 */

import type { Enums } from "@/lib/supabase/types"

type ContentState = Enums<"content_state">
type ResourceKind = Enums<"resource_kind">

/** Every state, in lifecycle order. */
const CONTENT_STATES = [
  "draft",
  "published",
  "replaced",
  "removed",
] as const satisfies readonly ContentState[]

/**
 * The permitted transitions, as `from -> to[]`.
 *
 * Mirrors the database function exactly. A state with no outgoing edge is
 * terminal and is listed with an empty array rather than omitted, so adding an
 * enum value without deciding its edges is a visible hole rather than a silent
 * one.
 */
const ALLOWED_TRANSITIONS: Record<ContentState, readonly ContentState[]> = {
  draft: ["published", "removed"],
  published: ["replaced", "removed"],
  replaced: [],
  removed: [],
}

/**
 * Whether a lifecycle move is permitted.
 * @param from - The item's current state.
 * @param to - The state being moved to.
 * @returns True when the database would also allow the move.
 */
function canTransition(from: ContentState, to: ContentState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Whether an item's own fields may still be edited in place.
 *
 * Only a draft. Editing published text would change what a family already read
 * with no record that it changed; revision after publication is a replacement,
 * which preserves the original.
 * @param state - The item's current state.
 * @returns True when in-place editing is permitted.
 */
function canEdit(state: ContentState): boolean {
  return state === "draft"
}

/**
 * What a family is shown.
 *
 * `replaced` stays visible, marked as superseded (deviation D-C2): MPS-ACC-030
 * asks for a truthful current state, and withdrawing a notice a family already
 * read is not a truthful state, it is a disappearance. `removed` is different —
 * that is what removal means.
 *
 * This mirrors the family RLS policy. It is a rendering convenience, never the
 * control: a family that reached this code with a `draft` would already have
 * had to get past a policy that returns no such row.
 * @param state - The item's current state.
 * @returns True when a family with an eligible enrollment may see the item.
 */
function isFamilyVisible(state: ContentState): boolean {
  return state === "published" || state === "replaced"
}

/**
 * The label for a state, as every surface shows it.
 *
 * MPS-ACC-031 requires an observable state, and the MDS requires status meaning
 * that does not depend on colour. One function so that `/admin`, `/educator`,
 * and `/family` cannot describe the same row differently (MPS-REQ-020).
 */
const STATE_LABELS: Record<ContentState, string> = {
  draft: "Draft",
  published: "Published",
  replaced: "Replaced",
  removed: "Removed",
}

/**
 * The sentence that says what a state means for families, for the authoring
 * surfaces. Written for an educator deciding what to do next, not for a log.
 */
const STATE_MEANINGS: Record<ContentState, string> = {
  draft: "Families cannot see this yet.",
  published: "Enrolled families can see this.",
  replaced: "Superseded by a newer version.",
  removed: "Withdrawn. Families can no longer see this.",
}

/** Resource kinds that carry a file in private Storage rather than a link. */
const FILE_BACKED_KINDS = ["document", "download"] as const

/**
 * Whether a resource kind carries a stored file.
 *
 * The database says the same thing in `learning_resources_one_medium`. This is
 * the copy the form uses to decide whether to ask for a web address or a file.
 * @param kind - The resource kind.
 * @returns True when the kind is file-backed.
 */
function isFileBacked(kind: ResourceKind): boolean {
  return (FILE_BACKED_KINDS as readonly string[]).includes(kind)
}

/** The label for each kind, matching the approved MDS variant names. */
const KIND_LABELS: Record<ResourceKind, string> = {
  document: "Document",
  link: "Link",
  video: "Video",
  activity: "Activity",
  download: "Download",
}

export {
  ALLOWED_TRANSITIONS,
  CONTENT_STATES,
  FILE_BACKED_KINDS,
  KIND_LABELS,
  STATE_LABELS,
  STATE_MEANINGS,
  canEdit,
  canTransition,
  isFamilyVisible,
  isFileBacked,
}
export type { ContentState, ResourceKind }
