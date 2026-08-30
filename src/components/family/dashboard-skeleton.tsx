/**
 * Dashboard loading skeleton (MDS `components.skeleton`, variant `dashboard`;
 * MPS-REQ-021 observable state).
 *
 * MDS's own rule for the skeleton variant is "Reserve layout without simulating
 * real student or payment data", so this reserves the shape of the section
 * grid and shows nothing that could be mistaken for a record — no names, no
 * program titles, and above all no enrollment state. A skeleton that guesses at
 * content is a skeleton that can be read as content.
 *
 * WHY THIS IS A SUSPENSE FALLBACK AND NOT `loading.tsx`
 *
 * It was a `loading.tsx` first, and that quietly broke denial. A route-level
 * `loading.tsx` makes Next stream the response: the 200 and the loading shell
 * go out before the page body runs, so `notFound()` in the guard could no
 * longer set the status. `/family` started answering **200** to an educator
 * instead of 404 — the body was still the not-found page and no family data
 * leaked, but "a wrong-role visitor is not told the route exists" stopped being
 * true, and `authorization.spec.ts` caught it.
 *
 * As a `<Suspense>` fallback inside the page it is strictly better: the guard
 * and the family read resolve first, so the status is decided before anything
 * streams, and only the four section reads suspend behind this.
 *
 * Reduced motion is honoured by the global rule in `globals.css`, which
 * flattens the pulse to a still surface.
 */
function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)] shadow-[var(--hsh-shadow-card)]"
    >
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <div className="size-10 shrink-0 rounded-full bg-[var(--hsh-surface-quiet)]" />
        <div className="h-[20px] w-[45%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)]" />
      </div>
      <div className="h-[16px] w-full rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)]" />
      <div className="h-[16px] w-[80%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)]" />
      <div className="h-[16px] w-[60%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)]" />
    </div>
  )
}

/**
 * Placeholder for the dashboard section grid while its reads are in flight.
 *
 * The status is announced, because a screen-reader user gets no visual cue
 * that anything is happening.
 *
 * @param cards - How many section placeholders to reserve.
 * @returns Dashboard skeleton.
 */
function DashboardSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <>
      <p role="status" className="sr-only">
        Loading your family overview.
      </p>
      <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-3 lg:gap-[var(--hsh-grid-gap-desktop)]">
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </>
  )
}

export { DashboardSkeleton }
