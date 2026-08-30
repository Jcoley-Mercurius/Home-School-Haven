/**
 * Pure dashboard logic: which student is being viewed, and what the family's
 * one next action is.
 *
 * Nothing here touches the network, the session, or the database. That is the
 * point — these are the two decisions most worth testing directly, and neither
 * needs a running Postgres to be proved correct.
 *
 * The repositories in this directory own the reads. `page.tsx` owns the
 * rendering. This file owns the two judgements between them.
 */

import type { EnrollmentRecord } from "@/lib/enrollment/repository"
import type { Student } from "@/lib/family/repository"

/**
 * Resolve the student whose context the dashboard is showing.
 *
 * `requested` arrives from `?student=` in the URL, which means it arrives from
 * the browser. It is never an authorization input: `students` has already come
 * back through RLS, so it contains this family's children and no others, and an
 * id that is not in it selects nothing. An id belonging to another family
 * therefore behaves exactly like an id that never existed — it falls back to
 * the first student, silently, disclosing neither that the id was valid
 * somewhere else nor that it was rejected.
 *
 * @param students - The authorized student profiles, already RLS-filtered.
 * @param requested - The `?student=` value, if any.
 * @returns The selected student, or `null` when the family has none.
 */
export function selectStudent(
  students: Student[],
  requested: string | null | undefined,
): Student | null {
  if (students.length === 0) return null
  if (!requested) return students[0]
  return students.find((student) => student.id === requested) ?? students[0]
}

export type NextAction = {
  /** `attention` renders the warning treatment; `calm` renders the quiet one. */
  tone: "attention" | "calm"
  title: string
  body: string
  href: string
  linkLabel: string
}

/**
 * The one next action for this family (MPS-REQ-015 "any required next action",
 * MPS-REQ-021, MDS-REF-007 "Your next step").
 *
 * Ordered by what actually blocks the family, most blocking first. Only one is
 * ever shown: a dashboard offering four next steps has no next step.
 *
 * Every branch is derived from stored state. None of them decides anything —
 * no enrollment is confirmed here, no payment is judged, no consent is implied,
 * no financial outcome is inferred (MPS-RUL-004, DO-DONT "Trust states"). When
 * a state is unresolved the action says who resolves it, which is Home School
 * Haven, not the parent and not this code.
 *
 * @param students - The family's authorized student profiles.
 * @param enrollments - The family's enrollments, or `null` when the read failed
 *   or is unavailable — in which case no action is claimed, because an action
 *   derived from data we do not have would be a guess.
 * @returns The single next action, or `null` when nothing needs attention.
 */
export function nextAction(
  students: Student[],
  enrollments: EnrollmentRecord[] | null,
): NextAction | null {
  if (students.length === 0) {
    return {
      tone: "attention",
      title: "Add a student profile",
      body: "Your family is set up. Adding a student profile is the next step, and you can change it later.",
      href: "/family/students/new",
      linkLabel: "Add A Student",
    }
  }

  if (enrollments === null) return null

  /* Payment awaiting verification outranks everything else a family can see.
     It is the state most easily mistaken for success, so it is the state that
     gets the one visible next step (MDS-REF-007). */
  if (
    enrollments.some((enrollment) => enrollment.state === "payment_pending")
  ) {
    return {
      tone: "attention",
      title: "Payment verification pending",
      body: "Home School Haven is verifying your payment. Enrollment is not yet confirmed. Nothing further is needed from you right now.",
      href: "/family/schedule",
      linkLabel: "View Details",
    }
  }

  if (enrollments.some((enrollment) => enrollment.state === "started")) {
    return {
      tone: "attention",
      title: "Checkout was started",
      body: "Checkout was started on Home School Haven's payment provider and no result has been recorded yet. Enrollment is not confirmed.",
      href: "/family/schedule",
      linkLabel: "View Details",
    }
  }

  if (enrollments.some((enrollment) => enrollment.state === "payment_failed")) {
    return {
      tone: "attention",
      title: "A payment did not complete",
      body: "One registration did not complete payment, so it is not confirmed. Home School Haven can help you sort it out.",
      href: "/contact",
      linkLabel: "Contact Home School Haven",
    }
  }

  if (enrollments.some((enrollment) => enrollment.state === "blocked")) {
    return {
      tone: "attention",
      title: "One registration needs attention",
      body: "Home School Haven needs to look at one of your registrations before it can go ahead. It is not confirmed.",
      href: "/contact",
      linkLabel: "Contact Home School Haven",
    }
  }

  if (
    enrollments.some((enrollment) => enrollment.state === "approval_pending")
  ) {
    return {
      tone: "calm",
      title: "A request is under review",
      body: "Home School Haven has your request and is reviewing it. Nothing is needed from you while it is with them.",
      href: "/family/schedule",
      linkLabel: "View Details",
    }
  }

  if (enrollments.some((enrollment) => enrollment.state === "waitlisted")) {
    return {
      tone: "calm",
      title: "You are on a waitlist",
      body: "A waitlist place is not enrollment. Home School Haven will be in touch if a place opens.",
      href: "/family/schedule",
      linkLabel: "View Details",
    }
  }

  if (enrollments.length === 0) {
    return {
      tone: "calm",
      title: "Explore what is on offer",
      body: "Your family has no registrations yet. Have a look at the programs Home School Haven has published.",
      href: "/programs",
      linkLabel: "Browse Programs",
    }
  }

  return null
}
