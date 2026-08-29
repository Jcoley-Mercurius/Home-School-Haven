/**
 * Field shapes for family setup and demo student profiles.
 *
 * Kept out of the action modules so it can be unit-tested directly and so the
 * same rule cannot drift between the form and the server. The database repeats
 * every length bound as a CHECK constraint — this layer exists to produce a
 * sentence a parent can act on, not to be the control.
 *
 * What is NOT here is as deliberate as what is. There is no legal name, date of
 * birth, allergy, medical, accommodation, emergency-contact, or pickup field:
 * MPS-RUL-006 forbids collecting them until Samantha confirms necessity and
 * policy, and checklist §7 is unanswered.
 */

import { z } from "zod"

export const FAMILY_NAME_MAX = 80
export const STUDENT_NAME_MAX = 80
export const SHORT_TEXT_MAX = 40

/**
 * The affirmation version stored with every demo student profile.
 *
 * It says `unapproved` because it is. MPS-RUL-010 forbids inventing consent or
 * waiver language, so none was written, and the database refuses any other
 * value — no row can imply that Samantha-approved language was accepted.
 */
export const AFFIRMATION_VERSION = "demo-unapproved-v0"

export const familyNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name for your family.")
    .max(FAMILY_NAME_MAX, `Use ${FAMILY_NAME_MAX} characters or fewer.`),
})

const optionalShortText = z
  .string()
  .trim()
  .max(SHORT_TEXT_MAX, `Use ${SHORT_TEXT_MAX} characters or fewer.`)
  .transform((value) => (value === "" ? null : value))

export const studentSchema = z.object({
  preferredName: z
    .string()
    .trim()
    .min(1, "Enter the name your family uses for this student.")
    .max(STUDENT_NAME_MAX, `Use ${STUDENT_NAME_MAX} characters or fewer.`),
  gradeLevel: optionalShortText,
  guardianRelationship: optionalShortText,
  /* An affirmation of parental authority, not a consent or waiver acceptance.
     MPS-RUL-008 requires the affirmation before a profile is created; the
     approved language for everything beyond it is checklist §6. */
  authority: z
    .literal("on", "Confirm that you are this student's parent or guardian.")
    .transform(() => true),
})
