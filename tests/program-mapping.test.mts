/**
 * Program row → `Program` mapping (MPS-REQ-008, MPS-REQ-020).
 *
 * The mapping is where a schema change silently becomes a wrong public page, so
 * the cases below are the ones that would be quietly wrong rather than loud:
 * an unpublished fact must stay `null` and never become "", and an unverified
 * detail must survive as data without being promoted to a published field.
 *
 * Run with: npm run test:unit
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { mapProgramRow } from "../src/lib/programs/map-program-row.ts"

import type { ProgramRow } from "../src/lib/programs/map-program-row.ts"
import type { Program } from "../src/content/programs.ts"

/** A row with every published fact absent — the common case in this catalog. */
function bareRow(overrides: Partial<ProgramRow> = {}): ProgramRow {
  return {
    slug: "sewing",
    name: "Sewing",
    published_dates: null,
    published_schedule: null,
    published_duration: null,
    published_session_length: null,
    published_price: null,
    published_registration_options: null,
    summary: null,
    audience: null,
    format: null,
    location: null,
    educator: null,
    enrollment_window: null,
    availability: "unknown",
    checkout_url: null,
    import_status: "import",
    source: "BETA-CONTENT-IMPORT-INVENTORY — Published program inventory",
    unverified_details: [],
    image_src: null,
    image_alt: null,
    image_width: null,
    image_height: null,
    image_is_placeholder: false,
    sort_order: 5,
    ...overrides,
  }
}

test("an unpublished fact stays null and is never coerced to a string", () => {
  const program = mapProgramRow(bareRow())

  const unpublished: (keyof Program)[] = [
    "publishedDates",
    "publishedSchedule",
    "publishedDuration",
    "publishedPrice",
    "summary",
    "audience",
    "format",
    "location",
    "educator",
    "enrollmentWindow",
    "checkoutUrl",
  ]

  for (const field of unpublished) {
    assert.equal(
      program[field],
      null,
      `${field} must stay null — an empty string would render as a published blank`,
    )
  }
})

test("a published fact is preserved exactly as written", () => {
  const program = mapProgramRow(
    bareRow({
      published_price: "$180 for all six weeks",
      published_dates: "August 20–September 24",
    }),
  )

  assert.equal(program.publishedPrice, "$180 for all six weeks")
  assert.equal(program.publishedDates, "August 20–September 24")
})

test("availability defaults to unknown rather than to open", () => {
  // Showing a program as open would invent a capacity fact the source does not
  // publish (import rule 3).
  assert.equal(mapProgramRow(bareRow()).availability, "unknown")
})

test("unverified details survive as data and are not promoted to a field", () => {
  const program = mapProgramRow(
    bareRow({
      slug: "etiquette-series",
      unverified_details: ["September 11–October 2 (association unproven)"],
    }),
  )

  assert.deepEqual(program.unverifiedDetails, [
    "September 11–October 2 (association unproven)",
  ])
  assert.equal(
    program.publishedDates,
    null,
    "an unproven date must not become a published date",
  )
})

test("a non-array unverified_details value degrades to an empty list", () => {
  // jsonb is only constrained to be an array by a CHECK; this is the belt to
  // that braces, so a bad row cannot crash the public catalog.
  const program = mapProgramRow(bareRow({ unverified_details: null }))
  assert.deepEqual(program.unverifiedDetails, [])
})

test("a complete image maps to a placeholder image", () => {
  const program = mapProgramRow(
    bareRow({
      image_src: "/placeholder/program-art-lab.jpg",
      image_alt: "Placeholder photo — demo only.",
      image_width: 456,
      image_height: 474,
      image_is_placeholder: true,
    }),
  )

  assert.deepEqual(program.image, {
    src: "/placeholder/program-art-lab.jpg",
    alt: "Placeholder photo — demo only.",
    width: 456,
    height: 474,
    isPlaceholder: true,
  })
})

test("a partial image maps to no image rather than a broken one", () => {
  const program = mapProgramRow(bareRow({ image_src: "/placeholder/x.jpg" }))
  assert.equal(
    program.image,
    null,
    "an image without alt text must not reach the page",
  )
})
