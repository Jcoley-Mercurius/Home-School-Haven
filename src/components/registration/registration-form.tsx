"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { ArrowLeft, ArrowRight, Send } from "lucide-react"

import { submitRegistrationAction } from "@/app/(portal)/family/registration/actions"
import type { RegistrationActionResult } from "@/app/(portal)/family/registration/result"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { contact } from "@/content/foundation-content"
import {
  childLabel,
  DOCUMENT_KINDS,
  DOCUMENT_NAMES,
  draftToInput,
  errorForServerPath,
  fieldId,
  initialDraft,
  orderResults,
  STEP_COUNT,
  stepName,
  validateAll,
  validateStep,
  type ChildDraft,
  type DocumentKind,
  type FormError,
  type RegistrationCatalog,
  type RegistrationDraft,
  type StepNumber,
  type StudentOption,
} from "@/lib/registration/form"

import { CheckoutStep } from "./checkout-step"
import { ChildrenStep } from "./children-step"
import { GuardianStep, PeopleStep } from "./contact-steps"
import { DocumentsStep } from "./documents-step"
import { ErrorSummary, ERROR_SUMMARY_HEADING_ID } from "./error-summary"
import { focusField } from "./fields"
import { ProgressRail, type StepStatus } from "./progress-rail"
import { ProgramsStep } from "./programs-step"
import {
  RegistrationContext,
  type RegistrationContextValue,
} from "./registration-context"
import { RegistrationResult } from "./registration-result"
import { ReviewStep } from "./review-step"

/**
 * The family registration form (MDS DESIGN-SYSTEM §9.1; MPS-WFL-002/003;
 * DEC-026 to DEC-033).
 *
 * WHAT IT HOLDS, AND WHERE
 *
 * The whole draft lives in this component's memory. Moving between steps
 * validates the step being left, for the parent's sake, and sends nothing. No
 * value is written to the URL, to storage, to a log, or to analytics. The
 * server receives the draft once, on "Submit registration", through
 * `submitRegistrationAction`, and `submit_family_registration` records all of it
 * or none of it.
 *
 * THE ATTEMPT KEY
 *
 * `attemptKey` comes from the page, and the first value received is pinned in
 * state, so a later server re-render that generates a new key cannot swap it
 * mid-attempt. Every submit and every retry sends the pinned key. If an answer
 * is lost after the database committed, the retry is answered `replayed` with
 * the same registration, so nothing is recorded twice. If the parent edits the form
 * after such a loss and submits again, the database answers
 * `idempotency_conflict`, and this form says that an earlier attempt was
 * recorded. It never says success for a registration it did not see recorded.
 * A second click while a submission is in flight is ignored (`inFlight`).
 *
 * WHAT IT NEVER DECIDES
 *
 * No enrollment, payment, or document state is inferred here. The per-step
 * checks mirror the database's rules so a parent hears about a problem early.
 * The database's answer always wins: it is shown on the field it names, and
 * nothing the parent chose is changed to make it pass.
 */

type Notice =
  | { kind: "unconfirmed" }
  | { kind: "conflict" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }

export function RegistrationForm({
  catalog: initialCatalog,
  students,
  attemptKey,
  initialProgramId,
  guardianName,
  guardianEmail,
}: {
  catalog: RegistrationCatalog
  students: StudentOption[]
  attemptKey: string
  initialProgramId: string | null
  guardianName: string
  guardianEmail: string
}) {
  const [pinnedAttemptKey] = useState(attemptKey)
  const [draft, setDraft] = useState<RegistrationDraft>(() =>
    initialDraft({ guardianName, guardianEmail }),
  )
  const [documents, setDocuments] = useState(initialCatalog.documents)
  const catalog = useMemo<RegistrationCatalog>(
    () => ({ ...initialCatalog, documents }),
    [initialCatalog, documents],
  )

  const [step, setStep] = useState<StepNumber>(1)
  const [furthest, setFurthest] = useState<StepNumber>(1)
  const [validated, setValidated] = useState<ReadonlySet<StepNumber>>(
    () => new Set(),
  )
  const [serverErrors, setServerErrors] = useState<FormError[]>([])
  const [summary, setSummary] = useState<{
    title: string
    errors: FormError[]
  } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [recorded, setRecorded] = useState<Extract<
    RegistrationActionResult,
    { status: "recorded" }
  > | null>(null)
  const [renewed, setRenewed] = useState<ReadonlySet<string>>(() => new Set())
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({})
  const [announcement, setAnnouncement] = useState({ text: "", n: 0 })
  /* Focus is requested by id and applied after the render that shows the
     field, because the field may only exist once a step changes or a card
     expands. The ref holds the target; the counter makes sure a render happens
     even when nothing else changed. */
  const focusTarget = useRef<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const setPendingFocus = useCallback((id: string) => {
    focusTarget.current = id
    setFocusTick((n) => n + 1)
  }, [])
  const [pending, startTransition] = useTransition()

  const keyCounter = useRef(1)
  const inFlight = useRef(false)

  /* Marks the form interactive once React owns it. Before hydration a native
     submit would only reload this page: no field has a `name`, so nothing a
     parent typed could reach a URL or a request. Tests wait on this marker. */
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (formRef.current) formRef.current.dataset.ready = "true"
  }, [])

  // -------------------------------------------------------------------------
  // Errors: live for every step the parent has tried to leave, plus what the
  // server named on the last submission.
  // -------------------------------------------------------------------------
  const liveErrors = useMemo(
    () =>
      [...validated].flatMap((s) => validateStep(s, draft, catalog, students)),
    [validated, draft, catalog, students],
  )
  const errors = useMemo(
    () => [...serverErrors, ...liveErrors],
    [serverErrors, liveErrors],
  )

  const announce = useCallback((text: string) => {
    setAnnouncement((a) => ({ text, n: a.n + 1 }))
  }, [])

  useEffect(() => {
    const id = focusTarget.current
    if (!id) return
    focusTarget.current = null
    focusField(id)
  }, [focusTick])

  const collapseForStep = useCallback(
    (target: StepNumber, children: ChildDraft[], openKey?: number) => {
      if (target !== 4 && target !== 5) return
      /* Tablet and mobile: cards after the first start collapsed (§9.1). */
      const narrow = window.matchMedia("(max-width: 1023px)").matches
      setExpandedMap(
        Object.fromEntries(
          children.map((c, i) => [
            c.key,
            c.key === openKey || !narrow || i === 0,
          ]),
        ),
      )
    },
    [],
  )

  const goToStep = useCallback(
    (target: StepNumber, focusId?: string, openKey?: number) => {
      setSummary(null)
      collapseForStep(target, draft.children, openKey)
      setStep(target)
      setFurthest((f) => (target > f ? target : f))
      if (focusId) {
        setPendingFocus(focusId)
      } else {
        setPendingFocus("reg-step-heading")
        announce(`Step ${target} of ${STEP_COUNT}: ${stepName(target)}`)
      }
    },
    [announce, collapseForStep, draft.children, setPendingFocus],
  )

  const jumpToError = useCallback(
    (error: FormError) => {
      if (error.step !== step) {
        goToStep(error.step, error.id, error.childKey)
        return
      }
      if (error.childKey !== undefined) {
        setExpandedMap((m) => ({ ...m, [error.childKey as number]: true }))
      }
      setPendingFocus(error.id)
    },
    [goToStep, setPendingFocus, step],
  )

  const showSummary = (title: string, list: FormError[]) => {
    setSummary({ title, errors: list })
    setPendingFocus(ERROR_SUMMARY_HEADING_ID)
  }

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------
  const onContinue = () => {
    const stepErrors = validateStep(step, draft, catalog, students)
    setValidated((v) => new Set(v).add(step))
    if (stepErrors.length) {
      showSummary(
        stepErrors.length === 1
          ? "1 item on this step needs attention"
          : `${stepErrors.length} items on this step need attention`,
        stepErrors,
      )
      return
    }
    goToStep((step + 1) as StepNumber)
  }

  // -------------------------------------------------------------------------
  // Submission
  // -------------------------------------------------------------------------
  const applyResult = (result: RegistrationActionResult) => {
    switch (result.status) {
      case "recorded":
        setRecorded(result)
        announce("Registration received.")
        return
      case "invalid": {
        const error =
          result.path === "authority_affirmed"
            ? {
                id: fieldId.authority,
                step: 7 as const,
                message:
                  "Confirm that you are the parent or legal guardian of each child in this registration.",
              }
            : errorForServerPath(result.path, draft, catalog, students)
        setServerErrors([error])
        showSummary(
          "This registration was not submitted. Nothing was recorded.",
          [error],
        )
        return
      }
      case "blocked": {
        if (
          result.outcome === "blocked_document_version_stale" ||
          result.outcome === "blocked_documents_unavailable"
        ) {
          const next = result.documents ?? documents
          const changed = DOCUMENT_KINDS.filter(
            (kind) => next[kind] && next[kind]?.id !== documents[kind]?.id,
          )
          setDocuments(next)
          setRenewed((r) => new Set([...r, ...changed]))
          /* A new version needs a fresh acceptance (DEC-029), so what was
             accepted for the old one is cleared, and only that. */
          setDraft((d) => ({
            ...d,
            waiverSignature: changed.includes("liability_waiver")
              ? ""
              : d.waiverSignature,
            conductSignature: changed.includes("code_of_conduct")
              ? ""
              : d.conductSignature,
            handbookAcknowledged: changed.includes("parent_handbook")
              ? false
              : d.handbookAcknowledged,
          }))
          const list: FormError[] = DOCUMENT_KINDS.some((k) => !next[k])
            ? [
                {
                  id: fieldId.documents,
                  step: 7,
                  message:
                    "A required registration document is not available, so this registration cannot be submitted yet.",
                },
              ]
            : changed.map((kind: DocumentKind) => ({
                id:
                  kind === "liability_waiver"
                    ? fieldId.waiverSignature
                    : kind === "code_of_conduct"
                      ? fieldId.conductSignature
                      : fieldId.handbook,
                step: 7 as const,
                message: `${DOCUMENT_NAMES[kind]}: a new version, ${next[kind]?.versionLabel}, is now presented. ${kind === "parent_handbook" ? "Acknowledge" : "Sign"} this version to continue.`,
              }))
          showSummary(
            "This registration was not submitted. Nothing was recorded.",
            list.length
              ? list
              : [
                  {
                    id: fieldId.documents,
                    step: 7,
                    message:
                      "The registration documents changed. Review them and accept them again.",
                  },
                ],
          )
          return
        }
        const child =
          result.childIndex !== null ? draft.children[result.childIndex] : null
        const program = catalog.programs.find((p) => p.id === result.programId)
        const who = child
          ? childLabel(child, result.childIndex as number, students)
          : "One child"
        const what = program?.name ?? "one of the chosen programs"
        const message = {
          blocked_attendance_unconfigured: `${who}, ${what}: attendance days are not set up for this program, so it cannot be registered online yet. Remove it to continue, or call ${contact.phone}.`,
          blocked_unavailable: `${who}, ${what}: this program is not open for registration right now. Remove it to continue.`,
          blocked_closed: `${who}, ${what}: registration is closed. Remove it to continue.`,
          blocked_full: `${who}, ${what}: every place is taken and this program does not keep a waitlist. Remove it to continue.`,
          blocked_duplicate: `${who} is already registered for ${what}. Remove it from this registration. The existing registration is on your Family Overview.`,
        }[result.outcome]
        const error: FormError = child
          ? {
              id: fieldId.child(child.key, "programs"),
              step: 5,
              childKey: child.key,
              message,
            }
          : { id: fieldId.review, step: 8, message }
        setServerErrors([error])
        showSummary(
          "This registration was not submitted. Nothing was recorded.",
          [error],
        )
        return
      }
      case "conflict":
      case "forbidden":
      case "unavailable":
      case "unconfirmed":
        setNotice({ kind: result.status })
        setPendingFocus("reg-notice-heading")
        return
    }
  }

  const submit = () => {
    if (inFlight.current) return
    const all = validateAll(draft, catalog, students)
    setValidated(new Set<StepNumber>([1, 2, 3, 4, 5, 6, 7]))
    setServerErrors([])
    if (all.length) {
      showSummary(
        `This registration was not submitted. ${all.length === 1 ? "1 item needs" : `${all.length} items need`} attention.`,
        all,
      )
      return
    }
    inFlight.current = true
    setSummary(null)
    setNotice(null)
    announce("Submitting registration…")
    const input = draftToInput(draft, catalog)
    startTransition(async () => {
      let result: RegistrationActionResult
      try {
        result = await submitRegistrationAction(input, pinnedAttemptKey)
      } catch {
        /* A dropped connection or a timeout. Whether the database committed
           is unknown, and the same attempt key makes trying again safe. */
        result = { status: "unconfirmed" }
      }
      inFlight.current = false
      applyResult(result)
    })
  }

  const busy = pending

  // -------------------------------------------------------------------------
  // Context for the steps
  // -------------------------------------------------------------------------
  const context: RegistrationContextValue = {
    draft,
    update: (change) => setDraft(change),
    updateChild: (key, change) =>
      setDraft((d) => ({
        ...d,
        children: d.children.map((c) => (c.key === key ? change(c) : c)),
      })),
    catalog,
    students,
    errorFor: (id) => errors.find((e) => e.id === id)?.message,
    childErrorCount: (key, s) =>
      errors.filter((e) => e.childKey === key && e.step === s).length,
    expanded: (key) => expandedMap[key] ?? true,
    setExpanded: (key, open) => setExpandedMap((m) => ({ ...m, [key]: open })),
    announce,
    focusLater: setPendingFocus,
    nextKey: () => ++keyCounter.current,
    goToStep: (s, focusId) => goToStep(s, focusId),
    renewedDocuments: renewed,
    busy,
  }

  const statusOf = (s: StepNumber): StepStatus => {
    if (s === step) return "current"
    const has = errors.some((e) => e.step === s)
    if (has && (validated.has(s) || serverErrors.some((e) => e.step === s))) {
      return "attention"
    }
    if (s < furthest) return "complete"
    return "upcoming"
  }

  const programCount = draft.children.reduce(
    (n, c) => n + c.selections.length,
    0,
  )
  const railSummary = draft.children.length
    ? `${draft.children.length} ${draft.children.length === 1 ? "child" : "children"} · ${programCount} ${programCount === 1 ? "program" : "programs"} chosen`
    : "No children added yet"

  if (recorded) {
    return (
      <RegistrationResult
        replayed={recorded.replayed}
        results={
          recorded.children ? orderResults(recorded.children, draft) : null
        }
        draftDocuments={DOCUMENT_KINDS.some(
          (k) => documents[k]?.status === "draft",
        )}
      />
    )
  }

  return (
    <RegistrationContext.Provider value={context}>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={announcement.n}>{announcement.text}</span>
      </p>
      <div className="grid grid-cols-1 gap-[var(--hsh-grid-gap-mobile)] sm:gap-[var(--hsh-grid-gap-tablet)] lg:grid-cols-12 lg:items-start lg:gap-[var(--hsh-grid-gap-desktop)]">
        <form
          ref={formRef}
          noValidate
          aria-labelledby="reg-step-heading"
          onSubmit={(event) => {
            event.preventDefault()
            if (step === 8) submit()
            else onContinue()
          }}
          className="flex min-w-0 flex-col gap-[var(--hsh-space-6)] lg:col-span-8"
        >
          <div className="flex flex-col gap-[var(--hsh-space-1)]">
            <p className="hsh-label text-[var(--hsh-text-muted)]">
              Step {step} of {STEP_COUNT}
            </p>
            <h2
              id="reg-step-heading"
              tabIndex={-1}
              className="hsh-h2 text-[var(--hsh-text-primary)] outline-none"
            >
              {stepName(step)}
            </h2>
          </div>

          {summary ? (
            <ErrorSummary
              title={summary.title}
              errors={summary.errors}
              onSelect={jumpToError}
            />
          ) : null}

          {notice ? (
            <NoticePanel notice={notice} onRetry={submit} busy={busy} />
          ) : null}

          {step === 1 ? <GuardianStep /> : null}
          {step === 2 ? <PeopleStep kind="emergency" /> : null}
          {step === 3 ? <PeopleStep kind="pickup" /> : null}
          {step === 4 ? (
            <ChildrenStep initialProgramId={initialProgramId} />
          ) : null}
          {step === 5 ? <ProgramsStep /> : null}
          {step === 6 ? <CheckoutStep /> : null}
          {step === 7 ? <DocumentsStep /> : null}
          {step === 8 ? <ReviewStep /> : null}

          <div className="flex flex-col-reverse gap-[var(--hsh-space-3)] border-t border-[var(--hsh-border-default)] pt-[var(--hsh-space-5)] sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={busy}
                onClick={() => goToStep((step - 1) as StepNumber)}
              >
                <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                Back
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
            {step < 8 ? (
              <Button type="submit" variant="primary" size="lg" disabled={busy}>
                Continue
                <ArrowRight aria-hidden="true" strokeWidth={1.75} />
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" loading={busy}>
                {busy ? (
                  "Submitting registration…"
                ) : (
                  <>
                    <Send aria-hidden="true" strokeWidth={1.75} />
                    Submit registration
                  </>
                )}
              </Button>
            )}
          </div>
        </form>

        <div className="lg:col-span-4">
          <ProgressRail
            current={step}
            statusOf={statusOf}
            reachable={(s) => s <= furthest}
            onSelect={(s) => goToStep(s)}
            summary={railSummary}
            disabled={busy}
          />
        </div>
      </div>
    </RegistrationContext.Provider>
  )
}

function NoticePanel({
  notice,
  onRetry,
  busy,
}: {
  notice: Notice
  onRetry: () => void
  busy: boolean
}) {
  const heading = (text: string) => (
    <span id="reg-notice-heading" tabIndex={-1} className="outline-none">
      {text}
    </span>
  )

  if (notice.kind === "unconfirmed") {
    return (
      <Alert
        tone="warning"
        live="assertive"
        title={heading("We could not confirm your registration")}
      >
        <div className="flex flex-col items-start gap-[var(--hsh-space-3)]">
          <p>
            The connection dropped or timed out before Home School Haven
            answered, so we do not know whether this registration was recorded.
            Everything you entered is still here. Trying again is safe: it will
            not register anyone twice.
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={busy}
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      </Alert>
    )
  }

  if (notice.kind === "conflict") {
    return (
      <Alert
        tone="warning"
        live="assertive"
        title={heading("An earlier attempt was already recorded")}
      >
        <p>
          A registration from this page was already recorded with different
          details, so this one was not recorded. Check your{" "}
          <Link href="/family" data-inline-link="true">
            Family Overview
          </Link>{" "}
          to see what was registered before you change anything, or call{" "}
          {contact.phone} and Home School Haven will help.
        </p>
      </Alert>
    )
  }

  return (
    <Alert
      tone="warning"
      live="assertive"
      title={heading(
        notice.kind === "forbidden"
          ? "This registration could not be submitted from this account"
          : "Registration is not available in this environment",
      )}
    >
      <p>
        Nothing was recorded. Call {contact.phone} and Home School Haven will
        register your family with you.
      </p>
    </Alert>
  )
}
