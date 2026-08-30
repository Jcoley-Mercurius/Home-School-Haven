import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ResourcesCard } from "@/components/family/dashboard-cards"
import { ReviewDataBanner } from "@/components/family/section-states"
import { FamilyPortalShell } from "@/components/layout/family-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyResources } from "@/lib/family/content"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Learning resources for the programs this family is enrolled in
 * (MPS-REQ-019).
 *
 * Published links only. No educator authoring and no Course Builder — those are
 * a future release, and `learning_resources` has no client write path for
 * anyone to author through.
 */
export const metadata: Metadata = {
  title: "Learning Resources — Home School Haven of SWFL",
}

export default async function FamilyResourcesPage() {
  const viewer = await requireRole("parent", "/family/resources")
  const family = await getFamilyState()

  if (family.status === "incomplete") redirect("/family/setup")

  const resources = await getFamilyResources()

  return (
    <FamilyPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Learning Resources
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Material Home School Haven has published for the programs your
            family is registered for.
          </p>
        </header>

        <div className="max-w-[var(--hsh-content-reading)]">
          <ResourcesCard state={resources} heading="All Resources" />
        </div>
      </main>
    </FamilyPortalShell>
  )
}
