/**
 * Foundation Release public content.
 *
 * Every value here is a fact published on https://homeschoolhaven.org/ and
 * recorded in `mps/BETA-CONTENT-IMPORT-INVENTORY.md` (captured 2026-08-26).
 * Import rule 3 applies: nothing is inferred or invented. A field the source
 * does not publish stays `null` and renders as "Contact for details".
 *
 * This module is the approved staging step for content that will move to
 * Supabase-backed program administration (AGENTS.md §5). It is not a second
 * data store and must not accumulate facts that lack a source row.
 */

export type ImportStatus = "import" | "import-title-review-detail"

export type Program = {
  slug: string
  name: string
  /** Published schedule text, preserved as written in the source. */
  publishedDates: string | null
  /** Published duration text. */
  publishedDuration: string | null
  /** Published price text. Never derived or estimated. */
  publishedPrice: string | null
  importStatus: ImportStatus
  /** Inventory rows this entry is drawn from. */
  source: string
}

/** The three programs MDS-REF-006 features on the home page. */
export const featuredPrograms: Program[] = [
  {
    slug: "art-lab",
    name: "Art Lab",
    publishedDates: "August 22–September 26, 2026",
    publishedDuration: null,
    publishedPrice: null,
    importStatus: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
  },
  {
    slug: "haven-days-enrichment",
    name: "Haven Days Enrichment",
    publishedDates: "September 2026–June 2027",
    publishedDuration: null,
    publishedPrice: null,
    importStatus: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
  },
  {
    slug: "harvest-explorers",
    name: "Harvest Explorers",
    publishedDates: "August 20–September 24",
    publishedDuration: "Six weeks",
    publishedPrice: "$180 for all six weeks",
    importStatus: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
  },
]

/** Inventory "Values" row, preserved verbatim. */
export const values = [
  "Creativity over conformity",
  "Curiosity over perfection",
  "Character over performance",
  "Community over competition",
] as const

/** Inventory "Positioning", "Learning character", and "Faith identity" rows. */
export const positioning = {
  eyebrow: "Christ-centered homeschool community · Cape Coral",
  summary:
    "A boutique homeschool community offering enrichment classes, hands-on workshops, small-group learning, and family support.",
  learningCharacter:
    "Calm, creative, curiosity-led, relationship-centered learning.",
  faithIdentity:
    "Christ-centered values expressed through kindness, integrity, patience, humility, and grace.",
} as const

/** Inventory "Contact, assistance, privacy, and checkout" rows. */
export const contact = {
  addressLines: [
    "2930 Del Prado Boulevard South, Suite D",
    "Cape Coral, Florida",
  ],
  /**
   * The Contact-page number. QA-003: the privacy-policy footer publishes
   * 239-347-93556. Use this one provisionally and confirm before public launch.
   */
  phone: "239-347-9356",
  phoneNeedsConfirmation: true,
} as const

export type NavItem = {
  label: string
  href: string
  /** False until the destination route exists. Owner decision, 2026-08-27. */
  available: boolean
}

export const primaryNav: NavItem[] = [
  { label: "Programs", href: "/programs", available: false },
  { label: "Calendar", href: "/calendar", available: false },
  { label: "About", href: "/about", available: false },
  { label: "Resources", href: "/resources", available: false },
  { label: "Contact", href: "/contact", available: false },
]

export const accountNav: NavItem = {
  label: "Sign In",
  href: "/sign-in",
  available: false,
}
