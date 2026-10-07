/**
 * Published program catalog — Foundation Release staging module.
 *
 * Every value here is Samantha's evidence of 2026-09-14 as recorded in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md` ("Owner evidence of 2026-09-14"), which
 * supersedes the website capture of 2026-08-26 for the offerings it covers.
 * Import rules 1, 3, and 7 apply without exception:
 *
 *   - published facts are preserved as written;
 *   - a fact the source does not publish stays `null` and renders as
 *     "Contact for details" (QA-005);
 *   - a detail whose association with a program is not proven by the source
 *     goes in `unverifiedDetails` and is NEVER rendered publicly (QA-001);
 *   - no year is assigned to any offering: the evidence states none.
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

import { checkoutUrlForSlug } from "./checkout-sources.ts"
import type { OfferingType } from "@/lib/programs/offering-groups"

export type { OfferingType }

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
/**
 * A real photograph cleared to publish.
 *
 * Deliberately a separate type from `PlaceholderImage`, whose `isPlaceholder`
 * is the literal `true`. The two can never be assigned to one another, so an
 * approved photo cannot drift into a placeholder slot or the reverse, and the
 * release gate in `scripts/check-demo-placeholders.mjs` keeps its meaning.
 *
 * Provenance and authorization for every file live in
 * `public/photography/README.md`. Nothing may be typed `ApprovedPhoto` without
 * a row there.
 */
export type ApprovedPhoto = {
  /** Always under `/photography/`, never `/placeholder/`. */
  src: string
  /** Describes the subject. Never the "demo only" prefix placeholders carry. */
  alt: string
  width: number
  height: number
  isPlaceholder: false
}

/** Either kind of image, for a slot that may hold one while others hold the other. */
export type ContentImage = ApprovedPhoto | PlaceholderImage

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
  /**
   * How Home School Haven offers it: Haven Days, a Ready Set program, an
   * individual class, tutoring, or a monthly club. Never `null` for a published
   * program — the database refuses to publish one without it.
   */
  offeringType: OfferingType | null
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
   * Verified description, where the owner evidence gives one (Crochet,
   * Tutoring, Monthly Clubs). `null` everywhere else: nothing is written to fill
   * the space.
   */
  summary: string | null
  /** Published age or grade audience, where the evidence states one. */
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
   * Program-specific external checkout URL (MPS-REQ-013), exactly as the
   * approved source page publishes it (`@/content/checkout-sources`).
   *
   * `null` where the source page offers no checkout for the program (Tutoring).
   * Never constructed from a name or slug: that would invent a payment
   * destination. The handoff renders its truthful unavailable state instead.
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

const EVIDENCE = "BETA-CONTENT-IMPORT-INVENTORY — Owner evidence of 2026-09-14"

/** Fields no current offering publishes, spelled out once. */
const UNPUBLISHED = {
  format: null,
  location: null,
  educator: null,
  enrollmentWindow: null,
  availability: "unknown",
  checkoutUrl: null,
  importStatus: "import",
  source: EVIDENCE,
  unverifiedDetails: [],
  image: null,
} satisfies Partial<Program>

/** The combined Ready Set price, stated identically on both programs it covers. */
const READY_SET_COMBINED =
  "Ready Set Prep and Ready Set Learn combined: $140/week"

/**
 * The nine published offerings, in the administrator's `sort_order`. Identical
 * to the rows `20260916000000_public_offering_model.sql` writes.
 *
 * Offerings the 2026-09-14 evidence does not support — Ready Set Prep & Learn,
 * Etiquette Series, Art Lab, Harvest Explorers, History Explorers — are
 * ARCHIVED in the database and absent here, because this list is what a
 * visitor may see. Their history stays in the database and in the inventory.
 */
const catalog: Program[] = [
  {
    ...UNPUBLISHED,
    slug: "haven-days-enrichment",
    name: "Haven Days",
    offeringType: "haven_days",
    publishedDates: "September–June",
    publishedSchedule: "Tuesday, Wednesday, and Thursday, 9:00 AM–1:30 PM",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice:
      "One day $280/month; two days $550/month; three days $795/month",
    publishedRegistrationOptions: null,
    summary: null,
    audience: null,
    image: {
      src: "/placeholder/program-haven-days-enrichment.jpg",
      alt: "Placeholder photo — demo only. Potted plants beside a window.",
      width: 498,
      height: 474,
      isPlaceholder: true,
    },
  },
  {
    ...UNPUBLISHED,
    slug: "ready-set-prep",
    name: "Ready Set Prep",
    offeringType: "ready_set",
    publishedDates: "August–May",
    publishedSchedule: "Tuesday and Thursday, 9:15–11:30 AM",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: "$80/week",
    publishedRegistrationOptions: READY_SET_COMBINED,
    summary: null,
    audience: "Ages 3–4",
  },
  {
    ...UNPUBLISHED,
    slug: "ready-set-learn",
    name: "Ready Set Learn",
    offeringType: "ready_set",
    publishedDates: "August–May",
    publishedSchedule: "Tuesday and Thursday, 11:45 AM–2:00 PM",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: "$80/week",
    publishedRegistrationOptions: READY_SET_COMBINED,
    summary: null,
    audience: "Ages 4–5",
  },
  {
    ...UNPUBLISHED,
    slug: "ready-set-sensory",
    name: "Ready Set Sensory",
    offeringType: "ready_set",
    publishedDates: null,
    publishedSchedule: "Wednesday, 9:30–11:30 AM",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: "$45/week",
    publishedRegistrationOptions: null,
    summary: null,
    audience: "Ages 3–5",
  },
  {
    ...UNPUBLISHED,
    slug: "sewing",
    name: "Sewing",
    offeringType: "individual_class",
    /* Eight weeks, with no start date and no year in the evidence. */
    publishedDates: null,
    publishedSchedule: "Wednesday, 4:45–6:15 PM",
    publishedDuration: "Eight weeks",
    publishedSessionLength: null,
    publishedPrice: "$45/week",
    publishedRegistrationOptions:
      "$20 non-refundable deposit when paying weekly; no deposit when paying in full",
    summary: null,
    audience: null,
  },
  {
    ...UNPUBLISHED,
    slug: "crochet",
    name: "Crochet",
    offeringType: "individual_class",
    /* November, with no year and no exact dates in the evidence. */
    publishedDates: "November",
    publishedSchedule: "Mondays in November, 2:00–4:00 PM",
    publishedDuration: "Four weeks",
    publishedSessionLength: null,
    publishedPrice: "$250, including materials",
    publishedRegistrationOptions: null,
    summary:
      "A beginner class. No experience is required, and there is a take-home project each week.",
    audience: null,
  },
  {
    ...UNPUBLISHED,
    slug: "gardening",
    name: "Gardening",
    offeringType: "individual_class",
    publishedDates: "October–June; no class during the final week of October",
    publishedSchedule: "Thursday, 2:15–3:15 PM",
    publishedDuration: null,
    publishedSessionLength: null,
    /* QA-007: the flyer says $35/week and the email says $35 drop-in. Neither
       is published until Home School Haven says which is right. */
    publishedPrice: null,
    publishedRegistrationOptions: null,
    summary: null,
    audience: "Ages 5 and up",
    importStatus: "import-title-review-detail",
    source: `${EVIDENCE} (QA-007: price unresolved)`,
    unverifiedDetails: [
      "Price: the flyer states $35/week and the email states $35 drop-in (QA-007, unresolved)",
    ],
  },
  {
    ...UNPUBLISHED,
    slug: "tutoring",
    name: "Tutoring",
    offeringType: "tutoring",
    publishedDates: null,
    publishedSchedule: "Tuesday, Wednesday, and Thursday",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: "$65/hour or $40/half-hour",
    publishedRegistrationOptions: null,
    summary: "Academic skill building, homework help, and test preparation.",
    audience: "Kindergarten and up",
  },
  {
    ...UNPUBLISHED,
    slug: "monthly-clubs",
    name: "Monthly Clubs",
    offeringType: "monthly_club",
    /* The first club's month and year are not in the evidence. */
    publishedDates: null,
    publishedSchedule: "Thursday, 4:30–6:30 PM",
    publishedDuration: null,
    publishedSessionLength: null,
    publishedPrice: "$100/month or $30 drop-in",
    publishedRegistrationOptions: null,
    summary: "The first club is Lego.",
    audience: null,
  },
]

/* The checkout link is joined from the source mapping rather than written into
   each entry, so there is one place a destination is recorded in code. */
export const programs: Program[] = catalog.map((program) => ({
  ...program,
  checkoutUrl: checkoutUrlForSlug(program.slug),
}))

/** Detail route for a program (MDS-REF-005 §2: Home / Programs / Art Lab). */
export function programHref(slug: string): string {
  return `/programs/${slug}`
}

export function getProgram(slug: string): Program | undefined {
  return programs.find((program) => program.slug === slug)
}

/**
 * The three programs the home page features (MDS-REF-006 draws three).
 *
 * One from each of the three largest offering groups — Haven Days, Ready Set,
 * individual classes. Two of the previous three are archived, so this is a
 * presentation choice recorded in prompts/public-offering-model.md §4, not a
 * ranking Home School Haven has published.
 */
export const featuredSlugs = [
  "haven-days-enrichment",
  "ready-set-prep",
  "sewing",
] as const

export const featuredPrograms: Program[] = featuredSlugs.map((slug) => {
  const program = getProgram(slug)
  if (!program) throw new Error(`Featured program "${slug}" is not published.`)
  return program
})

/**
 * Related programs for the detail page (DESIGN-SYSTEM.md §7): the next
 * published programs in `sort_order`, which already keeps each offering group
 * together. No affinity beyond that is invented.
 */
export function relatedPrograms(slug: string, count = 3): Program[] {
  const index = programs.findIndex((program) => program.slug === slug)
  if (index < 0) return []
  return Array.from({ length: count }, (_, offset) => {
    return programs[(index + offset + 1) % programs.length]
  }).filter((program) => program.slug !== slug)
}

/**
 * Published facts in the order the card surfaces show them. Audience sits
 * before price, as MDS `program_card.content_order` places age or grade.
 * Only non-null entries are returned — an unpublished fact is never guessed.
 */
export function publishedFacts(program: Program): string[] {
  return [
    program.publishedDates,
    program.publishedSchedule,
    program.publishedDuration,
    program.publishedSessionLength,
    program.audience,
    program.publishedPrice,
  ].filter((fact): fact is string => Boolean(fact))
}
