import { Leaf } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardGlyph,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Program } from "@/content/foundation-content"

/**
 * Program card, featured variant (DESIGN-SYSTEM.md §6, MDS-REF-006).
 *
 * Truthful content only: a field the source does not publish renders as
 * "Contact for details" (BETA-CONTENT-IMPORT-INVENTORY rule 3, QA-005).
 * No availability, capacity, or enrollment state is shown, and the card carries
 * no register, pay, or checkout action.
 */
function ProgramCard({ program }: { program: Program }) {
  const details = [
    program.publishedDates,
    program.publishedDuration,
    program.publishedPrice,
  ].filter((detail): detail is string => Boolean(detail))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardGlyph>
          <Leaf aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </CardGlyph>
        <CardTitle>{program.name}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1">
        {details.length > 0 ? (
          <ul className="flex flex-col gap-[var(--hsh-space-1)]">
            {details.map((detail) => (
              <li
                key={detail}
                className="hsh-body text-[var(--hsh-text-secondary)]"
              >
                {detail}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
          Contact for details
        </p>
      </CardContent>

      <CardFooter>
        <Button variant="primary" size="md" disabled>
          View Details
          <span className="sr-only">
            for {program.name} — coming soon
          </span>
        </Button>
      </CardFooter>
    </Card>
  )
}

export { ProgramCard }
