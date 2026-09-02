import type { Metadata } from "next"

import { ReviewSignalCard } from "@/components/admin/review-signal-card"
import { ReviewDataBanner, SectionError } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Alert } from "@/components/ui/alert"
import { requireAdmin } from "@/lib/auth/guards"
import { listReviewSignals } from "@/lib/admin/review"
import { demonstratedCount } from "@/lib/admin/review-transitions"

/**
 * Foundation beta review (ACT-006, ACT-004; MPS-REQ-022/024; MPS-WFL-008;
 * MPS-ACC-032; SIG-BETA-001 through 008; MDS
 * `navigation.specification.admin` "Reports", `page_shells.admin_operations`).
 *
 * THIS FILLS AN APPROVED DESTINATION
 *
 * MDS `navigation.specification.admin` names nine administrator destinations
 * and **Reports** is one of them, with nothing behind it until now. So unlike
 * the inquiry queue — which had to live inside Communications because
 * Inquiries is not an approved destination (MDS-GAP-P2) — this introduces no
 * navigation gap. It closes the Reports half of the D-AO3 note in
 * `src/components/layout/admin-portal-shell.tsx`.
 *
 * AUTHORIZATION, TWICE, INDEPENDENTLY
 *
 * `requireAdmin()` decides whether this page renders. RLS then decides
 * independently what `listReviewSignals()` returns, and both review tables
 * have no educator policy and no family policy at all. That matters more here
 * than on most surfaces: Samantha's candid assessment of the educator
 * workspace is not something an educator reads.
 *
 * THE SUMMARY IS THE MOST DANGEROUS THING ON THIS PAGE
 *
 * A review surface that overstates readiness is worse than no review surface,
 * because it is the artifact someone will point at when deciding whether the
 * beta can be shown or a launch approved. So `demonstratedCount()` counts
 * `pass` and nothing else — not `blocked`, not `not_tested` — and lives in one
 * tested function rather than being recomputed in the markup. The page says
 * how many signals are demonstrated out of eight, and never rounds a silence
 * up into evidence.
 *
 * WHAT THIS PAGE WILL NOT DO
 *
 * It does not update the MPS. MPS-WFL-008's last step, "Update affected MPS
 * state", is a governance act performed in ChatGPT Work by the system that
 * owns the decision (AGENTS.md §3). Approving a disposition here records the
 * owner's judgment and attributes it; carrying that into approved product
 * state remains a person's job (GAP-EVIDENCE-002), and the page says so rather
 * than leaving it to be assumed.
 *
 * It changes no scope, priority, requirement, or acceptance criterion, and
 * there is no control that could. It also does not itself close MPS-ACC-032 —
 * that needs the Phase 5 sweep and Samantha's actual session. This is where
 * that session gets written down.
 */
export const metadata: Metadata = {
  title: "Beta review — Reports — Operations — Home School Haven of SWFL",
}

export default async function AdminReportsPage() {
  const viewer = await requireAdmin("/admin/reports")
  const result = await listReviewSignals()

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[{ label: "Operations", href: "/admin" }, { label: "Reports" }]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Foundation beta review
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            The eight approved beta success signals, the evidence recorded
            against each one, and what Samantha said about it.
          </p>
        </header>

        <Alert
          tone="info"
          title="Recording a decision here does not change what has been approved"
        >
          Classifying feedback and approving its disposition record Samantha&rsquo;s
          judgment, attributed and timestamped. They add nothing to any release
          and change no requirement. Carrying an approved decision into the
          product system is a separate step that a person does deliberately, so
          nothing enters launch scope without someone putting it there.
        </Alert>

        {result.status === "unavailable" ? (
          <SectionError>
            The beta review is not available in this environment because no
            Supabase project is configured. This is a setup state, not an empty
            review.
          </SectionError>
        ) : result.status === "failed" ? (
          <SectionError>
            The beta review could not be loaded. This is not the same as nothing
            having been reviewed — reload the page to try again.
          </SectionError>
        ) : (
          <>
            {/* One tested function decides what "demonstrated" means. */}
            <section
              aria-labelledby="review-progress"
              className="flex flex-col gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-5)]"
            >
              <h2
                id="review-progress"
                className="hsh-label m-0 text-[var(--hsh-text-secondary)]"
              >
                Where the review stands
              </h2>
              <p
                role="status"
                className="hsh-body m-0 text-[var(--hsh-text-primary)]"
              >
                {demonstratedCount(result.data.map((signal) => signal.result))}{" "}
                of {result.data.length} signals demonstrated.
              </p>
              <p className="hsh-caption m-0 text-[var(--hsh-text-muted)]">
                Only a recorded <strong>pass</strong> counts. A signal that is
                blocked or not yet walked is not evidence of anything, and is
                never counted here as though it were.
              </p>
            </section>

            <ul className="flex list-none flex-col gap-[var(--hsh-space-4)] p-0">
              {result.data.map((signal) => (
                <ReviewSignalCard key={signal.id} signal={signal} />
              ))}
            </ul>
          </>
        )}
      </main>
    </AdminPortalShell>
  )
}
