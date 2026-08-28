/**
 * Foundation Release public content — brand, contact, and navigation.
 *
 * The published program catalog lives in `./programs` and is re-exported here
 * so existing imports keep working.
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

import type { PlaceholderImage } from "./programs"

export {
  featuredPrograms,
  featuredSlugs,
  getProgram,
  programHref,
  programs,
  publishedFacts,
  relatedPrograms,
} from "./programs"
export type {
  AvailabilityState,
  ImportStatus,
  PlaceholderImage,
  Program,
} from "./programs"

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
  { label: "Calendar", href: "/calendar", available: true },
  { label: "About", href: "/about", available: true },
  { label: "Resources", href: "/resources", available: false },
  { label: "Contact", href: "/contact", available: false },
]

/** Destination for every Request Guidance action (MPS-REQ-009). */
export const guidanceHref = "/guidance"

/** Destination for the Explore Programs action. */
export const programsHref = "/programs"

/**
 * Sign In became reachable when Supabase Auth landed. The Foundation Release
 * provisions accounts rather than offering self-service sign-up, so the page it
 * opens says so plainly.
 */
export const accountNav: NavItem = {
  label: "Sign In",
  href: "/sign-in",
  available: true,
}
