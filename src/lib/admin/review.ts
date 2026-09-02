/**
 * Authorized beta-review reads and the four approved writes (MPS-REQ-022,
 * MPS-REQ-024, MPS-WFL-008, MPS-ACC-032).
 *
 * WHERE THE BOUNDARY IS
 *
 * Both tables have one SELECT policy, `private.is_admin()`, which is exactly
 * the ACT-004/ACT-006 pair MPS-WFL-008 names. Nothing here filters by role
 * because the database already did: an educator running these queries gets
 * nothing, which matters more than usual — Samantha's candid assessment of the
 * educator workspace is not something an educator reads.
 *
 * THE FOUR WRITES ARE FOUR ACTS
 *
 * MPS-WFL-008 separates recording evidence, recording feedback, classifying
 * it, and approving its disposition. They stay four functions here because
 * collapsing any two would lose the distinction between what an engineer
 * observed and what the owner decided.
 *
 * WHAT DOES NOT EXIST HERE
 *
 * No write to `mps/`, `mds/`, or `mts/` (GAP-EVIDENCE-002). No delete: a
 * recorded piece of the owner's feedback is not removable, because
 * MPS-WFL-008's recovery keeps unresolved items explicit. No evidence file
 * upload (GAP-EVIDENCE-001). No scope, priority, or requirement field.
 */

import "server-only"

import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

import type { AdminRead } from "@/lib/admin/repository"
import type { MutationResult } from "@/lib/admin/programs"
import type {
  ReviewDisposition,
  ReviewResult,
  ReviewSignalState,
} from "@/lib/admin/review-transitions"

/** One recorded piece of the owner's feedback. */
type ReviewFeedbackItem = {
  id: string
  signalId: string
  note: string
  disposition: ReviewDisposition | null
  approvedAt: string | null
  createdAt: string
}

/** One approved beta success signal and the evidence recorded against it. */
type ReviewSignal = {
  id: string
  statement: string
  displayOrder: number
  state: ReviewSignalState
  stateChangedAt: string
  result: ReviewResult
  environment: string | null
  buildIdentifier: string | null
  method: string | null
  actor: string | null
  evidence: string | null
  feedback: ReviewFeedbackItem[]
}

/* One unbroken literal — see the note in `programs.ts`. */
// prettier-ignore
const SIGNAL_COLUMNS = "id,statement,display_order,state,state_changed_at,result,environment,build_identifier,method,actor,evidence"

/* prettier-ignore */
const FEEDBACK_COLUMNS = "id,signal_id,note,disposition,disposition_approved_at,created_at"

type SignalRow = {
  id: string
  statement: string
  display_order: number
  state: ReviewSignalState
  state_changed_at: string
  result: ReviewResult
  environment: string | null
  build_identifier: string | null
  method: string | null
  actor: string | null
  evidence: string | null
}

type FeedbackRow = {
  id: string
  signal_id: string
  note: string
  disposition: ReviewDisposition | null
  disposition_approved_at: string | null
  created_at: string
}

/**
 * Every approved signal in order, each with its feedback.
 * @returns The walkthrough, or a state that is not emptiness.
 */
async function listReviewSignals(): Promise<AdminRead<ReviewSignal[]>> {
  if (!isSupabaseConfigured()) return { status: "unavailable" }

  const supabase = await createClient()

  /* Two reads rather than a nested select: the feedback list is ordered
     independently of the signals, and a join would return the statement once
     per feedback row. */
  const [signals, feedback] = await Promise.all([
    supabase
      .from("review_signals")
      .select(SIGNAL_COLUMNS)
      .order("display_order", { ascending: true }),
    supabase
      .from("review_feedback")
      .select(FEEDBACK_COLUMNS)
      .order("created_at", { ascending: true }),
  ])

  /* A failed read is never rendered as "no signals" or "no feedback". An empty
     walkthrough and an unreadable one mean opposite things to the person
     deciding whether the beta is ready. */
  if (signals.error || !signals.data || feedback.error || !feedback.data) {
    return { status: "failed" }
  }

  const byId = new Map<string, ReviewFeedbackItem[]>()
  for (const row of feedback.data as FeedbackRow[]) {
    const item: ReviewFeedbackItem = {
      id: row.id,
      signalId: row.signal_id,
      note: row.note,
      disposition: row.disposition,
      approvedAt: row.disposition_approved_at,
      createdAt: row.created_at,
    }
    const existing = byId.get(row.signal_id)
    if (existing) existing.push(item)
    else byId.set(row.signal_id, [item])
  }

  return {
    status: "ready",
    data: (signals.data as SignalRow[]).map((row) => ({
      id: row.id,
      statement: row.statement,
      displayOrder: row.display_order,
      state: row.state,
      stateChangedAt: row.state_changed_at,
      result: row.result,
      environment: row.environment,
      buildIdentifier: row.build_identifier,
      method: row.method,
      actor: row.actor,
      evidence: row.evidence,
      feedback: byId.get(row.id) ?? [],
    })),
  }
}

function mapError(code: string | undefined): MutationResult {
  /* Deliberately not logged and deliberately not echoed. Only the code decides
     the recovery; a Supabase error object carries the query that produced it,
     and here that query carries the owner's own words. */
  switch (code) {
    case "42501":
      return { ok: false, reason: "forbidden" }
    case "P0002":
      return { ok: false, reason: "notFound" }
    case "23514":
      return { ok: false, reason: "invalidTransition" }
    case "22023":
      return { ok: false, reason: "rejected" }
    default:
      return { ok: false, reason: "failed" }
  }
}

/**
 * Record what was checked for one signal, and optionally move its state.
 * @param input - The signal, the result, and the evidence fields.
 * @returns Whether the change was applied, and why not when it was refused.
 */
async function recordSignalEvidence(input: {
  signalId: string
  result: ReviewResult
  environment: string
  buildIdentifier: string
  method: string
  evidence: string
  nextState: ReviewSignalState | null
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_record_signal_evidence", {
    p_signal_id: input.signalId,
    p_result: input.result,
    p_environment: input.environment,
    p_build_identifier: input.buildIdentifier,
    p_method: input.method,
    p_evidence: input.evidence,
    ...(input.nextState ? { p_next_state: input.nextState } : {}),
  })

  if (error) return mapError(error.code)
  return { ok: true, outcome: "updated" }
}

/**
 * Record one thing the owner said about a signal.
 * @param input - The signal and the note.
 * @returns Whether it was recorded.
 */
async function recordReviewFeedback(input: {
  signalId: string
  note: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_record_review_feedback", {
    p_signal_id: input.signalId,
    p_note: input.note,
  })

  if (error) return mapError(error.code)
  return { ok: true, outcome: "updated" }
}

/**
 * Classify one feedback item (MPS-WFL-008 "Classify issue or idea").
 * @param input - The feedback item and its disposition.
 * @returns Whether it was classified.
 */
async function classifyReviewFeedback(input: {
  feedbackId: string
  disposition: ReviewDisposition
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_classify_review_feedback", {
    p_feedback_id: input.feedbackId,
    p_disposition: input.disposition,
  })

  if (error) return mapError(error.code)
  return { ok: true, outcome: "updated" }
}

/**
 * Approve one feedback item's disposition (MPS-WFL-008 "Approve disposition").
 *
 * Records an approved judgment and attributes it. It changes no scope, and
 * carrying the decision into the MPS remains a human step (GAP-EVIDENCE-002).
 * @param input - The feedback item.
 * @returns Whether the approval was recorded.
 */
async function approveReviewDisposition(input: {
  feedbackId: string
}): Promise<MutationResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "failed" }

  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_approve_review_disposition", {
    p_feedback_id: input.feedbackId,
  })

  if (error) return mapError(error.code)
  return { ok: true, outcome: "updated" }
}

export {
  listReviewSignals,
  recordSignalEvidence,
  recordReviewFeedback,
  classifyReviewFeedback,
  approveReviewDisposition,
}
export type { ReviewSignal, ReviewFeedbackItem }
