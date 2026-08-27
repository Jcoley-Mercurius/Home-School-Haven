import { cn } from "@/lib/utils"

/**
 * MDS §6 textarea. Height grows from the standard control height.
 * @param className - Additional CSS classes
 * @param props - Standard textarea props
 * @returns Textarea component
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "hsh-body flex min-h-[calc(var(--hsh-control-height-standard)*2)] w-full",
        "px-[var(--hsh-space-4)] py-[var(--hsh-space-3)]",
        "rounded-[var(--hsh-radius-control)] border border-[var(--hsh-border-default)]",
        "bg-[var(--hsh-surface-card)] text-[var(--hsh-text-primary)]",
        "placeholder:text-[var(--hsh-neutral-400)]",
        "transition-colors outline-none",
        "hover:border-[var(--hsh-border-strong)]",
        "focus-visible:outline-[length:var(--hsh-focus-width)] focus-visible:outline-solid",
        "focus-visible:outline-offset-[var(--hsh-focus-offset)] focus-visible:outline-[color:var(--hsh-focus)]",
        "disabled:cursor-not-allowed disabled:bg-[var(--hsh-surface-elevated)] disabled:text-[var(--hsh-neutral-400)]",
        "aria-invalid:border-[var(--hsh-error)]",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
