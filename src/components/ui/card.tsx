import { cn } from "@/lib/utils"

/** MDS §6 card: white surface, 14 px radius, 1 px border, card elevation. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-[var(--hsh-space-4)] p-[var(--hsh-space-6)]",
        "rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)]",
        "bg-[var(--hsh-surface-card)] shadow-[var(--hsh-shadow-card)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-[var(--hsh-space-3)]", className)}
      {...props}
    />
  )
}

/** Quiet botanical mark from MDS-REF-003 §5. Decorative — keep it aria-hidden. */
function CardGlyph({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="card-glyph"
      className={cn(
        "flex size-10 items-center justify-center rounded-full",
        "bg-[var(--hsh-surface-quiet)] text-[var(--hsh-forest-500)]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("hsh-h3 text-[var(--hsh-text-primary)]", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("hsh-body text-[var(--hsh-text-secondary)]", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col gap-[var(--hsh-space-3)]", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center gap-[var(--hsh-space-4)]",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardGlyph,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
}
