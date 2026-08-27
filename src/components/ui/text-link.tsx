import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * MDS §6 text link. The accent tone uses Coral 700, not Logo Coral:
 * DO-DONT.md forbids Logo Coral for normal-size text on light surfaces.
 */
const textLinkVariants = cva(
  [
    "inline-flex items-center gap-[var(--hsh-space-2)]",
    "font-[family-name:var(--hsh-font-ui)] font-semibold",
    "underline-offset-4 transition-colors outline-none hover:underline",
    "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
    "focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-offset-[var(--hsh-focus-offset)]",
  ],
  {
    variants: {
      tone: {
        default: "text-[var(--hsh-text-link)]",
        accent: "text-[var(--hsh-coral-700)]",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
)

/**
 * Text link component with optional arrow icon.
 * @param className - Additional CSS classes
 * @param tone - Link tone (default or accent)
 * @param withArrow - Whether to display arrow icon
 * @param children - Link content
 * @param props - Next.js Link props
 * @returns Text link component
 */
function TextLink({
  className,
  tone,
  withArrow = false,
  children,
  ...props
}: React.ComponentProps<typeof Link> &
  VariantProps<typeof textLinkVariants> & { withArrow?: boolean }) {
  return (
    <Link
      data-slot="text-link"
      className={cn(textLinkVariants({ tone, className }))}
      {...props}
    >
      {children}
      {withArrow ? (
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
      ) : null}
    </Link>
  )
}

export { TextLink, textLinkVariants }
