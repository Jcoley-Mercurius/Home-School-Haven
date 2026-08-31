import type { Metadata } from "next"

import { CreateProgramForm } from "@/components/admin/create-program-form"
import { ReviewDataBanner } from "@/components/family/section-states"
import { AdminPortalShell } from "@/components/layout/admin-portal-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { requireAdmin } from "@/lib/auth/guards"

/**
 * Create a program draft (ACT-004, ACT-006; MPS-REQ-016, MPS-RUL-005;
 * MDS `patterns.forms`, MDS-REF-009 "New Program Draft" quick action).
 *
 * This route restores the first of the four Quick Actions that deviation D-AO1
 * removed from the overview, now that its destination exists.
 *
 * No `searchParams` and no route parameter: there is nothing here for a request
 * to manipulate. The guard settles authorization before anything renders, and
 * `admin_create_program_draft` checks it again inside the write.
 */
export const metadata: Metadata = {
  title: "New program draft — Operations — Home School Haven of SWFL",
}

export default async function NewProgramPage() {
  const viewer = await requireAdmin("/admin/programs/new")

  return (
    <AdminPortalShell viewerLabel={viewer.displayName ?? viewer.email ?? ""}>
      <main
        id="main"
        className="hsh-container hsh-container-operations flex flex-1 flex-col gap-[var(--hsh-space-6)] py-[var(--hsh-space-8)]"
      >
        <ReviewDataBanner />

        <Breadcrumbs
          trail={[
            { label: "Operations", href: "/admin" },
            { label: "Programs", href: "/admin/programs" },
            { label: "New draft" },
          ]}
        />

        <header className="flex flex-col gap-[var(--hsh-space-2)]">
          <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
            New program draft
          </h1>
          <p className="hsh-body-lg max-w-[var(--hsh-content-reading)] text-[var(--hsh-text-secondary)]">
            Start with what Home School Haven already publishes. Anything the
            source does not publish stays unset and shows families
            &ldquo;Contact for details&rdquo; rather than a guess.
          </p>
        </header>

        <CreateProgramForm />
      </main>
    </AdminPortalShell>
  )
}
