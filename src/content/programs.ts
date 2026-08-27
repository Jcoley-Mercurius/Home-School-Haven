/**
 * Published program catalog — Foundation Release staging module.
 *
 * Every value here is published on https://homeschoolhaven.org/ and recorded in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md` (captured 2026-08-26). Import rules 1,
 * 3, and 7 apply without exception:
 *
 *   - published facts are preserved as written;
 *   - a fact the source does not publish stays `null` and renders as
 *     "Contact for details" (QA-005);
 *   - a detail whose association with a program is not proven by the source
 *     goes in `unverifiedDetails` and is NEVER rendered publicly (QA-001).
 *
 * This is the approved staging step for content that moves to Supabase-backed
 * program administration (AGENTS.md §5). It is not a second data store: the
 * `Program` shape is what a Supabase row will provide, so replacing this module
 * changes no component contract.
 *
 * Summer Series and Seasonal School Photos are published offerings the
 * inventory marks "import if included in the beta catalog". That inclusion is
 * undecided, so they are absent (owner decision, 2026-08-27).
 */

/**
 * Availability vocabulary from DESIGN-SYSTEM.md §6 "Enrollment state".
 *
 * `unknown` is the state of every program today: the source publishes no
 * capacity, seat count, or registration window for any offering, and
 * MDS-REF-004's Open / Limited Spaces / Waitlist badges are labelled
 * SAMPLE DATA on the reference sheet itself. Showing any program as open would
 * invent a fact (import rule 3, DO-DONT "Trust states").
 */
export type AvailabilityState =
  "open" | "limited" | "waitlist" | "closed" | "unknown"

export type ImportStatus = "import" | "import-title-review-detail"

/**
 * Demo-only placeholder imagery. Owner decision 2026-08-27: reuse the generated
 * art direction already in MDS-REF-006 so Samantha can review layout now.
 *
 * These are NOT approved photography and the people in them are NOT real
 * students (DESIGN-SYSTEM.md §5, DO-DONT.md). Alt text always says so, and the
 * files must not ship to a live environment. When released photography arrives,
 * replace the files in `public/placeholder/` and update `alt` here — the layout
 * does not change. See `public/placeholder/README.md`.
 */
export type PlaceholderImage = {
  src: string
  alt: string
  width: number
  height: number
  /** Always true while the asset is generated art direction, never approved. */
  isPlaceholder: true
}

export type Program = {
  slug: string
  name: string
  /** Published schedule range text, preserved as written in the source. */
  publishedDates: string | null
  /** Published recurring-day text, e.g. "Tuesdays and Thursdays". */
  publishedSchedule: string | null
  /** Published overall duration, e.g. "Six weeks". */
  publishedDuration: string | null
  /** Published per-session length, e.g. "Two hours per session". */
  publishedSessionLength: string | null
  /** Published price text. Never derived or estimated. */
  publishedPrice: string | null
  /** Published registration-option text, preserved as written. */
  publishedRegistrationOptions: string | null
  /**
   * Approved long-form description. `null` for every program: the source
   * inventory publishes none, and MDS-REF-005 shows only the literal
   * placeholder "Approved program description appears here."
   */
  summary: string | null
  /** Published age or grade audience. Not published for any program (QA-005). */
  audience: string | null
  /** Published delivery format. Not published for any program (QA-005). */
  format: string | null
  /** Published per-program location. Not published for any program (QA-005). */
  location: string | null
  /** Published educator association. Not published per program (QA-005). */
  educator: string | null
  /** Published enrollment window. Not published for any program (QA-005). */
  enrollmentWindow: string | null
  /** See {@link AvailabilityState}. `unknown` for every program today. */
  availability: AvailabilityState
  /**
   * Program-specific `pay.homeschoolhaven.org` checkout URL (MPS-REQ-013).
   *
   * `null` for every program: the approved artifacts authorize "the current
   * program-specific checkout links" but record no actual URL, and constructing
   * one would invent a payment destination. The handoff renders its truthful
   * unavailable state until the owner supplies them.
   */
  checkoutUrl: string | null
  importStatus: ImportStatus
  /** Inventory rows this entry is drawn from. */
  source: string
  /**
   * Details the source page shows near this program without proving the
   * association (QA-001, import rule 7). Retained for traceability and
   * deliberately never rendered. Do not promote one of these to a published
   * field without an owner decision.
   */
  unverifiedDetails: string[]
  /** Demo-only placeholder art, or `null` where none exists yet. */
  image: PlaceholderImage | null
}

const INVENTORY = "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory"

/** Fields no program publishes today, spelled out once. */
const UNPUBLISHED = {
  summary: null,
  audience: null,
  format: null,
  location: null,
  educator: null,
  enrollmentWindow: null,
  availability: "unknown",
  checkoutUrl: null,
} satisfies Partial<Program>

export const programs: Program[] = [
  {
    slug: "ready-set-prep-and-learn",
    name: "Ready Set Prep & Learn",
    publishedDates: null,
    publishedSchedule: "Tuesdays and Thursdays",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: null,
    publishedRegistrationOptions:
      "Fall registration offers 1-, 2-, or 3-day options across Enrichment or Ready Set Prep.",
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: null,
    ...UNPUBLISHED,
  },
  {
    slug: "haven-days-enrichment",
    name: "Haven Days Enrichment",
    publishedDates: "September 2026–June 2027",
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: null,
    publishedRegistrationOptions:
      "Fall registration offers 1-, 2-, or 3-day options.",
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: {
      src: "/placeholder/program-haven-days-enrichment.jpg",
      alt: "Placeholder photo — demo only. Potted plants beside a window.",
      width: 498,
      height: 474,
      isPlaceholder: true,
    },
    ...UNPUBLISHED,
  },
  {
    slug: "etiquette-series",
    name: "Etiquette Series",
    publishedDates: null,
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: null,
    publishedRegistrationOptions: null,
    importStatus: "import-title-review-detail",
    source: `${INVENTORY} (QA-001: date association unproven)`,
    /* A September 11–October 2 range appears in the page content, but the
       retrieved hierarchy does not prove it belongs to this series. */
    unverifiedDetails: ["September 11–October 2 (association unproven)"],
    image: null,
    ...UNPUBLISHED,
  },
  {
    slug: "art-lab",
    name: "Art Lab",
    publishedDates: "August 22–September 26, 2026",
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: null,
    publishedRegistrationOptions: null,
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: {
      src: "/placeholder/program-art-lab.jpg",
      alt: "Placeholder photo — demo only. Watercolour paints and brushes on a table.",
      width: 456,
      height: 474,
      isPlaceholder: true,
    },
    ...UNPUBLISHED,
  },
  {
    slug: "sewing",
    name: "Sewing",
    publishedDates: "September 15–October 5",
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: "Two hours per session",
    publishedPrice: null,
    publishedRegistrationOptions: null,
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: null,
    ...UNPUBLISHED,
  },
  {
    slug: "gardening",
    name: "Gardening",
    publishedDates: "September 3–September 24",
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: null,
    publishedRegistrationOptions: null,
    importStatus: "import-title-review-detail",
    source: `${INVENTORY} (QA-001: session-length association unproven)`,
    /* "Two hours per session" appears near the gardening / Harvest Explorers
       content without proving which program it describes. */
    unverifiedDetails: ["Two hours per session (association unproven)"],
    image: null,
    ...UNPUBLISHED,
  },
  {
    slug: "harvest-explorers",
    name: "Harvest Explorers",
    publishedDates: "August 20–September 24",
    publishedSchedule: null,
    publishedDuration: "Six weeks",
    publishedSessionLength: null,
    publishedPrice: "$180 for all six weeks",
    publishedRegistrationOptions: null,
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: {
      src: "/placeholder/program-harvest-explorers.jpg",
      alt: "Placeholder photo — demo only. A woven basket with a eucalyptus sprig.",
      width: 474,
      height: 474,
      isPlaceholder: true,
    },
    ...UNPUBLISHED,
  },
  {
    slug: "history-explorers",
    name: "History Explorers",
    publishedDates: "September 3–October 15",
    publishedSchedule: null,
    publishedDuration: null,
    publishedSessionLength: "2.5 hours per session",
    publishedPrice: null,
    publishedRegistrationOptions: null,
    importStatus: "import",
    source: INVENTORY,
    unverifiedDetails: [],
    image: null,
    ...UNPUBLISHED,
  },
]

/** Detail route for a program (MDS-REF-005 §2: Home / Programs / Art Lab). */
export function programHref(slug: string): string {
  return `/programs/${slug}`
}

export function getProgram(slug: string): Program | undefined {
  return programs.find((program) => program.slug === slug)
}

/** The three programs MDS-REF-006 features on the home page, in its order. */
export const featuredSlugs = [
  "art-lab",
  "haven-days-enrichment",
  "harvest-explorers",
] as const

export const featuredPrograms: Program[] = featuredSlugs.map((slug) => {
  const program = getProgram(slug)
  if (!program) throw new Error(`Featured program "${slug}" is not published.`)
  return program
})

/**
 * Related programs for the detail page (DESIGN-SYSTEM.md §7). There is no
 * published category, format, or audience to relate on (QA-005), so this is
 * simply the next published programs in inventory order rather than an invented
 * affinity.
 */
export function relatedPrograms(slug: string, count = 3): Program[] {
  const index = programs.findIndex((program) => program.slug === slug)
  if (index < 0) return []
  return Array.from({ length: count }, (_, offset) => {
    return programs[(index + offset + 1) % programs.length]
  }).filter((program) => program.slug !== slug)
}

/**
 * Published facts in the order the detail and catalog surfaces show them.
 * Only non-null entries are returned — an unpublished fact is never guessed.
 */
export function publishedFacts(program: Program): string[] {
  return [
    program.publishedDates,
    program.publishedSchedule,
    program.publishedDuration,
    program.publishedSessionLength,
    program.publishedPrice,
  ].filter((fact): fact is string => Boolean(fact))
}
