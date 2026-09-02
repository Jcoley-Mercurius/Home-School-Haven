/**
 * What the MPS-REQ-012 evaluation means to a parent.
 *
 * `public.family_request_enrollment` performs the evaluation; this module turns
 * its answer into words. The split matters: the database is the control, and
 * nothing here can loosen it. A blocker this table did not anticipate still
 * blocks — it simply falls to the neutral entry rather than being let through.
 *
 * Pure, so it is directly unit-testable (`tests/enrollment-eligibility.test.mts`)
 * and so no page has to reimplement the mapping and drift from it.
 *
 * THE ONE RULE
 *
 * `offersPayment` is true for exactly one outcome: `started`. Every blocked
 * outcome, `approval_pending` (MPS-ACC-019), and `waitlisted` (MPS-ACC-020)
 * offer no payment path at all — not a disabled one, not a hidden one. Payment
 * is not initiated when a blocking state exists (MPS-ACC-018, MPS-ACC-002).
 */

import type { EnrollmentState } from "@/lib/enrollment/repository"

/** Every value `family_request_enrollment` can return in its `outcome` column. */
export type EnrollmentOutcome =
  | "blocked_authority"
  | "blocked_unavailable"
  | "blocked_closed"
  | "blocked_full"
  | "duplicate"
  | "waitlisted"
  | "approval_pending"
  | "started"

/** Where a parent can go next when a registration did not go through. */
export type EnrollmentRecovery = "guidance" | "programs" | "dashboard" | null

export type OutcomePresentation = {
  /** Whether a row now exists for this student and program. */
  recorded: boolean
  /** True for exactly one outcome. See the module note. */
  offersPayment: boolean
  heading: string
  /** Names the blocker plainly (MPS-ACC-018). Never blames the parent. */
  sentence: string
  recovery: EnrollmentRecovery
}

const OUTCOME: Record<EnrollmentOutcome, OutcomePresentation> = {
  blocked_authority: {
    recorded: false,
    offersPayment: false,
    heading: "Registration not started",
    sentence:
      "Confirm that you are this student's parent or guardian before registering. Nothing was recorded and no payment was started.",
    recovery: null,
  },
  blocked_unavailable: {
    recorded: false,
    offersPayment: false,
    heading: "This program is not open for registration",
    sentence:
      "Home School Haven is not accepting registrations for this program right now. Nothing was recorded and no payment was started.",
    recovery: "programs",
  },
  blocked_closed: {
    recorded: false,
    offersPayment: false,
    heading: "Registration is closed",
    sentence:
      "Registration for this program is closed. Nothing was recorded and no payment was started.",
    recovery: "guidance",
  },
  blocked_full: {
    recorded: false,
    offersPayment: false,
    /* MPS-RUL-002: capacity behaviour is program-specific. This program is full
       and does not take a waitlist, so no waitlist is offered — offering one
       here would invent a policy the program does not have. */
    heading: "This program is full",
    sentence:
      "Every place in this program is taken and it does not keep a waitlist. Nothing was recorded and no payment was started.",
    recovery: "guidance",
  },
  duplicate: {
    /* MPS-REQ-014 and MPS-ACC-023: a retry finds the existing registration.
       Nothing was created and nothing was charged twice. */
    recorded: true,
    offersPayment: false,
    heading: "You already registered this student",
    sentence:
      "This student is already registered for this program. Nothing was added and nothing was charged. Their current state is shown below.",
    recovery: "dashboard",
  },
  waitlisted: {
    /* MPS-ACC-020: a waitlist place is recorded and no payment is collected. */
    recorded: true,
    offersPayment: false,
    heading: "Added to the waitlist",
    sentence:
      "Every place is taken, so this student is on the waitlist. A waitlist place is not enrollment, and no payment was collected.",
    recovery: "dashboard",
  },
  approval_pending: {
    /* MPS-ACC-019: approval-required programs become approval-pending, never
       confirmed and never paid. */
    recorded: true,
    offersPayment: false,
    heading: "Registration sent for review",
    sentence:
      "Home School Haven reviews registrations for this program before any payment step. This is not confirmed enrollment, and no payment was started.",
    recovery: "dashboard",
  },
  started: {
    /* MPS-ACC-021: the only outcome that reaches the approved handoff. */
    recorded: true,
    offersPayment: true,
    heading: "Registration started",
    sentence:
      "Your registration is recorded. Payment is completed on Home School Haven's own checkout page — starting it does not confirm payment and does not confirm your child's place.",
    recovery: "dashboard",
  },
}

/**
 * Reads a value returned by `family_request_enrollment`.
 * @param value - The raw `outcome` column.
 * @returns The outcome, or `null` when it is not one this build knows.
 */
export function parseOutcome(value: unknown): EnrollmentOutcome | null {
  return typeof value === "string" && value in OUTCOME
    ? (value as EnrollmentOutcome)
    : null
}

/**
 * How an outcome is presented to a parent.
 * @param outcome - The outcome to present.
 * @returns Heading, sentence, recovery, and whether a payment path is offered.
 */
export function presentOutcome(
  outcome: EnrollmentOutcome,
): OutcomePresentation {
  return OUTCOME[outcome]
}

/**
 * Whether the external checkout handoff may be shown for a stored state.
 *
 * Used by the enrollment page, which renders from the stored state rather than
 * from an outcome — a parent returning to the page later has no outcome. It
 * agrees with `offersPayment` by construction: `started` and nothing else.
 * @param state - The stored enrollment state.
 * @returns True only for `started`.
 */
export function mayOfferCheckout(state: EnrollmentState): boolean {
  return state === "started"
}

export { OUTCOME }
