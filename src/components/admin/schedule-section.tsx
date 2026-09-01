import { SessionActions } from "@/components/admin/session-actions"
import { SessionForm } from "@/components/admin/session-form"
import {
  presentationStateOf,
  SessionStateBadge,
} from "@/components/schedule/session-state"
import { formatSessionTime } from "@/components/schedule/session-list"
import { SectionError } from "@/components/family/section-states"
import { byStartTime } from "@/lib/schedule/sessions"
import { listProgramSessions } from "@/lib/schedule/repository"

/**
 * One program's schedule, with the approved editing actions (MPS-REQ-016,
 * MPS-REQ-020, MPS-REQ-024, MPS-WFL-005; MDS `components.schedule_item`).
 *
 * WHAT A SESSION IS, AND WHAT IT IS NOT
 *
 * A session is verified detail an administrator authored — MPS-WFL-005 step 2,
 * "add verified details, schedule, capacity". It is NOT derived from the
 * program's published schedule text, and this surface offers no way to derive
 * one: most published ranges carry no year, and choosing one would invent the
 * fact the beta content import rules forbid outright (rule 3).
 *
 * The published text stays exactly where it is, on the Program details form
 * above. The two coexist because they say different things: the text is what
 * Home School Haven publishes about a program, and a session is a meeting with
 * a date. Where a program has no sessions, this section says so and the
 * published text remains the only schedule anyone sees — which is the state
 * every program starts in.
 *
 * WHY THE LIST IS RENDERED SERVER-SIDE AND THE ACTIONS ARE NOT
 *
 * A schedule is a list to read; only its actions are interactive. Keeping the
 * list on the server means the session data does not enter a client bundle for
 * the reading path, and the client component carries only the one session each
 * action needs.
 */
async function ScheduleSection({
  programId,
  programName,
}: {
  programId: string
  programName: string
}) {
  const result = await listProgramSessions(programId)

  return (
    <section
      aria-labelledby="schedule-heading"
      className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <div className="flex flex-col gap-[var(--hsh-space-2)]">
        <h2
          id="schedule-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Schedule
        </h2>
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Dated sessions for {programName}. These appear on the family and
          educator schedules, and on the public calendar once this program is
          published. They do not replace the published schedule text above —
          both are shown, because they say different things.
        </p>
      </div>

      {result.status !== "ready" ? (
        <SectionError>
          {result.status === "unavailable"
            ? "Schedules are not available in this environment because no Supabase project is configured."
            : "This schedule could not be loaded. Nothing has changed — reload the page to try again."}
        </SectionError>
      ) : result.items.length === 0 ? (
        <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          No sessions have been added for this program. Families see the
          published schedule text above and nothing else, which is accurate
          until a session is authored here.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[var(--hsh-space-4)] p-0">
          {byStartTime(result.items).map((session) => (
            <li
              key={session.id}
              className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-4)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
                <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
                  <h3 className="hsh-h5 m-0 text-[var(--hsh-text-primary)]">
                    {session.title}
                  </h3>
                  <p className="hsh-body-sm m-0 text-[var(--hsh-text-primary)]">
                    <time dateTime={session.startsAt}>
                      {formatSessionTime(session)}
                    </time>
                  </p>
                  {session.location ? (
                    <p className="hsh-body-sm m-0 text-[var(--hsh-text-secondary)]">
                      {session.location}
                    </p>
                  ) : null}
                  {session.changeNote ? (
                    <p className="hsh-body-sm m-0 max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
                      {session.changeNote}
                    </p>
                  ) : null}
                </div>
                <SessionStateBadge state={presentationStateOf(session)} />
              </div>

              <SessionActions session={session} programId={programId} />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-5)]">
        <h3 className="hsh-h5 mb-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]">
          Add a session
        </h3>
        <SessionForm programId={programId} />
      </div>
    </section>
  )
}

export { ScheduleSection }
