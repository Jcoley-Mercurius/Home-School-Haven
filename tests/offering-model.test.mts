/**
 * Public offering model and factual content (Closeout Slice 1; owner evidence
 * of 2026-09-14; prompts/public-offering-model.md).
 *
 * What these pin is what would be quietly wrong rather than loud: a price typed
 * a little differently, a year that crept in, a contradicted price that got
 * published anyway, or a withdrawn offering that came back.
 *
 * `src/content/programs.ts` mirrors the rows the 20260916000000 migration
 * writes, so the facts asserted here are the facts the database holds; the
 * pgTAP test `150_public_offering_model.test.sql` asserts the database side.
 *
 * Run with: npm run test:unit
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  groupPrograms,
  OFFERING_GROUPS,
  OFFERING_ORDER,
  offeringLabel,
} from "../src/lib/programs/offering-groups.ts"
import {
  featuredSlugs,
  programs,
  publishedFacts,
} from "../src/content/programs.ts"
import {
  calendarEntries,
  entriesInMonth,
  scheduleAndSeasons,
} from "../src/content/calendar.ts"
import { checkoutUrlForSlug } from "../src/content/checkout-sources.ts"
import { contact } from "../src/content/foundation-content.ts"

import type { Program } from "../src/content/programs.ts"

function program(slug: string): Program {
  const found = programs.find((candidate) => candidate.slug === slug)
  assert.ok(found, `${slug} must be published`)
  return found
}

const ARCHIVED_SLUGS = [
  "ready-set-prep-and-learn",
  "etiquette-series",
  "art-lab",
  "harvest-explorers",
  "history-explorers",
]

const ARCHIVED_NAMES = [
  "Ready Set Prep & Learn",
  "Etiquette Series",
  "Art Lab",
  "Harvest Explorers",
  "History Explorers",
]

describe("taxonomy and grouping", () => {
  it("presents the five offering groups in the approved order", () => {
    assert.deepEqual(OFFERING_ORDER, [
      "haven_days",
      "ready_set",
      "individual_class",
      "tutoring",
      "monthly_club",
    ])
    assert.deepEqual(
      OFFERING_ORDER.map((type) => OFFERING_GROUPS[type].heading),
      [
        "Haven Days",
        "Ready Set programs",
        "Individual classes",
        "Tutoring",
        "Monthly clubs",
      ],
    )
  })

  it("groups the published catalog without dropping or duplicating anything", () => {
    const groups = groupPrograms(programs)

    assert.deepEqual(
      groups.map((group) => [
        group.type,
        group.programs.map((item) => item.slug),
      ]),
      [
        ["haven_days", ["haven-days-enrichment"]],
        [
          "ready_set",
          ["ready-set-prep", "ready-set-learn", "ready-set-sensory"],
        ],
        ["individual_class", ["sewing", "crochet", "gardening"]],
        ["tutoring", ["tutoring"]],
        ["monthly_club", ["monthly-clubs"]],
      ],
    )
    assert.equal(
      groups.reduce((total, group) => total + group.programs.length, 0),
      programs.length,
    )
  })

  it("keeps Haven Days out of the individual classes", () => {
    const classes = groupPrograms(programs).find(
      (group) => group.type === "individual_class",
    )
    assert.ok(classes)
    assert.ok(
      classes.programs.every((item) => !item.name.startsWith("Haven Days")),
    )
    assert.equal(program("haven-days-enrichment").offeringType, "haven_days")
  })

  it("leaves out a group with nothing in it rather than an empty heading", () => {
    const groups = groupPrograms([program("tutoring")])
    assert.deepEqual(
      groups.map((group) => group.type),
      ["tutoring"],
    )
  })

  it("never invents a group for an unclassified program", () => {
    const unclassified = { ...program("sewing"), offeringType: null }
    assert.deepEqual(groupPrograms([unclassified]), [])
    assert.equal(offeringLabel(null), "Program")
    assert.equal(offeringLabel("ready_set"), "Ready Set program")
  })

  it("every published program carries an offering type", () => {
    for (const item of programs) {
      assert.notEqual(item.offeringType, null, `${item.slug} is unclassified`)
    }
  })
})

describe("verified prices and schedules", () => {
  const expected: Record<
    string,
    Partial<
      Pick<
        Program,
        | "name"
        | "audience"
        | "publishedSchedule"
        | "publishedDates"
        | "publishedDuration"
        | "publishedPrice"
        | "publishedRegistrationOptions"
        | "summary"
      >
    >
  > = {
    "ready-set-prep": {
      name: "Ready Set Prep",
      audience: "Ages 3–4",
      publishedSchedule: "Tuesday and Thursday, 9:15–11:30 AM",
      publishedDates: "August–May",
      publishedPrice: "$80/week",
      publishedRegistrationOptions:
        "Ready Set Prep and Ready Set Learn combined: $140/week",
    },
    "ready-set-learn": {
      name: "Ready Set Learn",
      audience: "Ages 4–5",
      publishedSchedule: "Tuesday and Thursday, 11:45 AM–2:00 PM",
      publishedDates: "August–May",
      publishedPrice: "$80/week",
      publishedRegistrationOptions:
        "Ready Set Prep and Ready Set Learn combined: $140/week",
    },
    "ready-set-sensory": {
      name: "Ready Set Sensory",
      audience: "Ages 3–5",
      publishedSchedule: "Wednesday, 9:30–11:30 AM",
      publishedDates: null,
      publishedPrice: "$45/week",
    },
    "haven-days-enrichment": {
      name: "Haven Days",
      publishedSchedule: "Tuesday, Wednesday, and Thursday, 9:00 AM–1:30 PM",
      publishedDates: "September–June",
      publishedPrice:
        "One day $280/month; two days $550/month; three days $795/month",
    },
    sewing: {
      name: "Sewing",
      publishedSchedule: "Wednesday, 4:45–6:15 PM",
      publishedDates: null,
      publishedDuration: "Eight weeks",
      publishedPrice: "$45/week",
      publishedRegistrationOptions:
        "$20 non-refundable deposit when paying weekly; no deposit when paying in full",
    },
    tutoring: {
      name: "Tutoring",
      audience: "Kindergarten and up",
      publishedSchedule: "Tuesday, Wednesday, and Thursday",
      publishedPrice: "$65/hour or $40/half-hour",
      summary: "Academic skill building, homework help, and test preparation.",
    },
    "monthly-clubs": {
      name: "Monthly Clubs",
      publishedSchedule: "Thursday, 4:30–6:30 PM",
      publishedDates: null,
      publishedPrice: "$100/month or $30 drop-in",
      summary: "The first club is Lego.",
    },
    crochet: {
      name: "Crochet",
      publishedSchedule: "Mondays in November, 2:00–4:00 PM",
      publishedDates: "November",
      publishedDuration: "Four weeks",
      publishedPrice: "$250, including materials",
      audience: null,
    },
    gardening: {
      name: "Gardening",
      audience: "Ages 5 and up",
      publishedSchedule: "Thursday, 2:15–3:15 PM",
      publishedDates: "October–June; no class during the final week of October",
    },
  }

  for (const [slug, facts] of Object.entries(expected)) {
    it(`${slug} publishes exactly the verified facts`, () => {
      const actual = program(slug)
      for (const [field, value] of Object.entries(facts)) {
        assert.equal(actual[field as keyof Program], value, `${slug}.${field}`)
      }
    })
  }

  it("publishes exactly nine offerings", () => {
    assert.equal(programs.length, 9)
  })

  it("claims no capacity, educator, location, or enrollment window", () => {
    for (const item of programs) {
      assert.equal(item.availability, "unknown", item.slug)
      assert.equal(item.educator, null, item.slug)
      assert.equal(item.location, null, item.slug)
      assert.equal(item.enrollmentWindow, null, item.slug)
    }
  })

  it("carries only the checkout link the approved classes page publishes", () => {
    /* prompts/external-checkout-payment-truth.md §4. Tutoring has no checkout
       action on the source page, so it has no link; nothing is constructed. */
    for (const item of programs) {
      assert.equal(item.checkoutUrl, checkoutUrlForSlug(item.slug), item.slug)
    }
    assert.equal(program("tutoring").checkoutUrl, null)
  })

  it("puts age or grade on the card before the price", () => {
    assert.deepEqual(publishedFacts(program("ready-set-prep")), [
      "August–May",
      "Tuesday and Thursday, 9:15–11:30 AM",
      "Ages 3–4",
      "$80/week",
    ])
  })
})

describe("Gardening price stays unpublished", () => {
  it("has no published price while the flyer and email disagree", () => {
    const gardening = program("gardening")
    assert.equal(gardening.publishedPrice, null)
    assert.ok(
      publishedFacts(gardening).every((fact) => !fact.includes("$")),
      "no card fact may carry a Gardening price",
    )
  })

  it("keeps the conflict as an unrendered review detail, flagged for review", () => {
    const gardening = program("gardening")
    assert.equal(gardening.importStatus, "import-title-review-detail")
    assert.equal(gardening.unverifiedDetails.length, 1)
    assert.match(gardening.unverifiedDetails[0], /\$35\/week/)
    assert.match(gardening.unverifiedDetails[0], /\$35 drop-in/)
    assert.match(gardening.unverifiedDetails[0], /QA-007/)
  })
})

describe("unknown years stay unknown", () => {
  const YEAR = /\b(19|20)\d{2}\b/

  it("no published offering fact carries a year", () => {
    for (const item of programs) {
      for (const fact of [
        ...publishedFacts(item),
        item.publishedRegistrationOptions,
        item.summary,
      ]) {
        if (fact) assert.doesNotMatch(fact, YEAR, `${item.slug}: ${fact}`)
      }
    }
  })

  it("month and weekday schedules are listed, never plotted", () => {
    const listed = scheduleAndSeasons(programs)
    assert.equal(listed.length, 9)
    assert.deepEqual(
      listed.find((item) => item.slug === "crochet"),
      {
        slug: "crochet",
        name: "Crochet",
        schedule: "Mondays in November, 2:00–4:00 PM",
        season: "November",
      },
    )
    /* Nothing on the grid comes from an offering: every plotted entry is a
       dated inventory event with a published day and year. */
    for (const entry of calendarEntries) {
      assert.match(entry.publishedDetail, YEAR, entry.id)
    }
    /* November of any year shows no Crochet, and no month shows Sewing or a
       club — none publishes a date to plot. */
    for (const year of [2026, 2027]) {
      for (let month = 0; month < 12; month += 1) {
        for (const entry of entriesInMonth({ year, month }, calendarEntries)) {
          assert.doesNotMatch(entry.title, /Crochet|Sewing|Club|Gardening/)
        }
      }
    }
  })

  it("orders the calendar's schedule list by offering group", () => {
    assert.deepEqual(
      scheduleAndSeasons([...programs].reverse()).map((item) => item.slug),
      [
        "haven-days-enrichment",
        "ready-set-sensory",
        "ready-set-learn",
        "ready-set-prep",
        "gardening",
        "crochet",
        "sewing",
        "tutoring",
        "monthly-clubs",
      ],
    )
  })

  it("retires QA-002's anomalous Ready Set range", () => {
    const text = JSON.stringify({ programs, calendarEntries })
    assert.ok(!text.includes("August 2026–May 2026"))
  })
})

describe("address replacement", () => {
  it("publishes the owner-confirmed address", () => {
    assert.deepEqual(contact.addressLines, [
      "1329 Hibiscus Drive",
      "Cape Coral, FL 33909",
    ])
  })

  it("does not carry the previous address anywhere in public content", () => {
    const text = JSON.stringify({ contact, programs, calendarEntries })
    assert.ok(!text.includes("Del Prado"))
    assert.ok(!text.includes("Suite D"))
  })
})

describe("removed offerings do not reappear", () => {
  it("no archived offering is in the published catalog", () => {
    const slugs = programs.map((item) => item.slug)
    const names = programs.map((item) => item.name)
    for (const slug of ARCHIVED_SLUGS) assert.ok(!slugs.includes(slug), slug)
    for (const name of ARCHIVED_NAMES) assert.ok(!names.includes(name), name)
  })

  it("no archived offering is featured or linked from the calendar", () => {
    for (const slug of ARCHIVED_SLUGS) {
      assert.ok(!(featuredSlugs as readonly string[]).includes(slug), slug)
    }
    for (const entry of calendarEntries) {
      if (entry.program) {
        assert.ok(!ARCHIVED_SLUGS.includes(entry.program.slug), entry.id)
      }
      assert.ok(!entry.title.includes("Art Lab"), entry.id)
    }
  })

  it("every featured slug is published", () => {
    for (const slug of featuredSlugs) program(slug)
  })
})
