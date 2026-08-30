import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The three states every dashboard section needs, in one place so they read the
 * same everywhere (MPS-REQ-021, MDS `patterns.empty` / `patterns.error`).
 *
 * The distinction they exist to protect: an empty read and a failed read must
 * never look alike. One is a fact about the family; the other is a fact about
 * us, and only one of them is the family's to act on.
 */

/**
 * A recoverable failure inside one card, so the rest of the page still renders.
 *
 * `role="status"` rather than `role="alert"`: several of these can appear at
 * once on a partially-failed load, and a queue of interruptions would bury the
 * page content the family can still use.
 *
 * @param children - What failed, in the family's terms, plus what to do next.
 * @param className - Additional CSS classes.
 * @returns Section error component.
 */
function SectionError({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)]",
        "border border-[var(--hsh-border-strong)] bg-[var(--hsh-surface-elevated)]",
        "p-[var(--hsh-space-4)]",
        className,
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-[2px] size-5 shrink-0 text-[var(--hsh-warning)]"
        strokeWidth={1.75}
      />
      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">{children}</p>
    </div>
  )
}

/**
 * A warm empty state: what is not here, and the one action that changes it.
 * @param title - What is empty.
 * @param children - The explanation, and any action.
 * @param className - Additional CSS classes.
 * @returns Empty state component.
 */
function EmptyState({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-[var(--hsh-space-3)]",
        "rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-quiet)]",
        "p-[var(--hsh-space-5)]",
        className,
      )}
    >
      <p className="hsh-h4 text-[var(--hsh-text-primary)]">{title}</p>
      <div className="hsh-body-sm flex flex-col items-start gap-[var(--hsh-space-3)] text-[var(--hsh-text-secondary)]">
        {children}
      </div>
    </div>
  )
}

/**
 * The private-beta band from MDS-REF-007.
 *
 * It says on the page what the database enforces in a check constraint: every
 * record on this surface is sample data. The precedent is the `/resources` demo
 * notice and the family page's D-FF1 notice — a demo surface says so where the
 * reader is, not only in a commit message.
 *
 * @returns Review data banner.
 */
function ReviewDataBanner() {
  return (
    <div className="flex items-center justify-center gap-[var(--hsh-space-2)] rounded-[var(--hsh-radius-card)] bg-[var(--hsh-surface-warm-highlight)] px-[var(--hsh-space-4)] py-[var(--hsh-space-3)]">
      <Info
        aria-hidden="true"
        className="size-4 shrink-0 text-[var(--hsh-coral-700)]"
        strokeWidth={1.75}
      />
      <p className="hsh-caption text-center tracking-[0.06em] text-[var(--hsh-coral-700)] uppercase">
        Private beta · Sample data
      </p>
    </div>
  )
}

/**
 * The quiet inline note that a card's contents are sample records.
 * @param children - The note.
 * @returns Sample note component.
 */
function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="hsh-body-sm flex gap-[var(--hsh-space-2)] text-[var(--hsh-text-muted)]">
      <CircleAlert
        aria-hidden="true"
        className="mt-[3px] size-4 shrink-0 text-[var(--hsh-info)]"
        strokeWidth={1.75}
      />
      <span>{children}</span>
    </p>
  )
}

export { SectionError, EmptyState, ReviewDataBanner, SampleNote }
