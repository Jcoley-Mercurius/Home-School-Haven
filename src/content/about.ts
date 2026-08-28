/**
 * Public About page content.
 *
 * Unlike every other public content module, this one carries two provenances,
 * and each entry records which it is:
 *
 *   - `"beta-content-import-inventory"` — a fact published on
 *     https://homeschoolhaven.org/ and recorded in
 *     `mps/BETA-CONTENT-IMPORT-INVENTORY.md`. The values band is the only such
 *     content here, and it is re-exported from `./foundation-content`.
 *   - `"owner-approved-about-reference"` — copy drawn in
 *     `mds/references/proposed/public-about-proposed.png` and approved verbatim
 *     by the owner on 2026-08-28 ("Approved, but keep image copy"). It is the
 *     owner's own words for this page, not an import, and it is not covered by
 *     import rule 3.
 *
 * The distinction is kept so a later content review can tell which strings a
 * source page can be checked against and which came from the owner directly.
 * Nothing may be added to either group without the matching authority.
 *
 * See `prompts/public-about-page.md` §3–§4.
 */

/** Where a string on this page came from. */
export type AboutContentSource =
  "beta-content-import-inventory" | "owner-approved-about-reference"

const OWNER: AboutContentSource = "owner-approved-about-reference"

export const aboutHero = {
  // Drawn verbatim in the owner-approved image copy (2026-08-28).
  eyebrow: "ABOUT HOME SCHOOL HAVEN",
  heading: "A haven for curious learners and connected families",
  summary:
    "Home School Haven is a Christ-centered homeschool community offering enrichment classes, hands-on workshops, small-group learning, and family support.",
  mission:
    "Our mission is simple: to cultivate calm, confident, and compassionate learners through creativity, curiosity, and connection.",
  source: OWNER,
} as const

export type ApproachItem = {
  title: string
  description: string
  source: AboutContentSource
}

export const approachItems: ApproachItem[] = [
  {
    title: "Calm, hands-on learning",
    description:
      "Our classes and workshops encourage hands-on experiences that spark imagination, build skills, and nurture a love of learning.",
    source: OWNER,
  },
  {
    title: "Relationship-centered community",
    description:
      "We believe learning happens best in community. Small classes, meaningful connections, and supportive families help every child thrive.",
    source: OWNER,
  },
]

/**
 * The Scripture selection is the owner's, approved with the rest of the image
 * copy. No translation is named because none was supplied; naming one would
 * assert a fact the owner has not given (open item, prompt §12).
 */
export const faithPanel = {
  heading: "Faith expressed through character",
  body: "We are a Christ-centered community shaping hearts as well as minds. Through prayer, service, and Scripture-inspired teaching, we encourage children to reflect God's love in their words, choices, and relationships.",
  quote:
    "Let your light shine before others, that they may see your good deeds and glorify your Father in heaven.",
  attribution: "Matthew 5:16",
  source: OWNER,
} as const

export type CommunityGroup = {
  name: string
  description: string
  source: AboutContentSource
}

/**
 * Groups, not people. The published educator roster in the import inventory is
 * deliberately not merged in here: the approved composition describes the
 * community in groups, and attaching named educators to it would be a
 * composition the owner has not approved (prompt §4, D-A9).
 */
export const communityGroups: CommunityGroup[] = [
  {
    name: "Educators",
    description:
      "Experienced, caring educators who love to teach, mentor, and inspire.",
    source: OWNER,
  },
  {
    name: "Mentors",
    description:
      "Skilled mentors guiding projects, skills, and personal growth.",
    source: OWNER,
  },
  {
    name: "Families",
    description:
      "Supportive families building friendships and learning together.",
    source: OWNER,
  },
  {
    name: "Community",
    description: "A welcoming community united by faith, values, and purpose.",
    source: OWNER,
  },
]

export const communityIntro = {
  heading: "Meet our community",
  summary:
    "A diverse group of educators, mentors, and families who are passionate about nurturing the whole child.",
  source: OWNER,
} as const

export const aboutClosing = {
  // Drawn verbatim in the owner-approved image copy (2026-08-28).
  prompt: "Ready to learn more about our programs and community?",
  source: OWNER,
} as const
