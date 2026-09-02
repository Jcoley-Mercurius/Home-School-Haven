import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { PortalNav } from "@/components/layout/portal-nav"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { CheckoutHandoff } from "@/components/program/checkout-handoff"
import { Alert } from "@/components/ui/alert"
import { contact, guidanceHref } from "@/content/foundation-content"
import { requireRole } from "@/lib/auth/guards"
import {
  mayOfferCheckout,
  parseOutcome,
  presentOutcome,
} from "@/lib/enrollment/eligibility"
import { getFamilyEnrollment } from "@/lib/enrollment/repository"

/**
 * One registration, with one authoritative state (MPS-REQ-014, MPS-REQ-021,
 * MPS-ACC-021/022/023).
 *
 * WHERE THE STATE COMES FROM
 *
 * The stored row, always. `?outcome=` only decides which confirmation sentence
 * a parent sees immediately after submitting; it can never change what is
 * rendered as the state, and an outcome this build does not recognise is
 * ignored rather than shown. A query parameter is browser input, and browser
 * input does not get to describe an enrollment.
 *
 * WHEN THE CHECKOUT HANDOFF APPEARS
 *
 * Only when the stored state is `started` — `mayOfferCheckout` is the single
 * rule, and it agrees with `presentOutcome().offersPayment` by construction.
 * `approval_pending` (MPS-ACC-019) and `waitlisted` (MPS-ACC-020) render no
 * payment control at all. Not a disabled one, not a hidden one: none.
 *
 * WHAT ITS ABSENCE IS NOT
 *
 * The absence of a payment control never has to be interpreted.
 * `EnrollmentStateBadge withSentence` states non-confirmation in words for
 * every state, so nothing rests on a missing button (DO-DONT "Trust states").
 *
 * WHO CAN SEE IT
 *
 * `requireRole` decides whether the page renders; RLS decides whether the row
 * comes back. An enrollment belonging to another family is indistinguishable
 * from one that never existed — both are `notFound()`.
 */
export const metadata: Metadata = {
  title: "Your registration — Home School Haven of SWFL",
}

export default async function FamilyEnrollmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ enrollmentId: string }>
  searchParams: Promise<{ outcome?: string }>
}) {
  const { enrollmentId } = await params
  const { outcome: rawOutcome } = await searchParams
  const viewer = await requireRole(
    "parent",
    `/family/enrollments/${enrollmentId}`,
  )

  const result = await getFamilyEnrollment(enrollmentId)
  if (result.status === "missing") notFound()

  const outcome = parseOutcome(rawOutcome)
  const presentation = outcome ? presentOutcome(outcome) : null
  const enrollment = result.status === "ready" ? result.enrollment : null

  return (
    <>
      <SiteHeader />
      <PortalNav viewer={viewer} area="family" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-8)] py-[var(--hsh-space-12)]"
      >
        <header className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
            Your registration
          </h1>
          {enrollment ? (
            <p className="hsh-body text-[var(--hsh-text-secondary)]">
              {enrollment.program
                ? enrollment.program.name
                : "This program is no longer published"}{" "}
              — {enrollment.studentName}
            </p>
          ) : null}
        </header>

        <div className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-6)]">
          {result.status !== "ready" ? (
            /* Never rendered as "no registration": the read did not happen. */
            <Alert tone="warning" title="This registration could not be loaded">
              <p>
                Nothing changed. Try again in a moment, or call {contact.phone}{" "}
                and Home School Haven will tell you where your registration
                stands.
              </p>
            </Alert>
          ) : null}

          {enrollment && presentation ? (
            /* The submission's own result, announced once. The stored state
               below is what the page actually asserts. */
            <Alert
              tone={presentation.offersPayment ? "info" : "neutral"}
              title={presentation.heading}
              live="polite"
            >
              <p>{presentation.sentence}</p>
            </Alert>
          ) : null}

          {enrollment ? (
            <section
              aria-labelledby="enrollment-state-heading"
              className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
            >
              <h2
                id="enrollment-state-heading"
                className="hsh-h4 text-[var(--hsh-text-primary)]"
              >
                Current state
              </h2>
              <EnrollmentStateBadge state={enrollment.state} withSentence />
              {enrollment.program?.publishedSchedule ? (
                <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  {enrollment.program.publishedSchedule}
                </p>
              ) : null}
            </section>
          ) : null}

          {enrollment?.program && mayOfferCheckout(enrollment.state) ? (
            /* The same component the public program page uses, so the trust
               language cannot drift between the two places a parent meets it.
               Nothing is appended to the URL. */
            <CheckoutHandoff
              program={{
                name: enrollment.program.name,
                checkoutUrl: enrollment.program.checkoutUrl,
              }}
            />
          ) : null}

          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Questions about this registration?{" "}
            <Link href={guidanceHref} data-inline-link="true">
              Ask Home School Haven
            </Link>{" "}
            or call {contact.phone}.
          </p>
        </div>

        <Link
          href="/family"
          className="hsh-body inline-flex min-h-[var(--hsh-touch-target)] items-center self-start rounded-[var(--hsh-radius-small)] font-semibold text-[var(--hsh-text-link)] underline underline-offset-4"
        >
          Back to your family
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
