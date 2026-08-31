import { Archive, CircleCheck, CircleMinus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { PublicationState } from "@/lib/admin/transitions"

/**
 * The one place a stored publication state becomes something an administrator
 * reads (MDS `components.status`: "always pair semantic color with an icon and
 * explicit label").
 *
 * Shared by the overview table, the program list, and the program detail for
 * the same reason `enrollment-state.tsx` is shared by the family and admin
 * views: MPS-REQ-020 requires one consistent representation of program state
 * across role experiences, and one table is the only way to be sure of it.
 *
 * `archived` gets its own icon rather than reusing `draft`'s. They are both
 * "not public", but they mean different things to an operator deciding what to
 * do next, and a status that reads identically to another status is a status
 * that has to be read twice.
 */
const PUBLICATION = {
  published: {
    tone: "open",
    label: "Published",
    icon: CircleCheck,
    sentence: "Visible in the public catalog.",
  },
  draft: {
    tone: "neutral",
    label: "Draft",
    icon: CircleMinus,
    sentence: "Not visible to families or visitors.",
  },
  archived: {
    tone: "neutral",
    label: "Archived",
    icon: Archive,
    sentence: "Withdrawn from the catalog. Its history is kept.",
  },
} as const satisfies Record<
  PublicationState,
  {
    tone: "open" | "neutral"
    label: string
    icon: typeof CircleCheck
    sentence: string
  }
>

/**
 * Publication state badge.
 * @param state - The program's publication state.
 * @returns The badge.
 */
function PublicationBadge({ state }: { state: PublicationState }) {
  const { tone, label, icon: Icon } = PUBLICATION[state]
  return (
    <Badge tone={tone}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {label}
    </Badge>
  )
}

export { PUBLICATION, PublicationBadge }
