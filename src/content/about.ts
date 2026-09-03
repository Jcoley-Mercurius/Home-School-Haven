/**
 * Public About page content.
 *
 * Unlike every other public content module, this one carries three
 * provenances, and each entry records which it is:
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
 *   - `"published-about-page"` — a fact published on
 *     https://homeschoolhaven.org/about-us. Only the staff profiles carry it;
 *     see `staffProfiles` below for the rules that govern them.
 *
 * The distinction is kept so a later content review can tell which strings a
 * source page can be checked against and which came from the owner directly.
 * Nothing may be added to either group without the matching authority.
 *
 * See `prompts/public-about-page.md` §3–§4.
 */

import type { ApprovedPhoto } from "./programs"

/** Where a string on this page came from. */
export type AboutContentSource =
  | "beta-content-import-inventory"
  | "owner-approved-about-reference"
  /** A fact published on https://homeschoolhaven.org/about-us. See `staffProfiles`. */
  | "published-about-page"

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

/**
 * Published staff profiles.
 *
 * These carry a third provenance, distinct from the two above:
 * `"published-about-page"` — facts published on
 * https://homeschoolhaven.org/about-us, captured 2026-09-02. They are neither
 * an import-inventory row nor owner image copy, so they are tagged separately
 * and can be re-verified against that page at any time.
 *
 * Hard rules for this array (AGENTS.md §6, §11; MPS-ACC-009/010):
 *
 *   - Every credential, year count, role, and personal statement below appears
 *     on that page. Nothing is inferred, rounded, or filled in.
 *   - No value here comes from an `educators` row, an educator assignment, or
 *     any authenticated record. A person's account is not authorization to
 *     publish a profile for them.
 *   - Nobody is added without the published page listing them.
 *
 * Light editorial corrections applied, meaning unchanged (slice HSH-SLICE-
 * PUBLIC-03B): decorative emoji removed from the heading lines, "everyday" →
 * "every day" where used adverbially, "Faith filled" → "Faith-filled", and the
 * brand name normalized from the source page's "Homeschool Haven" to the
 * approved "Home School Haven". No other word is changed.
 */
const PUBLISHED: AboutContentSource = "published-about-page"

export type StaffProfile = {
  /**
   * The name exactly as the published page gives it. Samantha is published
   * with no surname; that is her own published choice about her public profile
   * and is not overridden from project authority elsewhere.
   */
  name: string
  role: string
  /** The page's personal lead-in, where it gives one. */
  lede: string | null
  /** Bio paragraphs, in published order. */
  paragraphs: string[]
  /**
   * Owner-supplied approved photograph, or null where none is cleared.
   *
   * These are NOT the images on the published About page — those carry no alt
   * text tying either to a person and could not be attributed without
   * guessing. They were supplied directly by Samantha on 2026-09-02, with the
   * owner confirming Heidi and Celina are aware and agreed. Provenance for
   * each file is recorded in `public/photography/README.md`.
   */
  portrait: ApprovedPhoto | null
  source: AboutContentSource
}

export const staffProfiles: StaffProfile[] = [
  {
    name: "Samantha",
    role: "Founder",
    lede: "It's me Sam!",
    paragraphs: [
      "Faith-filled mama to 5 running multiple businesses with my husband Matthew and stepping into my purpose more and more every day!",
      "The vision behind Home School Haven was truly placed on my heart by God.",
      "For over 16 years, I've built a career in the hair industry while navigating the beautiful journey of motherhood. Throughout those years, my husband and I faced many challenges within the public school system and watched our first three children struggle in ways that broke our hearts. We knew there had to be a better way, one that nurtured their minds, honored their individuality, and strengthened their faith.",
      "That desire for something different became the foundation of Home School Haven. It's a space designed to bring families together to encourage a love of learning, and to remind parents, children and educators that education can be peaceful, purposeful and led by God's guidance.",
    ],
    portrait: {
      src: "/photography/staff-samantha.webp",
      alt: "Samantha, founder of Home School Haven, outside the Cape Coral space.",
      width: 300,
      height: 300,
      isPlaceholder: false,
    },
    source: PUBLISHED,
  },
  {
    name: "Heidi Endress",
    role: "Lead Educator",
    lede: null,
    paragraphs: [
      "Heidi brings 36 years of experience in elementary education, working with students from Pre-K through fifth grade. For the past 10 years, she has served as an elementary Art Director and visual arts teacher. She holds a degree in Commercial Art, has an extensive knowledge of art history, and is also a certified Therapeutic Art Life Coach.",
      "In addition to teaching, Heidi coaches high school athletics, leads private art experiences through her business, Art Waves of Positive Energy, and teaches at the Alliance for the Arts in Fort Myers, where she also serves as a Summer Art Director.",
      "Heidi loves God, sharing His light, serving others, and embracing the beauty of nature. She brings her joyful “aloha spirit” into everything she does and believes art helps children express emotions, build confidence, develop friendships, and discover their own unique creativity.",
      "When she isn't teaching or coaching, you'll likely find her painting, spending time in nature, or dreaming up new ways to bring creativity and positive energy into her lessons.",
      "We are incredibly grateful to have Heidi as part of the Home School Haven family. Her experience, passion, warmth, and genuine love for children make her such a special part of our community!",
    ],
    portrait: {
      src: "/photography/staff-heidi-endress.webp",
      alt: "Heidi Endress, Lead Educator, smiling outdoors.",
      width: 600,
      height: 600,
      isPlaceholder: false,
    },
    source: PUBLISHED,
  },
  {
    name: "Celina Carlin",
    role: "Community Engagement & Campus Culture Coordinator",
    lede: null,
    paragraphs: [
      "Celina is a Florida native who loves sunshine, the outdoors, and hands-on learning. Energetic, creative, and engaging, she creates a warm environment where children feel encouraged to explore, ask questions, and grow in confidence.",
      "Inspired by her mother's daycare, Celina began working with children at an early age. She has since gained extensive experience teaching her own children, as well as neighborhood and extended family children, through activities in arts and crafts, science, gardening, and sewing.",
      "As a certified horticulturist with certifications in Agricultural Science, Soil Science, and Plant Nutrition, Celina brings specialized knowledge of plants, gardening, soil, and the natural world to her teaching. She believes children learn best through observation, exploration, and hands-on discovery. Her goal is to nurture curiosity, creativity, independence, and confidence while helping children connect learning to real-world experiences.",
      "We are so grateful to have Mrs. Celina as part of the Home School Haven family. Her warmth, creativity, hands-on experience, specialized knowledge, and genuine love for children make her a wonderful addition to our community!",
    ],
    portrait: {
      src: "/photography/staff-celina-carlin.webp",
      alt: "Celina Carlin, Community Engagement & Campus Culture Coordinator.",
      width: 600,
      height: 600,
      isPlaceholder: false,
    },
    source: PUBLISHED,
  },
]

export const staffIntro = {
  heading: "Meet our team",
  summary:
    "The founder and educators who welcome your family to Home School Haven.",
  source: PUBLISHED,
} as const
