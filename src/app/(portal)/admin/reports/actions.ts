"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/guards"
import {
  approveReviewDisposition,
  classifyReviewFeedback,
  recordReviewFeedback,
  recordSignalEvidence,
} from "@/lib/admin/review"
import { isSupabaseConfigured } from "@/lib/env"

import { type ReviewActionFormState } from "./form-state"

/**
 * The four beta-review acts (MPS-REQ-022, MPS-REQ-024; MPS-WFL-008).
 *
 * WHAT THESE ACTIONS ARE, AND WHAT THEY REFUSE TO BE
 *
 * They record evidence that a signal was walked, what Samantha said about it,
 * how that was classified, and who approved the classification. That is all.
 *
 * They change no scope. MPS-REQ-022 requires classifying feedback "without
 * silently changing scope", and MPS-WFL-008's recovery is explicit that
 * "unresolved items remain explicit gaps; they do not silently enter launch
 * scope". So there is no action here that adds a requirement, alters a
 * priority, or marks something as accepted into this release — and the
 * disposition vocabulary has no value that could mean it.
 *
 * They do not touch `mps/`, `mds/`, or `mts/`. Carrying an approved
 * disposition into approved product state is a governance act performed in
 * ChatGPT Work by the system that owns the decision (AGENTS.md §3,
 * GAP-EVIDENCE-002). Letting a server action edit an approved artifact would
 * let the beta rewrite its own authority.
 *
 * THE ONE THING WORTH FAILING LOUDLY
 *
 * `approveDispositionAction` refuses an unclassified item, and so does the
 * database beneath it, and so does a CHECK constraint beneath that. An
 * approved decision nobody can categorise later is exactly the silent scope
 * change MPS-REQ-022 exists to prevent, so it is guarded three times.
 */
const SIGNAL_ID = z.string().regex(/^SIG-BETA-00[1-8]$/)

const evidenceSchema = z.object({
  signalId: SIGNAL_ID,
  result: z.enum(["pass", "fail", "blocked", "not_tested"]),
  environment: z.string().trim().max(200),
  buildIdentifier: z.string().trim().max(200),
  method: z.string().trim().max(400),
  evidence: z.string().trim().max(4000),
  nextState: z
    .enum([
      "not_reviewed",
      "in_review",
      "feedback_recorded",
      "decision_pending",
      "disposition_approved",
      "review_complete",
    ])
    .nullable(),
})

const feedbackSchema = z.object({
  signalId: SIGNAL_ID,
  note: z
    .string()
    .trim()
    .min(1, "Write down what was said. An empty note records nothing.")
    .max(4000, "Please keep this under 4000 characters."),
})

const classifySchema = z.object({
  signalId: SIGNAL_ID,
  feedbackId: z.uuid(),
  disposition: z.enum([
    "must_fix_beta_defect",
    "launch_requirement",
    "next_idea",
    "later_idea",
    "rejected_change",
  ]),
})

const approveSchema = z.object({
  signalId: SIGNAL_ID,
  feedbackId: z.uuid(),
})

function read(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function toStatus(reason: string): ReviewActionFormState["status"] {
  switch (reason) {
    case "forbidden":
      return "forbidden"
    case "notFound":
      return "notFound"
    case "invalidTransition":
      return "invalidTransition"
    case "rejected":
      return "rejected"
    default:
      return "failed"
  }
}

/**
 * Record evidence for one signal, and optionally move its state.
 * @param _previous - The previous form state (required by useActionState).
 * @param formData - The submitted evidence fields.
 * @returns The updated form state.
 */
export async function recordEvidenceAction(
  _previous: ReviewActionFormState,
  formData: FormData,
): Promise<ReviewActionFormState> {
  const rawSignal = read(formData, "signalId")
  const nextState = read(formData, "nextState")

  const parsed = evidenceSchema.safeParse({
    signalId: rawSignal,
    result: read(formData, "result"),
    environment: read(formData, "environment"),
    buildIdentifier: read(formData, "buildIdentifier"),
    method: read(formData, "method"),
    evidence: read(formData, "evidence"),
    nextState: nextState === "" ? null : nextState,
  })

  if (!parsed.success) {
    return {
      status: "invalid",
      signalId: rawSignal || null,
      fieldErrors: { result: "Choose a result and try again." },
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", signalId: parsed.data.signalId, fieldErrors: {} }
  }

  await requireAdmin("/admin/reports")

  const result = await recordSignalEvidence(parsed.data)

  if (!result.ok) {
    return {
      status: toStatus(result.reason),
      signalId: parsed.data.signalId,
      fieldErrors: {},
    }
  }

  revalidatePath("/admin/reports")
  return { status: "updated", signalId: parsed.data.signalId, fieldErrors: {} }
}

/**
 * Record one thing the owner said about a signal.
 * @param _previous - The previous form state.
 * @param formData - The signal and the note.
 * @returns The updated form state.
 */
export async function recordFeedbackAction(
  _previous: ReviewActionFormState,
  formData: FormData,
): Promise<ReviewActionFormState> {
  const rawSignal = read(formData, "signalId")

  const parsed = feedbackSchema.safeParse({
    signalId: rawSignal,
    note: read(formData, "note"),
  })

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error)
    return {
      status: "invalid",
      signalId: rawSignal || null,
      fieldErrors: { note: flattened.fieldErrors.note?.[0] },
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", signalId: parsed.data.signalId, fieldErrors: {} }
  }

  await requireAdmin("/admin/reports")

  const result = await recordReviewFeedback(parsed.data)

  if (!result.ok) {
    return {
      status: toStatus(result.reason),
      signalId: parsed.data.signalId,
      fieldErrors: {},
    }
  }

  revalidatePath("/admin/reports")
  return { status: "updated", signalId: parsed.data.signalId, fieldErrors: {} }
}

/**
 * Classify one feedback item.
 * @param _previous - The previous form state.
 * @param formData - The feedback item and its disposition.
 * @returns The updated form state.
 */
export async function classifyFeedbackAction(
  _previous: ReviewActionFormState,
  formData: FormData,
): Promise<ReviewActionFormState> {
  const rawSignal = read(formData, "signalId")

  const parsed = classifySchema.safeParse({
    signalId: rawSignal,
    feedbackId: read(formData, "feedbackId"),
    disposition: read(formData, "disposition"),
  })

  if (!parsed.success) {
    return { status: "invalid", signalId: rawSignal || null, fieldErrors: {} }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", signalId: parsed.data.signalId, fieldErrors: {} }
  }

  await requireAdmin("/admin/reports")

  const result = await classifyReviewFeedback({
    feedbackId: parsed.data.feedbackId,
    disposition: parsed.data.disposition,
  })

  if (!result.ok) {
    return {
      status: toStatus(result.reason),
      signalId: parsed.data.signalId,
      fieldErrors: {},
    }
  }

  revalidatePath("/admin/reports")
  return { status: "updated", signalId: parsed.data.signalId, fieldErrors: {} }
}

/**
 * Approve one feedback item's disposition.
 *
 * Records an approved judgment, attributed and timestamped. It adds nothing to
 * any release: carrying the decision into the MPS is a separate human step
 * (GAP-EVIDENCE-002), and the confirmation says so.
 * @param _previous - The previous form state.
 * @param formData - The feedback item.
 * @returns The updated form state.
 */
export async function approveDispositionAction(
  _previous: ReviewActionFormState,
  formData: FormData,
): Promise<ReviewActionFormState> {
  const rawSignal = read(formData, "signalId")

  const parsed = approveSchema.safeParse({
    signalId: rawSignal,
    feedbackId: read(formData, "feedbackId"),
  })

  if (!parsed.success) {
    return { status: "invalid", signalId: rawSignal || null, fieldErrors: {} }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", signalId: parsed.data.signalId, fieldErrors: {} }
  }

  await requireAdmin("/admin/reports")

  const result = await approveReviewDisposition({
    feedbackId: parsed.data.feedbackId,
  })

  if (!result.ok) {
    return {
      status: toStatus(result.reason),
      signalId: parsed.data.signalId,
      fieldErrors: {},
    }
  }

  revalidatePath("/admin/reports")
  return { status: "updated", signalId: parsed.data.signalId, fieldErrors: {} }
}
