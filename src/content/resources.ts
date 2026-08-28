/**
 * Public Resources page content.
 *
 * Like `./about`, this module carries more than one provenance and records
 * which each string is. Unlike `./about`, one of those provenances is
 * **not real content at all**, and that distinction is the point of the module:
 *
 *   - `"owner-approved-resources-reference"` — copy drawn in
 *     `mds/references/proposed/public-resources-proposed.png` and approved
 *     verbatim by the owner on 2026-08-28. It is the owner's own words for this
 *     page, not an import, so import rule 3 does not apply to it.
 *   - `"sample-placeholder"` — layout demonstration only. These entries are not
 *     published Home School Haven resources, and the page says so visibly
 *     wherever they render.
 *
 * **Why samples exist here at all.** MPS scopes learning resources as private
 * and program-scoped: MPS-REQ-015 (a parent's dashboard), MPS-REQ-018 (an
 * educator's assigned programs), MPS-REQ-019 (publishing them), MPS-ACC-029 and
 * MPS-ACC-030 (unauthorized families denied); MTS backs them with private
 * Supabase Storage under signed access. There is no approved *public* resource
 * library and no public resource row in `mps/BETA-CONTENT-IMPORT-INVENTORY.md`.
 * The proposed image is honest about this — every entry it draws is titled
 * "Sample resource: …" — and the owner approved shipping them as marked samples
 * on 2026-08-28 (prompt §1, resolution A).
 *
 * **Owner decision, 2026-08-28: the public resource library is demo-only and is
 * not approved MPS scope.** The samples stay labelled as samples and must not be
 * replaced with invented "real" resources. That is a standing decision, not a
 * gap waiting to be filled: giving these entries genuine content requires an MPS
 * requirement, acceptance criteria, and an import-inventory row first.
 * See `prompts/public-resources-page.md` §1, §4, and §12.
 */

/** Where a string on this page came from. */
export type ResourceContentSource =
  "owner-approved-resources-reference" | "sample-placeholder"

const OWNER: ResourceContentSource = "owner-approved-resources-reference"
const SAMPLE: ResourceContentSource = "sample-placeholder"

export const resourcesHero = {
  eyebrow: "Resources",
  heading: "Support for every step of the journey",
  summary:
    "Useful guidance for exploring programs, preparing for participation, and staying connected.",
  searchPanelLabel: "Find a resource",
  searchPlaceholder: "Search guides, topics, and tools…",
  source: OWNER,
} as const

/**
 * Category identifiers. They are filter values, not routes: no category page
 * exists or is approved, and a dead "Explore resources →" link would be exactly
 * the broken link the owner ruled out on 2026-08-27 (prompt §4, D-R3).
 */
export type ResourceCategoryId =
  | "getting-started"
  | "program-information"
  | "homeschool-support"
  | "family-guides"

export type ResourceCategory = {
  id: ResourceCategoryId
  name: string
  description: string
  source: ResourceContentSource
}

export const resourceCategories: ResourceCategory[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    description: "New to Home School Haven? Start here with the basics.",
    source: OWNER,
  },
  {
    id: "program-information",
    name: "Program Information",
    description: "Learn about our programs, enrollment, and expectations.",
    source: OWNER,
  },
  {
    id: "homeschool-support",
    name: "Homeschool Support",
    description: "Practical help, planning tools, and encouragement.",
    source: OWNER,
  },
  {
    id: "family-guides",
    name: "Family Guides",
    description: "Tips and ideas for thriving together at home.",
    source: OWNER,
  },
]

/**
 * What kind of thing an entry is. The label is always rendered as a visible
 * word beside its tone, never as colour alone (DESIGN-SYSTEM.md §10,
 * DO-DONT.md "Trust states").
 */
export type ResourceKind = "guide" | "link" | "download"

export const resourceKindLabels: Record<ResourceKind, string> = {
  guide: "Guide",
  link: "Link",
  download: "Download",
}

/** The drawn action wording, per kind, kept verbatim from the reference. */
export const resourceKindActions: Record<ResourceKind, string> = {
  guide: "Read more",
  link: "Visit resource",
  download: "View details",
}

export type ResourceEntry = {
  id: string
  kind: ResourceKind
  title: string
  description: string
  category: ResourceCategoryId
  source: ResourceContentSource
}

/**
 * Sample entries — layout demonstration, not published resources.
 *
 * Titles keep the "Sample resource:" prefix the reference draws. It is not
 * decoration: it is the honest label, and removing it would turn a placeholder
 * into a claim (MPS-REQ-020, MPS-REQ-021, MPS-ACC-009, MPS-ACC-010).
 *
 * None of these entries links anywhere. There is no file, no URL, and no
 * storage object behind any of them, so each action is inert and the page says
 * why rather than offering a download that cannot happen.
 */
export const sampleResources: ResourceEntry[] = [
  {
    id: "sample-getting-started-guide",
    kind: "guide",
    title: "Sample resource: Getting Started Guide",
    description: "A gentle overview to help you begin with confidence.",
    category: "getting-started",
    source: SAMPLE,
  },
  {
    id: "sample-program-overview",
    kind: "guide",
    title: "Sample resource: Program Overview",
    description: "Understand our programs and how they work.",
    category: "program-information",
    source: SAMPLE,
  },
  {
    id: "sample-helpful-link-collection",
    kind: "link",
    title: "Sample resource: Helpful Link Collection",
    description: "Curated tools and references to support your homeschool.",
    category: "homeschool-support",
    source: SAMPLE,
  },
  {
    id: "sample-planning-worksheet",
    kind: "download",
    title: "Sample resource: Planning Worksheet",
    description: "A simple worksheet to help you get organized.",
    category: "homeschool-support",
    source: SAMPLE,
  },
  {
    id: "sample-community-connection",
    kind: "guide",
    title: "Sample resource: Community Connection",
    description: "Ways to connect, participate, and stay in the loop.",
    category: "family-guides",
    source: SAMPLE,
  },
]

/**
 * The visible notice that sits with the sample entries. It follows the
 * convention already used for demo photography (`public/placeholder/README.md`)
 * and for the header's "not yet available in this review" wording: a reviewer is
 * never shown placeholder material as if it were the real thing.
 */
export const sampleNotice = {
  heading: "Sample entries for layout review",
  body: "These are placeholder entries that show how resources will be arranged. They are not published Home School Haven resources, and they do not open, download, or link anywhere.",
} as const

export const libraryHeading = {
  heading: "Explore helpful resources",
  clearLabel: "View all resources",
  source: OWNER,
} as const

/**
 * The one part of this page that is squarely inside approved scope: private,
 * program-specific material lives behind the family account (MPS-REQ-015), in
 * private Supabase Storage under signed access. This band points at it; it does
 * not implement it, and it asserts nothing about any family's enrollment.
 */
export const enrolledFamiliesBand = {
  heading: "Resources for enrolled families",
  body: "Program-specific materials and classroom resources are available securely in your family account.",
  primaryAction: "Sign In",
  secondaryAction: "Learn more about access",
  source: OWNER,
} as const

/** The approved MPS-REQ-009 guidance pathway, in this page's wording. */
export const resourcesGuidanceBand = {
  heading: "Looking for something specific?",
  body: "Our team is here to help you find the right information for your family's needs.",
  primaryAction: "Request Guidance",
  secondaryAction: "Contact Us",
  source: OWNER,
} as const
