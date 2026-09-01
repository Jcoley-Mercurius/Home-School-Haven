import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  ALLOWED_TRANSITIONS,
  CONTENT_STATES,
  FILE_BACKED_KINDS,
  KIND_LABELS,
  STATE_LABELS,
  STATE_MEANINGS,
  canEdit,
  canTransition,
  isFamilyVisible,
  isFileBacked,
} from "../src/lib/content/lifecycle.ts"
import type { ContentState } from "../src/lib/content/lifecycle.ts"

/**
 * The content lifecycle, exercised without a database.
 *
 * The block that matters most is the last one. `lifecycle.ts` carries a copy of
 * the transition table so a surface can decide which buttons to draw without a
 * round trip, and `private.content_transition_allowed` in the migration is the
 * copy that ENFORCES it. Two copies that can disagree is exactly the problem
 * this repository keeps refusing to accept elsewhere, so the test reads the
 * migration and asserts the two agree edge for edge. If someone widens one, the
 * test fails rather than a button appearing for a move the database refuses —
 * or, worse, a move being permitted that no button ever offered.
 */

const MIGRATION =
  "supabase/migrations/20260901000000_program_content_authoring.sql"

describe("content states", () => {
  it("every state has a label, a meaning, and a transition entry", () => {
    for (const state of CONTENT_STATES) {
      assert.ok(STATE_LABELS[state], `${state} has no label`)
      assert.ok(STATE_MEANINGS[state], `${state} has no meaning`)
      assert.ok(
        Array.isArray(ALLOWED_TRANSITIONS[state]),
        `${state} has no transition entry`,
      )
    }
  })

  it("a label never depends on colour to carry its meaning", () => {
    /* Not a rendering test — a vocabulary one. Every state must be
       distinguishable as a WORD, because the MDS forbids status meaning that
       depends on colour alone and a component can only honour that if the four
       labels are actually different. */
    const labels = CONTENT_STATES.map((state) => STATE_LABELS[state])
    assert.equal(new Set(labels).size, CONTENT_STATES.length)
  })
})

describe("permitted transitions", () => {
  it("a draft publishes or is discarded, and does nothing else", () => {
    assert.equal(canTransition("draft", "published"), true)
    assert.equal(canTransition("draft", "removed"), true)
    assert.equal(canTransition("draft", "replaced"), false)
    assert.equal(canTransition("draft", "draft"), false)
  })

  it("a published item is replaced or withdrawn, and is not re-published", () => {
    assert.equal(canTransition("published", "replaced"), true)
    assert.equal(canTransition("published", "removed"), true)
    assert.equal(canTransition("published", "published"), false)
    assert.equal(canTransition("published", "draft"), false)
  })

  it("replaced and removed are terminal — nothing comes back", () => {
    for (const terminal of ["replaced", "removed"] as ContentState[]) {
      for (const target of CONTENT_STATES) {
        assert.equal(
          canTransition(terminal, target),
          false,
          `${terminal} -> ${target} must not be permitted`,
        )
      }
    }
  })
})

describe("editing and family visibility", () => {
  it("only a draft may be edited in place", () => {
    assert.equal(canEdit("draft"), true)
    assert.equal(canEdit("published"), false)
    assert.equal(canEdit("replaced"), false)
    assert.equal(canEdit("removed"), false)
  })

  it("a family sees published and replaced, never draft or removed", () => {
    /* Replaced STAYS VISIBLE, marked as superseded (deviation D-C2).
       Withdrawing a notice a family already read is not a truthful state, it is
       a disappearance. Removed is the opposite case, and losing it is exactly
       what removal means. */
    assert.equal(isFamilyVisible("published"), true)
    assert.equal(isFamilyVisible("replaced"), true)
    assert.equal(isFamilyVisible("draft"), false)
    assert.equal(isFamilyVisible("removed"), false)
  })
})

describe("resource kinds", () => {
  it("document and download carry a file; the rest carry a link", () => {
    assert.equal(isFileBacked("document"), true)
    assert.equal(isFileBacked("download"), true)
    assert.equal(isFileBacked("link"), false)
    assert.equal(isFileBacked("video"), false)
    assert.equal(isFileBacked("activity"), false)
  })

  it("every kind is one of the five approved MDS variants", () => {
    /* MDS-PROJECT-STATE.yaml:445 lists exactly these. A sixth kind would be a
       new design convention requiring approval, not a code change. */
    assert.deepEqual(Object.keys(KIND_LABELS).sort(), [
      "activity",
      "document",
      "download",
      "link",
      "video",
    ])
  })

  it("the file-backed set is a subset of the kinds", () => {
    for (const kind of FILE_BACKED_KINDS) {
      assert.ok(kind in KIND_LABELS)
    }
  })
})

describe("the application table agrees with the database", () => {
  /* Parse the edges out of `private.content_transition_allowed`. The function
     body lists them as `('from', 'to')` tuples, one per permitted edge. */
  function databaseEdges(): Set<string> {
    const sql = readFileSync(MIGRATION, "utf8")
    const start = sql.indexOf(
      "create function private.content_transition_allowed",
    )
    assert.notEqual(start, -1, "the transition function is missing")

    const body = sql.slice(start, sql.indexOf("$$;", start))
    const edges = new Set<string>()
    for (const match of body.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)) {
      edges.add(`${match[1]}->${match[2]}`)
    }
    return edges
  }

  it("permits exactly the edges the database permits", () => {
    const fromApp = new Set<string>()
    for (const state of CONTENT_STATES) {
      for (const target of ALLOWED_TRANSITIONS[state]) {
        fromApp.add(`${state}->${target}`)
      }
    }

    const fromDb = databaseEdges()

    assert.ok(fromDb.size > 0, "no edges parsed from the migration")
    assert.deepEqual(
      [...fromApp].sort(),
      [...fromDb].sort(),
      "the application transition table has drifted from the database's",
    )
  })

  it("declares the same four states the database enum declares", () => {
    const sql = readFileSync(MIGRATION, "utf8")
    const match = sql.match(
      /create type public\.content_state as enum \(([^)]*)\)/,
    )
    assert.ok(match, "the content_state enum is missing")

    const fromDb = [...match[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual([...CONTENT_STATES].sort(), fromDb)
  })
})
