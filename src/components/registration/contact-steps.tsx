"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  emptyGuardian,
  emptyPerson,
  fieldId,
  LIMITS,
  type PersonDraft,
} from "@/lib/registration/form"

import { TextField } from "./fields"
import { useRegistration } from "./registration-context"

/**
 * Steps 1–3: the parent or guardian, emergency contacts, and approved pickup
 * persons (DEC-026: a guardian phone, and at least one of each list).
 *
 * Every list starts with one entry and never drops below it, so "at least one"
 * is kept by construction and the only thing left to check is each entry's
 * fields. "Add another" stops at the database's limit rather than letting a
 * parent fill in an entry the server would refuse.
 */

const ENTRY =
  "flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"

const PAIR = "grid grid-cols-1 gap-[var(--hsh-space-4)] sm:grid-cols-2"

export function GuardianStep() {
  const { draft, update, errorFor, announce, focusLater, nextKey, busy } =
    useRegistration()

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        Home School Haven uses these details to reach you about this
        registration. Your phone number is required.
      </p>

      {draft.guardians.map((g, i) => {
        const set =
          (field: "fullName" | "phone" | "email" | "relationship") =>
          (value: string) =>
            update((d) => ({
              ...d,
              guardians: d.guardians.map((x) =>
                x.key === g.key ? { ...x, [field]: value } : x,
              ),
            }))
        const heading = i === 0 ? "You" : `Parent or guardian ${i + 1}`
        return (
          <section
            key={g.key}
            aria-labelledby={`reg-guardian-${g.key}-heading`}
            className={ENTRY}
          >
            <div className="flex items-center justify-between gap-[var(--hsh-space-3)]">
              <h3
                id={`reg-guardian-${g.key}-heading`}
                className="hsh-h4 text-[var(--hsh-text-primary)]"
              >
                {heading}
              </h3>
              {i > 0 ? (
                <Button
                  variant="quiet"
                  size="md"
                  disabled={busy}
                  onClick={() => {
                    update((d) => ({
                      ...d,
                      guardians: d.guardians.filter((x) => x.key !== g.key),
                    }))
                    announce(`Parent or guardian ${i + 1} removed.`)
                    focusLater("reg-guardian-add")
                  }}
                >
                  <Trash2 aria-hidden="true" strokeWidth={1.75} />
                  Remove parent or guardian {i + 1}
                </Button>
              ) : null}
            </div>
            <div className={PAIR}>
              <TextField
                id={fieldId.guardian(g.key, "fullName")}
                label="Full name"
                value={g.fullName}
                onChange={set("fullName")}
                error={errorFor(fieldId.guardian(g.key, "fullName"))}
                maxLength={LIMITS.name}
                autoComplete={i === 0 ? "name" : "off"}
                disabled={busy}
              />
              <TextField
                id={fieldId.guardian(g.key, "phone")}
                label="Phone number"
                type="tel"
                inputMode="tel"
                value={g.phone}
                onChange={set("phone")}
                error={errorFor(fieldId.guardian(g.key, "phone"))}
                maxLength={LIMITS.phone}
                autoComplete={i === 0 ? "tel" : "off"}
                disabled={busy}
              />
              <TextField
                id={fieldId.guardian(g.key, "email")}
                label="Email"
                type="email"
                inputMode="email"
                optional
                value={g.email}
                onChange={set("email")}
                error={errorFor(fieldId.guardian(g.key, "email"))}
                maxLength={LIMITS.email}
                autoComplete={i === 0 ? "email" : "off"}
                disabled={busy}
              />
              <TextField
                id={fieldId.guardian(g.key, "relationship")}
                label="Relationship to the children"
                optional
                hint="For example Mother, Father, or Guardian."
                value={g.relationship}
                onChange={set("relationship")}
                error={errorFor(fieldId.guardian(g.key, "relationship"))}
                maxLength={LIMITS.shortText}
                disabled={busy}
              />
            </div>
          </section>
        )
      })}

      {draft.guardians.length < LIMITS.guardians ? (
        <Button
          id="reg-guardian-add"
          variant="text"
          size="md"
          className="self-start"
          disabled={busy}
          onClick={() => {
            const key = nextKey()
            update((d) => ({
              ...d,
              guardians: [...d.guardians, emptyGuardian(key)],
            }))
            announce(`Parent or guardian ${draft.guardians.length + 1} added.`)
            focusLater(fieldId.guardian(key, "fullName"))
          }}
        >
          <Plus aria-hidden="true" strokeWidth={1.75} />
          Add another parent or guardian
        </Button>
      ) : (
        <p
          id="reg-guardian-add"
          tabIndex={-1}
          className="hsh-body-sm text-[var(--hsh-text-muted)] outline-none"
        >
          This form takes up to {LIMITS.guardians} parents or guardians.
        </p>
      )}
    </div>
  )
}

const PEOPLE = {
  emergency: {
    intro:
      "Who should Home School Haven call if your child needs help and you cannot be reached? Add at least one person.",
    noun: "Emergency contact",
    lower: "emergency contact",
    limit: LIMITS.emergencies,
    phoneOptional: false,
    id: fieldId.emergency,
    list: "emergencies" as const,
  },
  pickup: {
    intro:
      "Who may pick your child up? Add at least one person. You can include yourself.",
    noun: "Approved pickup person",
    lower: "approved pickup person",
    limit: LIMITS.pickups,
    phoneOptional: true,
    id: fieldId.pickup,
    list: "pickups" as const,
  },
}

export function PeopleStep({ kind }: { kind: "emergency" | "pickup" }) {
  const { draft, update, errorFor, announce, focusLater, nextKey, busy } =
    useRegistration()
  const config = PEOPLE[kind]
  const people = draft[config.list]
  const addId = `reg-${kind}-add`

  const setField =
    (key: number, field: keyof Omit<PersonDraft, "key">) => (value: string) =>
      update((d) => ({
        ...d,
        [config.list]: d[config.list].map((p) =>
          p.key === key ? { ...p, [field]: value } : p,
        ),
      }))

  return (
    <div className="flex flex-col gap-[var(--hsh-space-5)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        {config.intro}
      </p>

      <ol className="flex flex-col gap-[var(--hsh-space-5)]">
        {people.map((p, i) => (
          <li key={p.key}>
            <section
              aria-labelledby={`reg-${kind}-${p.key}-heading`}
              className={ENTRY}
            >
              <div className="flex flex-wrap items-center justify-between gap-[var(--hsh-space-3)]">
                <h3
                  id={`reg-${kind}-${p.key}-heading`}
                  className="hsh-h4 text-[var(--hsh-text-primary)]"
                >
                  {config.noun} {i + 1}
                </h3>
                {people.length > 1 ? (
                  <Button
                    variant="quiet"
                    size="md"
                    disabled={busy}
                    onClick={() => {
                      update((d) => ({
                        ...d,
                        [config.list]: d[config.list].filter(
                          (x) => x.key !== p.key,
                        ),
                      }))
                      announce(`${config.noun} ${i + 1} removed.`)
                      focusLater(addId)
                    }}
                  >
                    <Trash2 aria-hidden="true" strokeWidth={1.75} />
                    Remove {config.lower} {i + 1}
                  </Button>
                ) : null}
              </div>
              <div className={PAIR}>
                <TextField
                  id={config.id(p.key, "fullName")}
                  label="Full name"
                  value={p.fullName}
                  onChange={setField(p.key, "fullName")}
                  error={errorFor(config.id(p.key, "fullName"))}
                  maxLength={LIMITS.name}
                  disabled={busy}
                />
                <TextField
                  id={config.id(p.key, "relationship")}
                  label="Relationship to your child"
                  hint="For example Grandmother, Neighbor, or Aunt."
                  value={p.relationship}
                  onChange={setField(p.key, "relationship")}
                  error={errorFor(config.id(p.key, "relationship"))}
                  maxLength={LIMITS.shortText}
                  disabled={busy}
                />
                <TextField
                  id={config.id(p.key, "phone")}
                  label="Phone number"
                  type="tel"
                  inputMode="tel"
                  optional={config.phoneOptional}
                  value={p.phone}
                  onChange={setField(p.key, "phone")}
                  error={errorFor(config.id(p.key, "phone"))}
                  maxLength={LIMITS.phone}
                  disabled={busy}
                />
              </div>
            </section>
          </li>
        ))}
      </ol>

      {people.length < config.limit ? (
        <Button
          id={addId}
          variant="text"
          size="md"
          className="self-start"
          disabled={busy}
          onClick={() => {
            const key = nextKey()
            update((d) => ({
              ...d,
              [config.list]: [...d[config.list], emptyPerson(key)],
            }))
            announce(`${config.noun} ${people.length + 1} added.`)
            focusLater(config.id(key, "fullName"))
          }}
        >
          <Plus aria-hidden="true" strokeWidth={1.75} />
          Add another {config.lower}
        </Button>
      ) : (
        <p
          id={addId}
          tabIndex={-1}
          className="hsh-body-sm text-[var(--hsh-text-muted)] outline-none"
        >
          You have added the most this form takes ({config.limit}). Call Home
          School Haven if you need to list more.
        </p>
      )}
    </div>
  )
}
