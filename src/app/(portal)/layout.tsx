import { SkipLink } from "@/components/layout/skip-link"

/**
 * Portal shell for the authenticated family, educator, and administrator areas.
 *
 * It renders the skip link and nothing else. Chrome belongs to each area, not
 * to this layout: the family area has its own role sidebar, rail, and bottom
 * navigation (MDS-REF-007), while the educator and administrator areas still
 * use the public header until their own shells are built. A shared header here
 * would have to be one or the other, and would be wrong for whichever area it
 * was not built for.
 *
 * This layout intentionally performs NO authorization. Each page calls its own
 * guard, so authorization cannot be lost by a layout being skipped, by a route
 * moving out of this group, or by a middleware matcher edit. A layout is a
 * convenient place to check and a dangerous place to rely on.
 *
 * No analytics is mounted here. PostHog is approved for anonymous public routes
 * only and "must not leak into authenticated layouts through a shared root
 * provider" (AGENTS.md §12).
 */
/**
 * Never prerendered, never cached.
 *
 * Without this the build statically renders these routes. In an environment
 * with no Supabase project that even "succeeds" — `getViewer()` returns null
 * before it touches cookies, the guard redirects, and Next bakes that redirect
 * into a static page. The result would be a protected route whose answer was
 * decided at build time instead of per request. Authorization must be
 * evaluated on every request, for every viewer.
 */
export const dynamic = "force-dynamic"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SkipLink />
      {children}
    </>
  )
}
