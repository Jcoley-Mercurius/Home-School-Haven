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

import type { ApprovedPhoto } from "./programs"

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

/**
 * Approved photography for the two home panels.
 *
 * Supplied by Samantha and cleared on 2026-09-03, including parental consent
 * for the children shown. Provenance is recorded in
 * `public/photography/README.md`; the demo placeholders these replaced are
 * deleted rather than left beside them.
 *
 * The alt text describes what is happening. It never names a child, and the
 * "Placeholder photo — demo only" prefix is gone because it would now be false.
 */
export const heroImage: ApprovedPhoto = {
  src: "/photography/children-science-experiment.webp",
  alt: "Four children gathered around a bubbling colour-mixing experiment at a classroom table.",
  width: 1240,
  height: 620,
  isPlaceholder: false,
}

export const communityImage: ApprovedPhoto = {
  src: "/photography/learning-room.webp",
  alt: "A Home School Haven learning room: a child working at a low table beside open storage and a potted plant.",
  width: 1240,
  height: 620,
  isPlaceholder: false,
}

/**
 * The About page's own hero, no longer the home hero reused.
 *
 * This image is 600 px wide, which is why it sits here and not in a home or
 * program panel: the About hero renders at roughly 580 CSS px inside the
 * container, so it lands near 1:1, where the wider 60vw program hero would
 * upscale it visibly.
 */
export const aboutHeroImage: ApprovedPhoto = {
  src: "/photography/classroom-group.webp",
  alt: "A group class in session at Home School Haven, children seated around a long table with an educator.",
  width: 600,
  height: 433,
  isPlaceholder: false,
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
  { label: "Resources", href: "/resources", available: true },
  { label: "Contact", href: "/contact", available: true },
]

/**
 * Destination for every Request Guidance action (MPS-REQ-009).
 *
 * `/contact` is the single public inquiry surface (owner decision 2026-08-28);
 * `/guidance` redirects there. The visible CTA label stays "Request Guidance".
 */
export const guidanceHref = "/contact"

/**
 * The same destination, carrying which program the family was looking at
 * (MPS-REQ-009, MPS-REQ-010, MPS-ACC-011).
 *
 * A slug is public program data — it is already in the page's own URL — so
 * unlike a contact detail it is safe in a query string (AGENTS.md §11 bars the
 * latter, not the former). `/contact` re-validates it against published
 * programs and ignores anything it cannot resolve, so a stale or edited link
 * degrades to the plain form rather than pre-selecting a program that is not
 * published.
 *
 * @param slug - The published program's slug.
 * @returns The inquiry surface, pre-selecting that program.
 */
export function guidanceHrefForProgram(slug: string): string {
  return `/contact?program=${encodeURIComponent(slug)}`
}

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
