import type { Metadata } from "next"

import { ResourceList } from "@/components/educator/content-lists"
import { NoAssignments, ReadFailure } from "@/components/educator/states"
import { ReviewDataBanner } from "@/components/family/section-states"
import { EducatorPortalShell } from "@/components/layout/educator-portal-shell"
import { requireRole } from "@/lib/auth/guards"
import { listAssignedPrograms } from "@/lib/educator/assignments"
import { listEducatorResources } from "@/lib/educator/content"

/**
 * Learning resources on assigned programs, read-only (MPS-REQ-018,
 * MPS-REQ-019).
 *
 * NO UPLOAD, AND NOT BECAUSE IT WAS DEFERRED FROM THIS PAGE
 *
 * `learning_resources` stores a published link, never a file: private Supabase
 * Storage with scoped signed access is approved but is a slice of its own
 * (upload authorization, type and size validation, signed URLs). No file leaves
 * Storage here because none enters it, and no client role holds a write on the
 * table either. So there is no upload control to show, disabled or otherwise.
 *
 * The educator Course Builder — lesson authoring, material editing, resource
 * upload — is future-platform scope (MDS-DEC-020). MDS-REF-008 informs how the
 * educator shell relates to its content, and authorizes none of its behavior.
 */
export const metadata: Metadata = {
  title: "Resources — Educator — Home School Haven of SWFL",
}

export default async function EducatorResourcesPage() {
  const viewer = await requireRole("educator", "/educator/resources")
  const assigned = await listAssignedPrograms(viewer.userId)

  const resources =
    assigned.status === "ready"
      ? await listEducatorResources(assigned.items.map((program) => program.id))
      : null

  return (
    <EducatorPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-portal flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            Resources
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Learning resources published for the programs you are assigned to.
            Resources are added by an administrator in this release.
          </p>
        </header>

        {assigned.status !== "ready" ? (
          <ReadFailure
            status={assigned.status}
            subject="Your assigned programs"
          />
        ) : assigned.items.length === 0 ? (
          <NoAssignments surface="resources" />
        ) : resources === null || resources.status !== "ready" ? (
          <ReadFailure
            status={resources?.status ?? "failed"}
            subject="Your programs' resources"
          />
        ) : (
          <ResourceList
            items={resources.items}
            emptyTitle="No resources yet"
            emptyBody="There are no learning resources on the programs you are assigned to. When an administrator adds one, it appears here."
          />
        )}
      </main>
    </EducatorPortalShell>
  )
}
