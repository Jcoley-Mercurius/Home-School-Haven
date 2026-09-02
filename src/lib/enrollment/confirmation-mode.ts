import type { Enums } from "@/lib/supabase/types"

export type ConfirmationMode = Enums<"program_confirmation_mode">

/**
 * How a program confirms registrations (MPS-RUL-001), in the words an
 * administrator configures it with and a parent reads it in.
 *
 * One table, two audiences, for the same reason `ENROLLMENT_STATE` is one
 * table: MPS-ACC-022 and MPS-ACC-031 require that a family and an administrator
 * be told the same thing, and the cheapest guarantee of that is that neither
 * side can be edited without the other.
 *
 * THE WORD "INSTANT" IS NOT A PROMISE
 *
 * `instant` does not confirm an enrollment and never could. It means an
 * eligible registration may be handed to Home School Haven's external checkout
 * (MPS-REQ-013). Payment is verified afterwards, by a person, and confirmation
 * comes from that and nothing else (DO-DONT "Trust states"). Both descriptions
 * below say so, because a mode named "instant" that quietly meant "confirmed"
 * is precisely the inference this release exists to prevent.
 */
const CONFIRMATION_MODE = {
  administrator_approval: {
    label: "Administrator approval",
    /** Shown to an administrator configuring the program. */
    description:
      "A family's registration is recorded as pending review. Nobody is sent to checkout until Home School Haven approves it.",
    /** Shown to a parent before they register. */
    familyNote:
      "Home School Haven reviews each registration for this program before any payment step. Registering does not confirm a place.",
  },
  instant: {
    label: "Instant confirmation",
    description:
      "An eligible registration goes straight to the external checkout link. It is still not confirmed enrollment: payment is verified afterwards.",
    familyNote:
      "You will be taken to Home School Haven's checkout page. Starting checkout does not confirm payment and does not confirm your child's place.",
  },
} as const satisfies Record<
  ConfirmationMode,
  { label: string; description: string; familyNote: string }
>

export { CONFIRMATION_MODE }
