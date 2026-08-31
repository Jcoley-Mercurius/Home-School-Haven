import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { EmptyState, SectionError } from "@/components/family/section-states"
import { Alert } from "@/components/ui/alert"
import { TextLink } from "@/components/ui/text-link"
import { getProgramRoster } from "@/lib/admin/roster"

import type { RosterEntry } from "@/lib/admin/roster-state"

/**
 * A program's roster (MPS-REQ-017, MPS-REQ-020, MPS-ACC-028; MDS
 * `components.table` variant `roster`, `components.enrollment_state`).
 *
 * TWO TABLES, NOT ONE WITH A STATUS COLUMN
 *
 * The confirmed roster and the unconfirmed records are rendered as two separate
 * tables under two separate headings. That is the whole point of the surface.
 * One table with a state column invites a reader to skim it as "the roster" and
 * count the rows, and the row they would miscount belongs to a child whose
 * place is not settled. Two tables cannot be skimmed that way: the heading
 * above each one says what it is before any row is read.
 *
 * The split is computed in `roster-state.ts` by an explicit equality against
 * `confirmed`, never by excluding a list of states — see the note there.
 *
 * NO SUCCESS STYLING BELOW THE SECOND HEADING
 *
 * Every unconfirmed row carries its own `EnrollmentStateBadge`, which is the
 * same component and the same words the family sees on their dashboard
 * (MPS-ACC-022). `payment_pending` renders as "Payment verification pending"
 * with a sentence saying enrollment is not confirmed, in the pending tone. A
 * green tick appears in exactly one place on this page, and it means the one
 * thing it is allowed to mean.
 *
 * A SERVER COMPONENT, DELIBERATELY
 *
 * Unlike the family and educator directories, there is nothing modal here and
 * nothing to filter: a roster is a list to read. Keeping it on the server means
 * no child's name enters a client bundle or a hydration payload for this page.
 *
 * WHAT THIS SECTION DOES NOT OFFER
 *
 * No add, no remove, no move, no export, no attendance. A child joins a roster
 * by their parent enrolling them and an administrator confirming it on the
 * Enrollments page — MPS-RUL-008 requires a parent's authority affirmation that
 * an administrator cannot give, so there is no "add student" here to build.
 * Moving a student between programs is a transfer, which is a financial
 * decision this release never makes (MPS-RUL-004). Export waits on checklist §9
 * confirming who may export or print roster information (GAP-ADMIN-015).
 */

/**
 * One roster table.
 *
 * @param props.entries - The rows.
 * @param props.caption - The table's accessible caption.
 * @param props.showState - Whether to render a state column.
 * @returns The table, in both its desktop and mobile renderings.
 */
function RosterTable({
  entries,
  caption,
  showState,
}: {
  entries: RosterEntry[]
  caption: string
  showState: boolean
}) {
  const headings = showState
    ? ["Student", "Family", "State", "Changed"]
    : ["Student", "Family", "Confirmed"]

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--hsh-border-default)]">
              {headings.map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.enrollmentId}
                className="border-b border-[var(--hsh-border-default)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                >
                  {entry.studentName || "Student not available"}
                </th>
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {entry.familyName || "Family not available"}
                </td>
                {showState ? (
                  <td className="px-[var(--hsh-space-3)] py-[var(--hsh-space-4)]">
                    <EnrollmentStateBadge state={entry.state} />
                  </td>
                ) : null}
                <td className="hsh-body-sm px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]">
                  {new Date(entry.stateChangedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex list-none flex-col gap-[var(--hsh-space-3)] p-0 sm:hidden">
        {entries.map((entry) => (
          <li
            key={entry.enrollmentId}
            className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
          >
            <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {entry.studentName || "Student not available"}
            </p>
            <dl className="flex flex-col gap-[var(--hsh-space-2)]">
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  Family
                </dt>
                <dd className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                  {entry.familyName || "Family not available"}
                </dd>
              </div>
              {/* The state label is never dropped on a narrow screen: it is the
                  fact that distinguishes a roster member from a child whose
                  place is unsettled. */}
              <div className="flex flex-col gap-[var(--hsh-space-1)]">
                <dt className="hsh-label text-[var(--hsh-text-secondary)]">
                  {showState ? "State" : "Confirmed"}
                </dt>
                <dd className="m-0">
                  {showState ? (
                    <EnrollmentStateBadge state={entry.state} />
                  ) : (
                    <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                      {new Date(entry.stateChangedAt).toLocaleDateString()}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The roster section for one program.
 *
 * @param props.programId - The program whose roster is shown.
 * @param props.programName - Its name, for the captions and headings.
 * @returns The section.
 */
async function RosterSection({
  programId,
  programName,
}: {
  programId: string
  programName: string
}) {
  const result = await getProgramRoster(programId)

  const heading = (
    <h2 id="roster-heading" className="hsh-h4 text-[var(--hsh-text-primary)]">
      Roster
    </h2>
  )

  if (result.status !== "ready") {
    return (
      <section
        aria-labelledby="roster-heading"
        className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        {heading}
        <SectionError>
          {result.status === "unavailable"
            ? "The roster is not available in this environment because no Supabase project is configured. This is a setup state, not an empty roster."
            : "The roster could not be loaded. Nothing has changed — reload the page to try again."}
        </SectionError>
      </section>
    )
  }

  const { confirmed, notConfirmed, partial } = result.data

  return (
    <section
      aria-labelledby="roster-heading"
      className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      {heading}

      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        The roster is every confirmed enrollment for {programName}, and only
        those. Records below the second heading are not roster members.
      </p>

      {partial > 0 ? (
        <Alert tone="warning" title="Some records are incomplete">
          A student or family could not be read for{" "}
          {partial === 1 ? "one record" : `${partial} records`}. The{" "}
          {partial === 1 ? "record is" : "records are"} still listed — nothing
          is hidden because part of it could not be loaded.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
          Confirmed ({confirmed.length})
        </h3>

        {confirmed.length === 0 ? (
          <EmptyState title="No confirmed enrollments yet">
            <p>
              No student has a confirmed place in this program.
              {notConfirmed.length > 0
                ? " The records below are not confirmed and are not roster members."
                : ""}{" "}
              An enrollment is confirmed by an administrator on{" "}
              <TextLink href="/admin/enrollments">Enrollments</TextLink>.
            </p>
          </EmptyState>
        ) : (
          <RosterTable
            entries={confirmed}
            caption={`Confirmed roster for ${programName}, with each student's family and when the enrollment was confirmed.`}
            showState={false}
          />
        )}
      </div>

      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <h3 className="hsh-heading-sm m-0 text-[var(--hsh-text-primary)]">
          Not on the roster ({notConfirmed.length})
        </h3>

        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          These students are not enrolled in {programName}. A waitlist place, a
          pending review, and payment activity awaiting verification are each a
          different unsettled state, and none of them is a place in the program.
        </p>

        {notConfirmed.length === 0 ? (
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            There are no unconfirmed records for this program.
          </p>
        ) : (
          <RosterTable
            entries={notConfirmed}
            caption={`Records for ${programName} that are not confirmed enrollments, with each student's family, current state, and when that state last changed.`}
            showState
          />
        )}
      </div>

      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        Students are not added to or removed from a roster here. A place comes
        from a parent enrolling their child and an administrator confirming it
        on <TextLink href="/admin/enrollments">Enrollments</TextLink>, where the
        decision is recorded with a reason. Transfers between programs, roster
        exports, and attendance are not part of this release.
      </p>
    </section>
  )
}

export { RosterSection }
