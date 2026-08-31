/**
 * Field shapes for the administrator program and enrollment operations.
 *
 * Kept out of the action modules so the same rule cannot drift between the form
 * and the server, and so it can be unit-tested without a Supabase project.
 *
 * This layer exists to produce a sentence an administrator can act on. It is
 * NOT the control: every bound here is repeated by the SECURITY DEFINER
 * functions in `20260830090000_admin_program_enrollment_operations.sql`, which
 * are what a request bypassing this application would meet.
 *
 * WHAT IS NOT HERE
 *
 * No capacity, seat count, discount, scholarship, refund, credit, transfer, fee,
 * deposit, or payment-evidence field. Checklist §1 (capacity), §2 (how a
 * payment is identified), §4 (assistance), and §5 (refunds and cancellations)
 * are unanswered, and MPS GAP-010 is open. A field here would be the first step
 * toward storing an answer nobody has given.
 */

import { z } from "zod"

/* A relative import, not the `@/` alias, and deliberately: this is a runtime
   value import, and the Node test runner does not resolve the alias. An aliased
   import here would make every rule in this file untestable outside a browser —
   the same constraint that moved `describeActivity` out of the admin
   repository. The explicit `.ts` specifier is what Node's type stripping
   requires, and `allowImportingTsExtensions` in `tsconfig.json` exists for
   exactly this case. */
import { ADMIN_ENROLLMENT_TARGETS } from "./transitions.ts"

const PROGRAM_NAME_MAX = 160
const PROGRAM_SLUG_MAX = 80
const SUMMARY_MAX = 600
const FACT_MAX = 200
const CHECKOUT_URL_MAX = 300
const NOTE_MAX = 400

/**
 * The one host an external checkout link may point at.
 *
 * `mps/BETA-CONTENT-IMPORT-INVENTORY.md` names the current program-specific
 * `pay.homeschoolhaven.org` links as the approved beta checkout path. Anything
 * else is a payment destination nobody approved, so the allowlist is a literal
 * rather than a "looks like a URL" check.
 */
const CHECKOUT_HOST = "pay.homeschoolhaven.org"

/**
 * An optional published fact.
 *
 * Empty becomes `null`, never `""`. The difference is the whole point of the
 * import rules: `null` means the source does not publish this and renders as
 * "Contact for details"; `""` would be a published fact whose value is nothing.
 */
const optionalFact = z
  .string()
  .trim()
  .max(FACT_MAX, `Use ${FACT_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))

const optionalSummary = z
  .string()
  .trim()
  .max(SUMMARY_MAX, `Use ${SUMMARY_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))

const programName = z
  .string()
  .trim()
  .min(1, "Enter the program name.")
  .max(PROGRAM_NAME_MAX, `Use ${PROGRAM_NAME_MAX} characters or fewer.`)

/**
 * The slug is the program's public web address, so it is constrained to what
 * can appear in one unencoded: lowercase, digits, and single hyphens between
 * them. Uniqueness is the database's answer, not this schema's.
 */
const programSlug = z
  .string()
  .trim()
  .min(1, "Enter a web address for this program.")
  .max(PROGRAM_SLUG_MAX, `Use ${PROGRAM_SLUG_MAX} characters or fewer.`)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens — for example art-lab.",
  )

/**
 * The external checkout link.
 *
 * Parsed rather than pattern-matched, then checked part by part:
 *
 *   * `https:` only — a payment destination must not be reachable over http.
 *   * exactly the approved host — no other checkout provider is approved.
 *   * no query string and no fragment — an identifier appended to a checkout
 *     link is private data leaving the platform in a URL, which
 *     SECURITY-ARCHITECTURE forbids outright. Refusing it at the point of
 *     storage means no later code has to remember to strip it.
 */
const checkoutUrl = z
  .string()
  .trim()
  .max(CHECKOUT_URL_MAX, `Use ${CHECKOUT_URL_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))
  .refine((value) => {
    if (value === null) return true
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return false
    }
    return (
      parsed.protocol === "https:" &&
      parsed.host === CHECKOUT_HOST &&
      parsed.search === "" &&
      parsed.hash === ""
    )
  }, `Enter the program's https://${CHECKOUT_HOST} link, with no extra information after a ? or #.`)

/** MDS `enrollment_state` availability vocabulary, verbatim. */
const availability = z.enum(
  ["open", "limited", "waitlist", "closed", "unknown"],
  "Choose an availability state.",
)

const publicationTarget = z.enum(
  ["draft", "published", "archived"],
  "Choose a publication state.",
)

/**
 * A record identifier from a form body.
 *
 * Validating the shape is not what makes this safe — the database checks
 * authorization and existence itself, and reports a well-formed id belonging to
 * nothing exactly as it reports one that never existed. This check exists so a
 * malformed value fails as a validation error instead of as a database type
 * error, which would surface as an unexplained failure.
 */
const recordId = z.uuid("That record could not be identified.")

/**
 * The mandatory attributable note on every enrollment state change
 * (MPS-REQ-024).
 *
 * It is stored on the enrollment row and deliberately NOT copied into
 * `audit_events`: it is free text and cannot be guaranteed free of a child's or
 * a family's name, which must not enter the history payload.
 */
const stateNote = z
  .string()
  .trim()
  .min(1, "Say why this enrollment is changing. This is recorded.")
  .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)

/**
 * The concurrency token.
 *
 * Carried through the form as the row's `updated_at` at render time, and
 * compared by the database before it writes. A submission that omits or mangles
 * it is treated as stale rather than allowed through, so a forged request
 * cannot skip the check by leaving the field out.
 */
const concurrencyToken = z
  .string()
  .trim()
  .min(1, "Reload this page and try again.")

const createProgramSchema = z.object({
  name: programName,
  slug: programSlug,
  summary: optionalSummary,
})

const programFactsSchema = z.object({
  programId: recordId,
  expectedUpdatedAt: concurrencyToken,
  name: programName,
  summary: optionalSummary,
  audience: optionalFact,
  format: optionalFact,
  location: optionalFact,
  educator: optionalFact,
  dates: optionalFact,
  schedule: optionalFact,
  duration: optionalFact,
  sessionLength: optionalFact,
  price: optionalFact,
  availability,
  checkoutUrl,
})

const publicationSchema = z.object({
  programId: recordId,
  expectedUpdatedAt: concurrencyToken,
  publicationState: publicationTarget,
})

/**
 * The mandatory attributable note on an educator assignment change
 * (MPS-REQ-024).
 *
 * Reuses the enrollment note's shape and length because the database applies
 * the identical 1–400 rule to both, and two limits that must agree are better
 * expressed once. The wording differs because the decision does: an assignment
 * note explains a change to who may reach a program's roster.
 *
 * Unlike the enrollment note, this one is not persisted — `educator_assignments`
 * has no note column and no approved requirement asks for one (deviation
 * D-FE2). It is required so an administrator states a reason before acting.
 */
const assignmentNote = z
  .string()
  .trim()
  .min(1, "Say why this assignment is changing.")
  .max(NOTE_MAX, `Use ${NOTE_MAX} characters or fewer.`)

/**
 * Assign or unassign an educator (MPS-REQ-017).
 *
 * Both identifiers are validated as uuids and neither is trusted beyond its
 * shape: the database decides whether the target actually holds the `educator`
 * grant and whether the program may be assigned. Passing this schema means the
 * request is well-formed, never that it is permitted.
 *
 * There is no concurrency token. Assignment is set membership with no prior
 * material state to flatten, so a stale submission reaches the same result and
 * is reported as `unchanged` rather than refused (deviation D-FE1).
 */
const assignmentSchema = z.object({
  educatorUserId: recordId,
  programId: recordId,
  note: assignmentNote,
})

const enrollmentStateSchema = z.object({
  enrollmentId: recordId,
  expectedUpdatedAt: concurrencyToken,
  /* Only the four administrative targets are accepted. A browser that submits
     `payment_pending` — a state that exists in the database and appears in the
     UI as a label — is refused here before the database is asked, because it is
     not a state anyone decides. */
  state: z.enum(
    ADMIN_ENROLLMENT_TARGETS,
    "That is not an enrollment decision an administrator makes.",
  ),
  note: stateNote,
})

export {
  CHECKOUT_HOST,
  CHECKOUT_URL_MAX,
  FACT_MAX,
  NOTE_MAX,
  PROGRAM_NAME_MAX,
  PROGRAM_SLUG_MAX,
  SUMMARY_MAX,
  assignmentSchema,
  createProgramSchema,
  enrollmentStateSchema,
  programFactsSchema,
  publicationSchema,
}
