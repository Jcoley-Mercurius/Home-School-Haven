"use client"

import { ExternalLink } from "lucide-react"

import { HANDOFF_NOTICE } from "@/components/program/checkout-handoff"
import { childHeading } from "@/lib/registration/form"

import { useRegistration } from "./registration-context"

/**
 * Step 6: the external-checkout explanation, per child (MPS-REQ-013; MDS
 * `payment_handoff` "external checkout notice"; DESIGN-SYSTEM §9.1).
 *
 * There is no checkout link here, and there cannot be one yet. A link belongs
 * to an enrollment the database has evaluated to `started` (`mayOfferCheckout`),
 * and nothing is evaluated until the registration is submitted. The success
 * screen shows the link, per program, only where the returned state allows it.
 *
 * STEP UP is not mentioned. It is a coupon applied at the end of that same
 * external checkout (MPS DEC-033), which this site does not operate.
 */
export function CheckoutStep() {
  const { draft, catalog, students } = useRegistration()

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        Home School Haven collects payment on its own checkout page, not on this
        site. Here is what happens for each child after you submit.
      </p>

      <ul className="flex flex-col gap-[var(--hsh-space-4)]">
        {draft.children.map((child) => {
          const programs = child.selections
            .map((s) => catalog.programs.find((p) => p.id === s.programId))
            .filter((p) => p !== undefined)
          const heading = childHeading(child, students)
          return (
            <li
              key={child.key}
              className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
            >
              <h3 className="hsh-h4 text-[var(--hsh-text-primary)]">
                {heading}
              </h3>
              {programs.length ? (
                <ul className="hsh-body flex list-disc flex-col gap-[var(--hsh-space-1)] pl-[var(--hsh-space-5)] text-[var(--hsh-text-primary)]">
                  {programs.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
                  No programs chosen yet.
                </p>
              )}
              <div className="flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-4)]">
                <ExternalLink
                  aria-hidden="true"
                  className="mt-[3px] size-5 shrink-0 text-[var(--hsh-text-secondary)]"
                  strokeWidth={1.75}
                />
                <div className="hsh-body-sm flex flex-col gap-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
                  <p>{HANDOFF_NOTICE}</p>
                  <p>
                    After you submit, each program shows its own next step. Some
                    programs are reviewed by Home School Haven first, and a full
                    program may offer a waitlist place instead. A checkout link
                    appears only for a program that is ready for payment.
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
