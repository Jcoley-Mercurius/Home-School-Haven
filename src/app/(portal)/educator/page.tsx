import type { Metadata } from "next"

import { PortalNav } from "@/components/layout/portal-nav"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/guards"

/**
 * Educator area (ACT-003, MPS-REQ-018).
 *
 * "An educator's program access does not imply access to every family, student,
 * or administrator record" (AGENTS.md §12). This page reads assignments and the
 * programs they point at — nothing else. There is no family or roster query
 * here, and RLS would refuse one anyway.
 *
 * Rosters, schedules, announcements, and resources are MTS IMPLEMENTATION-PLAN
 * Phase 4. The roster in particular needs the approved minimum student fields
 * that MPS GAP-005 leaves unconfirmed.
 */
export const metadata: Metadata = {
  title: "Educator — Home School Haven of SWFL",
}

export default async function EducatorPage() {
  const viewer = await requireRole("educator", "/educator")
  const supabase = await createClient()

  const { data: assignments, error } = await supabase
    .from("educator_assignments")
    .select("program_id, programs(name, slug, publication_state)")

  return (
    <>
      <SiteHeader />
      <PortalNav viewer={viewer} area="educator" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-12)]"
      >
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Your assigned programs
        </h1>

        {error ? (
          <p role="alert" className="hsh-body text-[var(--hsh-text-secondary)]">
            We could not load your assignments just now. Nothing was lost —
            please refresh in a moment.
          </p>
        ) : assignments && assignments.length > 0 ? (
          <ul className="flex flex-col gap-[var(--hsh-space-3)]">
            {assignments.map((assignment) => (
              <li
                key={assignment.program_id}
                className="flex flex-wrap items-baseline justify-between gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
              >
                <span className="hsh-body text-[var(--hsh-text-primary)]">
                  {assignment.programs?.name ?? "Program"}
                </span>
                <span className="hsh-body-sm text-[var(--hsh-text-secondary)]">
                  {assignment.programs?.publication_state === "published"
                    ? "Published"
                    : "Not published"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            You are not assigned to any programs yet. An administrator makes
            assignments.
          </p>
        )}

        <p className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Rosters, schedules, announcements, and learning resources are not part
          of this review yet.
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
