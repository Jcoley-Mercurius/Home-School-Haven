import { cloneElement, isValidElement, type ReactElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * MDS §6 button primitive.
 * Variants and control heights follow MDS-REF-003 §5 and DESIGN-SYSTEM.md §6.
 * Accent uses Coral 700 rather than Logo Coral: white on Logo Coral is ~2.7:1
 * and fails the AA requirement in DESIGN-SYSTEM.md §10.
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-[var(--hsh-radius-control)] border border-transparent bg-clip-padding",
    "font-[family-name:var(--hsh-font-ui)] font-semibold whitespace-nowrap",
    "transition-colors outline-none select-none",
    "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
    "focus-visible:outline-[color:var(--hsh-focus)] focus-visible:outline-offset-[var(--hsh-focus-offset)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[loading]:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--hsh-forest-600)] text-[var(--hsh-text-inverse)] shadow-[var(--hsh-shadow-subtle)] hover:bg-[var(--hsh-forest-700)] active:bg-[var(--hsh-forest-700)]",
        secondary:
          "border-[var(--hsh-neutral-300)] bg-[var(--hsh-surface-card)] text-[var(--hsh-forest-700)] hover:bg-[var(--hsh-forest-50)] active:bg-[var(--hsh-forest-100)]",
        accent:
          "bg-[var(--hsh-coral-700)] text-[var(--hsh-text-inverse)] shadow-[var(--hsh-shadow-subtle)] hover:bg-[color-mix(in_srgb,var(--hsh-coral-700)_88%,black)] active:bg-[color-mix(in_srgb,var(--hsh-coral-700)_80%,black)]",
        quiet:
          "bg-transparent text-[var(--hsh-forest-700)] hover:bg-[var(--hsh-forest-50)] active:bg-[var(--hsh-forest-100)]",
        text: "bg-transparent px-0 text-[var(--hsh-forest-700)] underline-offset-4 hover:underline",
        destructive:
          "bg-[var(--hsh-error)] text-[var(--hsh-text-inverse)] hover:bg-[color-mix(in_srgb,var(--hsh-error)_88%,black)] active:bg-[color-mix(in_srgb,var(--hsh-error)_80%,black)]",
      },
      size: {
        /* Dense operational surfaces only; keep 8 px separation from neighbours. */
        sm: "h-[var(--hsh-control-height-small)] min-h-[var(--hsh-control-height-small)] px-[var(--hsh-space-4)] text-[length:var(--hsh-size-body-sm)]",
        md: "h-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] px-[var(--hsh-space-6)] text-[length:var(--hsh-size-body)]",
        lg: "h-[var(--hsh-control-height-large)] min-h-[var(--hsh-control-height-large)] px-[var(--hsh-space-8)] text-[length:var(--hsh-size-body-lg)]",
        icon: "size-[var(--hsh-control-height-standard)] min-h-[var(--hsh-control-height-standard)] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

/**
 * A `render` element that is not a real <button> — a Next.js `Link`, which
 * produces an <a> — is a navigation styled as a button, not a button.
 *
 * Passing it through Base UI's Button is wrong in both directions: leaving
 * `nativeButton` at its `true` default warns and strips native semantics, while
 * setting it to `false` stamps `role="button"` onto the anchor, so screen
 * readers announce "button" for something that navigates and users lose the
 * link affordances that come with it.
 *
 * So render those directly, carrying only the visual variant across. Real
 * buttons keep going through the primitive and its loading/disabled handling.
 */
function isLinkLikeRender(
  render: ButtonPrimitive.Props["render"],
): render is ReactElement<{ className?: string } & Record<string, unknown>> {
  return isValidElement(render) && render.type !== "button"
}

/**
 * Button component with support for variants, sizes, and loading state.
 * @param className - Additional CSS classes
 * @param variant - Visual variant (primary, secondary, accent, quiet, text, destructive)
 * @param size - Button size (sm, md, lg, icon)
 * @param loading - Whether button is in loading state with spinner
 * @param disabled - Whether the button is disabled; implied while loading
 * @param nativeButton - Base UI native-button semantics. Ignored for a link-like
 *   `render`, which is rendered directly to keep its link semantics.
 * @param render - Element to render as, e.g. a Next.js `Link`
 * @param children - Button content
 * @param props - Additional button primitive props
 * @returns Button component
 */
function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  nativeButton,
  render,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  const classes = cn(buttonVariants({ variant, size, className }))

  if (isLinkLikeRender(render)) {
    return cloneElement(
      render,
      {
        "data-slot": "button",
        ...props,
        className: cn(classes, render.props.className),
      },
      children,
    )
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
      render={render}
      nativeButton={nativeButton}
      disabled={loading || disabled}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
          {children}
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
