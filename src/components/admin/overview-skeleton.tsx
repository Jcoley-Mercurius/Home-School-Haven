/**
 * Operations overview loading skeleton (MDS `components.skeleton`, variant
 * `dashboard`; MPS-REQ-021 observable state).
 *
 * MDS's rule for this variant is "Reserve layout without simulating real
 * student or payment data", so this reserves the shape of the overview and
 * shows nothing that could be mistaken for a record — no counts, no program
 * names, and above all no enrollment or payment state. A skeleton that guesses
 * at content is a skeleton that can be read as content, and a fabricated
 * "3 payments pending" flashing before the real number is exactly the
 * fabricated statistic this release forbids.
 *
 * WHY THIS IS A SUSPENSE FALLBACK AND NOT `loading.tsx`
 *
 * A route-level `loading.tsx` makes Next stream the response: the 200 and the
 * loading shell go out before the page body runs, so `notFound()` in the guard
 * can no longer set the status. The family dashboard learned this the
 * expensive way — `/family` began answering 200 to an educator instead of 404.
 * As a `<Suspense>` fallback inside the page, the guard resolves before
 * anything streams, so denial still sets the status.
 *
 * Reduced motion is honoured by the global rule in `globals.css`, which
 * flattens the pulse to a still surface.
 */

function Block({ className }: { className: string }) {
  return (
    <div
      className={`rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)] ${className}`}
    />
  )
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)] shadow-[var(--hsh-shadow-card)]"
    >
      <div className="flex items-center gap-[var(--hsh-space-3)]">
        <div className="size-10 shrink-0 rounded-full bg-[var(--hsh-surface-quiet)]" />
        <Block className="h-[20px] w-[45%]" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <Block key={index} className="h-[16px] w-full" />
      ))}
    </div>
  )
}

/**
 * Placeholder for the overview while its authorized reads are in flight.
 *
 * The status is announced, because a screen-reader user gets no visual cue that
 * anything is happening.
 *
 * @returns Overview skeleton.
 */
function OverviewSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading the operations overview.
      </p>

      <div className="flex flex-col gap-[var(--hsh-space-6)]">
        <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:grid-cols-2 sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-4 lg:gap-[var(--hsh-grid-gap-desktop)]">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} rows={3} />
          ))}
        </div>

        <SkeletonCard rows={5} />

        <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-2 lg:gap-[var(--hsh-grid-gap-desktop)]">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      </div>
    </>
  )
}

export { OverviewSkeleton }
