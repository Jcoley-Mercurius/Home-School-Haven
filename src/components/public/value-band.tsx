import { Heart, Sprout, User, Users } from "lucide-react"

import { values } from "@/content/foundation-content"
import { cn } from "@/lib/utils"

/**
 * The approved values band (MDS-REF-006 value band).
 *
 * Extracted from `src/app/page.tsx` when `/about` needed the same band: the
 * strings are inventory content and must read identically everywhere
 * (MPS-REQ-020), so both pages render one implementation rather than two copies
 * that can drift.
 *
 * One mark per `values` entry, in order: heart on coral, sprig on forest,
 * person on gold, group on forest.
 */
const valueMarks = [
  { icon: Heart, surface: "var(--hsh-coral-100)", ink: "var(--hsh-coral-700)" },
  {
    icon: Sprout,
    surface: "var(--hsh-forest-50)",
    ink: "var(--hsh-forest-600)",
  },
  { icon: User, surface: "var(--hsh-gold-100)", ink: "var(--hsh-gold-700)" },
  {
    icon: Users,
    surface: "var(--hsh-forest-100)",
    ink: "var(--hsh-forest-600)",
  },
] as const

/**
 * Values band listing the four approved values with their marks.
 *
 * The band is labelled by the section that contains it, so it takes no heading
 * of its own.
 * @param className - Additional CSS classes for the list surface
 * @returns Values band list
 */
function ValueBand({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "grid gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-feature)] bg-[var(--hsh-surface-elevated)] p-[var(--hsh-space-6)] sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {values.map((value, index) => {
        const { icon: Icon, surface, ink } = valueMarks[index]
        return (
          <li
            key={value}
            className="hsh-body flex items-center gap-[var(--hsh-space-3)] text-[var(--hsh-text-primary)]"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: surface, color: ink }}
            >
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            {value}
          </li>
        )
      })}
    </ul>
  )
}

export { ValueBand }
