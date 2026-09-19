"use client"

import { createContext, useContext } from "react"

import type {
  ChildDraft,
  RegistrationCatalog,
  RegistrationDraft,
  StepNumber,
  StudentOption,
} from "@/lib/registration/form"

/**
 * What every registration step reads and changes.
 *
 * One context rather than props threaded through eight steps and their child
 * cards. It carries the in-memory draft and nothing else: no step writes to the
 * server, and no value here reaches a URL, a log, or storage.
 */
export type RegistrationContextValue = {
  draft: RegistrationDraft
  update: (change: (draft: RegistrationDraft) => RegistrationDraft) => void
  updateChild: (key: number, change: (child: ChildDraft) => ChildDraft) => void
  catalog: RegistrationCatalog
  students: StudentOption[]
  /** The inline message for a field, if it currently has one. */
  errorFor: (id: string) => string | undefined
  /** Errors inside one child card on one step, for its collapsed summary. */
  childErrorCount: (key: number, step: StepNumber) => number
  expanded: (key: number) => boolean
  setExpanded: (key: number, open: boolean) => void
  /** Polite announcement for add, remove, and conditional fields. */
  announce: (message: string) => void
  focusLater: (id: string) => void
  nextKey: () => number
  goToStep: (step: StepNumber, focusId?: string) => void
  /** Kinds whose version changed after a stale-document refusal. */
  renewedDocuments: ReadonlySet<string>
  busy: boolean
}

export const RegistrationContext =
  createContext<RegistrationContextValue | null>(null)

export function useRegistration(): RegistrationContextValue {
  const value = useContext(RegistrationContext)
  if (!value) throw new Error("useRegistration outside RegistrationForm")
  return value
}

/** `aria-describedby` for a control that may have a hint and an error. */
export function describedBy(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const list = ids.filter(Boolean)
  return list.length ? list.join(" ") : undefined
}

/** The id of a field's inline error element. */
export function errorId(id: string): string {
  return `${id}-error`
}
