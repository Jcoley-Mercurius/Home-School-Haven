import { CapacityForm } from "@/components/admin/capacity-form"
import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { SectionError } from "@/components/family/section-states"
import { TextLink } from "@/components/ui/text-link"
import { getProgramRoster } from "@/lib/admin/roster"
import { summarizeCapacity } from "@/lib/schedule/capacity"

import type { AdminProgram } from "@/lib/admin/programs"
import type { RosterEntry } from "@/lib/admin/roster-state"

/**
 * Capacity, and the waitlist that goes with it (MPS-REQ-012, MPS-RUL-002,
 * MPS-FEA-012, MPS-ACC-018/020; MDS `components.enrollment_state`).
 *
 * THE WAITLIST IS A LIST, NOT A QUEUE
 *
 * Waitlisted records are shown in the order they were PLACED — the moment an
 * administrator recorded the decision, read from `state_changed_at`. That is a
 * fact about when something was recorded. It is not an order of promotion, and
 * the heading says so, because MPS approves no waitlist ordering, priority, or
 * promotion rule at all (GAP-ADMIN-011).
 *
 * Nothing here promotes anybody. A waitlisted record becomes confirmed the same
 * way every other enrollment decision is made: an authorized administrator
 * decides it on the Enrollments page, with a mandatory note and an audit row.
 * There is no "promote" button on this page, because a button here would be a
 * second, quieter route to the same decision — and the two would drift.
 *
 * NO PAYMENT, ANYWHERE
 *
 * A waitlist place collects nothing and starts nothing (MPS-RUL-002). There is
 * no payment column in this product to collect into, and no field on this
 * surface that could begin one.
 */
async function CapacitySection({ program }: { program: AdminProgram }) {
  const roster = await getProgramRoster(program.id)

  if (roster.status !== "ready") {
    return (
      <section
        aria-labelledby="capacity-heading"
        className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        <h2
          id="capacity-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Capacity and waitlist
        </h2>
        <SectionError>
          {roster.status === "unavailable"
            ? "Capacity is not available in this environment because no Supabase project is configured."
            : "Capacity could not be loaded. Nothing has changed — reload the page to try again."}
        </SectionError>
      </section>
    )
  }

  const entries = [...roster.data.confirmed, ...roster.data.notConfirmed]
  const summary = summarizeCapacity(
    program.capacity,
    entries.map((entry) => entry.state),
  )

  /* Oldest placement first. `state_changed_at` is when the decision was
     recorded, which is a fact; reading it as a promotion order would not be. */
  const waitlisted = entries
    .filter((entry) => entry.state === "waitlisted")
    .sort((a, b) => a.stateChangedAt.localeCompare(b.stateChangedAt))

  return (
    <section
      aria-labelledby="capacity-heading"
      className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <h2
        id="capacity-heading"
        className="hsh-h4 text-[var(--hsh-text-primary)]"
      >
        Capacity and waitlist
      </h2>

      <CapacityForm
        programId={program.id}
        updatedAt={program.updatedAt}
        capacity={program.capacity}
        waitlistEnabled={program.waitlistEnabled}
        summary={summary}
      />

      <div className="flex flex-col gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-5)]">
        <h3 className="hsh-h5 m-0 text-[var(--hsh-text-primary)]">
          Waitlisted records, in the order they were placed
        </h3>
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          This is when each record was placed on the waitlist, not an order of
          promotion. Home School Haven has not set a rule for who is offered a
          place first, so this product does not imply one. A waitlisted record
          becomes confirmed only when an administrator decides it on{" "}
          <TextLink href="/admin/enrollments">Enrollments</TextLink>.
        </p>

        {waitlisted.length === 0 ? (
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            No record is waitlisted for this program.
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-[var(--hsh-space-2)] p-0">
            {waitlisted.map((entry, index) => (
              <WaitlistRow
                key={entry.enrollmentId}
                entry={entry}
                position={index + 1}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/**
 * One waitlisted record.
 * @param props.entry - The roster entry.
 * @param props.position - Its place in the placement order, from 1.
 * @returns The list item.
 */
function WaitlistRow({
  entry,
  position,
}: {
  entry: RosterEntry
  position: number
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)]">
      <span className="hsh-body text-[var(--hsh-text-primary)]">
        <span className="hsh-label mr-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
          {position}.
        </span>
        {/* An unresolved join reads as an explicit absence, never as a blank
            cell that looks like an empty value. */}
        {entry.studentName || "Name not available"}
        {entry.familyName ? (
          <span className="hsh-body-sm ml-[var(--hsh-space-2)] text-[var(--hsh-text-secondary)]">
            {entry.familyName}
          </span>
        ) : null}
      </span>
      <EnrollmentStateBadge state={entry.state} />
    </li>
  )
}

export { CapacitySection }
