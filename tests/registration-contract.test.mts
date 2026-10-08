import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  describeRegistrationFailure,
  isRecorded,
  parseRegistrationOutcome,
  registrationInputSchema,
  REGISTRATION_OUTCOMES,
  STEP_UP_STATES,
  toRegistrationPayload,
  type RegistrationInput,
} from "../src/lib/registration/contract.ts"

/**
 * The registration payload contract (Slice 2).
 *
 * `public.submit_family_registration` is the control and
 * `supabase/tests/database/160_family_registration_foundation.test.sql` proves
 * it. These tests pin the TypeScript side: the shape the later UI will send,
 * the refusals a parent is spared a round trip for, and the promise that no
 * error sentence ever carries what a family typed.
 */

const PROGRAM = "10000000-0000-4000-8000-000000000009"
const HAVEN_DAYS = "10000000-0000-4000-8000-000000000002"
const STUDENT = "40000000-0000-4000-8000-000000000001"

function valid(): RegistrationInput {
  return {
    authorityAffirmed: true,
    guardianContacts: [
      { fullName: "Sample Parent", phone: "555-0100", isSubmitter: true },
    ],
    emergencyContacts: [
      { fullName: "Sample Aunt", relationship: "Aunt", phone: "555-0101" },
    ],
    pickupPersons: [
      { fullName: "Sample Grandparent", relationship: "Grandparent" },
    ],
    children: [
      {
        studentId: STUDENT,
        hasAllergies: false,
        hasMedicalNeeds: false,
        hasAccommodationNeeds: false,
        photoVideoPermission: false,
        selections: [
          {
            programId: HAVEN_DAYS,
            attendanceDays: ["tuesday"],
            planDaysPerWeek: 1,
          },
        ],
      },
      {
        newStudent: { preferredName: "Sample Student New" },
        hasAllergies: true,
        allergyDetails: "Sample allergy detail",
        hasMedicalNeeds: true,
        medicalInformation: "Sample medical detail",
        hasAccommodationNeeds: false,
        photoVideoPermission: true,
        selections: [{ programId: PROGRAM }],
      },
    ],
    documents: {
      liabilityWaiver: {
        versionId: "d0000000-0000-4000-8000-000000000001",
        typedSignature: "Sample Parent",
      },
      codeOfConduct: {
        versionId: "d0000000-0000-4000-8000-000000000002",
        typedSignature: "Sample Parent",
      },
      parentHandbook: {
        versionId: "d0000000-0000-4000-8000-000000000003",
        acknowledged: true,
      },
    },
  }
}

describe("registrationInputSchema", () => {
  it("accepts a two-child registration", () => {
    assert.equal(registrationInputSchema.safeParse(valid()).success, true)
  })

  it("follows the explicit allergy Yes/No", () => {
    const yesWithout = valid()
    yesWithout.children[1] = {
      ...yesWithout.children[1],
      allergyDetails: undefined,
    }
    assert.equal(registrationInputSchema.safeParse(yesWithout).success, false)

    const noWith = valid()
    noWith.children[0] = {
      ...noWith.children[0],
      allergyDetails: "Sample detail",
    }
    assert.equal(registrationInputSchema.safeParse(noWith).success, false)

    const blankDetailsOnYes = valid()
    blankDetailsOnYes.children[1] = {
      ...blankDetailsOnYes.children[1],
      allergyDetails: "   ",
    }
    assert.equal(
      registrationInputSchema.safeParse(blankDetailsOnYes).success,
      false,
    )
  })

  it("requires explicit medical and accommodation answers", () => {
    for (const key of ["hasMedicalNeeds", "hasAccommodationNeeds"]) {
      const missing = valid() as unknown as {
        children: Record<string, unknown>[]
      }
      delete missing.children[0][key]
      assert.equal(
        registrationInputSchema.safeParse(missing).success,
        false,
        `${key} must be answered`,
      )
    }
  })

  it("follows the explicit medical and accommodation Yes/No", () => {
    const medicalYesWithout = valid()
    medicalYesWithout.children[1] = {
      ...medicalYesWithout.children[1],
      medicalInformation: undefined,
    }
    assert.equal(
      registrationInputSchema.safeParse(medicalYesWithout).success,
      false,
    )

    const accommodationNoWith = valid()
    accommodationNoWith.children[0] = {
      ...accommodationNoWith.children[0],
      accommodationInformation: "Sample detail",
    }
    assert.equal(
      registrationInputSchema.safeParse(accommodationNoWith).success,
      false,
    )

    const accommodationYesWith = valid()
    accommodationYesWith.children[0] = {
      ...accommodationYesWith.children[0],
      hasAccommodationNeeds: true,
      accommodationInformation: "Sample detail",
    }
    assert.equal(
      registrationInputSchema.safeParse(accommodationYesWith).success,
      true,
    )
  })

  it("requires at least one emergency contact and one pickup person", () => {
    const noEmergency = valid()
    noEmergency.emergencyContacts = []
    assert.equal(registrationInputSchema.safeParse(noEmergency).success, false)

    const noPickup = valid()
    noPickup.pickupPersons = []
    assert.equal(registrationInputSchema.safeParse(noPickup).success, false)

    const omitted = valid() as unknown as Record<string, unknown>
    delete omitted.pickupPersons
    assert.equal(registrationInputSchema.safeParse(omitted).success, false)
  })

  it("requires the parent or guardian phone", () => {
    const input = valid() as unknown as {
      guardianContacts: Record<string, unknown>[]
    }
    delete input.guardianContacts[0].phone
    assert.equal(registrationInputSchema.safeParse(input).success, false)
  })

  it("accepts a whole-number plan from one to seven days only", () => {
    for (const plan of [0, 8, 1.5]) {
      const input = valid()
      input.children[0] = {
        ...input.children[0],
        selections: [
          {
            programId: HAVEN_DAYS,
            attendanceDays: ["tuesday"],
            planDaysPerWeek: plan,
          },
        ],
      }
      assert.equal(
        registrationInputSchema.safeParse(input).success,
        false,
        `plan ${plan} must be refused`,
      )
    }
  })

  it("refuses a signature on the Parent Handbook", () => {
    const input = valid() as unknown as {
      documents: { parentHandbook: Record<string, unknown> }
    }
    input.documents.parentHandbook.typedSignature = "Sample Parent"
    assert.equal(registrationInputSchema.safeParse(input).success, false)
  })

  it("requires a signature on the waiver and the Code of Conduct", () => {
    const input = valid()
    input.documents.codeOfConduct = {
      ...input.documents.codeOfConduct,
      typedSignature: "  ",
    }
    assert.equal(registrationInputSchema.safeParse(input).success, false)
  })

  it("refuses smuggled family, role, state, and verification fields", () => {
    const withFamily = { ...valid(), familyId: STUDENT }
    assert.equal(registrationInputSchema.safeParse(withFamily).success, false)

    const withState = valid() as unknown as {
      children: Record<string, unknown>[]
    }
    withState.children[0].enrollmentState = "confirmed"
    assert.equal(registrationInputSchema.safeParse(withState).success, false)

    const withVerification = valid() as unknown as {
      children: Record<string, unknown>[]
    }
    withVerification.children[1].verificationState = "verified"
    assert.equal(
      registrationInputSchema.safeParse(withVerification).success,
      false,
    )
  })

  it("requires exactly one submitting guardian", () => {
    const none = valid()
    none.guardianContacts = [
      { ...none.guardianContacts[0], isSubmitter: false },
    ]
    assert.equal(registrationInputSchema.safeParse(none).success, false)

    const two = valid()
    two.guardianContacts = [two.guardianContacts[0], two.guardianContacts[0]]
    assert.equal(registrationInputSchema.safeParse(two).success, false)
  })

  it("refuses a child with both or neither of studentId and newStudent", () => {
    const both = valid() as unknown as { children: Record<string, unknown>[] }
    both.children[0].newStudent = { preferredName: "Sample" }
    assert.equal(registrationInputSchema.safeParse(both).success, false)

    const neither = valid() as unknown as {
      children: Record<string, unknown>[]
    }
    delete neither.children[0].studentId
    assert.equal(registrationInputSchema.safeParse(neither).success, false)
  })

  it("refuses a repeated program or day and a missing selection", () => {
    const repeatedProgram = valid()
    repeatedProgram.children[0] = {
      ...repeatedProgram.children[0],
      selections: [{ programId: PROGRAM }, { programId: PROGRAM }],
    }
    assert.equal(
      registrationInputSchema.safeParse(repeatedProgram).success,
      false,
    )

    const repeatedDay = valid()
    repeatedDay.children[0] = {
      ...repeatedDay.children[0],
      selections: [
        { programId: PROGRAM, attendanceDays: ["tuesday", "tuesday"] },
      ],
    }
    assert.equal(registrationInputSchema.safeParse(repeatedDay).success, false)

    const none = valid()
    none.children[0] = { ...none.children[0], selections: [] }
    assert.equal(registrationInputSchema.safeParse(none).success, false)
  })

  it("refuses any STEP UP key, selected or not (MPS DEC-033)", () => {
    for (const stepUp of [
      { selected: true },
      { selected: false },
      { selected: true, reference: "SAMPLE-REF" },
    ]) {
      const input = valid() as unknown as {
        children: Record<string, unknown>[]
      }
      input.children[1].stepUp = stepUp
      assert.equal(registrationInputSchema.safeParse(input).success, false)
    }
  })

  it("enforces the same limits the database enforces", () => {
    const tooMany = valid()
    tooMany.children = Array.from({ length: 11 }, () => valid().children[0])
    assert.equal(registrationInputSchema.safeParse(tooMany).success, false)

    const longHealth = valid()
    longHealth.children[1] = {
      ...longHealth.children[1],
      medicalInformation: "x".repeat(1001),
    }
    assert.equal(registrationInputSchema.safeParse(longHealth).success, false)
  })
})

describe("toRegistrationPayload", () => {
  it("maps to the snake_case contract and omits blank optional fields", () => {
    const parsed = registrationInputSchema.parse(valid())
    const payload = JSON.parse(JSON.stringify(toRegistrationPayload(parsed)))

    assert.deepEqual(Object.keys(payload).sort(), [
      "authority_affirmed",
      "children",
      "documents",
      "emergency_contacts",
      "guardian_contacts",
      "pickup_persons",
    ])
    assert.equal(payload.children[0].student_id, STUDENT)
    assert.equal(
      payload.children[1].new_student.preferred_name,
      "Sample Student New",
    )
    assert.equal("allergy_details" in payload.children[0], false)
    // DEC-033: no child ever carries a step_up key.
    for (const child of payload.children) {
      assert.equal("step_up" in child, false)
    }
    assert.equal(JSON.stringify(payload).includes("step_up"), false)
    assert.deepEqual(payload.children[0].selections[0].attendance_days, [
      "tuesday",
    ])
    assert.equal(payload.children[0].selections[0].plan_days_per_week, 1)
    assert.equal(
      "plan_days_per_week" in payload.children[1].selections[0],
      false,
    )
    assert.equal(payload.children[0].has_medical_needs, false)
    assert.equal(payload.children[0].has_accommodation_needs, false)
    assert.equal("medical_information" in payload.children[0], false)
    assert.equal(
      payload.children[1].medical_information,
      "Sample medical detail",
    )
    assert.deepEqual(payload.documents.parent_handbook, {
      version_id: "d0000000-0000-4000-8000-000000000003",
      acknowledged: true,
    })
    assert.equal("phone" in payload.pickup_persons[0], false)
  })

  it("never carries a family, role, or state key", () => {
    const text = JSON.stringify(
      toRegistrationPayload(registrationInputSchema.parse(valid())),
    )
    for (const key of [
      "family_id",
      "role",
      "state",
      "verification_state",
      "payment",
    ]) {
      assert.equal(text.includes(`"${key}"`), false, `${key} must not be sent`)
    }
  })

  it("is stable across retries of the same input", () => {
    const a = JSON.stringify(
      toRegistrationPayload(registrationInputSchema.parse(valid())),
    )
    const b = JSON.stringify(
      toRegistrationPayload(registrationInputSchema.parse(valid())),
    )
    assert.equal(a, b)
  })
})

describe("registration outcomes", () => {
  it("recognises every outcome the database returns and nothing else", () => {
    for (const outcome of REGISTRATION_OUTCOMES) {
      assert.equal(parseRegistrationOutcome(outcome), outcome)
    }
    for (const unknown of ["confirmed", "paid", "", null, undefined, 1]) {
      assert.equal(parseRegistrationOutcome(unknown), null)
    }
  })

  it("recognises the unconfigured-attendance blocker", () => {
    assert.equal(
      parseRegistrationOutcome("blocked_attendance_unconfigured"),
      "blocked_attendance_unconfigured",
    )
    assert.equal(isRecorded("blocked_attendance_unconfigured"), false)
  })

  it("lists exactly the five STEP UP review outcomes, none of them payment", () => {
    assert.deepEqual(
      [...STEP_UP_STATES],
      [
        "pending_verification",
        "needs_information",
        "verified",
        "declined",
        "canceled",
      ],
    )
    for (const forbidden of ["paid", "confirmed", "enrolled"]) {
      assert.equal(
        (STEP_UP_STATES as readonly string[]).includes(forbidden),
        false,
      )
    }
  })

  it("treats only submitted and replayed as recorded", () => {
    const recorded = REGISTRATION_OUTCOMES.filter(isRecorded)
    assert.deepEqual(recorded, ["submitted", "replayed"])
  })

  it("does not claim nothing was recorded when the result is unknown", () => {
    const sentence = describeRegistrationFailure("failed")
    assert.equal(/nothing was recorded/i.test(sentence), false)
    assert.match(sentence, /could not confirm/i)
  })

  it("never puts submitted values into a failure sentence", () => {
    const sentences = (
      ["invalid", "forbidden", "unavailable", "failed"] as const
    ).map(describeRegistrationFailure)
    for (const sentence of sentences) {
      for (const value of ["Sample", "555", "allergy", "SAMPLE-REF"]) {
        assert.equal(sentence.includes(value), false)
      }
    }
  })
})
