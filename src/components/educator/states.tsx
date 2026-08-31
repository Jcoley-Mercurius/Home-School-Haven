import { EmptyState, SectionError } from "@/components/family/section-states"

/**
 * The two states every educator surface needs before it can show anything
 * (MPS-REQ-021, MDS `patterns.empty` / `patterns.error`).
 *
 * They live in one file because all six educator destinations reach them, and
 * because the distinction they protect is easy to lose one page at a time: an
 * educator with no assignments and an educator whose assignments could not be
 * read must never look alike. One is a fact about them that an administrator
 * changes; the other is a fact about us that a reload might fix. Rendering the
 * second as the first would tell an educator they have been unassigned when
 * they have not.
 */

/**
 * The workspace-wide empty state: no assignments, so nothing to scope to.
 *
 * Names the one action that changes it, and names who takes it. An educator
 * cannot assign themselves — `authenticated` holds no write on
 * `educator_assignments` — so an instruction to "add a program" would describe
 * a control that does not exist.
 *
 * @param surface - What is empty, in the educator's words, e.g. "schedule".
 * @returns The empty state.
 */
function NoAssignments({ surface }: { surface: string }) {
  return (
    <EmptyState title="You are not assigned to any programs yet">
      <p>
        Your {surface} shows the programs you are assigned to, and you do not
        hold any at the moment. An administrator makes assignments; once one is
        made, it appears here on your next visit without you signing out and
        back in.
      </p>
    </EmptyState>
  )
}

/**
 * A read that did not resolve, kept distinct from emptiness.
 *
 * `unavailable` and `failed` are different sentences on purpose. The first is a
 * setup state in an environment with no Supabase project and is not something
 * an educator can act on; the second is recoverable and says so.
 *
 * @param status - Which non-ready state occurred.
 * @param subject - What could not be loaded, e.g. "Your assigned programs".
 * @returns The error state.
 */
function ReadFailure({
  status,
  subject,
}: {
  status: "unavailable" | "failed"
  subject: string
}) {
  return (
    <SectionError>
      {status === "unavailable"
        ? `${subject} cannot be loaded in this environment because no Supabase project is configured. This is a setup state, not an empty workspace.`
        : `${subject} could not be loaded. Nothing has changed — reload the page to try again.`}
    </SectionError>
  )
}

export { NoAssignments, ReadFailure }
