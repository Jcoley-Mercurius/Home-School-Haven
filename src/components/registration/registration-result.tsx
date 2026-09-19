"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { CheckoutHandoff } from "@/components/program/checkout-handoff"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { mayOfferCheckout } from "@/lib/enrollment/eligibility"
import type { RegistrationChildResult } from "@/lib/registration/repository"

/**
 * The recorded registration (MDS DESIGN-SYSTEM §9.1 "Success"; MPS-REQ-013,
 * MPS-ACC-019/020/021/022).
 *
 * Every state shown here was read back from the database after the submission
 * committed. None of it comes from the form. The words are the shared
 * `enrollment_state` table's, so this page and the family dashboard cannot
 * disagree about what a state means:
 *
 *   * only `confirmed` reads as "Enrolled";
 *   * `approval_pending`, `payment_pending`, and `waitlisted` each say in their
 *     own sentence that enrollment is not confirmed;
 *   * the external-checkout handoff appears only for `started`
 *     (`mayOfferCheckout`), and says that checkout is not payment.
 *
 * The heading says "received", not "complete": nothing about a registration is
 * complete until Home School Haven confirms each enrollment. STEP UP is not
 * mentioned (MPS DEC-033; no coupon field exists on the approved checkout,
 * prompts/external-checkout-payment-truth.md §5).
 *
 * Every GoDaddy checkout is one program's page, so when more than one checkout
 * is offered the page says each is separate. Nothing here suggests that one
 * payment covers several children or programs.
 */
export function RegistrationResult({
  replayed,
  results,
  draftDocuments,
}: {
  replayed: boolean
  results: RegistrationChildResult[] | null
  /** True when any accepted document was a draft, not an approved version. */
  draftDocuments: boolean
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const checkoutCount = (results ?? [])
    .flatMap((child) => child.selections)
    .filter((s) => mayOfferCheckout(s.state) && s.checkoutUrl).length
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section
      aria-labelledby="reg-result-heading"
      className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-6)]"
    >
      <div
        role="status"
        className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-forest-100)] bg-[var(--hsh-forest-50)] p-[var(--hsh-space-5)]"
      >
        <h2
          id="reg-result-heading"
          ref={headingRef}
          tabIndex={-1}
          className="hsh-h2 text-[var(--hsh-text-primary)] outline-none"
        >
          Registration received
        </h2>
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          {replayed
            ? "This registration had already been recorded. It was not recorded twice."
            : "Home School Haven has recorded your registration."}{" "}
          Each program&rsquo;s status is below. A registration is not
          enrollment: a place is confirmed only when a program shows
          &ldquo;Enrolled&rdquo;.
        </p>
      </div>

      {draftDocuments ? (
        <Alert tone="neutral" title="Sample preview">
          <p>
            This registration used sample draft documents. Accepting a draft is
            not acceptance of approved policy, and nothing here is for a real
            family yet.
          </p>
        </Alert>
      ) : null}

      {checkoutCount > 1 ? (
        <p className="hsh-body text-[var(--hsh-text-secondary)]">
          Each program below has its own checkout link. Complete each one on its
          own: starting one checkout does not pay for any other program or
          child.
        </p>
      ) : null}

      {results === null ? (
        <Alert tone="warning" title="We could not load each program's status">
          <p>
            Your registration was recorded, but the status of each program could
            not be loaded just now. Your Family Overview shows it.
          </p>
        </Alert>
      ) : (
        <ul className="flex flex-col gap-[var(--hsh-space-5)]">
          {results.map((child) => (
            <li
              key={child.studentId}
              className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] shadow-[var(--hsh-shadow-subtle)]"
            >
              <h3 className="hsh-h3 break-words text-[var(--hsh-text-primary)]">
                {child.studentName}
              </h3>
              <ul className="flex flex-col gap-[var(--hsh-space-4)]">
                {child.selections.map((s) => (
                  <li
                    key={s.enrollmentId}
                    className="flex flex-col gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-4)] first:border-t-0 first:pt-0"
                  >
                    <h4 className="hsh-h4 text-[var(--hsh-text-primary)]">
                      {s.programName}
                    </h4>
                    <EnrollmentStateBadge state={s.state} withSentence />
                    {mayOfferCheckout(s.state) ? (
                      <CheckoutHandoff
                        program={{
                          name: s.programName,
                          checkoutUrl: s.checkoutUrl,
                        }}
                        placement="eligible"
                        studentName={child.studentName}
                        headingId={`reg-result-${s.enrollmentId}-checkout`}
                        headingLevel="h4"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-[var(--hsh-space-3)]">
        <Button variant="primary" size="md" render={<Link href="/family" />}>
          Go to Family Overview
        </Button>
        <Button
          variant="secondary"
          size="md"
          render={<Link href="/family/schedule" />}
        >
          View Schedule
        </Button>
      </div>
    </section>
  )
}
