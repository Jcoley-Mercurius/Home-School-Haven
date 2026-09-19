/**
 * Where each program's external checkout link comes from (MPS-REQ-013; import
 * rules 1 and 4; prompts/external-checkout-payment-truth.md §4).
 *
 * The canonical record is the "Checkout source mapping" table in
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md`. The database value is set by
 * `supabase/migrations/20260919200000_external_checkout_activation.sql`. This
 * file mirrors both so the staging catalog renders the same links, and
 * `tests/checkout-sources.test.mts` fails if any of the three disagree.
 *
 * Every destination was read from the approved source page in a real browser.
 * None is derived from a program's name or slug, and none may be: a checkout
 * link is a payment destination, and inventing one would send a family's money
 * somewhere nobody approved.
 */

/** The page Samantha Dodson confirmed as the approved checkout (2026-09-19). */
export const CHECKOUT_SOURCE_PAGE = "https://homeschoolhaven.org/classes"

export const CHECKOUT_VERIFIED_ON = "2026-09-19"

/** Home School Haven's GoDaddy business id, present in every checkout path. */
export const GODADDY_BUSINESS_ID = "2bf1b322-d362-4d5d-a4a7-5e5791473f14"

export type CheckoutMappingConfidence =
  "exact" | "ambiguous" | "inactive" | "missing"

export type CheckoutSource = {
  /** The offering as the source page names it. */
  offering: string
  /** The button's visible label, verbatim. */
  buttonLabel: string | null
  section: string
  /** GoDaddy's `data-pb-checkout-url-id`, or `null` when there is no button. */
  checkoutUrlId: string | null
  /** The stored destination: the bare checkout the button opens. */
  destination: string | null
  /** Repository programs this destination is stored on. Empty when none. */
  programs: { id: string; slug: string }[]
  confidence: CheckoutMappingConfidence
  note: string
}

const checkout = (shortName: string) =>
  `https://poynt.godaddy.com/checkout/${GODADDY_BUSINESS_ID}/${shortName}`

const CLASS_CARDS = "Class cards (no section heading)"
const CLUBS = "Check out our Clubs"

export const checkoutSources: readonly CheckoutSource[] = [
  {
    offering: "Stay & Play Sensory Day",
    buttonLabel: "Register & Pay",
    section: CLASS_CARDS,
    checkoutUrlId: "2f095262-28a4-4714-a180-d4753fd67175",
    destination: checkout("2f095262-28a4-4714-a180-d47"),
    programs: [],
    confidence: "missing",
    note: "No program in the approved offering inventory (DEC-024). Not activated; owner decision.",
  },
  {
    offering: "Haven Days Enrichment",
    buttonLabel: "Register & Pay",
    section: CLASS_CARDS,
    checkoutUrlId: "0342bb2d-f9c2-4573-a196-943133241098",
    destination: checkout("0342bb2d-f9c2-4573-a196-943"),
    programs: [
      {
        id: "10000000-0000-4000-8000-000000000002",
        slug: "haven-days-enrichment",
      },
    ],
    confidence: "exact",
    note: 'Checkout item "Enrichment program".',
  },
  {
    offering: "Ready Set Prep & Learn",
    buttonLabel: "Pay Now",
    section: CLASS_CARDS,
    checkoutUrlId: "1232e79c-3492-461d-a305-eb1bafc694c2",
    destination: checkout("1232e79c-3492-461d-a305-eb1"),
    programs: [
      { id: "10000000-0000-4000-8000-000000000009", slug: "ready-set-prep" },
      { id: "10000000-0000-4000-8000-00000000000a", slug: "ready-set-learn" },
    ],
    confidence: "exact",
    note: "One shared checkout that names both classes (Prep ages 3/4, Learn ages 4/5).",
  },
  {
    offering: "Ready Set Sensory",
    buttonLabel: "PAY NOW",
    section: CLASS_CARDS,
    checkoutUrlId: "f5bbc6ae-3bb3-424e-a014-24aa92a26e98",
    destination: checkout("f5bbc6ae-3bb3-424e-a014-24a"),
    programs: [
      { id: "10000000-0000-4000-8000-00000000000b", slug: "ready-set-sensory" },
    ],
    confidence: "exact",
    note: 'Checkout item "Ready Set Sensory".',
  },
  {
    offering: "Beginners Crocheting Class",
    buttonLabel: "Pay Now",
    section: CLASS_CARDS,
    checkoutUrlId: "a8c851d1-9461-426f-924d-7c51374a1a9a",
    destination: checkout("a8c851d1-9461-426f-924d-7c5"),
    programs: [{ id: "10000000-0000-4000-8000-00000000000e", slug: "crochet" }],
    confidence: "exact",
    note: 'Checkout item "Crocheting class". The page\'s schedule differs from DEC-024 evidence (flagged, not changed).',
  },
  {
    offering: "Sewing ( EVENING CLASS)",
    buttonLabel: "Pay Now",
    section: CLASS_CARDS,
    checkoutUrlId: "568b1ef2-952a-499b-878a-5992850c3133",
    destination: checkout("568b1ef2-952a-499b-878a-599"),
    programs: [{ id: "10000000-0000-4000-8000-000000000005", slug: "sewing" }],
    confidence: "exact",
    note: 'Checkout item "Sewing ( evening)".',
  },
  {
    offering: "Gardening Club",
    buttonLabel: "PAY NOW",
    section: CLUBS,
    checkoutUrlId: "cd911575-37c3-4e2e-ad66-1b222c943122",
    destination: checkout("cd911575-37c3-4e2e-ad66-1b2"),
    programs: [
      { id: "10000000-0000-4000-8000-000000000006", slug: "gardening" },
    ],
    confidence: "exact",
    note: 'Checkout item "Gardening Club". Its "Weekly fee $35" is QA-007 evidence; no price is published.',
  },
  {
    offering: "MONTHLY THEMED CLUBS",
    buttonLabel: "PAY NOW",
    section: CLUBS,
    checkoutUrlId: "7fa2bfc8-430f-48e3-8ea7-c0111da5a66f",
    destination: checkout("7fa2bfc8-430f-48e3-8ea7-c01"),
    programs: [
      { id: "10000000-0000-4000-8000-00000000000d", slug: "monthly-clubs" },
    ],
    confidence: "exact",
    note: 'Checkout item "Monthly Clubs".',
  },
  {
    offering: "Beginners Drumming Class",
    buttonLabel: null,
    section: CLASS_CARDS,
    checkoutUrlId: null,
    destination: null,
    programs: [],
    confidence: "inactive",
    note: '"COMING SOON"; no checkout action and no program.',
  },
  {
    offering: "Tutoring",
    buttonLabel: null,
    section: "—",
    checkoutUrlId: null,
    destination: null,
    programs: [
      { id: "10000000-0000-4000-8000-00000000000c", slug: "tutoring" },
    ],
    confidence: "missing",
    note: "No checkout action on the source page. checkout_url stays NULL.",
  },
]

/**
 * The approved checkout link for a program slug, or `null`.
 *
 * Only `exact` rows count. A `missing` row that lists a program (Tutoring) is
 * there to record that it was looked for, not to supply a link.
 * @param slug - The program's slug.
 * @returns The destination, or `null` when none is approved.
 */
export function checkoutUrlForSlug(slug: string): string | null {
  const source = checkoutSources.find(
    (s) => s.confidence === "exact" && s.programs.some((p) => p.slug === slug),
  )
  return source?.destination ?? null
}
