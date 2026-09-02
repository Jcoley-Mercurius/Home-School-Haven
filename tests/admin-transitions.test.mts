import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ADMIN_ENROLLMENT_TARGETS,
  allowedEnrollmentTargets,
  allowedPublicationTargets,
  isEnrollmentTransitionAllowed,
  isPublicationTransitionAllowed,
} from "../src/lib/admin/transitions.ts"
import {
  matchesSearch,
  parseEnrollmentFilters,
  parseProgramFilters,
} from "../src/lib/admin/filters.ts"
import {
  createProgramSchema,
  enrollmentStateSchema,
  programFactsSchema,
  publicationSchema,
} from "../src/lib/admin/validation.ts"
import type { EnrollmentState } from "../src/lib/admin/transitions.ts"

/**
 * The three pieces of this slice that decide what an administrator may do, and
 * what an untrusted request is allowed to become.
 *
 * The transition tables are the product's answer to "which enrollment and
 * publication changes are approved". The database holds the authoritative copy
 * and the pgTAP suite pins that one; this pins the copy the UI renders buttons
 * from, because a divergence between them would show an administrator an action
 * that is refused — or worse, hide one that is allowed.
 *
 * The filters parse query strings, which are whatever someone typed into the
 * address bar. What matters is that a hostile or malformed value degrades to
 * "show everything this viewer is already authorized to see" rather than to an
 * error or, far worse, to a widened query.
 *
 * The validation schemas are where a forged form body meets a rule. The
 * checkout-URL cases are the sharpest: that field is a payment destination and
 * a place private data could leave the platform in a query string.
 */

const ALL_ENROLLMENT_STATES: EnrollmentState[] = [
  "started",
  "approval_pending",
  "payment_pending",
  "waitlisted",
  "confirmed",
  "payment_failed",
  "canceled",
  "blocked",
]

describe("enrollment transitions", () => {
  it("offers only the four states an administrator actually decides", () => {
    for (const from of ALL_ENROLLMENT_STATES) {
      for (const target of allowedEnrollmentTargets(from)) {
        assert.ok(
          (ADMIN_ENROLLMENT_TARGETS as readonly string[]).includes(target),
          `${from} → ${target} is not an administrative decision`,
        )
      }
    }
  })

  it("never offers started, approval_pending, or payment_failed as a target", () => {
    /* These are outcomes of the family journey and the payment path. An
       administrator setting `payment_failed` would be asserting a payment fact
       this product holds no evidence for (GAP-ADMIN-002). */
    for (const from of ALL_ENROLLMENT_STATES) {
      for (const forbidden of [
        "started",
        "approval_pending",
        "payment_failed",
      ] as const) {
        assert.equal(
          isEnrollmentTransitionAllowed(from, forbidden),
          false,
          `${from} → ${forbidden} must never be allowed`,
        )
      }
    }
  })

  it("refuses payment_failed → confirmed but allows the two-step correction", () => {
    assert.equal(
      isEnrollmentTransitionAllowed("payment_failed", "confirmed"),
      false,
    )
    assert.equal(
      isEnrollmentTransitionAllowed("payment_failed", "blocked"),
      true,
    )
    assert.equal(isEnrollmentTransitionAllowed("blocked", "confirmed"), true)
  })

  it("refuses confirmed → blocked, the correction path the owner declined", () => {
    /* GAP-ADMIN-008. If this ever passes, either the owner approved the
       correction path and the migration was updated, or someone widened the
       table without approval. Both need the SQL changed too. */
    assert.equal(isEnrollmentTransitionAllowed("confirmed", "blocked"), false)
    assert.equal(
      isEnrollmentTransitionAllowed("confirmed", "waitlisted"),
      false,
    )
    assert.deepEqual(allowedEnrollmentTargets("confirmed"), ["canceled"])
  })

  it("treats canceled as terminal", () => {
    assert.deepEqual(allowedEnrollmentTargets("canceled"), [])
    for (const target of ADMIN_ENROLLMENT_TARGETS) {
      assert.equal(isEnrollmentTransitionAllowed("canceled", target), false)
    }
  })

  it("never offers a state as a transition to itself", () => {
    for (const from of ALL_ENROLLMENT_STATES) {
      assert.equal(
        isEnrollmentTransitionAllowed(from, from),
        false,
        `${from} → ${from} should be a no-op, not an offered action`,
      )
    }
  })

  it("lets every pending state reach confirmed, waitlisted, blocked, and canceled", () => {
    for (const from of [
      "started",
      "approval_pending",
      "payment_pending",
    ] as const) {
      assert.deepEqual([...allowedEnrollmentTargets(from)].sort(), [
        "blocked",
        "canceled",
        "confirmed",
        "waitlisted",
      ])
    }
  })
})

describe("program publication transitions", () => {
  it("allows publish, unpublish, archive, and restore", () => {
    assert.equal(isPublicationTransitionAllowed("draft", "published"), true)
    assert.equal(isPublicationTransitionAllowed("published", "draft"), true)
    assert.equal(isPublicationTransitionAllowed("draft", "archived"), true)
    assert.equal(isPublicationTransitionAllowed("published", "archived"), true)
    assert.equal(isPublicationTransitionAllowed("archived", "draft"), true)
  })

  it("refuses archived → published, so restoring never publishes by accident", () => {
    /* An archived program's details may be stale. Restoring it returns it to
       the working list as a draft; publishing is then a separate, deliberate,
       separately audited decision. */
    assert.equal(isPublicationTransitionAllowed("archived", "published"), false)
    assert.deepEqual(allowedPublicationTargets("archived"), ["draft"])
  })

  it("never offers a publication state as a transition to itself", () => {
    for (const state of ["draft", "published", "archived"] as const) {
      assert.equal(isPublicationTransitionAllowed(state, state), false)
    }
  })
})

describe("program filters", () => {
  it("defaults to an unnarrowed list", () => {
    const filters = parseProgramFilters({})
    assert.deepEqual(filters, { status: "all", search: "", active: false })
  })

  it("falls back to all for an unrecognised status rather than erroring", () => {
    assert.equal(parseProgramFilters({ status: "deleted" }).status, "all")
    assert.equal(parseProgramFilters({ status: "'; drop table" }).status, "all")
    assert.equal(parseProgramFilters({ status: "" }).status, "all")
  })

  it("takes the first value of a repeated parameter, deterministically", () => {
    assert.equal(
      parseProgramFilters({ status: ["draft", "published"] }).status,
      "draft",
    )
  })

  it("clamps an over-long search rather than rejecting it", () => {
    const filters = parseProgramFilters({ q: "a".repeat(500) })
    assert.equal(filters.search.length, 80)
  })

  it("reports whether any filter is narrowing the list", () => {
    assert.equal(parseProgramFilters({ q: "art" }).active, true)
    assert.equal(parseProgramFilters({ status: "draft" }).active, true)
    assert.equal(parseProgramFilters({ status: "all", q: "" }).active, false)
  })
})

describe("enrollment filters", () => {
  it("defaults to an unnarrowed list", () => {
    const filters = parseEnrollmentFilters({})
    assert.deepEqual(filters, { state: "all", program: "", active: false })
  })

  it("accepts every real enrollment state", () => {
    for (const state of ALL_ENROLLMENT_STATES) {
      assert.equal(parseEnrollmentFilters({ state }).state, state)
    }
  })

  it("falls back to all for an unrecognised state", () => {
    assert.equal(parseEnrollmentFilters({ state: "paid" }).state, "all")
    assert.equal(parseEnrollmentFilters({ state: "refunded" }).state, "all")
  })
})

describe("search matching", () => {
  it("matches case- and accent-insensitively", () => {
    assert.equal(matchesSearch("Art Lab", "art"), true)
    assert.equal(matchesSearch("Art Lab", "LAB"), true)
    assert.equal(matchesSearch("Café Morning", "cafe"), true)
  })

  it("matches everything when the term is empty", () => {
    assert.equal(matchesSearch("Anything", ""), true)
  })

  it("does not match an unrelated term", () => {
    assert.equal(matchesSearch("Art Lab", "sewing"), false)
  })
})

describe("checkout URL validation", () => {
  const base = {
    programId: "00000000-0000-4000-8000-000000000001",
    expectedUpdatedAt: "2026-08-30T00:00:00Z",
    name: "Art Lab",
    summary: "",
    audience: "",
    format: "",
    location: "",
    educator: "",
    dates: "",
    schedule: "",
    duration: "",
    sessionLength: "",
    price: "",
    availability: "unknown",
    /* Required since the conversion-journey slice: MPS-RUL-001 gives every
       program a confirmation mode, and the schema will not accept a save that
       omits it. */
    confirmationMode: "administrator_approval",
  }

  const parse = (checkoutUrl: string) =>
    programFactsSchema.safeParse({ ...base, checkoutUrl })

  it("accepts the approved host over https", () => {
    assert.equal(parse("https://pay.homeschoolhaven.org/art-lab").success, true)
    assert.equal(parse("https://pay.homeschoolhaven.org").success, true)
  })

  it("accepts an empty value and stores it as null, not an empty string", () => {
    const result = parse("")
    assert.equal(result.success, true)
    /* NULL means "no checkout link is published" and renders as such. `""`
       would be a published link whose value is nothing. */
    assert.equal(result.data?.checkoutUrl, null)
  })

  it("refuses http, so a payment destination is never plaintext", () => {
    assert.equal(parse("http://pay.homeschoolhaven.org/art-lab").success, false)
  })

  it("refuses any other host, including lookalikes", () => {
    assert.equal(
      parse("https://pay.homeschoolhaven.org.evil.com/x").success,
      false,
    )
    assert.equal(parse("https://homeschoolhaven.org/pay").success, false)
    assert.equal(parse("https://stripe.com/pay").success, false)
  })

  it("refuses a query string or fragment, so nothing rides along in the URL", () => {
    /* SECURITY-ARCHITECTURE: keep private data out of URLs. An identifier
       appended here would leave the platform with every click. */
    assert.equal(
      parse("https://pay.homeschoolhaven.org/x?student=abc").success,
      false,
    )
    assert.equal(parse("https://pay.homeschoolhaven.org/x#ref").success, false)
  })

  it("refuses a javascript: or data: scheme", () => {
    assert.equal(parse("javascript:alert(1)").success, false)
    assert.equal(parse("data:text/html,<script>").success, false)
  })

  it("refuses a value that is not a URL at all", () => {
    assert.equal(parse("pay.homeschoolhaven.org").success, false)
    assert.equal(parse("ask samantha").success, false)
  })

  it("turns every cleared optional fact into null", () => {
    const result = parse("")
    assert.equal(result.data?.summary, null)
    assert.equal(result.data?.audience, null)
    assert.equal(result.data?.price, null)
  })
})

describe("program draft validation", () => {
  it("accepts a well-formed slug", () => {
    const result = createProgramSchema.safeParse({
      name: "Art Lab",
      slug: "art-lab",
      summary: "",
    })
    assert.equal(result.success, true)
  })

  it("refuses a slug that could not appear in a URL unencoded", () => {
    for (const slug of [
      "Art Lab",
      "art_lab",
      "art--lab",
      "-art",
      "art-",
      "art/lab",
      "ärt",
    ]) {
      assert.equal(
        createProgramSchema.safeParse({ name: "n", slug, summary: "" }).success,
        false,
        `${slug} should be refused`,
      )
    }
  })

  it("requires a name", () => {
    assert.equal(
      createProgramSchema.safeParse({ name: "   ", slug: "x", summary: "" })
        .success,
      false,
    )
  })
})

describe("enrollment state submission validation", () => {
  const base = {
    enrollmentId: "00000000-0000-4000-8000-000000000001",
    expectedUpdatedAt: "2026-08-30T00:00:00Z",
    note: "Sample reason.",
  }

  it("accepts the four administrative targets", () => {
    for (const state of ADMIN_ENROLLMENT_TARGETS) {
      assert.equal(
        enrollmentStateSchema.safeParse({ ...base, state }).success,
        true,
      )
    }
  })

  it("refuses a real state that is not an administrative decision", () => {
    /* These appear in the UI as labels and in the database as values, so a
       forged submission naming one is entirely plausible. */
    for (const state of ["started", "approval_pending", "payment_failed"]) {
      assert.equal(
        enrollmentStateSchema.safeParse({ ...base, state }).success,
        false,
        `${state} must not be settable`,
      )
    }
  })

  it("requires a note, so every change is attributable and explained", () => {
    assert.equal(
      enrollmentStateSchema.safeParse({
        ...base,
        state: "confirmed",
        note: "   ",
      }).success,
      false,
    )
    assert.equal(
      enrollmentStateSchema.safeParse({
        ...base,
        state: "confirmed",
        note: "x".repeat(401),
      }).success,
      false,
    )
  })

  it("requires a concurrency token, so a forged body cannot skip the check", () => {
    assert.equal(
      enrollmentStateSchema.safeParse({
        ...base,
        state: "confirmed",
        expectedUpdatedAt: "",
      }).success,
      false,
    )
  })

  it("refuses a malformed record id", () => {
    assert.equal(
      enrollmentStateSchema.safeParse({
        ...base,
        state: "confirmed",
        enrollmentId: "1 OR 1=1",
      }).success,
      false,
    )
  })
})

describe("publication submission validation", () => {
  const base = {
    programId: "00000000-0000-4000-8000-000000000001",
    expectedUpdatedAt: "2026-08-30T00:00:00Z",
  }

  it("accepts the three publication states", () => {
    for (const publicationState of ["draft", "published", "archived"]) {
      assert.equal(
        publicationSchema.safeParse({ ...base, publicationState }).success,
        true,
      )
    }
  })

  it("refuses a state the product does not model", () => {
    /* MPS-WFL-005 names `canceled` and `completed`, and neither exists as an
       enum value or a workflow in this release (GAP-ADMIN-005). */
    for (const publicationState of ["canceled", "completed", "deleted"]) {
      assert.equal(
        publicationSchema.safeParse({ ...base, publicationState }).success,
        false,
      )
    }
  })
})
