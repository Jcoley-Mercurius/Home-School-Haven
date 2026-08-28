import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"

/**
 * Authentication shell (MDS `page_shells.authentication`: "Centered 440px
 * account panel on warm brand surface with trust, help, and privacy context";
 * MDS `patterns.authentication`: brand context, account form, recovery/help,
 * privacy reassurance; responsive: "Full-width panel with 16px gutter").
 *
 * MDS gap recorded for review: the reference index carries canonical images for
 * the homepage, family dashboard, educator workspace, and administrator
 * operations, but none for the authentication screen. This shell is built from
 * the written MDS specification, which outranks visual inference (AGENTS.md
 * §7). Its screenshots are new baselines awaiting owner review, not a
 * comparison against an approved reference.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main
        id="main"
        className="flex flex-1 justify-center bg-[var(--hsh-surface-quiet)] px-[var(--hsh-space-4)] py-[var(--hsh-space-16)]"
      >
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
      <SiteFooter />
    </>
  )
}
