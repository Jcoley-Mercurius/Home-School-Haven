import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FamilySetupForm } from "@/components/family/family-setup-form"
import { PortalNav } from "@/components/layout/portal-nav"
import { requireRole } from "@/lib/auth/guards"
import { getFamilyState } from "@/lib/family/repository"

/**
 * Family setup (MPS-WFL-002 `family_incomplete` → `family_ready`;
 * MPS-REQ-011, MPS-ACC-015/016/017).
 *
 * A parent who already has a family is sent to `/family` rather than shown a
 * form that would do nothing — that is the "safely resume an incomplete family
 * profile" half of MPS-REQ-011, and it means a bookmarked or back-buttoned
 * setup URL cannot be a way to make a second family.
 *
 * The guard runs here and again inside the Server Action, because the action is
 * a public endpoint that this page does not protect.
 */
export const metadata: Metadata = {
  title: "Set up your family — Home School Haven of SWFL",
}

export default async function FamilySetupPage() {
  const viewer = await requireRole("parent", "/family/setup")
  const state = await getFamilyState()

  if (state.status === "ready") redirect("/family")

  return (
    <>
      <PortalNav viewer={viewer} area="family" />
      <main
        id="main"
        className="hsh-container hsh-container-public flex flex-1 flex-col gap-[var(--hsh-space-8)] py-[var(--hsh-space-12)]"
      >
        <header className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-3)]">
          <h1 className="hsh-display-sm text-[var(--hsh-text-primary)]">
            Set up your family
          </h1>
          <p className="hsh-body text-[var(--hsh-text-secondary)]">
            Welcome. One family account holds everything Home School Haven keeps
            for you, and you stay in control of it. This takes a moment.
          </p>
        </header>

        <div className="max-w-[var(--hsh-content-reading)]">
          <FamilySetupForm />
        </div>
      </main>
    </>
  )
}
