/**
 * Hand-maintained helpers over the generated schema types.
 *
 * These live outside `database.types.ts` so that `npm run db:types` can
 * overwrite that file wholesale without losing anything.
 */

import type { Database } from "./database.types"

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
