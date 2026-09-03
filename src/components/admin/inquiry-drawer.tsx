"use client"

import { useActionState } from "react"
import { UserCheck, UserMinus } from "lucide-react"

import { setInquiryStateAction } from "@/app/(portal)/admin/communications/inquiries/actions"
import { emptyInquiryActionFormState } from "@/app/(portal)/admin/communications/inquiries/form-state"
import {
  InquiryStateBadge,
  InquiryStateMeaning,
} from "@/components/admin/inquiry-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogHeader,
  DialogPopup,
} from "@/components/ui/dialog"
import {
  INQUIRY_STATE_LABELS,
  INQUIRY_TYPE_LABELS,
  isSensitiveInquiry,
  nextInquiryStates,
} from "@/lib/admin/inquiry-transitions"

import type { AdminInquiry } from "@/lib/admin/inquiries"

/**
 * Inquiry detail drawer and the approved triage actions (MPS-REQ-010,
 * MPS-REQ-021, MPS-REQ-024; MPS-WFL-004; MPS-RUL-003, MPS-RUL-004; MDS
 * `page_shells.admin_operations` detail drawer, `components.dialog`).
 *
 * THIS IS WHERE THE FAMILY'S WORDS ARE
 *
 * The queue behind this drawer shows a pathway, a name, and a state. What the
 * family actually wrote appears here and nowhere else, because a triage list
 * that renders every assistance request in full is a list nobody can safely
 * have open on a shared screen (MPS-RUL-003).
 *
 * THE LINE THIS COMPONENT EXISTS TO HOLD
 *
 * Every control below records a review position. None of them decides
 * anything. "Path provided" says an administrator gave this family a
 * registration or payment path — it is not a discount, an award, a price, or
 * an eligibility finding, and the drawer says so in words next to the button
 * (MPS-RUL-004). "Not available" says no path was available, not that a family
 * was assessed and declined.
 *
 * NOTHING HERE CONTACTS THE FAMILY
 *
 * MPS-WFL-004 completes when the family receives a private outcome or next
 * step, and the approved way to deliver one is the administrator replying
 * personally. No message is sent by any control on this surface, and the
 * drawer says that rather than leaving it to be inferred (GAP-PUBLIC-001).
 */
function InquiryDrawer({
  inquiry,
  viewerOwns,
  onClose,
}: {
  inquiry: AdminInquiry | null
  /** Whether the signed-in administrator is this inquiry's owner. */
  viewerOwns: boolean
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState(
    setInquiryStateAction,
    emptyInquiryActionFormState,
  )

  if (!inquiry) return null

  /* An outcome from a different record must not be shown against this one —
     the drawer is reused, and a stale success would attach a change to the
     wrong family's request. */
  const outcome = state.inquiryId === inquiry.id ? state.status : "idle"

  const targets = nextInquiryStates(inquiry.state)
  const sensitive = isSensitiveInquiry(inquiry.type)

  const message =
    outcome === "updated"
      ? "The inquiry was updated. The change is recorded with your account and the time. Nothing was sent to the family."
      : outcome === "invalidTransition"
        ? "That change is not approved from this inquiry's current state."
        : outcome === "notFound"
          ? "This inquiry is no longer available."
          : outcome === "forbidden"
            ? "This account is not authorized to change an inquiry."
            : outcome === "unavailable"
              ? "No Supabase project is configured in this environment. Nothing was changed."
              : outcome === "invalid"
                ? "That request was not understood. Nothing was changed."
                : outcome === "failed"
                  ? "Something went wrong on our side. Nothing was changed."
                  : ""

  const submitted = new Date(inquiry.submittedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup size="panel">
        <DialogHeader
          title={`${INQUIRY_TYPE_LABELS[inquiry.type]} — ${inquiry.reference}`}
          description={`From ${inquiry.contactName}, ${submitted} UTC`}
          closeLabel="Close inquiry detail"
        />

        <DialogBody>
          {message ? (
            <Alert
              tone={outcome === "updated" ? "success" : "warning"}
              title={
                outcome === "updated"
                  ? "Inquiry updated"
                  : "Nothing was changed"
              }
              live="polite"
            >
              {message}
            </Alert>
          ) : null}

          {sensitive ? (
            /* MPS-RUL-003. Said plainly to the person reading it, because the
               control that keeps this private at every other layer is the
               absence of a policy, and an administrator forwarding the text is
               the one disclosure path no database rule can close. */
            <Alert tone="info" title="This is a private request about cost">
              Keep what this family wrote between the administrators handling
              it. It is not visible to educators and must not be repeated in a
              program announcement, a roster note, or any group message.
            </Alert>
          ) : null}

          <section
            aria-labelledby="inquiry-current-state"
            className="flex flex-col gap-[var(--hsh-space-2)]"
          >
            <h3
              id="inquiry-current-state"
              className="hsh-label text-[var(--hsh-text-secondary)]"
            >
              Current state
            </h3>
            <InquiryStateBadge state={inquiry.state} />
            <InquiryStateMeaning state={inquiry.state} />
          </section>

          <dl className="flex flex-col gap-[var(--hsh-space-3)]">
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Reply to
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                <a
                  href={`mailto:${inquiry.contactEmail}`}
                  className="text-[var(--hsh-text-link)] underline underline-offset-4"
                >
                  {inquiry.contactEmail}
                </a>
                {inquiry.contactPhone ? ` · ${inquiry.contactPhone}` : null}
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                About
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {inquiry.program?.name ?? "No particular program"}
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                Owner
              </dt>
              <dd className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                {inquiry.owned
                  ? viewerOwns
                    ? "You"
                    : "Another administrator"
                  : "Nobody yet"}
              </dd>
            </div>
            <div className="flex flex-col gap-[var(--hsh-space-1)]">
              <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                What they wrote
              </dt>
              <dd className="hsh-body-sm m-0 whitespace-pre-wrap text-[var(--hsh-text-primary)]">
                {inquiry.message}
              </dd>
            </div>
          </dl>

          <section
            aria-labelledby="inquiry-owner-actions"
            className="flex flex-col gap-[var(--hsh-space-2)]"
          >
            <h3
              id="inquiry-owner-actions"
              className="hsh-label text-[var(--hsh-text-secondary)]"
            >
              Ownership
            </h3>
            <form action={formAction}>
              <input type="hidden" name="inquiryId" value={inquiry.id} />
              <input type="hidden" name="state" value="" />
              <input
                type="hidden"
                name="claim"
                value={viewerOwns ? "release" : "claim"}
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                className="w-full justify-start"
                disabled={pending}
              >
                {viewerOwns ? (
                  <UserMinus aria-hidden="true" strokeWidth={1.75} />
                ) : (
                  <UserCheck aria-hidden="true" strokeWidth={1.75} />
                )}
                {viewerOwns ? "Release this inquiry" : "Take this inquiry"}
              </Button>
            </form>
          </section>

          <section
            aria-labelledby="inquiry-actions"
            className="flex flex-col gap-[var(--hsh-space-3)]"
          >
            <h3
              id="inquiry-actions"
              className="hsh-label text-[var(--hsh-text-secondary)]"
            >
              Move this inquiry
            </h3>

            <Alert tone="info" title="These record a status, not a decision">
              Nothing here grants a discount, awards assistance, sets a price,
              or tells the family anything. Replying to the family is still
              yours to do, by email or phone.
            </Alert>

            {targets.length === 0 ? (
              <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                {INQUIRY_STATE_LABELS[inquiry.state]} is a final state. A later
                request from this family arrives as a new inquiry, and this
                record and its history are kept.
              </p>
            ) : (
              <div className="flex flex-col gap-[var(--hsh-space-2)]">
                {targets.map((target) => (
                  <form key={target} action={formAction}>
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    <input type="hidden" name="state" value={target} />
                    <input type="hidden" name="claim" value="none" />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="md"
                      className="w-full justify-start"
                      disabled={pending}
                    >
                      Mark {INQUIRY_STATE_LABELS[target].toLowerCase()}
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </section>
        </DialogBody>
      </DialogPopup>
    </Dialog>
  )
}

export { InquiryDrawer }
