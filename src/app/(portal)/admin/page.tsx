import type { Metadata } from "next"

import { PortalNav } from "@/components/layout/portal-nav"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/guards"

/**
 * Administration area (ACT-004, MPS-REQ-016, MPS-REQ-017).
 *
 * Foundation scope: read-only. It shows every program at every publication
 * state — the reach an administrator has and a parent or educator does not —
 * plus the attributable history of material changes (MPS-REQ-024).
 *
 * Create, publish, reschedule, cancel, and archive actions are MTS
 * IMPLEMENTATION-PLAN Phase 4. The RLS write policies they will use already
 * exist and are already tested, so those actions add a UI, not a new trust
 * boundary.
 */
export const metadata: Metadata = {
  title: "Administration — Home School Haven of SWFL",
}

export default async function AdminPage() {
  const viewer = await requireAdmin("/admin")
  const supabase = await createClient()

  const [{ data: programs }, { data: events }] = await Promise.all([
    supabase
      .from("programs")
      .select("id,name,slug,publication_state")
      .order("sort_order"),
    supabase
      .from("audit_events")
      .select("id,occurred_at,entity_type,action")
      .order("occurred_at", { ascending: false })
      .limit(10),
  ])

  return (
    <>
      <SiteHeader />
      <PortalNav viewer={viewer} area="admin" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-10)] py-[var(--hsh-space-12)]"
      >
        <div className="flex flex-col gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
            Program operations
          </h1>
          {/* MDS admin_operations composition includes an owner-authority
              reminder. Samantha Dodson is the final decision owner. */}
          <p className="hsh-body max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Program, price, availability, and registration changes are published
            by an administrator or by Samantha Dodson, who holds final
            authority.
          </p>
        </div>

        <section
          aria-labelledby="programs-heading"
          className="flex flex-col gap-[var(--hsh-space-4)]"
        >
          <h2
            id="programs-heading"
            className="hsh-h3 text-[var(--hsh-text-primary)]"
          >
            All programs
          </h2>
          {/* MDS: operational tables become labeled record cards when column
              integrity cannot be preserved. Two fields fit at every breakpoint,
              so this stays a list. */}
          <ul className="flex flex-col gap-[var(--hsh-space-2)]">
            {(programs ?? []).map((program) => (
              <li
                key={program.id}
                className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
              >
                <span className="hsh-body text-[var(--hsh-text-primary)]">
                  {program.name}
                </span>
                <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  {program.publication_state === "published"
                    ? "Published"
                    : program.publication_state === "draft"
                      ? "Draft"
                      : "Archived"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="history-heading"
          className="flex flex-col gap-[var(--hsh-space-4)]"
        >
          <h2
            id="history-heading"
            className="hsh-h3 text-[var(--hsh-text-primary)]"
          >
            Recent activity
          </h2>
          {events && events.length > 0 ? (
            <ul className="flex flex-col gap-[var(--hsh-space-2)]">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="hsh-body-sm rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-4)] text-[var(--hsh-text-secondary)]"
                >
                  <time dateTime={event.occurred_at}>
                    {new Date(event.occurred_at).toLocaleString("en-US")}
                  </time>
                  {" — "}
                  {event.entity_type} {event.action}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hsh-body text-[var(--hsh-text-secondary)]">
              No recorded changes yet.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
