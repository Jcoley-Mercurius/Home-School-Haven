import Link from "next/link"
import { ChevronRight } from "lucide-react"

/**
 * Breadcrumb trail (MDS-REF-005 §2 program detail: Home / Programs / Art Lab).
 * The current page is marked with `aria-current` and is not a link.
 */
function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-[var(--hsh-space-2)]">
        {trail.map((crumb, index) => (
          <li
            key={crumb.label}
            className="hsh-body-sm flex items-center gap-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]"
          >
            {index > 0 ? (
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0"
                strokeWidth={1.75}
              />
            ) : null}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="inline-flex min-h-[var(--hsh-touch-target)] min-w-[var(--hsh-touch-target)] items-center justify-center rounded-[var(--hsh-radius-small)] hover:text-[var(--hsh-forest-700)]"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="inline-flex min-h-[var(--hsh-touch-target)] items-center text-[var(--hsh-text-secondary)]"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export { Breadcrumbs }
