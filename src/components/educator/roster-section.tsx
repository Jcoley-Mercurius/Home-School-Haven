import { EnrollmentStateBadge } from "@/components/enrollment/enrollment-state"
import { EmptyState } from "@/components/family/section-states"
import { ReadFailure } from "@/components/educator/states"
import { getEducatorProgramRoster } from "@/lib/educator/roster"

import type { EducatorRosterEntry } from "@/lib/educator/workspace-state"

/**
 * One assigned program's roster, as an educator is permitted to see it
 * (MPS-REQ-018, MPS-ACC-028; MDS `components.table` variant `roster`).
 *
 * ONE COLUMN OF CHILD DATA, AND THAT IS THE POINT
 *
 * The confirmed table has a single column: a preferred name. No family name, no
 * grade level, no guardian relationship, no contact detail, no state note, no
 * date. That is not a layout decision — `public.educator_roster_students` is a
 * security-barrier view exposing `program_id` and `preferred_name`, and it is
 * the only route an educator has to a child's name at all. There is nothing
 * further to hide because there is nothing further to read.
 *
 * THE SECOND LIST HAS NO NAMES, DELIBERATELY
 *
 * Records that are not confirmed appear as counts by state. An educator
 * planning a session needs to know that two more children may or may not join
 * it; they do not need to know which children, and MPS-RUL-003 says a family
 * whose place is unsettled is not an educator's business. The view enforces
 * that — an unconfirmed child's name is unreadable to an educator — so this
 * component could not name them even if it tried to.
 *
 * That is the one place this surface reads differently from the administrator
 * roster, which names both groups. An administrator is accountable for the
 * unsettled record; an educator is not.
 *
 * A SERVER COMPONENT, DELIBERATELY
 *
 * There is nothing to filter and nothing modal here; a roster is a list to
 * read. Keeping it on the server means no child's name enters a client bundle.
 *
 * WHAT THIS OFFERS: NOTHING
 *
 * No add, no remove, no move, no export, no attendance, no message. A place on
 * a roster comes from a parent enrolling their child and an administrator
 * confirming it; MPS-RUL-008 requires a parent's authority affirmation that
 * nobody else can give. There is no educator write path to any of these tables.
 */

/**
 * The confirmed roster, in its desktop and its narrow rendering.
 *
 * A single-column table is still a table: it has a caption and a column header,
 * so a screen-reader user is told what the column is before the first name.
 *
 * @param props.entries - The confirmed children.
 * @param props.caption - The table's accessible caption.
 * @returns The table.
 */
function ConfirmedTable({
  entries,
  caption,
}: {
  entries: EducatorRosterEntry[]
  caption: string
}) {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--hsh-border-default)]">
              <th
                scope="col"
                className="hsh-label px-[var(--hsh-space-3)] py-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]"
              >
                Student
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                /* There is no enrollment id on this side — the view exposes a
                   name and a program, and asking for an identifier for a child
                   would be asking for more than the allowlist permits. The list
                   is server-rendered and static, so its position is a stable
                   key. */
                key={`${entry.studentName}-${index}`}
                className="border-b border-[var(--hsh-border-default)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="hsh-body px-[var(--hsh-space-3)] py-[var(--hsh-space-4)] font-semibold text-[var(--hsh-text-primary)]"
                >
                  {entry.studentName || "Student not available"}
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MDS `components.table`: transform to labeled rows on narrow screens,
          never compress a table until it is unreadable. */}
      <ul className="flex list-none flex-col gap-[var(--hsh-space-2)] p-0 sm:hidden">
        {entries.map((entry, index) => (
          <li
            key={`${entry.studentName}-${index}`}
            className="flex flex-col gap-[var(--hsh-space-1)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] p-[var(--hsh-space-4)]"
          >
            <span className="hsh-label text-[var(--hsh-text-secondary)]">
              Student
            </span>
            <span className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
              {entry.studentName || "Student not available"}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The roster section for one assigned program.
 *
 * @param props.programId - The program whose roster is shown. The caller has
 *   already proven the viewer's assignment to it.
 * @param props.programName - Its name, for the headings and captions.
 * @param props.headingId - Unique id, so several sections can sit on one page.
 * @param props.headingLevel - `h2` on the Rosters page, `h3` inside detail.
 * @returns The section.
 */
async function EducatorRosterSection({
  programId,
  programName,
  headingId,
  headingLevel = "h3",
}: {
  programId: string
  programName: string
  headingId: string
  headingLevel?: "h2" | "h3"
}) {
  const result = await getEducatorProgramRoster(programId)
  const Heading = headingLevel
  /* One level below the section heading, always. The approved MDS type scale
     stops at Heading 4 (20px Manrope 700), so a heading nested below an
     `hsh-h4` section takes the Label role rather than an invented fifth size —
     a sub-heading that renders LARGER than its parent inverts the hierarchy
     the MDS requires be preserved.

     `hsh-label` rather than the `hsh-heading-sm` alias, deliberately: the two
     are the same declarations, and naming the role directly leaves this slice
     with no dependency on the separate change that defines the alias. */
  const SubHeading = headingLevel === "h2" ? "h3" : "h4"

  const frame = (children: React.ReactNode) => (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <Heading
        id={headingId}
        className="hsh-h4 m-0 text-[var(--hsh-text-primary)]"
      >
        {programName}
      </Heading>
      {children}
    </section>
  )

  if (result.status !== "ready") {
    return frame(
      <ReadFailure
        status={result.status}
        subject={`The roster for ${programName}`}
      />,
    )
  }

  const { confirmed, unconfirmed } = result.data

  return frame(
    <>
      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
        Your roster is every confirmed enrollment for {programName}, and only
        those.
      </p>

      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <SubHeading className="hsh-label m-0 text-[var(--hsh-text-primary)]">
          Confirmed ({confirmed.length})
        </SubHeading>

        {confirmed.length === 0 ? (
          <EmptyState title="No confirmed enrollments yet">
            <p>
              No student has a confirmed place in this program.
              {unconfirmed.total > 0
                ? " There are records on this program that are not confirmed, and they are not roster members."
                : ""}{" "}
              An administrator confirms an enrollment; the student appears here
              once they do.
            </p>
          </EmptyState>
        ) : (
          <ConfirmedTable
            entries={confirmed}
            caption={`Confirmed roster for ${programName}, listing each student's preferred name.`}
          />
        )}
      </div>

      <div className="flex flex-col gap-[var(--hsh-space-3)]">
        <SubHeading className="hsh-label m-0 text-[var(--hsh-text-primary)]">
          Not on the roster ({unconfirmed.total})
        </SubHeading>

        {unconfirmed.total === 0 ? (
          <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
            There are no unconfirmed records for this program.
          </p>
        ) : (
          <>
            <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
              These records are not enrolled in {programName}. A waitlist place,
              a pending review, and payment activity awaiting verification are
              each a different unsettled state, and none of them is a place in
              the program.
            </p>
            {/* Counts, not names. A family whose place is unsettled has an
                arrangement with Home School Haven that is not an educator's
                business (MPS-RUL-003), and the roster view does not expose
                those children at all — so this could not name them. */}
            <ul className="flex list-none flex-wrap gap-[var(--hsh-space-3)] p-0">
              {unconfirmed.byState.map((entry) => (
                <li
                  key={entry.state}
                  className="flex items-center gap-[var(--hsh-space-2)]"
                >
                  <EnrollmentStateBadge state={entry.state} />
                  <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                    {entry.count}
                  </span>
                </li>
              ))}
            </ul>
            <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-muted)]">
              Students are not named until their place is confirmed.
            </p>
          </>
        )}
      </div>

      <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-muted)]">
        Students are not added to or removed from a roster here, and this view
        shows a preferred name only. Enrollment decisions are made by an
        authorized administrator and recorded with a reason.
      </p>
    </>,
  )
}

export { EducatorRosterSection }
