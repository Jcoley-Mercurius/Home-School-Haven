import type { Metadata } from "next"

import { PortalNav } from "@/components/layout/portal-nav"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth/guards"

/**
 * Family area (ACT-001, MPS-REQ-004).
 *
 * Foundation scope: this proves the ownership boundary end to end — a signed-in
 * parent reaches their own family and nothing else — and is not yet the family
 * dashboard. The dashboard of MPS-REQ-015 and MDS-REF-002 (enrollments,
 * schedule, announcements, resources) is MTS IMPLEMENTATION-PLAN Phase 3, and it
 * needs the student and enrollment records that MPS GAP-005 and GAP-010 still
 * block. Rendering a dashboard shell with invented student rows would be the
 * simulated data DO-DONT forbids.
 *
 * The query below asks for every family. RLS returns only the viewer's own —
 * which is the point: the boundary holds in the database, not in this file.
 */
export const metadata: Metadata = {
  title: "Family — Home School Haven of SWFL",
}

export default async function FamilyPage() {
  const viewer = await requireRole("parent", "/family")
  const supabase = await createClient()

  const { data: families, error } = await supabase
    .from("families")
    .select("id,name")
    .order("name")

  return (
    <>
      <PortalNav viewer={viewer} area="family" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-12)]"
      >
        <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
          Your family
        </h1>

        {error ? (
          <p role="alert" className="hsh-body text-[var(--hsh-text-secondary)]">
            We could not load your family details just now. Nothing was lost —
            please refresh in a moment.
          </p>
        ) : families && families.length > 0 ? (
          <ul className="flex flex-col gap-[var(--hsh-space-3)]">
            {families.map((family) => (
              <li
                key={family.id}
                className="hsh-body rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] text-[var(--hsh-text-primary)]"
              >
                {family.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            No family record is linked to your account yet.
          </p>
        )}

        <p className="hsh-body-sm max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
          Student profiles, enrollments, schedules, announcements, and learning
          resources are not part of this review yet. They depend on the parental
          consent and student-data decisions Home School Haven has still to
          confirm.
        </p>
      </main>
    </>
  )
}
