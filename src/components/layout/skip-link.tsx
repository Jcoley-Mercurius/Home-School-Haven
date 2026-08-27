/** Shared skip link so every public route opens with the same first tab stop. */
function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-[var(--hsh-space-4)] focus:left-[var(--hsh-space-4)] focus:z-100 focus:rounded-[var(--hsh-radius-control)] focus:bg-[var(--hsh-surface-card)] focus:px-[var(--hsh-space-4)] focus:py-[var(--hsh-space-3)] focus:shadow-[var(--hsh-shadow-card)]"
    >
      Skip to main content
    </a>
  )
}

export { SkipLink }
