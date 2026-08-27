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
  /** Published schedule text, preserved as written in the source. */
  publishedDates: string | null
  /** Published duration text. */
  publishedDuration: string | null
  /** Published price text. Never derived or estimated. */
  publishedPrice: string | null
  importStatus: ImportStatus
  /** Inventory rows this entry is drawn from. */
  source: string
  /** Demo-only placeholder art. Replace the file, not the layout. */
  image: PlaceholderImage
  /** Detail route. Stubbed within the programs page until that screen is built. */
  href: string
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
    href: "/programs#art-lab",
    image: {
      src: "/placeholder/program-art-lab.jpg",
      alt: "Placeholder photo — demo only. Watercolour paints and brushes on a table.",
      width: 456,
      height: 474,
      isPlaceholder: true,
    },
  },
  {
    slug: "haven-days-enrichment",
    name: "Haven Days Enrichment",
    publishedDates: "September 2026–June 2027",
    publishedDuration: null,
    publishedPrice: null,
    importStatus: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
    href: "/programs#haven-days-enrichment",
    image: {
      src: "/placeholder/program-haven-days-enrichment.jpg",
      alt: "Placeholder photo — demo only. Potted plants beside a window.",
      width: 498,
      height: 474,
      isPlaceholder: true,
    },
  },
  {
    slug: "harvest-explorers",
    name: "Harvest Explorers",
    publishedDates: "August 20–September 24",
    publishedDuration: "Six weeks",
    publishedPrice: "$180 for all six weeks",
    importStatus: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
    href: "/programs#harvest-explorers",
    image: {
      src: "/placeholder/program-harvest-explorers.jpg",
      alt: "Placeholder photo — demo only. A woven basket with a eucalyptus sprig.",
      width: 474,
      height: 474,
      isPlaceholder: true,
    },
  },
]

/** Demo-only placeholder art for the two reserved home panels. */
export const heroImage: PlaceholderImage = {
  src: "/placeholder/hero.jpg",
  alt: "Placeholder photo — demo only. Children painting at a sunlit table surrounded by plants.",
  width: 1816,
  height: 744,
  isPlaceholder: true,
}

export const communityImage: PlaceholderImage = {
  src: "/placeholder/community.jpg",
  alt: "Placeholder photo — demo only. A child drawing at a table beside potted plants.",
  width: 484,
  height: 744,
  isPlaceholder: true,
}

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
   * QA-003 resolved by owner decision 2026-08-27: the Contact-page number is
   * the single published number everywhere. The conflicting variant recorded in
   * the MPS import inventory is not used and must not be reintroduced.
   * Standing unless Samantha directs otherwise.
   */
  phone: "239-347-9356",
} as const

export type NavItem = {
  label: string
  href: string
  /** False until the destination route exists. Owner decision, 2026-08-27. */
  available: boolean
}

export const primaryNav: NavItem[] = [
  { label: "Programs", href: "/programs", available: true },
  { label: "Calendar", href: "/calendar", available: false },
  { label: "About", href: "/about", available: false },
  { label: "Resources", href: "/resources", available: false },
  { label: "Contact", href: "/contact", available: false },
]

/** Destination for every Request Guidance action (MPS-REQ-009). */
export const guidanceHref = "/guidance"

/** Destination for the Explore Programs action. */
export const programsHref = "/programs"

export const accountNav: NavItem = {
  label: "Sign In",
  href: "/sign-in",
  available: false,
}
