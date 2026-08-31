"use client"

import { useActionState, useId, useState } from "react"
import Link from "next/link"

import { createProgramDraftAction } from "@/app/(portal)/admin/programs/new/actions"
import { emptyCreateProgramFormState } from "@/app/(portal)/admin/programs/new/form-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PROGRAM_NAME_MAX,
  PROGRAM_SLUG_MAX,
  SUMMARY_MAX,
} from "@/lib/admin/validation"

/**
 * Create a program draft (MDS `patterns.forms`, MPS-WFL-005 step 1).
 *
 * THREE FIELDS, AND THE ABSENCES ARE THE DESIGN
 *
 * There is no price, capacity, date, schedule, audience, location, or educator
 * field here. Not because they are unimportant — because a create form invites
 * whoever is filling it in to fill every box, and the boxes for published facts
 * belong on the edit page where an administrator is working from a source
 * rather than from a blank. A published fact that is unset renders as "Contact
 * for details", which is true; a fact typed to complete a form is not.
 *
 * `noValidate` keeps a native constraint bubble from hiding the server
 * boundary, matching every other form in this repository. The server's answer
 * is the answer.
 *
 * The slug suggestion is a convenience, not a rule: it fills the field from the
 * name only while the administrator has not typed a slug themselves, and it
 * never overwrites what they did type.
 */
function CreateProgramForm() {
  const [state, formAction, pending] = useActionState(
    createProgramDraftAction,
    emptyCreateProgramFormState,
  )
  const ids = useId()
  const [slugTouched, setSlugTouched] = useState(false)
  const [slug, setSlug] = useState(state.values.slug)

  const announcement =
    state.status === "invalid" || state.status === "duplicate"
      ? "The draft was not created. Check the highlighted fields below."
      : state.status === "forbidden"
        ? "This account is not authorized to create a program."
        : state.status === "unavailable"
          ? "Programs cannot be created in this environment."
          : state.status === "failed"
            ? "The draft could not be created. Nothing was saved."
            : ""

  const blocked =
    state.status === "forbidden" ||
    state.status === "unavailable" ||
    state.status === "failed"

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <p
        role="status"
        aria-live="assertive"
        className="sr-only"
        key={`${state.status}-${announcement}`}
      >
        {announcement}
      </p>

      {state.status === "invalid" || state.status === "duplicate" ? (
        <Alert tone="error" title="The draft was not created">
          Check the highlighted fields below. Everything you typed is still
          here.
        </Alert>
      ) : null}

      {blocked ? (
        <Alert tone="warning" title="The draft was not created">
          {state.status === "unavailable"
            ? "No Supabase project is configured in this environment, so nothing can be created here. Nothing you typed was saved."
            : state.status === "forbidden"
              ? "This account is not authorized to create a program. Nothing you typed was saved."
              : "Something went wrong on our side. Nothing you typed was saved — please try again."}
        </Alert>
      ) : null}

      <form
        action={formAction}
        noValidate
        className="flex max-w-[var(--hsh-content-reading)] flex-col gap-[var(--hsh-space-6)]"
      >
        <Field invalid={Boolean(state.fieldErrors.name)}>
          <FieldLabel>Program name</FieldLabel>
          <FieldDescription>
            Exactly as Home School Haven publishes it.
          </FieldDescription>
          <Input
            key={state.values.name}
            name="name"
            type="text"
            autoComplete="off"
            maxLength={PROGRAM_NAME_MAX}
            defaultValue={state.values.name}
            onChange={(event) => {
              if (slugTouched) return
              setSlug(
                event.target.value
                  .toLocaleLowerCase()
                  .normalize("NFD")
                  .replace(/\p{Diacritic}/gu, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, PROGRAM_SLUG_MAX),
              )
            }}
          />
          <FieldError match={Boolean(state.fieldErrors.name)}>
            {state.fieldErrors.name}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.slug)}>
          <FieldLabel>Web address</FieldLabel>
          <FieldDescription>
            The program&rsquo;s public address, for example{" "}
            <span className="font-semibold">art-lab</span>. Lowercase letters,
            numbers, and single hyphens. This is hard to change once families
            have the link, so choose it deliberately.
          </FieldDescription>
          <Input
            name="slug"
            type="text"
            autoComplete="off"
            maxLength={PROGRAM_SLUG_MAX}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            aria-describedby={`${ids}-slug-preview`}
          />
          <p
            id={`${ids}-slug-preview`}
            className="hsh-body-sm text-[var(--hsh-text-muted)]"
          >
            Families will see /programs/{slug || "…"}
          </p>
          <FieldError match={Boolean(state.fieldErrors.slug)}>
            {state.fieldErrors.slug}
          </FieldError>
        </Field>

        <Field invalid={Boolean(state.fieldErrors.summary)}>
          <FieldLabel>Summary</FieldLabel>
          <FieldDescription>
            Optional now, required before this program can be published. Use the
            approved published description — do not write new copy for a program
            that already has some.
          </FieldDescription>
          <Textarea
            key={state.values.summary}
            name="summary"
            rows={4}
            maxLength={SUMMARY_MAX}
            defaultValue={state.values.summary}
          />
          <FieldError match={Boolean(state.fieldErrors.summary)}>
            {state.fieldErrors.summary}
          </FieldError>
        </Field>

        <Alert tone="info" title="This creates a draft">
          A draft is not visible to families or visitors, and it collects no
          registrations. You will add the published details and publish it from
          the program&rsquo;s own page.
        </Alert>

        <div className="flex flex-col gap-[var(--hsh-space-2)] sm:flex-row">
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Creating draft…" : "Create draft"}
          </Button>
          <Button
            variant="quiet"
            size="md"
            render={<Link href="/admin/programs" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export { CreateProgramForm }
