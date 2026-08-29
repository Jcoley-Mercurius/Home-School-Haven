import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isRecovery, parseLinkType } from "../src/lib/auth/link-types.ts"

/**
 * `verifyOtp` takes a `type` that arrives in a URL, so it is attacker-chosen
 * input. The allow-list is what stops a link type this release does not send
 * from being honoured — `magiclink` above all, which would be a password-free
 * sign-in that no approved artifact authorizes.
 */
describe("parseLinkType", () => {
  it("accepts the link types this release sends", () => {
    for (const type of ["recovery", "invite", "signup", "email_change"]) {
      assert.equal(parseLinkType(type), type)
    }
  })

  it("refuses a link type this release does not send", () => {
    /* `magiclink` and `email` would each establish a session without a
       password. Neither is offered, so neither is accepted. */
    for (const type of [
      "magiclink",
      "email",
      "phone_change",
      "sms",
      "RECOVERY",
      "recovery ",
      "",
    ]) {
      assert.equal(parseLinkType(type), null)
    }
  })

  it("refuses non-string input", () => {
    /* A search parameter can be absent, and `searchParams.get()` returns
       `null` when it is. */
    for (const raw of [null, undefined, 1, {}, ["recovery"], true]) {
      assert.equal(parseLinkType(raw), null)
    }
  })
})

describe("isRecovery", () => {
  it("is true only for a recovery link", () => {
    /* Only a recovery link may open the password form. An invite or
       confirmation link establishes a session and goes to role routing. */
    assert.equal(isRecovery("recovery"), true)
    assert.equal(isRecovery("invite"), false)
    assert.equal(isRecovery("signup"), false)
    assert.equal(isRecovery("email_change"), false)
  })

  it("is false for a refused or absent type", () => {
    /* A bare `?code=` link parses to `null`. It must be treated as a sign-in,
       not assumed to be a recovery — the weaker of the two outcomes, and the
       one that cannot hand an unexpected visitor a password form. */
    assert.equal(isRecovery(parseLinkType("magiclink")), false)
    assert.equal(isRecovery(null), false)
  })
})
