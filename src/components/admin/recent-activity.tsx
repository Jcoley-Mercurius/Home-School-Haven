import { FileClock } from "lucide-react"

import { SectionError } from "@/components/family/section-states"
import { Card, CardGlyph, CardTitle } from "@/components/ui/card"
import type { ActivityEntry, AdminRead } from "@/lib/admin/repository"

/**
 * Recent operational activity (MDS-REF-009 "Recent Activity"; MPS-REQ-024
 * attributable history).
 *
 * The source is `public.audit_events`, which is append-only at both the
 * privilege and the policy layer and is written only by SECURITY DEFINER
 * triggers. That is what makes this list evidence rather than a log: an
 * administrator cannot rewrite or delete a row here, and the pgTAP suite proves
 * it.
 *
 * WHAT EACH ENTRY DELIBERATELY DOES NOT SAY
 *
 * `audit_events` stores an entity type, an action, and enum labels — never a
 * family name, a student name, an email, or a price. Joining back to `programs`
 * to name the affected program is possible but deferred (deviation D-AO6),
 * because the program destination that would make the name a link does not
 * exist yet and a bare name adds nothing an operator can act on today.
 *
 * `actor_user_id` is NULL when a change came from a migration, seed, or CLI
 * operation rather than a signed-in person. That is recorded honestly here
 * rather than being attributed to nobody in particular, and it is stated as a
 * fact about the environment rather than as a name.
 */

/**
 * Recent activity list.
 * @param state - The authorized audit read.
 * @returns Recent activity card.
 */
function RecentActivity({ state }: { state: AdminRead<ActivityEntry[]> }) {
  return (
    <Card role="region" aria-labelledby="activity-heading">
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <CardGlyph>
          <FileClock aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </CardGlyph>
        <CardTitle id="activity-heading">Recent activity</CardTitle>
      </div>

      {state.status === "unavailable" ? (
        <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
          Change history is not connected in this review environment yet.
        </p>
      ) : state.status === "failed" ? (
        <SectionError>
          We could not load recent activity just now. Nothing was changed —
          please refresh in a moment.
        </SectionError>
      ) : state.data.length === 0 ? (
        <div className="rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]">
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            No material changes have been recorded yet.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[var(--hsh-space-2)]">
          {state.data.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-elevated)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)]"
            >
              <span className="hsh-body-sm text-[var(--hsh-text-primary)]">
                {entry.description}
                {entry.attributed ? null : (
                  <span className="text-[var(--hsh-text-muted)]">
                    {" "}
                    · set up by the review environment
                  </span>
                )}
              </span>
              {/* An ISO timestamp in `dateTime` and a fixed en-US rendering in
                  the text: `toLocaleString()` without an explicit locale reads
                  the server's locale on the server and the viewer's in the
                  browser, and the two disagreeing is a hydration mismatch. */}
              <time
                dateTime={entry.occurredAt}
                className="hsh-caption text-[var(--hsh-text-muted)]"
              >
                {new Date(entry.occurredAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export { RecentActivity }
