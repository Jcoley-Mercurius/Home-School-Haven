import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  registrationInputSchema,
  toRegistrationPayload,
} from "../src/lib/registration/contract.ts"
import {
  attendanceRequirement,
  childHasEntries,
  childHeading,
  draftToInput,
  emptyChild,
  emptySelection,
  errorForServerPath,
  fieldId,
  initialDraft,
  orderResults,
  selectability,
  SERVER_PATH,
  validateAll,
  validateStep,
  type CatalogProgram,
  type ChildDraft,
  type RegistrationCatalog,
  type RegistrationDraft,
  type StudentOption,
} from "../src/lib/registration/form.ts"

/**
 * The registration form's own logic (Slice 3, prompts/family-registration-ui.md).
 *
 * The database is the control, and pgTAP proves it. These tests pin what the
 * form adds in front of it: that a blank answer is never a No, that hidden
 * details never leave the page, that the payload the form builds is one the
 * contract accepts and carries no STEP UP key, and that a database refusal
 * lands on the field it names.
 */

const HAVEN_DAYS = "10000000-0000-4000-8000-000000000002"
const SEWING = "10000000-0000-4000-8000-000000000005"
const TUTORING = "10000000-0000-4000-8000-00000000000c"
const UNCONFIGURED = "10000000-0000-4000-8000-0000000000ff"
const CLOSED = "10000000-0000-4000-8000-0000000000aa"
const STUDENT = "40000000-0000-4000-8000-000000000002"

function program(
  id: string,
  name: string,
  attendance: CatalogProgram["attendance"],
  availability: CatalogProgram["availability"] = "unknown",
): CatalogProgram {
  return {
    id,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    offeringType: null,
    publishedSchedule: null,
    availability,
    attendance,
  }
}

const CATALOG: RegistrationCatalog = {
  programs: [
    program(HAVEN_DAYS, "Haven Days", {
      mode: "family_selects",
      days: ["tuesday", "wednesday", "thursday"],
      plans: [1, 2, 3],
    }),
    program(SEWING, "Sewing", { mode: "fixed", days: ["wednesday"] }),
    program(TUTORING, "Tutoring", {
      mode: "family_selects",
      days: ["tuesday", "wednesday", "thursday"],
      plans: [],
    }),
    program(UNCONFIGURED, "Unconfigured", null),
    program(
      CLOSED,
      "Closed Club",
      { mode: "fixed", days: ["monday"] },
      "closed",
    ),
  ],
  documents: {
    liability_waiver: {
      id: "d0000000-0000-4000-8000-000000000001",
      kind: "liability_waiver",
      title: "Sample liability waiver",
      versionLabel: "sample-draft-v0",
      status: "draft",
    },
    code_of_conduct: {
      id: "d0000000-0000-4000-8000-000000000002",
      kind: "code_of_conduct",
      title: "Sample Code of Conduct",
      versionLabel: "sample-draft-v0",
      status: "draft",
    },
    parent_handbook: {
      id: "d0000000-0000-4000-8000-000000000003",
      kind: "parent_handbook",
      title: "Sample Parent Handbook",
      versionLabel: "sample-draft-v0",
      status: "draft",
    },
  },
}

const STUDENTS: StudentOption[] = [
  { id: STUDENT, preferredName: "Sample Student A2" },
]

function child(key: number, overrides: Partial<ChildDraft> = {}): ChildDraft {
  return {
    ...emptyChild(key, true),
    source: "new",
    preferredName: `Sample Child ${key}`,
    allergies: "no",
    medical: "no",
    accommodation: "no",
    media: "no",
    selections: [{ programId: SEWING, plan: "", days: [] }],
    ...overrides,
  }
}

function valid(): RegistrationDraft {
  return {
    ...initialDraft({ guardianName: "Sample Parent", guardianEmail: "" }),
    guardians: [
      {
        key: 1,
        fullName: "Sample Parent",
        phone: "555-0100",
        email: "",
        relationship: "",
      },
    ],
    emergencies: [
      {
        key: 1,
        fullName: "Sample Aunt",
        relationship: "Aunt",
        phone: "555-0101",
      },
    ],
    pickups: [
      {
        key: 1,
        fullName: "Sample Grandparent",
        relationship: "Grandparent",
        phone: "",
      },
    ],
    children: [
      child(2, { source: "existing", studentId: STUDENT, preferredName: "" }),
      child(3, {
        allergies: "yes",
        allergyDetails: "Sample allergy detail",
        selections: [
          { programId: HAVEN_DAYS, plan: "2", days: ["thursday", "tuesday"] },
          { programId: TUTORING, plan: "", days: ["wednesday"] },
        ],
      }),
    ],
    waiverSignature: "Sample Parent",
    conductSignature: "Sample Parent",
    handbookAcknowledged: true,
    authorityAffirmed: true,
  }
}

const ids = (draft: RegistrationDraft, step: 1 | 2 | 3 | 4 | 5 | 7) =>
  validateStep(step, draft, CATALOG, STUDENTS).map((e) => e.id)

describe("a complete draft", () => {
  it("passes every step and parses against the strict contract", () => {
    const draft = valid()
    assert.deepEqual(validateAll(draft, CATALOG, STUDENTS), [])
    const parsed = registrationInputSchema.safeParse(
      draftToInput(draft, CATALOG),
    )
    assert.equal(parsed.success, true)
  })

  it("never sends a STEP UP key (DEC-033)", () => {
    const parsed = registrationInputSchema.parse(draftToInput(valid(), CATALOG))
    const json = JSON.stringify(toRegistrationPayload(parsed))
    assert.equal(/step_?up/i.test(json), false)
  })

  it("is deterministic, so a retry hashes to the same fingerprint", () => {
    const a = JSON.stringify(draftToInput(valid(), CATALOG))
    const b = JSON.stringify(draftToInput(valid(), CATALOG))
    assert.equal(a, b)
  })

  it("sorts chosen days by weekday regardless of click order", () => {
    const input = draftToInput(valid(), CATALOG)
    const haven = input.children[1].selections[0]
    assert.deepEqual(haven.attendanceDays, ["tuesday", "thursday"])
    assert.equal(haven.planDaysPerWeek, 2)
  })
})

describe("contacts (DEC-026)", () => {
  it("requires the guardian phone", () => {
    const draft = valid()
    draft.guardians[0].phone = "  "
    assert.deepEqual(ids(draft, 1), [fieldId.guardian(1, "phone")])
  })

  it("refuses a malformed phone and email", () => {
    const draft = valid()
    draft.guardians[0].phone = "call me"
    draft.guardians[0].email = "not-an-email"
    assert.deepEqual(ids(draft, 1), [
      fieldId.guardian(1, "phone"),
      fieldId.guardian(1, "email"),
    ])
  })

  it("requires each emergency contact's name, relationship, and phone", () => {
    const draft = valid()
    draft.emergencies[0] = { key: 1, fullName: "", relationship: "", phone: "" }
    assert.equal(ids(draft, 2).length, 3)
  })

  it("lets a pickup person omit a phone but not a name or relationship", () => {
    const draft = valid()
    draft.pickups[0] = { key: 1, fullName: "", relationship: "", phone: "" }
    assert.deepEqual(ids(draft, 3), [
      fieldId.pickup(1, "fullName"),
      fieldId.pickup(1, "relationship"),
    ])
  })
})

describe("children and health (DEC-026)", () => {
  it("requires at least one child", () => {
    const draft = valid()
    draft.children = []
    assert.deepEqual(ids(draft, 4), [fieldId.addChild])
  })

  it("treats a blank answer as unanswered, never as No", () => {
    const draft = valid()
    draft.children[0].medical = ""
    assert.deepEqual(ids(draft, 4), [fieldId.child(2, "medical")])
  })

  it("requires details after Yes", () => {
    const draft = valid()
    draft.children[0].accommodation = "yes"
    assert.deepEqual(ids(draft, 4), [fieldId.child(2, "accommodationDetails")])
  })

  it("keeps hidden details in memory and leaves them out of the payload", () => {
    const draft = valid()
    draft.children[1].allergies = "no" // details text is still in the draft
    assert.equal(draft.children[1].allergyDetails, "Sample allergy detail")
    const input = draftToInput(draft, CATALOG)
    assert.equal(input.children[1].hasAllergies, false)
    assert.equal(input.children[1].allergyDetails, undefined)
    assert.equal(JSON.stringify(input).includes("Sample allergy detail"), false)
  })

  it("refuses the same existing child twice", () => {
    const draft = valid()
    draft.children[1] = child(3, { source: "existing", studentId: STUDENT })
    assert.deepEqual(ids(draft, 4), [fieldId.child(3, "who")])
  })

  it("heads a card with the preferred name, or New child", () => {
    assert.equal(childHeading(emptyChild(9, true), STUDENTS), "New child")
    assert.equal(
      childHeading(valid().children[0], STUDENTS),
      "Sample Student A2",
    )
  })

  it("asks before removing a child with entries", () => {
    assert.equal(childHasEntries(emptyChild(9, true)), false)
    assert.equal(childHasEntries({ ...emptyChild(9, true), media: "no" }), true)
  })
})

describe("attendance (DEC-032)", () => {
  const withSelection = (selection: ChildDraft["selections"][number]) => {
    const draft = valid()
    draft.children = [child(2, { selections: [selection] })]
    return ids(draft, 5)
  }

  it("asks nothing of a fixed-day program and sends no days", () => {
    const find = (id: string) => CATALOG.programs.find((p) => p.id === id)!
    assert.deepEqual(attendanceRequirement(find(SEWING)), {
      kind: "fixed",
      days: ["wednesday"],
    })
    const draft = valid()
    draft.children = [
      child(2, {
        selections: [{ programId: SEWING, plan: "", days: ["monday"] }],
      }),
    ]
    assert.deepEqual(ids(draft, 5), [])
    assert.deepEqual(
      draftToInput(draft, CATALOG).children[0].selections[0].attendanceDays,
      [],
    )
  })

  for (const plan of [1, 2, 3]) {
    it(`accepts Haven Days with a ${plan}-day plan and ${plan} days`, () => {
      const days = (["tuesday", "wednesday", "thursday"] as const).slice(
        0,
        plan,
      )
      assert.deepEqual(
        withSelection({
          programId: HAVEN_DAYS,
          plan: String(plan),
          days: [...days],
        }),
        [],
      )
    })
  }

  it("refuses Haven Days without a plan, or with a mismatched count", () => {
    assert.deepEqual(
      withSelection({ programId: HAVEN_DAYS, plan: "", days: [] }),
      [fieldId.plan(2, HAVEN_DAYS)],
    )
    assert.deepEqual(
      withSelection({ programId: HAVEN_DAYS, plan: "2", days: ["tuesday"] }),
      [fieldId.days(2, HAVEN_DAYS)],
    )
    assert.deepEqual(
      withSelection({ programId: HAVEN_DAYS, plan: "1", days: ["monday"] }),
      [fieldId.days(2, HAVEN_DAYS)],
    )
  })

  it("requires at least one configured day for Tutoring", () => {
    assert.deepEqual(
      withSelection({ programId: TUTORING, plan: "", days: [] }),
      [fieldId.days(2, TUTORING)],
    )
    assert.deepEqual(
      withSelection({ programId: TUTORING, plan: "", days: ["friday"] }),
      [fieldId.days(2, TUTORING)],
    )
  })

  it("blocks a program with no attendance rule, and a closed one", () => {
    const find = (id: string) => CATALOG.programs.find((p) => p.id === id)!
    assert.equal(selectability(find(UNCONFIGURED)), "unconfigured")
    assert.equal(selectability(find(CLOSED)), "closed")
    assert.deepEqual(withSelection(emptySelection(UNCONFIGURED)), [
      fieldId.child(2, "programs"),
    ])
  })

  it("requires at least one program per child", () => {
    const draft = valid()
    draft.children[0].selections = []
    assert.deepEqual(ids(draft, 5), [fieldId.child(2, "programs")])
  })
})

describe("documents and permissions", () => {
  it("blocks submission when a document version is missing", () => {
    const catalog = {
      ...CATALOG,
      documents: { ...CATALOG.documents, code_of_conduct: null },
    }
    const errors = validateStep(7, valid(), catalog, STUDENTS)
    assert.deepEqual(
      errors.map((e) => e.id),
      [fieldId.documents],
    )
  })

  it("keeps the two signatures and the acknowledgment separate", () => {
    const draft = valid()
    draft.waiverSignature = ""
    draft.handbookAcknowledged = false
    assert.deepEqual(ids(draft, 7), [fieldId.waiverSignature, fieldId.handbook])
  })

  it("requires an explicit media answer for every child, neither preselected", () => {
    assert.equal(emptyChild(1, false).media, "")
    const draft = valid()
    draft.children[1].media = ""
    assert.deepEqual(ids(draft, 7), [fieldId.child(3, "media")])
  })

  it("requires the guardian-authority affirmation", () => {
    const draft = valid()
    draft.authorityAffirmed = false
    assert.deepEqual(ids(draft, 7), [fieldId.authority])
  })
})

describe("database refusals", () => {
  it("accepts only key-and-index paths", () => {
    assert.equal(
      SERVER_PATH.test("children[1].selections[0].attendance_days"),
      true,
    )
    assert.equal(
      SERVER_PATH.test("children[0].allergy_details 555-0100"),
      false,
    )
    assert.equal(SERVER_PATH.test("Sample Parent"), false)
  })

  it("places a refusal on the field it names, in its card", () => {
    const draft = valid()
    const error = errorForServerPath(
      "children[1].selections[0].attendance_days",
      draft,
      CATALOG,
      STUDENTS,
    )
    assert.equal(error.id, fieldId.days(3, HAVEN_DAYS))
    assert.equal(error.step, 5)
    assert.equal(error.childKey, 3)

    const health = errorForServerPath(
      "children[0].medical_information",
      draft,
      CATALOG,
      STUDENTS,
    )
    assert.equal(health.id, fieldId.child(2, "medicalDetails"))
    assert.equal(health.step, 4)

    const phone = errorForServerPath(
      "emergency_contacts[0].phone",
      draft,
      CATALOG,
      STUDENTS,
    )
    assert.equal(phone.id, fieldId.emergency(1, "phone"))
  })

  it("puts an unplaceable refusal on the review step, with a fixed sentence", () => {
    const error = errorForServerPath(null, valid(), CATALOG, STUDENTS)
    assert.equal(error.step, 8)
    const odd = errorForServerPath("payload", valid(), CATALOG, STUDENTS)
    assert.equal(odd.step, 8)
    for (const e of [error, odd]) {
      assert.equal(/Sample|555/.test(e.message), false)
    }
  })

  it("never puts a typed value in an error message", () => {
    const draft = valid()
    draft.guardians[0].phone = "555-01"
    draft.children[1].allergyDetails = ""
    const messages = validateAll(draft, CATALOG, STUDENTS).map((e) => e.message)
    for (const m of messages) {
      assert.equal(m.includes("555-01"), false)
    }
  })
})

describe("recorded results", () => {
  it("follow the parent's child and program order, not the database's", () => {
    const draft = valid()
    const ordered = orderResults(
      [
        {
          studentId: "new-profile-id",
          studentName: "sample child 3",
          selections: [{ programId: TUTORING }, { programId: HAVEN_DAYS }],
        },
        {
          studentId: STUDENT,
          studentName: "Sample Student A2",
          selections: [{ programId: SEWING }],
        },
      ],
      draft,
    )
    assert.deepEqual(
      ordered.map((r) => r.studentId),
      [STUDENT, "new-profile-id"],
    )
    assert.deepEqual(
      ordered[1].selections.map((s) => s.programId),
      [HAVEN_DAYS, TUTORING],
    )
  })
})
