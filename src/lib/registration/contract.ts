/**
 * The family registration contract (Slice 2, prompts/registration-data-foundation.md;
 * tightened by Slice 2.5, prompts/registration-readiness.md).
 *
 * `public.submit_family_registration` is the control: it derives the family and
 * role from the session, validates every field again, and is the only write
 * path. This module exists so the later one-step UI and the server agree on the
 * payload's shape and can put a sentence in front of a parent, not so that it
 * can loosen anything the database enforces.
 *
 * Pure (zod only), so it is directly unit-testable
 * (`tests/registration-contract.test.mts`).
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * No family id, role, enrollment state, payment state, STEP UP verification
 * state, or administrative flag. Every object is `strict`, so a payload that
 * carries one is refused here, and the database refuses it again. No legal,
 * waiver, consent, or media-release wording either: none is approved
 * (MPS-RUL-010, GAP-014).
 */

import { z } from "zod"

export const REGISTRATION_LIMITS = {
  children: 10,
  selectionsPerChild: 10,
  guardianContacts: 2,
  emergencyContacts: 4,
  pickupPersons: 6,
  name: 120,
  studentName: 80,
  shortText: 40,
  phone: 32,
  email: 254,
  healthText: 1000,
  stepUpReference: 64,
  signature: 120,
} as const

export const ATTENDANCE_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number]

const L = REGISTRATION_LIMITS

const requiredText = (max: number) => z.string().trim().min(1).max(max)

/** Blank optional text becomes `undefined`, which is omitted from the JSON. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

const phone = z
  .string()
  .trim()
  .min(7)
  .max(L.phone)
  .regex(/^[0-9+(). -]+$/)

const optionalPhone = z
  .union([phone, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

const guardianContactSchema = z.strictObject({
  fullName: requiredText(L.name),
  phone,
  email: z
    .union([z.email().max(L.email), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  relationship: optionalText(L.shortText),
  isSubmitter: z.boolean(),
})

const emergencyContactSchema = z.strictObject({
  fullName: requiredText(L.name),
  relationship: requiredText(L.shortText),
  phone,
})

const pickupPersonSchema = z.strictObject({
  fullName: requiredText(L.name),
  relationship: requiredText(L.shortText),
  phone: optionalPhone,
})

/**
 * Which days are allowed, and how many, depends on the program's attendance
 * rule (DEC-032), which only the database knows: a fixed-day program takes no
 * days at all, Haven Days takes exactly its plan's count, Tutoring takes any of
 * its available days. This schema checks shape only.
 */
const selectionSchema = z.strictObject({
  programId: z.uuid(),
  attendanceDays: z
    .array(z.enum(ATTENDANCE_DAYS))
    .max(7)
    .default([])
    .refine((days) => new Set(days).size === days.length, {
      message: "Choose each day once.",
    }),
  planDaysPerWeek: z.number().int().min(1).max(7).optional(),
})

// DEC-026: every health question is an explicit Yes/No. `z.boolean()` refuses
// a missing answer, so a blank is never read as No.
const childBase = {
  hasAllergies: z.boolean(),
  allergyDetails: optionalText(L.healthText),
  hasMedicalNeeds: z.boolean(),
  medicalInformation: optionalText(L.healthText),
  hasAccommodationNeeds: z.boolean(),
  accommodationInformation: optionalText(L.healthText),
  photoVideoPermission: z.boolean(),
  stepUp: z
    .strictObject({
      selected: z.boolean(),
      reference: optionalText(L.stepUpReference),
    })
    .optional(),
  selections: z
    .array(selectionSchema)
    .min(1)
    .max(L.selectionsPerChild)
    .refine(
      (items) => new Set(items.map((s) => s.programId)).size === items.length,
      { message: "Choose each program once for this child." },
    ),
}

const childSchema = z
  .union([
    z.strictObject({ studentId: z.uuid(), ...childBase }),
    z.strictObject({
      newStudent: z.strictObject({
        preferredName: requiredText(L.studentName),
        gradeLevel: optionalText(L.shortText),
        guardianRelationship: optionalText(L.shortText),
      }),
      ...childBase,
    }),
  ])
  // Explicit Yes/No: details exist exactly when the answer is Yes. The
  // database CHECK repeats this.
  .refine((child) => child.hasAllergies === Boolean(child.allergyDetails), {
    message:
      "Allergy details go with a Yes answer, and only with a Yes answer.",
    path: ["allergyDetails"],
  })
  .refine(
    (child) => child.hasMedicalNeeds === Boolean(child.medicalInformation),
    {
      message:
        "Medical details go with a Yes answer, and only with a Yes answer.",
      path: ["medicalInformation"],
    },
  )
  .refine(
    (child) =>
      child.hasAccommodationNeeds === Boolean(child.accommodationInformation),
    {
      message:
        "Accommodation details go with a Yes answer, and only with a Yes answer.",
      path: ["accommodationInformation"],
    },
  )
  .refine((child) => child.stepUp?.selected || !child.stepUp?.reference, {
    message: "A STEP UP reference goes with a STEP UP selection.",
    path: ["stepUp", "reference"],
  })

const signedDocumentSchema = z.strictObject({
  versionId: z.uuid(),
  typedSignature: requiredText(L.signature),
})

export const registrationInputSchema = z
  .strictObject({
    authorityAffirmed: z.boolean(),
    guardianContacts: z
      .array(guardianContactSchema)
      .min(1)
      .max(L.guardianContacts),
    // DEC-026: at least one of each.
    emergencyContacts: z
      .array(emergencyContactSchema)
      .min(1)
      .max(L.emergencyContacts),
    pickupPersons: z.array(pickupPersonSchema).min(1).max(L.pickupPersons),
    children: z.array(childSchema).min(1).max(L.children),
    documents: z.strictObject({
      liabilityWaiver: signedDocumentSchema,
      codeOfConduct: signedDocumentSchema,
      // Acknowledged, never signed: there is no signature field to fill.
      parentHandbook: z.strictObject({
        versionId: z.uuid(),
        acknowledged: z.literal(true),
      }),
    }),
  })
  .refine(
    (input) => input.guardianContacts.filter((c) => c.isSubmitter).length === 1,
    {
      message: "Exactly one guardian contact is the person submitting.",
      path: ["guardianContacts"],
    },
  )

export type RegistrationInput = z.input<typeof registrationInputSchema>
export type ParsedRegistrationInput = z.output<typeof registrationInputSchema>

/**
 * The snake_case JSON `public.submit_family_registration` accepts. Optional
 * fields are omitted, never sent as `null`, so the payload fingerprint is
 * stable across retries of the same input.
 */
export function toRegistrationPayload(input: ParsedRegistrationInput) {
  return {
    authority_affirmed: input.authorityAffirmed,
    guardian_contacts: input.guardianContacts.map((c) => ({
      full_name: c.fullName,
      phone: c.phone,
      email: c.email,
      relationship: c.relationship,
      is_submitter: c.isSubmitter,
    })),
    emergency_contacts: input.emergencyContacts.map((c) => ({
      full_name: c.fullName,
      relationship: c.relationship,
      phone: c.phone,
    })),
    pickup_persons: input.pickupPersons.map((c) => ({
      full_name: c.fullName,
      relationship: c.relationship,
      phone: c.phone,
    })),
    children: input.children.map((child) => ({
      ...("studentId" in child
        ? { student_id: child.studentId }
        : {
            new_student: {
              preferred_name: child.newStudent.preferredName,
              grade_level: child.newStudent.gradeLevel,
              guardian_relationship: child.newStudent.guardianRelationship,
            },
          }),
      has_allergies: child.hasAllergies,
      allergy_details: child.allergyDetails,
      has_medical_needs: child.hasMedicalNeeds,
      medical_information: child.medicalInformation,
      has_accommodation_needs: child.hasAccommodationNeeds,
      accommodation_information: child.accommodationInformation,
      photo_video_permission: child.photoVideoPermission,
      step_up: child.stepUp
        ? { selected: child.stepUp.selected, reference: child.stepUp.reference }
        : undefined,
      selections: child.selections.map((s) => ({
        program_id: s.programId,
        attendance_days: s.attendanceDays,
        plan_days_per_week: s.planDaysPerWeek,
      })),
    })),
    documents: {
      liability_waiver: {
        version_id: input.documents.liabilityWaiver.versionId,
        typed_signature: input.documents.liabilityWaiver.typedSignature,
      },
      code_of_conduct: {
        version_id: input.documents.codeOfConduct.versionId,
        typed_signature: input.documents.codeOfConduct.typedSignature,
      },
      parent_handbook: {
        version_id: input.documents.parentHandbook.versionId,
        acknowledged: true,
      },
    },
  }
}

/** Every value the function can return in its `outcome` column. */
export const REGISTRATION_OUTCOMES = [
  "submitted",
  "replayed",
  "idempotency_conflict",
  "blocked_authority",
  "blocked_documents_unavailable",
  "blocked_document_version_stale",
  "blocked_attendance_unconfigured",
  "blocked_unavailable",
  "blocked_closed",
  "blocked_full",
  "blocked_duplicate",
] as const

export type RegistrationOutcome = (typeof REGISTRATION_OUTCOMES)[number]

/**
 * The STEP UP administrative review outcomes (DEC-028), in the database's
 * enum order. None is payment, a discount, confirmation, or enrollment;
 * `verified` hands the registration to the ordinary enrollment review.
 */
export const STEP_UP_STATES = [
  "pending_verification",
  "needs_information",
  "verified",
  "declined",
  "canceled",
] as const

export type StepUpState = (typeof STEP_UP_STATES)[number]

/**
 * An outcome this build does not recognise is `null`, which callers must treat
 * as a failure. Falling through to "submitted" on an unknown answer is how a
 * trust state gets invented.
 */
export function parseRegistrationOutcome(
  value: unknown,
): RegistrationOutcome | null {
  return typeof value === "string" &&
    (REGISTRATION_OUTCOMES as readonly string[]).includes(value)
    ? (value as RegistrationOutcome)
    : null
}

/** True only for the two outcomes that mean a submission exists. */
export function isRecorded(outcome: RegistrationOutcome): boolean {
  return outcome === "submitted" || outcome === "replayed"
}

export type RegistrationFailure =
  "invalid" | "forbidden" | "unavailable" | "failed"

/**
 * Fixed sentences only. Nothing a family typed, and no database message, is
 * ever interpolated, so no name, phone, health detail, signature, or STEP UP
 * reference can reach a log line or a rendered error through this path.
 */
export function describeRegistrationFailure(
  reason: RegistrationFailure,
): string {
  switch (reason) {
    case "invalid":
      return "Some registration details need attention before this can be submitted."
    case "forbidden":
      return "This registration could not be submitted from this account."
    case "unavailable":
      return "Registration is not available in this environment."
    case "failed":
      return "The registration could not be submitted. Nothing was recorded. Please try again."
  }
}
