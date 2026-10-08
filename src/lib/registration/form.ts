/**
 * The family registration form, as data (Slice 3, prompts/family-registration-ui.md;
 * MDS DESIGN-SYSTEM §9.1).
 *
 * Pure and client-safe. It holds the in-memory draft a parent is filling in,
 * the per-step checks that spare them a round trip, the mapping from that draft
 * to the registration contract, and the mapping from a database refusal back to
 * the field it names. It is unit-tested directly (`tests/registration-form.test.mts`).
 *
 * THESE CHECKS ARE NOT THE CONTROL
 *
 * `public.submit_family_registration` validates everything again, on the
 * server, against the stored attendance rules and the presented document
 * versions. What is here mirrors those rules so a parent hears about a missing
 * phone number on step 1 rather than on step 8. When the two ever disagree, the
 * database wins, and its answer is shown on the field it names. Nothing here
 * repairs a selection the database refused.
 *
 * WHAT NEVER LEAVES THE FORM
 *
 * Health details behind a No are kept in memory, so an accidental toggle loses
 * nothing, and are never put into the payload. There is no STEP UP field at all
 * (MPS DEC-033). No value typed here is ever put into an error message: errors
 * name the field and its position, never its contents.
 */

import {
  ATTENDANCE_DAYS,
  REGISTRATION_LIMITS,
  type AttendanceDay,
  type RegistrationInput,
} from "./contract.ts"

import type { OfferingType } from "@/lib/programs/offering-groups"
import type { Enums } from "@/lib/supabase/types"

export type DocumentKind = Enums<"registration_document_kind">
export type AvailabilityState = Enums<"availability_state">

// ---------------------------------------------------------------------------
// Catalog: what the server read, under the parent's own RLS
// ---------------------------------------------------------------------------

/** A program's structured attendance rule (DEC-032), or `null` when none exists. */
export type ProgramAttendance =
  | { mode: "fixed"; days: AttendanceDay[] }
  | { mode: "family_selects"; days: AttendanceDay[]; plans: number[] }
  | null

export type CatalogProgram = {
  id: string
  slug: string
  name: string
  offeringType: OfferingType | null
  publishedSchedule: string | null
  availability: AvailabilityState
  attendance: ProgramAttendance
}

/**
 * The version of a registration document the database presents right now: the
 * approved one when it exists, otherwise the draft. No wording travels with it,
 * because none is approved (GAP-014).
 */
export type CatalogDocument = {
  id: string
  kind: DocumentKind
  title: string
  versionLabel: string
  status: "approved" | "draft"
}

export type RegistrationCatalog = {
  programs: CatalogProgram[]
  documents: Record<DocumentKind, CatalogDocument | null>
}

export type StudentOption = { id: string; preferredName: string }

export const DOCUMENT_KINDS = [
  "liability_waiver",
  "code_of_conduct",
  "parent_handbook",
] as const satisfies readonly DocumentKind[]

export const DOCUMENT_NAMES: Record<DocumentKind, string> = {
  liability_waiver: "Liability Waiver",
  code_of_conduct: "Code of Conduct",
  parent_handbook: "Parent Handbook",
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/** Blank means unanswered. It is never read as No (DEC-026). */
export type YesNo = "" | "yes" | "no"

export type GuardianDraft = {
  key: number
  fullName: string
  phone: string
  email: string
  relationship: string
}

export type PersonDraft = {
  key: number
  fullName: string
  relationship: string
  phone: string
}

export type SelectionDraft = {
  programId: string
  /** "" until a plan is chosen; only programs with plans use it. */
  plan: string
  days: AttendanceDay[]
}

export type ChildDraft = {
  /** A local counter. Never derived from anything the parent typed. */
  key: number
  source: "" | "existing" | "new"
  studentId: string
  preferredName: string
  gradeLevel: string
  relationship: string
  allergies: YesNo
  allergyDetails: string
  medical: YesNo
  medicalDetails: string
  accommodation: YesNo
  accommodationDetails: string
  media: YesNo
  selections: SelectionDraft[]
}

export type RegistrationDraft = {
  guardians: GuardianDraft[]
  emergencies: PersonDraft[]
  pickups: PersonDraft[]
  children: ChildDraft[]
  waiverSignature: string
  conductSignature: string
  handbookAcknowledged: boolean
  authorityAffirmed: boolean
}

export const LIMITS = {
  guardians: REGISTRATION_LIMITS.guardianContacts,
  emergencies: REGISTRATION_LIMITS.emergencyContacts,
  pickups: REGISTRATION_LIMITS.pickupPersons,
  children: REGISTRATION_LIMITS.children,
  selections: REGISTRATION_LIMITS.selectionsPerChild,
  name: REGISTRATION_LIMITS.name,
  studentName: REGISTRATION_LIMITS.studentName,
  shortText: REGISTRATION_LIMITS.shortText,
  phone: REGISTRATION_LIMITS.phone,
  email: REGISTRATION_LIMITS.email,
  healthText: REGISTRATION_LIMITS.healthText,
  signature: REGISTRATION_LIMITS.signature,
} as const

export function emptyGuardian(key: number): GuardianDraft {
  return { key, fullName: "", phone: "", email: "", relationship: "" }
}

export function emptyPerson(key: number): PersonDraft {
  return { key, fullName: "", relationship: "", phone: "" }
}

export function emptyChild(key: number, hasStudents: boolean): ChildDraft {
  return {
    key,
    /* With no existing profiles there is only one answer, so it is not asked. */
    source: hasStudents ? "" : "new",
    studentId: "",
    preferredName: "",
    gradeLevel: "",
    relationship: "",
    allergies: "",
    allergyDetails: "",
    medical: "",
    medicalDetails: "",
    accommodation: "",
    accommodationDetails: "",
    media: "",
    selections: [],
  }
}

export function emptySelection(programId: string): SelectionDraft {
  return { programId, plan: "", days: [] }
}

/**
 * The starting draft. It has one guardian, one emergency contact, and one pickup
 * person, because each is required. It has no child: the children step starts
 * in the MDS empty state, with "Add a child" as its one action.
 */
export function initialDraft(defaults: {
  guardianName: string
  guardianEmail: string
}): RegistrationDraft {
  return {
    guardians: [
      {
        ...emptyGuardian(1),
        fullName: defaults.guardianName.slice(0, LIMITS.name),
        email: defaults.guardianEmail.slice(0, LIMITS.email),
      },
    ],
    emergencies: [emptyPerson(1)],
    pickups: [emptyPerson(1)],
    children: [],
    waiverSignature: "",
    conductSignature: "",
    handbookAcknowledged: false,
    authorityAffirmed: false,
  }
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export const STEPS = [
  "Parent or guardian",
  "Emergency contacts",
  "Approved pickup",
  "Children",
  "Programs and attendance",
  "Checkout",
  "Documents and permissions",
  "Review and submit",
] as const

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const STEP_COUNT = STEPS.length

export function stepName(step: StepNumber): string {
  return STEPS[step - 1]
}

// ---------------------------------------------------------------------------
// Field ids. Positional keys only, so no id carries anything a parent typed.
// ---------------------------------------------------------------------------

export const fieldId = {
  guardian: (key: number, field: keyof Omit<GuardianDraft, "key">) =>
    `reg-guardian-${key}-${field}`,
  emergency: (key: number, field: keyof Omit<PersonDraft, "key">) =>
    `reg-emergency-${key}-${field}`,
  pickup: (key: number, field: keyof Omit<PersonDraft, "key">) =>
    `reg-pickup-${key}-${field}`,
  child: (
    key: number,
    field:
      | "who"
      | "preferredName"
      | "gradeLevel"
      | "relationship"
      | "allergies"
      | "allergyDetails"
      | "medical"
      | "medicalDetails"
      | "accommodation"
      | "accommodationDetails"
      | "programs"
      | "media",
  ) => `reg-child-${key}-${field}`,
  plan: (childKey: number, programId: string) =>
    `reg-child-${childKey}-program-${programId}-plan`,
  days: (childKey: number, programId: string) =>
    `reg-child-${childKey}-program-${programId}-days`,
  addChild: "reg-children-add",
  documents: "reg-documents",
  waiverSignature: "reg-waiver-signature",
  conductSignature: "reg-conduct-signature",
  handbook: "reg-handbook-acknowledgment",
  authority: "reg-authority",
  review: "reg-review",
} as const

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type FormError = {
  /** The DOM id of the control to focus. */
  id: string
  step: StepNumber
  message: string
  /** Set when the field lives inside a child card that may be collapsed. */
  childKey?: number
}

const PHONE = /^[0-9+(). -]+$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function blank(value: string): boolean {
  return value.trim().length === 0
}

function phoneProblem(value: string, required: boolean): string | null {
  const v = value.trim()
  if (!v) return required ? "enter a phone number" : null
  if (v.length < 7 || v.length > LIMITS.phone || !PHONE.test(v)) {
    return "enter a phone number using digits, spaces, and ( ) + . -"
  }
  return null
}

function tooLong(value: string, max: number): boolean {
  return value.trim().length > max
}

/** "New child" until a name is known, as the child card heading reads. */
export function childHeading(
  child: ChildDraft,
  students: StudentOption[],
): string {
  if (child.source === "existing") {
    const student = students.find((s) => s.id === child.studentId)
    if (student) return student.preferredName
  }
  if (child.source === "new" && !blank(child.preferredName)) {
    return child.preferredName.trim()
  }
  return "New child"
}

/** A label that tells two unnamed children apart in an error sentence. */
export function childLabel(
  child: ChildDraft,
  index: number,
  students: StudentOption[],
): string {
  const heading = childHeading(child, students)
  return heading === "New child" ? `Child ${index + 1}` : heading
}

export function formatDays(days: readonly AttendanceDay[]): string {
  const names = [...days]
    .sort((a, b) => ATTENDANCE_DAYS.indexOf(a) - ATTENDANCE_DAYS.indexOf(b))
    .map((day) => day[0].toUpperCase() + day.slice(1))
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function validateGuardians(draft: RegistrationDraft): FormError[] {
  const errors: FormError[] = []
  draft.guardians.forEach((g, i) => {
    const who = i === 0 ? "Your details" : `Parent or guardian ${i + 1}`
    if (blank(g.fullName)) {
      errors.push({
        id: fieldId.guardian(g.key, "fullName"),
        step: 1,
        message: `${who}: enter a full name.`,
      })
    } else if (tooLong(g.fullName, LIMITS.name)) {
      errors.push({
        id: fieldId.guardian(g.key, "fullName"),
        step: 1,
        message: `${who}: the name is too long.`,
      })
    }
    const phone = phoneProblem(g.phone, true)
    if (phone) {
      errors.push({
        id: fieldId.guardian(g.key, "phone"),
        step: 1,
        message: `${who}: ${phone}.`,
      })
    }
    const email = g.email.trim()
    if (email && (email.length > LIMITS.email || !EMAIL.test(email))) {
      errors.push({
        id: fieldId.guardian(g.key, "email"),
        step: 1,
        message: `${who}: enter an email address like name@example.com, or leave it blank.`,
      })
    }
    if (tooLong(g.relationship, LIMITS.shortText)) {
      errors.push({
        id: fieldId.guardian(g.key, "relationship"),
        step: 1,
        message: `${who}: the relationship is too long.`,
      })
    }
  })
  return errors
}

function validatePeople(
  people: PersonDraft[],
  kind: "emergency" | "pickup",
): FormError[] {
  const errors: FormError[] = []
  const step: StepNumber = kind === "emergency" ? 2 : 3
  const noun = kind === "emergency" ? "Emergency contact" : "Pickup person"
  const id = kind === "emergency" ? fieldId.emergency : fieldId.pickup
  people.forEach((p, i) => {
    const who = `${noun} ${i + 1}`
    if (blank(p.fullName)) {
      errors.push({
        id: id(p.key, "fullName"),
        step,
        message: `${who}: enter a full name.`,
      })
    } else if (tooLong(p.fullName, LIMITS.name)) {
      errors.push({
        id: id(p.key, "fullName"),
        step,
        message: `${who}: the name is too long.`,
      })
    }
    if (blank(p.relationship)) {
      errors.push({
        id: id(p.key, "relationship"),
        step,
        message: `${who}: enter their relationship to your child.`,
      })
    } else if (tooLong(p.relationship, LIMITS.shortText)) {
      errors.push({
        id: id(p.key, "relationship"),
        step,
        message: `${who}: the relationship is too long.`,
      })
    }
    // An emergency contact must be reachable; a pickup phone is optional.
    const phone = phoneProblem(p.phone, kind === "emergency")
    if (phone) {
      errors.push({
        id: id(p.key, "phone"),
        step,
        message: `${who}: ${phone}.`,
      })
    }
  })
  return errors
}

const HEALTH = [
  {
    answer: "allergies",
    details: "allergyDetails",
    question: "the allergy question",
    detailName: "allergy details",
  },
  {
    answer: "medical",
    details: "medicalDetails",
    question: "the medical needs question",
    detailName: "medical details",
  },
  {
    answer: "accommodation",
    details: "accommodationDetails",
    question: "the accommodation question",
    detailName: "accommodation details",
  },
] as const

function validateChildren(
  draft: RegistrationDraft,
  students: StudentOption[],
): FormError[] {
  const errors: FormError[] = []
  if (draft.children.length === 0) {
    errors.push({
      id: fieldId.addChild,
      step: 4,
      message: "Add at least one child to register.",
    })
    return errors
  }
  const seen = new Set<string>()
  draft.children.forEach((child, index) => {
    const who = childLabel(child, index, students)
    const base = { step: 4 as const, childKey: child.key }
    if (child.source === "") {
      errors.push({
        ...base,
        id: fieldId.child(child.key, "who"),
        message: `${who}: choose which child this is.`,
      })
    } else if (child.source === "existing") {
      if (!students.some((s) => s.id === child.studentId)) {
        errors.push({
          ...base,
          id: fieldId.child(child.key, "who"),
          message: `${who}: choose which child this is.`,
        })
      } else if (seen.has(child.studentId)) {
        errors.push({
          ...base,
          id: fieldId.child(child.key, "who"),
          message: `${who} is already in this registration. Remove one of the two cards.`,
        })
      } else {
        seen.add(child.studentId)
      }
    } else {
      if (blank(child.preferredName)) {
        errors.push({
          ...base,
          id: fieldId.child(child.key, "preferredName"),
          message: `${who}: enter the name your child goes by.`,
        })
      } else if (tooLong(child.preferredName, LIMITS.studentName)) {
        errors.push({
          ...base,
          id: fieldId.child(child.key, "preferredName"),
          message: `${who}: the name is too long.`,
        })
      }
      for (const field of ["gradeLevel", "relationship"] as const) {
        if (tooLong(child[field], LIMITS.shortText)) {
          errors.push({
            ...base,
            id: fieldId.child(child.key, field),
            message: `${who}: the ${field === "gradeLevel" ? "grade" : "relationship"} is too long.`,
          })
        }
      }
    }
    for (const h of HEALTH) {
      const answer = child[h.answer]
      if (answer === "") {
        errors.push({
          ...base,
          id: fieldId.child(child.key, h.answer),
          message: `${who}: answer ${h.question} with Yes or No.`,
        })
      } else if (answer === "yes") {
        if (blank(child[h.details])) {
          errors.push({
            ...base,
            id: fieldId.child(child.key, h.details),
            message: `${who}: describe the ${h.detailName}, or answer No.`,
          })
        } else if (tooLong(child[h.details], LIMITS.healthText)) {
          errors.push({
            ...base,
            id: fieldId.child(child.key, h.details),
            message: `${who}: the ${h.detailName} are too long (${LIMITS.healthText} characters at most).`,
          })
        }
      }
    }
  })
  return errors
}

/** What a selection asks of the family, from the program's stored rule. */
export type AttendanceRequirement =
  | { kind: "fixed"; days: AttendanceDay[] }
  | { kind: "plan"; days: AttendanceDay[]; plans: number[] }
  | { kind: "choose"; days: AttendanceDay[] }
  | { kind: "unconfigured" }

export function attendanceRequirement(
  program: CatalogProgram,
): AttendanceRequirement {
  const rule = program.attendance
  if (!rule || rule.days.length === 0) return { kind: "unconfigured" }
  if (rule.mode === "fixed") return { kind: "fixed", days: rule.days }
  if (rule.plans.length > 0) {
    return { kind: "plan", days: rule.days, plans: rule.plans }
  }
  return { kind: "choose", days: rule.days }
}

/**
 * Whether a program can be chosen in this form. A program with no attendance
 * rule, or one that is closed, is shown but cannot be chosen: the database
 * would refuse it, and a checkbox that only leads to a refusal is a dead end.
 */
export function selectability(
  program: CatalogProgram,
): "selectable" | "unconfigured" | "closed" {
  if (attendanceRequirement(program).kind === "unconfigured") {
    return "unconfigured"
  }
  if (program.availability === "closed") return "closed"
  return "selectable"
}

function validateSelections(
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
  students: StudentOption[],
): FormError[] {
  const errors: FormError[] = []
  draft.children.forEach((child, index) => {
    const who = childLabel(child, index, students)
    const base = { step: 5 as const, childKey: child.key }
    if (child.selections.length === 0) {
      errors.push({
        ...base,
        id: fieldId.child(child.key, "programs"),
        message: `${who}: choose at least one program.`,
      })
      return
    }
    if (child.selections.length > LIMITS.selections) {
      errors.push({
        ...base,
        id: fieldId.child(child.key, "programs"),
        message: `${who}: choose ${LIMITS.selections} programs at most.`,
      })
    }
    for (const selection of child.selections) {
      const program = catalog.programs.find((p) => p.id === selection.programId)
      if (!program || selectability(program) !== "selectable") {
        errors.push({
          ...base,
          id: fieldId.child(child.key, "programs"),
          message: `${who}: ${program ? program.name : "a chosen program"} cannot be registered online right now. Remove it to continue.`,
        })
        continue
      }
      const need = attendanceRequirement(program)
      const unique = new Set(selection.days)
      const allowed =
        need.kind === "plan" || need.kind === "choose" ? need.days : []
      const outside = selection.days.some((d) => !allowed.includes(d))
      if (need.kind === "plan") {
        const plan = Number(selection.plan)
        if (!need.plans.includes(plan)) {
          errors.push({
            ...base,
            id: fieldId.plan(child.key, program.id),
            message: `${who}, ${program.name}: choose how many days a week.`,
          })
        } else if (
          unique.size !== plan ||
          selection.days.length !== plan ||
          outside
        ) {
          errors.push({
            ...base,
            id: fieldId.days(child.key, program.id),
            message: `${who}, ${program.name}: choose exactly ${plan} ${plan === 1 ? "day" : "days"}.`,
          })
        }
      } else if (need.kind === "choose") {
        if (unique.size === 0 || outside) {
          errors.push({
            ...base,
            id: fieldId.days(child.key, program.id),
            message: `${who}, ${program.name}: choose at least one day.`,
          })
        }
      }
    }
  })
  return errors
}

/** True when every document kind has a version the database will accept. */
export function documentsAvailable(catalog: RegistrationCatalog): boolean {
  return DOCUMENT_KINDS.every((kind) => catalog.documents[kind] !== null)
}

function validateDocuments(
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
  students: StudentOption[],
): FormError[] {
  const errors: FormError[] = []
  if (!documentsAvailable(catalog)) {
    errors.push({
      id: fieldId.documents,
      step: 7,
      message:
        "A required registration document is not available yet, so this registration cannot be submitted.",
    })
  }
  if (blank(draft.waiverSignature)) {
    errors.push({
      id: fieldId.waiverSignature,
      step: 7,
      message: "Liability Waiver: type your full name to sign.",
    })
  } else if (tooLong(draft.waiverSignature, LIMITS.signature)) {
    errors.push({
      id: fieldId.waiverSignature,
      step: 7,
      message: "Liability Waiver: the signature is too long.",
    })
  }
  if (blank(draft.conductSignature)) {
    errors.push({
      id: fieldId.conductSignature,
      step: 7,
      message: "Code of Conduct: type your full name to sign.",
    })
  } else if (tooLong(draft.conductSignature, LIMITS.signature)) {
    errors.push({
      id: fieldId.conductSignature,
      step: 7,
      message: "Code of Conduct: the signature is too long.",
    })
  }
  if (!draft.handbookAcknowledged) {
    errors.push({
      id: fieldId.handbook,
      step: 7,
      message: "Parent Handbook: confirm that you have read it.",
    })
  }
  draft.children.forEach((child, index) => {
    if (child.media === "") {
      errors.push({
        id: fieldId.child(child.key, "media"),
        step: 7,
        message: `${childLabel(child, index, students)}: answer the photo and video permission question.`,
      })
    }
  })
  if (!draft.authorityAffirmed) {
    errors.push({
      id: fieldId.authority,
      step: 7,
      message:
        "Confirm that you are the parent or legal guardian of each child in this registration.",
    })
  }
  return errors
}

/**
 * Every problem on one step, in the order the fields appear. Steps 6 and 8 hold
 * no input of their own.
 */
export function validateStep(
  step: StepNumber,
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
  students: StudentOption[],
): FormError[] {
  switch (step) {
    case 1:
      return validateGuardians(draft)
    case 2:
      return validatePeople(draft.emergencies, "emergency")
    case 3:
      return validatePeople(draft.pickups, "pickup")
    case 4:
      return validateChildren(draft, students)
    case 5:
      return validateSelections(draft, catalog, students)
    case 7:
      return validateDocuments(draft, catalog, students)
    default:
      return []
  }
}

export function validateAll(
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
  students: StudentOption[],
): FormError[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const).flatMap((step) =>
    validateStep(step, draft, catalog, students),
  )
}

/** Whether removing this child would lose something the parent entered. */
export function childHasEntries(child: ChildDraft): boolean {
  return (
    child.studentId !== "" ||
    !blank(child.preferredName) ||
    !blank(child.gradeLevel) ||
    !blank(child.relationship) ||
    child.allergies !== "" ||
    child.medical !== "" ||
    child.accommodation !== "" ||
    !blank(child.allergyDetails) ||
    !blank(child.medicalDetails) ||
    !blank(child.accommodationDetails) ||
    child.media !== "" ||
    child.selections.length > 0
  )
}

// ---------------------------------------------------------------------------
// Draft → contract
// ---------------------------------------------------------------------------

function sortedDays(days: readonly AttendanceDay[]): AttendanceDay[] {
  return [...new Set(days)].sort(
    (a, b) => ATTENDANCE_DAYS.indexOf(a) - ATTENDANCE_DAYS.indexOf(b),
  )
}

function optional(value: string): string | undefined {
  const v = value.trim()
  return v ? v : undefined
}

/**
 * The contract input for this draft.
 *
 * Deterministic: the same draft always produces the same JSON, so a retry of an
 * unchanged form hashes to the same fingerprint and replays instead of
 * conflicting. Details behind a No are left out. Selections follow the order
 * the parent chose them in, which is the order a database error's
 * `selections[j]` refers to. There is no STEP UP key.
 */
export function draftToInput(
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
): RegistrationInput {
  const version = (kind: DocumentKind) => catalog.documents[kind]?.id ?? ""

  return {
    authorityAffirmed: draft.authorityAffirmed,
    guardianContacts: draft.guardians.map((g, i) => ({
      fullName: g.fullName.trim(),
      phone: g.phone.trim(),
      email: optional(g.email),
      relationship: optional(g.relationship),
      isSubmitter: i === 0,
    })),
    emergencyContacts: draft.emergencies.map((p) => ({
      fullName: p.fullName.trim(),
      relationship: p.relationship.trim(),
      phone: p.phone.trim(),
    })),
    pickupPersons: draft.pickups.map((p) => ({
      fullName: p.fullName.trim(),
      relationship: p.relationship.trim(),
      phone: optional(p.phone),
    })),
    children: draft.children.map((child) => {
      const health = {
        hasAllergies: child.allergies === "yes",
        allergyDetails:
          child.allergies === "yes"
            ? optional(child.allergyDetails)
            : undefined,
        hasMedicalNeeds: child.medical === "yes",
        medicalInformation:
          child.medical === "yes" ? optional(child.medicalDetails) : undefined,
        hasAccommodationNeeds: child.accommodation === "yes",
        accommodationInformation:
          child.accommodation === "yes"
            ? optional(child.accommodationDetails)
            : undefined,
        photoVideoPermission: child.media === "yes",
      }
      const selections = child.selections.map((s) => {
        const program = catalog.programs.find((p) => p.id === s.programId)
        const need = program
          ? attendanceRequirement(program)
          : ({ kind: "unconfigured" } as const)
        return {
          programId: s.programId,
          attendanceDays:
            need.kind === "plan" || need.kind === "choose"
              ? sortedDays(s.days)
              : [],
          planDaysPerWeek:
            need.kind === "plan" && s.plan ? Number(s.plan) : undefined,
        }
      })
      return child.source === "existing"
        ? { studentId: child.studentId, ...health, selections }
        : {
            newStudent: {
              preferredName: child.preferredName.trim(),
              gradeLevel: optional(child.gradeLevel),
              guardianRelationship: optional(child.relationship),
            },
            ...health,
            selections,
          }
    }),
    documents: {
      liabilityWaiver: {
        versionId: version("liability_waiver"),
        typedSignature: draft.waiverSignature.trim(),
      },
      codeOfConduct: {
        versionId: version("code_of_conduct"),
        typedSignature: draft.conductSignature.trim(),
      },
      parentHandbook: {
        versionId: version("parent_handbook"),
        acknowledged: true,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Database refusal → field
// ---------------------------------------------------------------------------

/**
 * Only payload paths the contract can produce: keys and indexes, never values.
 * The server action applies the same grammar before it passes a path on.
 */
export const SERVER_PATH =
  /^[a-z_]+(?:\[\d{1,2}\])?(?:\.[a-z_]+(?:\[\d{1,2}\])?)*$/

const GUARDIAN_FIELD = {
  full_name: "fullName",
  phone: "phone",
  email: "email",
  relationship: "relationship",
} as const

const PERSON_FIELD = {
  full_name: "fullName",
  relationship: "relationship",
  phone: "phone",
} as const

const CHILD_FIELD = {
  student_id: ["who", 4],
  new_student: ["preferredName", 4],
  has_allergies: ["allergies", 4],
  allergy_details: ["allergyDetails", 4],
  has_medical_needs: ["medical", 4],
  medical_information: ["medicalDetails", 4],
  has_accommodation_needs: ["accommodation", 4],
  accommodation_information: ["accommodationDetails", 4],
  photo_video_permission: ["media", 7],
  selections: ["programs", 5],
} as const

const SERVER_REFUSED =
  "Home School Haven could not accept this answer. Check it and try again."

/**
 * Where a database refusal belongs in the form.
 *
 * `path` is the part of a `22023` message that names a payload position, for
 * example `children[1].selections[0].attendance_days`. The message is always
 * our own fixed sentence, so nothing the database said is shown to the parent.
 * A path this form cannot place lands on the review step, which is where the
 * parent pressed Submit.
 */
export function errorForServerPath(
  path: string | null,
  draft: RegistrationDraft,
  catalog: RegistrationCatalog,
  students: StudentOption[],
): FormError {
  const fallback: FormError = {
    id: fieldId.review,
    step: 8,
    message:
      "Home School Haven could not accept part of this registration. Check each section and try again.",
  }
  if (!path || !SERVER_PATH.test(path)) return fallback

  const parts = path.split(".")
  const head = /^([a-z_]+)(?:\[(\d+)\])?$/.exec(parts[0])
  if (!head) return fallback
  const [, list, rawIndex] = head
  const index = rawIndex === undefined ? -1 : Number(rawIndex)
  const leaf = parts[1] ?? ""

  if (list === "guardian_contacts") {
    const g = draft.guardians[index]
    const field = GUARDIAN_FIELD[leaf as keyof typeof GUARDIAN_FIELD]
    if (!g || !field)
      return {
        ...fallback,
        id: fieldId.guardian(draft.guardians[0].key, "fullName"),
        step: 1,
      }
    return {
      id: fieldId.guardian(g.key, field),
      step: 1,
      message: SERVER_REFUSED,
    }
  }

  if (list === "emergency_contacts" || list === "pickup_persons") {
    const emergency = list === "emergency_contacts"
    const people = emergency ? draft.emergencies : draft.pickups
    const p = people[index]
    const field = PERSON_FIELD[leaf as keyof typeof PERSON_FIELD]
    if (!p || !field) return fallback
    return {
      id: emergency
        ? fieldId.emergency(p.key, field)
        : fieldId.pickup(p.key, field),
      step: emergency ? 2 : 3,
      message: SERVER_REFUSED,
    }
  }

  if (list === "children") {
    const child = draft.children[index]
    if (!child) return fallback
    const who = childLabel(child, index, students)
    const sel = /^selections\[(\d+)\]$/.exec(leaf)
    if (sel) {
      const selection = child.selections[Number(sel[1])]
      const program = catalog.programs.find(
        (p) => p.id === selection?.programId,
      )
      if (!selection || !program) {
        return {
          id: fieldId.child(child.key, "programs"),
          step: 5,
          childKey: child.key,
          message: `${who}: Home School Haven could not accept these program choices. Check them and try again.`,
        }
      }
      const onPlan = parts[2] === "plan_days_per_week"
      return {
        id: onPlan
          ? fieldId.plan(child.key, program.id)
          : fieldId.days(child.key, program.id),
        step: 5,
        childKey: child.key,
        message: `${who}, ${program.name}: Home School Haven could not accept these days. Check the days this program allows and try again.`,
      }
    }
    const mapped =
      CHILD_FIELD[leaf.replace(/\[\d+\]$/, "") as keyof typeof CHILD_FIELD]
    if (!mapped) {
      return {
        id: fieldId.child(
          child.key,
          child.source === "new" ? "preferredName" : "who",
        ),
        step: 4,
        childKey: child.key,
        message: `${who}: Home School Haven could not accept this child's details. Check them and try again.`,
      }
    }
    const [field, step] = mapped
    return {
      id: fieldId.child(child.key, field),
      step,
      childKey: child.key,
      message: `${who}: ${SERVER_REFUSED}`,
    }
  }

  if (list === "documents") {
    if (leaf.startsWith("liability_waiver")) {
      return {
        id: fieldId.waiverSignature,
        step: 7,
        message: `Liability Waiver: ${SERVER_REFUSED}`,
      }
    }
    if (leaf.startsWith("code_of_conduct")) {
      return {
        id: fieldId.conductSignature,
        step: 7,
        message: `Code of Conduct: ${SERVER_REFUSED}`,
      }
    }
    if (leaf.startsWith("parent_handbook")) {
      return {
        id: fieldId.handbook,
        step: 7,
        message: `Parent Handbook: ${SERVER_REFUSED}`,
      }
    }
  }

  return fallback
}

/**
 * Orders the recorded result the way the parent entered it: children in card
 * order, and each child's programs in the order they were chosen.
 *
 * Every row of one submission is written in one transaction and shares its
 * timestamps, so the database cannot supply this order. A child is matched by
 * profile id, or, for a new child, by preferred name without regard to case,
 * which is the same key `submit_family_registration` uses to find or create
 * the profile. Anything unmatched keeps its place after the matched ones.
 */
export function orderResults<
  T extends {
    studentId: string
    studentName: string
    selections: { programId: string }[]
  },
>(results: T[], draft: RegistrationDraft): T[] {
  const rank = (result: T) => {
    const index = draft.children.findIndex((child) =>
      child.source === "existing"
        ? child.studentId === result.studentId
        : child.preferredName.trim().toLowerCase() ===
          result.studentName.trim().toLowerCase(),
    )
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }
  return [...results]
    .sort((a, b) => rank(a) - rank(b))
    .map((result) => {
      const child = draft.children[rank(result)]
      if (!child) return result
      const order = (id: string) => {
        const i = child.selections.findIndex((s) => s.programId === id)
        return i < 0 ? Number.MAX_SAFE_INTEGER : i
      }
      return {
        ...result,
        selections: [...result.selections].sort(
          (a, b) => order(a.programId) - order(b.programId),
        ),
      }
    })
}
