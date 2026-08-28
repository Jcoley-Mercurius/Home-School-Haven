import type { Metadata } from "next"
import Link from "next/link"
import { Lock } from "lucide-react"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ResourceLibrary } from "@/components/public/resource-library"
import { Button } from "@/components/ui/button"
import { accountNav, guidanceHref } from "@/content/foundation-content"
import {
  enrolledFamiliesBand,
  resourcesGuidanceBand,
  resourcesHero,
} from "@/content/resources"

/**
 * Public Resources page (MPS-REQ-007, MPS-REQ-009, MPS-ACC-009, MPS-ACC-010;
 * DESIGN-SYSTEM.md §7 public shell, §8 responsive behavior).
 *
 * Composition follows `mds/references/proposed/public-resources-proposed.png`.
 * That image is *proposed*, not canonical MDS: it carries no MDS-REF ID, so the
 * authority for every visual decision here remains the design specification, the
 * `--hsh-*` tokens, and the approved references. Promoting the image is an owner
 * governance action that has not happened.
 *
 * **The thing to understand before changing this page.** MPS scopes learning
 * resources as private and program-scoped (MPS-REQ-015, MPS-REQ-018,
 * MPS-REQ-019; private Supabase Storage under signed access). There is no
 * approved *public* resource library and no public resource content in the
 * import inventory. The entries this page shows are therefore marked samples,
 * approved as such by the owner on 2026-08-28, and the notice beside them says
 * so. See `src/content/resources.ts` and `prompts/public-resources-page.md` §1.
 *
 * The band that *is* in approved scope is "Resources for enrolled families": it
 * points at the family account, which is where real program materials live. It
 * implements nothing itself and claims nothing about any family's enrollment.
 *
 * Two parts of the reference are deliberately not built, as recorded in the
 * prompt §4: the decorative botanical illustrations (no such asset exists and
 * §5 forbids generating one, D-R1) and the reference's own footer composition
 * (the implemented `SiteFooter` is already approved, D-R2).
 *
 * Statically rendered with no `revalidate` and no data read — every string is a
 * module constant, and the search runs entirely in the browser.
 */
export const metadata: Metadata = {
  title: "Resources — Home School Haven of SWFL",
  description:
    "Useful guidance for exploring programs, preparing for participation, and staying connected with Home School Haven of SWFL.",
}

export default function ResourcesPage() {
  return (
    <>
      <SkipLink />
      <SiteHeader />

      <main id="main" className="flex-1">
        {/* Hero copy is server-rendered and handed to the client region, so the
            h1 never depends on hydration. */}
        <ResourceLibrary>
          <div className="flex flex-col gap-[var(--hsh-space-5)] lg:pr-[var(--hsh-space-8)]">
            <Breadcrumbs
              trail={[{ label: "Home", href: "/" }, { label: "Resources" }]}
            />
            <p className="hsh-label tracking-wide text-[var(--hsh-text-muted)] uppercase">
              {resourcesHero.eyebrow}
            </p>
            <h1 className="hsh-display-lg text-[var(--hsh-text-primary)]">
              {resourcesHero.heading}
            </h1>
            <p className="hsh-body-lg max-w-[52ch] text-[var(--hsh-text-secondary)]">
              {resourcesHero.summary}
            </p>
          </div>
        </ResourceLibrary>

        {/* The two closing bands: the private-account pathway and the guidance
            pathway. Two columns from lg, stacked below. */}
        <div className="hsh-container hsh-container-public mt-[var(--hsh-space-16)] grid gap-[var(--hsh-space-6)] lg:grid-cols-2">
          <section
            aria-labelledby="enrolled-families-heading"
            className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-quiet)] p-[var(--hsh-space-8)] md:flex-row md:items-center"
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] text-[var(--hsh-forest-600)]"
            >
              <Lock className="size-5" strokeWidth={1.75} />
            </span>
            <div className="flex flex-col gap-[var(--hsh-space-2)] md:flex-1">
              <h2
                id="enrolled-families-heading"
                className="hsh-h4 text-[var(--hsh-text-primary)]"
              >
                {enrolledFamiliesBand.heading}
              </h2>
              <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {enrolledFamiliesBand.body}
              </p>
            </div>
            <div className="flex flex-col items-start gap-[var(--hsh-space-3)]">
              <Button
                variant="primary"
                size="md"
                render={<Link href={accountNav.href} />}
              >
                {enrolledFamiliesBand.primaryAction}
              </Button>
              {/* Sign In is the only approved page that explains Foundation
                  Release account provisioning, so "learn more" goes there too
                  rather than inventing an access-policy page (D-R7). */}
              <Button
                variant="text"
                size="md"
                render={<Link href={accountNav.href} />}
              >
                {enrolledFamiliesBand.secondaryAction}
              </Button>
            </div>
          </section>

          <section
            aria-labelledby="resources-guidance-heading"
            className="flex flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-8)] md:flex-row md:items-center"
          >
            <div className="flex flex-col gap-[var(--hsh-space-2)] md:flex-1">
              <h2
                id="resources-guidance-heading"
                className="hsh-h4 text-[var(--hsh-text-primary)]"
              >
                {resourcesGuidanceBand.heading}
              </h2>
              <p className="hsh-body max-w-[52ch] text-[var(--hsh-text-secondary)]">
                {resourcesGuidanceBand.body}
              </p>
            </div>
            <div className="flex flex-col items-start gap-[var(--hsh-space-3)]">
              <Button
                variant="primary"
                size="md"
                render={<Link href={guidanceHref} />}
              >
                {resourcesGuidanceBand.primaryAction}
              </Button>
              {/* The reference draws a second action to a Contact page. That
                  route does not exist yet, so it points at the same approved
                  guidance pathway rather than at a dead link (prompt A-3). */}
              <Button
                variant="secondary"
                size="md"
                render={<Link href={guidanceHref} />}
              >
                {resourcesGuidanceBand.secondaryAction}
              </Button>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
