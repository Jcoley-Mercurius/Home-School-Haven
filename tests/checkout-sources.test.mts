/**
 * Checkout source mapping (prompts/external-checkout-payment-truth.md §4;
 * MPS-REQ-013; import rules 1 and 4).
 *
 * Four records must say the same thing about every checkout link, and a
 * divergence in any one of them is a payment destination nobody reviewed:
 *
 *   1. `src/content/checkout-sources.ts` — the code mirror of the evidence;
 *   2. `supabase/migrations/20260919200000_external_checkout_activation.sql`
 *      — what the database stores;
 *   3. `mps/BETA-CONTENT-IMPORT-INVENTORY.md` — the canonical source record;
 *   4. `src/content/programs.ts` — the staging catalog.
 *
 * And the TypeScript allowlist must accept exactly what the SQL allowlist does.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  CHECKOUT_SOURCE_PAGE,
  GODADDY_BUSINESS_ID,
  checkoutSources,
  checkoutUrlForSlug,
} from "../src/content/checkout-sources.ts"
import { programs } from "../src/content/programs.ts"
import { isApprovedCheckoutUrl } from "../src/lib/admin/validation.ts"

const MIGRATION = readFileSync(
  "supabase/migrations/20260919200000_external_checkout_activation.sql",
  "utf8",
)
const INVENTORY = readFileSync("mps/BETA-CONTENT-IMPORT-INVENTORY.md", "utf8")

/* The executable part of the migration: everything after the rollback header,
   so a URL quoted only in a comment cannot satisfy an assertion. */
const MIGRATION_BODY = MIGRATION.slice(MIGRATION.indexOf("create function"))
const ACTIVATION = MIGRATION_BODY.slice(MIGRATION_BODY.indexOf("-- 4."))

const exact = checkoutSources.filter((s) => s.confidence === "exact")
const TUTORING = "10000000-0000-4000-8000-00000000000c"

/** Every (program id, url) pair the migration's activation writes. */
function activatedPairs(): Map<string, string> {
  const pairs = new Map<string, string>()
  const pattern = /\('([0-9a-f-]{36})'::uuid,\s*'([^']+)'\)/g
  for (const match of ACTIVATION.matchAll(pattern)) {
    pairs.set(match[1], match[2])
  }
  return pairs
}

describe("checkout source evidence", () => {
  it("records every destination as a bare https Home School Haven GoDaddy checkout", () => {
    for (const source of checkoutSources) {
      if (source.destination === null) continue
      const url = new URL(source.destination)
      assert.equal(url.protocol, "https:", source.offering)
      assert.equal(url.host, "poynt.godaddy.com", source.offering)
      assert.equal(url.search, "", source.offering)
      assert.equal(url.hash, "", source.offering)
      assert.ok(
        url.pathname.startsWith(`/checkout/${GODADDY_BUSINESS_ID}/`),
        source.offering,
      )
      /* The button's own checkout id is where the short name comes from. */
      assert.ok(
        source.checkoutUrlId !== null &&
          source.checkoutUrlId.startsWith(url.pathname.split("/").at(-1)!),
        source.offering,
      )
    }
  })

  it("never uses the classes page as a checkout destination", () => {
    for (const source of checkoutSources) {
      assert.notEqual(source.destination, CHECKOUT_SOURCE_PAGE)
    }
  })

  it("never derives a destination from a program's slug", () => {
    for (const source of exact) {
      for (const program of source.programs) {
        assert.ok(!source.destination!.includes(program.slug), program.slug)
      }
    }
  })

  it("keeps ambiguous, inactive, and missing rows without an activated program", () => {
    for (const source of checkoutSources) {
      if (source.confidence === "exact") continue
      for (const program of source.programs) {
        assert.equal(checkoutUrlForSlug(program.slug), null, program.slug)
      }
    }
  })

  it("maps Tutoring to no checkout, because the source page offers none", () => {
    assert.equal(checkoutUrlForSlug("tutoring"), null)
  })

  it("preserves the one intentionally shared checkout", () => {
    assert.equal(
      checkoutUrlForSlug("ready-set-prep"),
      checkoutUrlForSlug("ready-set-learn"),
    )
    /* Every other destination belongs to exactly one offering. */
    const destinations = exact.map((s) => s.destination)
    assert.equal(new Set(destinations).size, destinations.length)
  })
})

describe("the migration stores exactly the recorded mappings", () => {
  const pairs = activatedPairs()

  it("activates every exact mapping, by fixed id", () => {
    for (const source of exact) {
      for (const program of source.programs) {
        assert.equal(pairs.get(program.id), source.destination, program.slug)
      }
    }
  })

  it("activates nothing that is not an exact mapping", () => {
    const expected = exact.flatMap((s) => s.programs.map((p) => p.id))
    assert.deepEqual([...pairs.keys()].sort(), [...expected].sort())
    assert.equal(pairs.has(TUTORING), false)
  })

  it("does not activate a checkout with no approved program", () => {
    for (const source of checkoutSources) {
      if (source.programs.length === 0 && source.destination) {
        assert.ok(!ACTIVATION.includes(source.destination), source.offering)
      }
    }
  })

  it("never overwrites an administrator's value or an unpublished program", () => {
    assert.match(ACTIVATION, /and p\.checkout_url is null/)
    assert.match(ACTIVATION, /and p\.publication_state = 'published'/)
  })

  it("touches no price, availability, date, capacity, or confirmation mode", () => {
    const setClause = ACTIVATION.slice(
      ACTIVATION.indexOf("set "),
      ACTIVATION.indexOf("from ("),
    )
    assert.equal(setClause.trim(), "set checkout_url = v.url")
  })
})

describe("the canonical inventory records every activated destination", () => {
  it("lists each exact destination and each program slug", () => {
    for (const source of exact) {
      assert.ok(INVENTORY.includes(source.destination!), source.offering)
      for (const program of source.programs) {
        assert.ok(INVENTORY.includes(`\`${program.slug}\``), program.slug)
      }
    }
  })
})

describe("the staging catalog renders the same links", () => {
  it("gives each published program the mapped destination or null", () => {
    for (const program of programs) {
      assert.equal(
        program.checkoutUrl,
        checkoutUrlForSlug(program.slug),
        program.slug,
      )
    }
  })
})

describe("the TypeScript and SQL allowlists agree", () => {
  /* Both SQL patterns, lifted from the helper's body. They use only syntax
     that means the same in POSIX and JavaScript regular expressions. */
  const sqlPatterns = [
    ...MIGRATION_BODY.slice(
      MIGRATION_BODY.indexOf(
        "create function private.is_approved_checkout_url",
      ),
      MIGRATION_BODY.indexOf("comment on function"),
    ).matchAll(/~ '([^']+)'/g),
  ].map((m) => new RegExp(m[1]))
  const sql = (value: string) => sqlPatterns.some((p) => p.test(value))

  const candidates = [
    ...exact.map((s) => s.destination!),
    "https://pay.homeschoolhaven.org",
    "https://pay.homeschoolhaven.org/sewing",
    `https://poynt.godaddy.com/checkout/${GODADDY_BUSINESS_ID}/x?sourceApp=wam.paybutton`,
    `https://poynt.godaddy.com/checkout/${GODADDY_BUSINESS_ID}/x#frag`,
    `https://poynt.godaddy.com/checkout/${GODADDY_BUSINESS_ID}/a/b`,
    "https://poynt.godaddy.com/checkout/00000000-0000-4000-8000-000000000000/x",
    "https://poynt.godaddy.com.evil.com/checkout/x",
    `http://poynt.godaddy.com/checkout/${GODADDY_BUSINESS_ID}/x`,
    "https://www.godaddy.com/",
    CHECKOUT_SOURCE_PAGE,
  ]

  it("finds both SQL patterns", () => {
    assert.equal(sqlPatterns.length, 2)
  })

  for (const candidate of candidates) {
    it(`agrees on ${candidate}`, () => {
      assert.equal(isApprovedCheckoutUrl(candidate), sql(candidate))
    })
  }

  it("accepts every exact destination", () => {
    for (const source of exact) {
      assert.equal(isApprovedCheckoutUrl(source.destination!), true)
    }
  })
})
