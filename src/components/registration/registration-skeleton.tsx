/**
 * Registration loading skeleton (MDS `components.skeleton`; DESIGN-SYSTEM §9.1
 * "Loading").
 *
 * Reserves the 8 + 4 column layout while programs, attendance rules, and
 * document versions load. It shows no program, name, or document: a skeleton
 * that guesses at content can be read as content. There is no submit control
 * at all until the authoritative data has arrived. The pulse flattens under
 * reduced motion through the global rule in `globals.css`.
 */
function Bar({ width }: { width: string }) {
  return (
    <div
      className="h-[16px] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-elevated)]"
      style={{ width }}
    />
  )
}

export function RegistrationSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-12 lg:gap-[var(--hsh-grid-gap-desktop)]">
      <p role="status" className="sr-only">
        Loading registration…
      </p>
      <div
        aria-hidden="true"
        className="flex animate-pulse flex-col gap-[var(--hsh-space-5)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-6)] lg:col-span-8"
      >
        <div className="h-[28px] w-[50%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)]" />
        <Bar width="90%" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-[var(--hsh-space-2)]">
            <Bar width="30%" />
            <div className="h-[var(--hsh-control-height-standard)] rounded-[var(--hsh-radius-control)] bg-[var(--hsh-surface-quiet)]" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="flex animate-pulse flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)] lg:col-span-4"
      >
        <div className="h-[20px] w-[60%] rounded-[var(--hsh-radius-small)] bg-[var(--hsh-surface-quiet)]" />
        {Array.from({ length: 8 }, (_, i) => (
          <Bar key={i} width="70%" />
        ))}
      </div>
    </div>
  )
}
