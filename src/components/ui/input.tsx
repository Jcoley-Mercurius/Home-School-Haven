import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * MDS §6 text input: 44 px control height, 10 px radius, Coral 700 focus ring.
 * @param className - Additional CSS classes
 * @param props - Input primitive props
 * @returns Input component
 */
function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "hsh-body flex min-h-[var(--hsh-control-height-standard)] w-full",
        "h-[var(--hsh-control-height-standard)] px-[var(--hsh-space-4)]",
        "rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)]",
        "bg-[var(--hsh-surface-card)] text-[var(--hsh-text-primary)]",
        "placeholder:text-[var(--hsh-neutral-400)]",
        "transition-colors outline-none",
        "hover:border-[var(--hsh-border-strong)]",
        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
        "focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)]",
        "disabled:cursor-not-allowed disabled:bg-[var(--hsh-surface-elevated)] disabled:text-[var(--hsh-neutral-400)]",
        "data-[invalid]:border-[var(--hsh-error)]",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
