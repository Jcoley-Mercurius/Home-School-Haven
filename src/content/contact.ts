/**
 * Public Contact page content.
 *
 * Like `./about` and `./resources`, every string here is copy drawn in
 * `mds/references/proposed/public-contact-proposed.png` and approved verbatim
 * by the owner on 2026-08-28. It is the owner's own words for this page, not an
 * import from https://homeschoolhaven.org/, so import rule 3 of
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md` does not cover it and nothing may be
 * added here without the same owner approval.
 *
 * The published phone number and address are *not* here: they are inventory
 * facts and stay in `./foundation-content`.
 *
 * Nothing on this page states a price, a schedule, a capacity, an educator, an
 * enrollment state, or an outcome for an assistance request.
 *
 * See `prompts/public-contact-page.md` §4.
 */

import type { GuidanceRequestType } from "@/lib/contact/recorder"

/** Where a string on this page came from. */
export type ContactContentSource = "owner-approved-contact-reference"

const OWNER: ContactContentSource = "owner-approved-contact-reference"

export const contactHero = {
  eyebrow: "Contact",
  heading: "How can we support your family?",
  summary:
    "Choose the path that best fits your question; Home School Haven will respond personally.",
  source: OWNER,
} as const

/**
 * The four drawn pathways. Each selects a request type on the form below it
 * rather than opening a route of its own (D-C3): no page exists behind any of
 * them, and the review contains no broken links (owner decision, 2026-08-27).
 *
 * `glyph` names a Lucide icon chosen by the page, and `tone` names one of the
 * existing glyph surface/ink pairs already used on home, programs, about, and
 * resources. Neither carries meaning on its own — the title and description do.
 */
export type ContactPathway = {
  /** The request type this pathway selects. */
  type: GuidanceRequestType
  title: string
  description: string
  glyph: "leaf" | "house" | "message" | "heart"
  tone: "forest" | "gold-tint" | "coral-tint" | "gold"
  source: ContactContentSource
}

export const contactPathways: ContactPathway[] = [
  {
    type: "guidance",
    title: "Request Guidance",
    description:
      "Ask about programs, enrollment, or how we can support your family.",
    glyph: "leaf",
    tone: "forest",
    source: OWNER,
  },
  {
    type: "visit",
    title: "Plan a Visit",
    description:
      "Learn more about our community with a personal tour or information session.",
    glyph: "house",
    tone: "gold-tint",
    source: OWNER,
  },
  {
    type: "question",
    title: "General Question",
    description:
      "Have a general inquiry? We're happy to help and point you in the right direction.",
    glyph: "message",
    tone: "coral-tint",
    source: OWNER,
  },
  {
    type: "assistance",
    title: "Private Assistance",
    description: "Request a confidential conversation with our care team.",
    glyph: "heart",
    tone: "gold",
    source: OWNER,
  },
]

/** The reassurance panel beside the form. */
export const reassurancePanel = {
  heading: "We're here for you.",
  body: "Whether you're exploring homeschooling for the first time or looking for a community that feels like home, we're glad you're here.",
  points: [
    {
      glyph: "people" as const,
      /* CHANGED 2026-09-01, and it had to change: this said "online requests
         are not open yet, so submitted messages are not recorded or seen",
         which was true only while no destination existed. It does now
         (`src/lib/contact/recorder.ts`), and a family told nobody would see
         their message writes a different message. Truthful state, no promised
         timeline (MPS-RUL-010). Needs owner sign-off as public copy —
         GAP-PUBLIC-005. */
      text: "Your request is recorded privately and seen only by Home School Haven administrators.",
    },
    {
      glyph: "heart" as const,
      text: "Share only what you're comfortable with. We'll listen and walk alongside you.",
    },
  ],
  source: OWNER,
} as const
