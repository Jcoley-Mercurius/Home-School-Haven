import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  AFFIRMATION_VERSION,
  familyNameSchema,
  studentSchema,
} from "../src/lib/family/validation.ts"

/**
 * The field rules for family setup and demo student profiles.
 *
 * Exercised directly rather than only through the browser, because the inputs
 * worth testing are the ones a browser would not send: whitespace-only names,
 * an over-long string, a missing affirmation. The database repeats every bound
 * as a CHECK constraint — these tests pin the sentence a parent is shown, not
 * the control itself.
 */
describe("familyNameSchema", () => {
  it("accepts and trims a real name", () => {
    const result = familyNameSchema.safeParse({ name: "  The Sample Family  " })
    assert.equal(result.success, true)
    assert.equal(result.data?.name, "The Sample Family")
  })

  it("refuses an empty or whitespace-only name", () => {
    for (const name of ["", "   ", "\t\n"]) {
      const result = familyNameSchema.safeParse({ name })
      assert.equal(result.success, false, `"${name}" must be refused`)
    }
  })

  it("refuses a name longer than the column allows", () => {
    // The database CHECK is 80 characters. If this bound ever drifts from the
    // migration, a parent gets a database error instead of a sentence.
    const result = familyNameSchema.safeParse({ name: "x".repeat(81) })
    assert.equal(result.success, false)
  })
})

describe("studentSchema", () => {
  const valid = {
    preferredName: "Sample Student",
    gradeLevel: "Grade 3",
    guardianRelationship: "Parent",
    authority: "on",
  }

  it("accepts a complete submission", () => {
    const result = studentSchema.safeParse(valid)
    assert.equal(result.success, true)
    assert.equal(result.data?.preferredName, "Sample Student")
    assert.equal(result.data?.authority, true)
  })

  it("treats the optional fields as absent rather than empty strings", () => {
    // NULL and "" must not both reach the column: an empty grade level is not
    // a grade level, and storing "" would make the empty state ambiguous.
    const result = studentSchema.safeParse({
      ...valid,
      gradeLevel: "",
      guardianRelationship: "   ",
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.gradeLevel, null)
    assert.equal(result.data?.guardianRelationship, null)
  })

  it("refuses a profile with no guardian-authority affirmation", () => {
    // MPS-RUL-008: parent or guardian authority is affirmed before a student
    // profile is created. An unchecked box is not a default to work around.
    for (const authority of ["", "off", "false", undefined]) {
      const result = studentSchema.safeParse({ ...valid, authority })
      assert.equal(result.success, false, `authority=${authority} must fail`)
    }
  })

  it("refuses a missing preferred name", () => {
    const result = studentSchema.safeParse({ ...valid, preferredName: "  " })
    assert.equal(result.success, false)
  })
})

describe("affirmation version", () => {
  it("names itself unapproved", () => {
    // MPS-RUL-010 forbids inventing consent or waiver language, so none was
    // written. The database CHECK refuses any other value, which is what stops
    // a row from ever implying that approved language was accepted.
    assert.equal(AFFIRMATION_VERSION, "demo-unapproved-v0")
    assert.match(AFFIRMATION_VERSION, /unapproved/)
  })
})
