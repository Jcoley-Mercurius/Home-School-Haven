import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  ALLOWED_CONTENT_TYPES,
  BODY_MAX,
  CONTENT_TYPE_EXTENSIONS,
  DESCRIPTION_MAX,
  MAX_FILE_BYTES,
  TITLE_MAX,
  announcementSchema,
  checkUpload,
  resourceSchema,
} from "../src/lib/content/validation.ts"

/**
 * The authoring field and file rules, exercised without a database.
 *
 * These rules exist to produce a sentence an author can act on. They are NOT
 * the control — every bound is repeated by a SECURITY DEFINER function and by a
 * column constraint. So the last block does not test the rules; it tests that
 * the two copies agree, because a form that accepts what the database rejects
 * wastes an author's time, and a form that rejects what the database accepts
 * quietly narrows the product.
 */

const MIGRATION =
  "supabase/migrations/20260901000000_program_content_authoring.sql"

describe("announcement fields", () => {
  it("accepts a normal announcement", () => {
    const parsed = announcementSchema.safeParse({
      title: "Field trip on Friday",
      body: "We meet at the front entrance.",
    })
    assert.equal(parsed.success, true)
  })

  it("trims, so whitespace is not content", () => {
    const parsed = announcementSchema.safeParse({
      title: "  Trimmed  ",
      body: "  Body  ",
    })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.title, "Trimmed")
  })

  it("refuses an empty title or body, before and after trimming", () => {
    assert.equal(
      announcementSchema.safeParse({ title: "", body: "x" }).success,
      false,
    )
    assert.equal(
      announcementSchema.safeParse({ title: "   ", body: "x" }).success,
      false,
    )
    assert.equal(
      announcementSchema.safeParse({ title: "x", body: "   " }).success,
      false,
    )
  })

  it("refuses at the boundary, and accepts one below it", () => {
    const at = { title: "x".repeat(TITLE_MAX), body: "y" }
    const over = { title: "x".repeat(TITLE_MAX + 1), body: "y" }
    assert.equal(announcementSchema.safeParse(at).success, true)
    assert.equal(announcementSchema.safeParse(over).success, false)

    assert.equal(
      announcementSchema.safeParse({ title: "x", body: "y".repeat(BODY_MAX) })
        .success,
      true,
    )
    assert.equal(
      announcementSchema.safeParse({
        title: "x",
        body: "y".repeat(BODY_MAX + 1),
      }).success,
      false,
    )
  })
})

describe("resource fields", () => {
  it("a link resource needs an http(s) address", () => {
    assert.equal(
      resourceSchema.safeParse({
        title: "t",
        description: "",
        kind: "link",
        url: "https://example.org/x",
      }).success,
      true,
    )
    assert.equal(
      resourceSchema.safeParse({
        title: "t",
        description: "",
        kind: "link",
        url: "",
      }).success,
      false,
    )
  })

  it("refuses every scheme that is not http(s)", () => {
    /* `javascript:` and `data:` are the ones that matter: a renderer must never
       have to defend against a scheme that was storable. The database says the
       same in a check constraint, so this is the message, not the control. */
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//example.org/x",
      "ftp://example.org/x",
      "HTTPS ://example.org",
    ]) {
      assert.equal(
        resourceSchema.safeParse({
          title: "t",
          description: "",
          kind: "link",
          url,
        }).success,
        false,
        `${url} must be refused`,
      )
    }
  })

  it("a file resource refuses a web address — one medium, never two", () => {
    for (const kind of ["document", "download"]) {
      assert.equal(
        resourceSchema.safeParse({
          title: "t",
          description: "",
          kind,
          url: "https://example.org/x",
        }).success,
        false,
      )
      assert.equal(
        resourceSchema.safeParse({ title: "t", description: "", kind, url: "" })
          .success,
        true,
      )
    }
  })

  it("an empty description becomes null, not an empty string", () => {
    /* The difference is the one the import rules turn on: `null` means the
       author published no description; `""` would be a published description
       whose content is nothing. */
    const parsed = resourceSchema.safeParse({
      title: "t",
      description: "   ",
      kind: "link",
      url: "https://example.org",
    })
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.description, null)
  })

  it("refuses an over-long description", () => {
    assert.equal(
      resourceSchema.safeParse({
        title: "t",
        description: "d".repeat(DESCRIPTION_MAX + 1),
        kind: "link",
        url: "https://example.org",
      }).success,
      false,
    )
  })
})

describe("upload checks", () => {
  const pdf = { contentType: "application/pdf", hasFile: true }

  it("accepts an allowed type at a normal size", () => {
    const result = checkUpload({ ...pdf, byteLength: 1024 })
    assert.equal(result.ok, true)
  })

  it("refuses at the size boundary and accepts exactly at the limit", () => {
    assert.equal(
      checkUpload({ ...pdf, byteLength: MAX_FILE_BYTES }).ok,
      true,
      "exactly the limit is allowed",
    )
    const over = checkUpload({ ...pdf, byteLength: MAX_FILE_BYTES + 1 })
    assert.equal(over.ok, false)
    assert.equal(over.ok === false && over.reason, "tooLarge")
  })

  it("refuses an empty file and a missing one, distinguishably", () => {
    const empty = checkUpload({ ...pdf, byteLength: 0 })
    assert.equal(empty.ok === false && empty.reason, "empty")

    const missing = checkUpload({ ...pdf, byteLength: 0, hasFile: false })
    assert.equal(missing.ok === false && missing.reason, "missing")
  })

  it("refuses every type outside the approved allowlist", () => {
    /* GAP-CONTENT-01, owner decision 2026-08-31. Office container formats carry
       macros and are excluded deliberately; so is anything executable or
       archived. */
    for (const contentType of [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/x-msdownload",
      "text/html",
      "image/svg+xml",
      "",
    ]) {
      const result = checkUpload({ contentType, byteLength: 10, hasFile: true })
      assert.equal(result.ok, false, `${contentType} must be refused`)
      assert.equal(result.ok === false && result.reason, "type")
    }
  })

  it("names what IS accepted rather than only what was wrong", () => {
    const result = checkUpload({
      contentType: "application/zip",
      byteLength: 10,
      hasFile: true,
    })
    assert.equal(result.ok, false)
    assert.match(
      result.ok === false ? result.message : "",
      /PDF, PNG, JPEG, or plain text/,
    )
  })

  it("every allowed type has a storage extension", () => {
    for (const type of ALLOWED_CONTENT_TYPES) {
      assert.ok(CONTENT_TYPE_EXTENSIONS[type], `${type} has no extension`)
    }
  })
})

describe("the application limits agree with the database", () => {
  const sql = readFileSync(MIGRATION, "utf8")

  it("uses the same maximum file size the column constraint uses", () => {
    const match = sql.match(/file_size_bytes <= (\d+)/)
    assert.ok(match, "the file size constraint is missing")
    assert.equal(Number(match[1]), MAX_FILE_BYTES)
  })

  it("uses the same content-type allowlist the column constraint uses", () => {
    const start = sql.indexOf("learning_resources_content_type")
    assert.notEqual(start, -1, "the content type constraint is missing")

    const clause = sql.slice(start, start + 400)
    for (const type of ALLOWED_CONTENT_TYPES) {
      assert.ok(
        clause.includes(`'${type}'`),
        `${type} is allowed by the form but not by the database`,
      )
    }

    /* And the other direction: nothing the database allows is missing here. */
    const fromDb = [...clause.matchAll(/'([a-z]+\/[a-z0-9.+-]+)'/g)].map(
      (m) => m[1],
    )
    assert.deepEqual(
      [...new Set(fromDb)].sort(),
      [...ALLOWED_CONTENT_TYPES].sort(),
    )
  })

  it("uses the same title and body bounds the functions enforce", () => {
    assert.ok(
      sql.includes(`char_length(trimmed_title) not between 1 and ${TITLE_MAX}`),
    )
    assert.ok(
      sql.includes(`char_length(trimmed_body) not between 1 and ${BODY_MAX}`),
    )
    assert.ok(
      sql.includes(`char_length(trimmed_description) > ${DESCRIPTION_MAX}`),
    )
  })
})
