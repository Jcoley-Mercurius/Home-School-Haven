/**
 * Authorized administrator inquiry reads and the one approved write
 * (MPS-REQ-010, MPS-REQ-024, MPS-WFL-004, MPS-RUL-003, MPS-RUL-004).
 *
 * WHERE THE BOUNDARY IS
 *
 * `public.inquiries` has exactly one SELECT policy, `private.is_admin()`, and
 * no educator or family policy at all. Nothing in this module filters by role,
 * because the database already did: an educator running these exact queries
 * gets nothing back, which is what keeps a discounted-class assistance request
 * private (MPS-ACC-013). The page's `requireAdmin()` guard is the second,
 * independent control; neither is load-bearing alone.
 *
 * TWO DIFFERENT SELECT LISTS, ON PURPOSE
 *
 * The queue needs to know *what is waiting*; the detail view needs to know
 * *what the family said*. So the list reads no message and no phone number —
 * a triage screen that an administrator may have open on a shared display
 * shows the pathway, the state, and the sender's name, and the words of an
 * assistance request stay behind a deliberate click (MPS-RUL-003).
 *
 * THE ONE WRITE
 *
 * `admin_set_inquiry_state`. The table's UPDATE policy is administrator-only,
 * and the function additionally applies the MPS-WFL-004 transition graph and
 * refuses to assign an inquiry to anyone who is not an administrator. A
 * request that never touches this module meets the same rules.
 *
 * WHAT DOES NOT EXIST HERE, DELIBERATELY
 *
 * No create (that is `public.submit_inquiry`, reached from the public form) and
 * no delete (retention is an unresolved owner decision, GAP-PUBLIC-004). No
 * amount, discount, scholarship, award, or eligibility of any kind: moving an
 * inquiry to `approved_path_provided` records that an administrator gave the
 * family a path, and decides nothing (MPS-RUL-004).
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead } from "@/lib/admin/repository"
import type { MutationResult } from "@/lib/admin/programs"
import type { InquiryState, InquiryType } from "@/lib/admin/inquiry-transitions"

/** One inquiry, as read and as the drawer shows it. */
type AdminInquiry = {
  id: string
  reference: string
  type: InquiryType
  state: InquiryState
  submittedAt: string
  stateChangedAt: string
  contactName: string
  /** True when an administrator has claimed it (MPS-REQ-010). */
  owned: boolean
  ownerUserId: string | null
  program: { slug: string; name: string } | null
  contactEmail: string
  contactPhone: string | null
  /** What the family wrote. Rendered in the drawer only, never in the list. */
  message: string
}

/* One unbroken literal — see the note in `programs.ts`. */
// prettier-ignore
const SELECT_COLUMNS = "id,reference,type,state,submitted_at,state_changed_at,contact_name,contact_email,contact_phone,message,owner_user_id,programs(slug,name)"

type InquiryRow = {
  id: string
  reference: string
  type: InquiryType
  state: InquiryState
  submitted_at: string
  state_changed_at: string
  contact_name: string
  owner_user_id: string | null
  programs: { slug: string; name: string } | null
  contact_email: string
  contact_phone: string | null
  message: string
}

function toInquiry(row: InquiryRow): AdminInquiry {
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    state: row.state,
    submittedAt: row.submitted_at,
    stateChangedAt: row.state_changed_at,
    contactName: row.contact_name,
    owned: row.owner_user_id !== null,
    ownerUserId: row.owner_user_id,
    program: row.programs ?? null,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    message: row.message,
  }
}

/**
 * Every inquiry the viewer is authorized to see, newest first.
 * @returns The triage queue, or a state that is not emptiness.
 */
async function listAdminInquiries(): Promise<AdminRead<AdminInquiry[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inquiries")
    .select(SELECT_COLUMNS)
    .order("submitted_at", { ascending: false })

  /* A failed read is never rendered as "no inquiries waiting". An empty queue
     and an unreadable queue mean opposite things to whoever is on duty. */
  if (error || !data) return { status: "failed" }

  return { status: "ready", data: (data as InquiryRow[]).map(toInquiry) }
}

/**
 * Move an inquiry's state, claim it, release it, or any combination
 * (MPS-REQ-010, MPS-WFL-004).
 * @param input - The inquiry, the proposed state, and the ownership change.
 * @returns Whether the change was applied, and why not when it was refused.
 */
async function setInquiryState(input: {
  inquiryId: string
  /** `null` leaves the state where it is — used when only claiming ownership. */
  state: InquiryState | null
  /** `null` leaves the owner alone; `clearOwner` releases the claim. */
  ownerUserId: string | null
  clearOwner: boolean
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  /* Each argument is omitted rather than sent as null when it does not apply:
     the function's defaults are what mean "leave this alone", and spelling
     that out here keeps a state-only change from touching the owner. */
  const { error } = await supabase.rpc("admin_set_inquiry_state", {
    p_inquiry_id: input.inquiryId,
    ...(input.state ? { p_next_state: input.state } : {}),
    ...(input.ownerUserId ? { p_owner_user_id: input.ownerUserId } : {}),
    p_clear_owner: input.clearOwner,
  })

  if (error) {
    /* Deliberately not logged and deliberately not echoed. A failure here
       concerns a family's private request, and a Supabase error object can
       carry the query that produced it. Only the code decides the recovery. */
    switch (error.code) {
      case "42501":
        return { ok: false, reason: "forbidden" }
      case "P0002":
        return { ok: false, reason: "notFound" }
      case "23514":
        return { ok: false, reason: "invalidTransition" }
      default:
        return { ok: false, reason: "failed" }
    }
  }

  return { ok: true, outcome: "updated" }
}

export { listAdminInquiries, setInquiryState }
export type { AdminInquiry }
