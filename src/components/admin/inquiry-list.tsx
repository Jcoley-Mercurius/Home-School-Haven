"use client"

import { useState } from "react"
import { ChevronRight, Lock } from "lucide-react"

import { InquiryDrawer } from "@/components/admin/inquiry-drawer"
import { InquiryStateBadge } from "@/components/admin/inquiry-state"
import { Button } from "@/components/ui/button"
import {
  INQUIRY_TYPE_LABELS,
  isSensitiveInquiry,
} from "@/lib/admin/inquiry-transitions"

import type { AdminInquiry } from "@/lib/admin/inquiries"

/**
 * The inquiry triage queue (MPS-REQ-010, MPS-WFL-004; MDS
 * `page_shells.admin_operations`, `components.table`; `responsive.rules.grid`
 * "Operational tables transform to labeled record cards when column integrity
 * cannot be preserved").
 *
 * WHAT THE QUEUE SHOWS, AND WHAT IT WITHHOLDS
 *
 * Pathway, sender, when it arrived, whether anyone has taken it, and its
 * state. Not the message, not the email address, not the phone number. An
 * administrator triaging twenty requests needs to know what is waiting; the
 * words of a family's private request about cost are one deliberate click
 * away, not spread across a screen that might be shared or screenshotted
 * (MPS-RUL-003).
 *
 * WHY THE WHOLE LIST IS A CLIENT COMPONENT
 *
 * Same reason as `./enrollment-list.tsx`: the drawer is modal and needs focus
 * trapping, Escape, and focus return. Every row already carries what the
 * drawer shows, so opening one needs no second authorized read and no request
 * that takes a record identifier from the browser.
 *
 * TWO RENDERINGS, ONE ACCESSIBILITY TREE
 *
 * Table from `sm` up, labeled record cards below it. Both are in the DOM, so
 * every test locator over this component must be scoped to one of them
 * (DEFECT-AO3).
 */
function InquiryList({
  inquiries,
  viewerId,
}: {
  inquiries: AdminInquiry[]
  /** The signed-in administrator, so the drawer can say "You" for an owner. */
  viewerId: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = inquiries.find((inquiry) => inquiry.id === selectedId) ?? null

  const arrived = (inquiry: AdminInquiry) =>
    new Date(inquiry.submittedAt).toLocaleDateString("en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    })

  /* The control's accessible name says which request it opens, so a list of
     controls read out of the row's context is still unambiguous. Applied as
     `aria-label` rather than a hidden span, for the reason in
     `./enrollment-list.tsx` (DEFECT-PE4). */
  const openLabel = (inquiry: AdminInquiry) =>
    `Open the ${INQUIRY_TYPE_LABELS[inquiry.type].toLowerCase()} request ${inquiry.reference} from ${inquiry.contactName}`

  /* The lock marks a request whose contents are private to administrators.
     It never stands alone: the pathway label beside it already says "Cost
     assistance", so the meaning does not rest on an icon or a colour. */
  const pathway = (inquiry: AdminInquiry) => (
    <span className="inline-flex items-center gap-[var(--hsh-space-1)]">
      {isSensitiveInquiry(inquiry.type) ? (
        <Lock aria-hidden="true" strokeWidth={1.75} className="size-4" />
      ) : null}
      {INQUIRY_TYPE_LABELS[inquiry.type]}
    </span>
  )

  const ownerLabel = (inquiry: AdminInquiry) =>
    inquiry.owned
      ? inquiry.ownerUserId === viewerId
        ? "You"
        : "Another administrator"
      : "Unassigned"

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Inquiries, with the request type, who sent it, when it arrived, who
            owns it, and its current state. Select an inquiry to read what the
            family wrote and to move it.
          </caption>
          <thead>
            <tr className="border-b border-[var(--hsh-border-default)]">
              {["Request", "From", "Arrived", "Owner", "State", "Action"].map(
                (heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
                  >
                    <span className={index === 5 ? "sr-only" : undefined}>
                      {heading}
                    </span>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr
                key={inquiry.id}
                className="border-b border-[var(--hsh-border-default)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                >
                  {pathway(inquiry)}
                </th>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {inquiry.contactName}
                </td>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  <time dateTime={inquiry.submittedAt}>{arrived(inquiry)}</time>
                </td>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {ownerLabel(inquiry)}
                </td>
                <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                  <InquiryStateBadge state={inquiry.state} />
                </td>
                <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={openLabel(inquiry)}
                    onClick={() => setSelectedId(inquiry.id)}
                  >
                    Open
                    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
        {inquiries.map((inquiry) => (
          <li
            key={inquiry.id}
            className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
          >
            <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {pathway(inquiry)}
            </p>

            <dl className="flex flex-col gap-[var(--hsh-space-3)]">
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  From
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {inquiry.contactName}
                </dd>
              </div>
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Arrived
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  <time dateTime={inquiry.submittedAt}>{arrived(inquiry)}</time>
                </dd>
              </div>
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Owner
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {ownerLabel(inquiry)}
                </dd>
              </div>
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  State
                </dt>
                <dd className="m-0">
                  <InquiryStateBadge state={inquiry.state} />
                </dd>
              </div>
            </dl>

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              aria-label={openLabel(inquiry)}
              onClick={() => setSelectedId(inquiry.id)}
            >
              Open
              <ChevronRight aria-hidden="true" strokeWidth={1.75} />
            </Button>
          </li>
        ))}
      </ul>

      <InquiryDrawer
        inquiry={selected}
        viewerOwns={selected?.ownerUserId === viewerId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

export { InquiryList }
