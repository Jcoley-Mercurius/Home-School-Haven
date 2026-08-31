import { cva, type VariantProps } from "class-variance-authority"
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * MDS §6 alert (`components.alert`: variants success / warning / error / info /
 * neutral, sizes inline / banner).
 *
 * Approved component, first implementation. This is EXTEND, not CREATE — the
 * convention is already in the locked MDS component set, so building it here
 * introduces no new reusable visual language.
 *
 * Three rules it exists to hold:
 *
 *   1. Every tone carries an icon and a text label. DO-DONT "Trust states"
 *      requires meaning never rest on colour, and an operator reading a status
 *      in greyscale, or with a colour-vision difference, must reach the same
 *      conclusion.
 *   2. `role` is chosen by the caller, not by the tone. A result of an action
 *      the operator just took needs announcing (`status` / `alert`); a standing
 *      notice on a page does not, and announcing it would interrupt a screen
 *      reader user for something they did not do.
 *   3. Nothing is dismissible by default. A payment, consent, or enrollment
 *      state that can be dismissed is a state that can be missed.
 */
const alertVariants = cva(
  [
    "flex gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border",
    "font-[family-name:var(--hsh-font-ui)]",
    "[&_svg]:mt-[2px] [&_svg]:size-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--hsh-border-default)] bg-[var(--hsh-surface-quiet)] text-[var(--hsh-text-primary)] [&_svg]:text-[var(--hsh-text-secondary)]",
        info: "border-[var(--hsh-forest-100)] bg-[var(--hsh-forest-50)] text-[var(--hsh-text-primary)] [&_svg]:text-[var(--hsh-info)]",
        success:
          "border-[var(--hsh-forest-100)] bg-[var(--hsh-forest-50)] text-[var(--hsh-text-primary)] [&_svg]:text-[var(--hsh-success)]",
        /* Gold 100 and Coral 100 are the lightest approved tints of each hue.
           There is no 50 step for either in the MDS palette, and inventing one
           would be hardcoding a value where an approved token exists. */
        warning:
          "border-[var(--hsh-gold-500)] bg-[var(--hsh-gold-100)] text-[var(--hsh-text-primary)] [&_svg]:text-[var(--hsh-gold-700)]",
        error:
          "border-[var(--hsh-coral-500)] bg-[var(--hsh-coral-100)] text-[var(--hsh-text-primary)] [&_svg]:text-[var(--hsh-error)]",
      },
      size: {
        inline: "p-[var(--hsh-space-4)]",
        banner: "px-[var(--hsh-space-5)] py-[var(--hsh-space-4)]",
      },
    },
    defaultVariants: { tone: "neutral", size: "inline" },
  },
)

const TONE_ICON = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const satisfies Record<string, LucideIcon>

type AlertTone = keyof typeof TONE_ICON

/**
 * Alert with an icon, a title, and its explanation.
 *
 * @param tone - Semantic tone; always paired with the matching icon and title.
 * @param size - `inline` inside a card, `banner` across a page region.
 * @param title - The short statement. Required: a tone with no words is a colour.
 * @param live - `off` for a standing notice, `polite` for the result of an
 *   action, `assertive` for one that blocks the operator.
 * @param className - Additional CSS classes.
 * @param children - The explanation and any recovery action.
 * @returns Alert component.
 */
function Alert({
  tone = "neutral",
  size,
  title,
  live = "off",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    tone?: AlertTone
    title: React.ReactNode
    live?: "off" | "polite" | "assertive"
  }) {
  const Icon = TONE_ICON[tone]

  return (
    <div
      data-slot="alert"
      /* `alert` implies assertive interruption; `status` is polite. Neither is
         applied to a standing notice, which is just a region of the page. */
      role={
        live === "assertive"
          ? "alert"
          : live === "polite"
            ? "status"
            : undefined
      }
      className={cn(alertVariants({ tone, size, className }))}
      {...props}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} />
      <div className="flex min-w-0 flex-col gap-[var(--hsh-space-1)]">
        <p className="hsh-body font-semibold text-[var(--hsh-text-primary)]">
          {title}
        </p>
        {children ? (
          /* Never `truncate` and never `line-clamp`: DO-DONT forbids
             compressing help, validation, consent, payment, or privacy
             language, and this component carries all five. */
          <div className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { Alert, alertVariants }
export type { AlertTone }
