import { CircleSlash, FileClock, FileText, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DOCUMENT_NAMES,
  type CatalogDocument,
  type DocumentKind,
} from "@/lib/registration/form"

/**
 * MDS `components.consent_state` (DESIGN-SYSTEM §6, v1.2 `acceptance_method`).
 *
 * Approved component, first implementation: EXTEND, not CREATE. It uses the
 * existing Badge tones and card tokens and adds no new visual convention.
 *
 * Which variant a document gets is decided by what the database presents, never
 * by this component:
 *
 *   * required: an approved version is presented and still needs acceptance.
 *   * unavailable: only a draft exists. No wording is approved (GAP-014), so
 *     none is shown, and a sample signature on it is not accepted policy
 *     (`registration_policy_satisfied` stays false).
 *   * renewal_required: the presented version changed after the family
 *     started, so what they had accepted no longer counts (DEC-029).
 *   * blocked: no version is presented at all, so nothing can be accepted.
 *
 * `accepted` exists in the MDS set but is not reachable before submission, so
 * it is not rendered here.
 *
 * Every variant has an icon and a label, so none depends on colour.
 */
export type ConsentVariant =
  "required" | "unavailable" | "renewal_required" | "blocked"

const VARIANT = {
  required: { icon: FileText, tone: "pending", label: "Acceptance required" },
  unavailable: {
    icon: FileClock,
    tone: "neutral",
    label: "Draft — not approved",
  },
  renewal_required: {
    icon: RefreshCw,
    tone: "pending",
    label: "New version — accept again",
  },
  blocked: { icon: CircleSlash, tone: "neutral", label: "Not available" },
} as const

export function consentVariant(
  document: CatalogDocument | null,
  renewed: boolean,
): ConsentVariant {
  if (!document) return "blocked"
  if (renewed) return "renewal_required"
  return document.status === "approved" ? "required" : "unavailable"
}

export function ConsentState({
  kind,
  document,
  variant,
  method,
  children,
}: {
  kind: DocumentKind
  document: CatalogDocument | null
  variant: ConsentVariant
  method: "signature" | "acknowledgment"
  children?: React.ReactNode
}) {
  const { icon: Icon, tone, label } = VARIANT[variant]
  const name = DOCUMENT_NAMES[kind]
  const headingId = `reg-document-${kind}-heading`

  return (
    <section
      aria-labelledby={headingId}
      data-slot="consent-state"
      data-state={variant}
      className="flex flex-col gap-[var(--hsh-space-3)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--hsh-space-3)]">
        <div className="flex flex-col gap-[var(--hsh-space-1)]">
          <h3 id={headingId} className="hsh-h4 text-[var(--hsh-text-primary)]">
            {name}
          </h3>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            {document
              ? `Version ${document.versionLabel}`
              : "No version is available"}
            {" · "}
            {method === "signature"
              ? "Signed with your typed name"
              : "Acknowledged, not signed"}
          </p>
        </div>
        <Badge tone={tone}>
          <Icon aria-hidden="true" strokeWidth={1.75} />
          {label}
        </Badge>
      </div>

      <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
        {variant === "blocked"
          ? `Home School Haven has not made a version of the ${name} available, so registration cannot be submitted yet. Everything you have entered is kept on this page.`
          : variant === "renewal_required"
            ? `Home School Haven presented a newer version of the ${name} while you were filling in this form. Review and accept this version to continue.`
            : variant === "unavailable"
              ? `This is a sample draft. Its wording has not been approved, so none is shown here. In this sample preview you can accept it to try the form, but that is not acceptance of approved policy, and a real registration cannot be finalized until Home School Haven publishes an approved version.`
              : `This version of the ${name} is approved. Accept it to continue.`}
      </p>

      {children}
    </section>
  )
}
