import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * MDS §6 status indicator (MDS-REF-004 "STATUS BADGE SYSTEM").
 *
 * A badge always pairs its tone with a visible label, and callers pass an icon,
 * because DO-DONT.md "Trust states" and DESIGN-SYSTEM.md §10 both require that
 * meaning never rests on colour alone.
 *
 * Tones map to the approved semantic palette. `neutral` is the honest tone for
 * a state the source has not published — it must not borrow the `open` tone.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-[var(--hsh-space-2)]",
    "rounded-[var(--hsh-radius-pill)] px-[var(--hsh-space-3)] py-[var(--hsh-space-1)]",
    "font-[family-name:var(--hsh-font-ui)] text-[length:var(--hsh-size-label)]",
    "leading-[var(--hsh-leading-label)] font-semibold",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--hsh-surface-quiet)] text-[var(--hsh-text-secondary)]",
        open: "bg-[var(--hsh-forest-100)] text-[var(--hsh-forest-700)]",
        limited: "bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]",
        waitlist: "bg-[var(--hsh-coral-100)] text-[var(--hsh-coral-700)]",
        pending: "bg-[var(--hsh-gold-100)] text-[var(--hsh-gold-700)]",
        /* Reserved for a confirmed outcome. `open` says a program accepts
           registrations; this says something actually completed, and the two
           must not be spelled the same way. Success #2F6B4F on Forest 100
           measures 4.91:1 — AA for the 14 px semibold label above. */
        success: "bg-[var(--hsh-forest-100)] text-[var(--hsh-success)]",
        info: "bg-[var(--hsh-forest-50)] text-[var(--hsh-info)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

/**
 * Status badge.
 * @param className - Additional CSS classes
 * @param tone - Semantic tone; pair it with an explicit label, never alone
 * @param props - Standard span props
 * @returns Badge component
 */
function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
