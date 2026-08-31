/**
 * Loading placeholder for the program and enrollment lists (MDS
 * `components.skeleton` variant `dashboard`; MPS-REQ-021 observable state).
 *
 * Same rule as `overview-skeleton.tsx`: reserve the shape, simulate no record.
 * No name, no state badge, no count — a skeleton that guesses at content is a
 * skeleton that can be read as content, and a fabricated enrollment state
 * flashing before the real one is exactly what DO-DONT "Trust states" forbids.
 *
 * It is a `<Suspense>` fallback inside the page, never a route-level
 * `loading.tsx`. A `loading.tsx` makes Next stream the response, which sends
 * the 200 before the guard runs and would let `notFound()` lose its status —
 * the defect that once had `/family` answering 200 to an educator.
 */

/**
 * A list skeleton with an announced loading status.
 * @param label - What is loading, announced to assistive technology.
 * @param rows - How many placeholder rows to reserve.
 * @returns The skeleton.
 */
function ListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}.
      </p>
      <div
        aria-hidden="true"
        className="flex animate-pulse flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-[var(--hsh-space-4)]"
          >
            <div className="size-10 shrink-0 rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)]" />
            <div className="h-[16px] flex-1 rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)]" />
            <div className="hidden h-[16px] w-[15%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)] sm:block" />
            <div className="hidden h-[16px] w-[15%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)] sm:block" />
          </div>
        ))}
      </div>
    </>
  )
}

export { ListSkeleton }
