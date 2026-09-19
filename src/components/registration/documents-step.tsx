"use client"

import { Alert } from "@/components/ui/alert"
import {
  childLabel,
  documentsAvailable,
  fieldId,
  LIMITS,
  type YesNo,
} from "@/lib/registration/form"

import { ConsentState, consentVariant } from "./consent-state"
import { CheckField, ChoiceField, TextField } from "./fields"
import { useRegistration } from "./registration-context"

/**
 * Step 7: documents, media permission, acknowledgment, and signatures (MDS
 * DESIGN-SYSTEM §9.1 "Documents, permissions, and signature"; DEC-029, DEC-030;
 * MPS-RUL-008/009/010).
 *
 * The order follows the pattern: the three document panels, then media
 * permission, then the signatures. The Parent Handbook takes an acknowledgment
 * checkbox and never a signature. The Liability Waiver and the Code of Conduct
 * each take their own typed-name signature. There is no combined "I agree to
 * everything" control. Only the parent signs: students do not sign the Code of
 * Conduct.
 *
 * No document wording is shown, because none is approved (GAP-014). The media
 * question is the DEC-030 design wording, verbatim, and it is marked as not yet
 * approved for real families.
 */

export const MEDIA_QUESTION =
  "Do you give Home School Haven permission to photograph or record your child and use those photos or videos for educational and promotional purposes?"
export const MEDIA_SUPPORT =
  "Choosing No will not affect your child's registration eligibility."
const MEDIA_OPTIONS = [
  { value: "yes", label: "Yes, I give permission." },
  { value: "no", label: "No, I do not give permission." },
]

export function DocumentsStep() {
  const {
    draft,
    update,
    updateChild,
    catalog,
    students,
    errorFor,
    renewedDocuments,
    busy,
  } = useRegistration()

  const docs = catalog.documents
  const variant = (kind: keyof typeof docs) =>
    consentVariant(docs[kind], renewedDocuments.has(kind))
  const available = documentsAvailable(catalog)

  return (
    <div className="flex flex-col gap-[var(--hsh-space-6)]">
      <p className="hsh-body text-[var(--hsh-text-secondary)]">
        Each document below is accepted on its own. The Liability Waiver and the
        Code of Conduct are signed by typing your full name. The Parent Handbook
        is acknowledged with a checkbox.
      </p>

      {!available ? (
        <div id={fieldId.documents} tabIndex={-1} className="outline-none">
          <Alert tone="warning" title="Registration cannot be submitted yet">
            <p>
              A required registration document is not available. Everything you
              have entered is kept on this page. Home School Haven must publish
              the document before this registration can be submitted.
            </p>
          </Alert>
        </div>
      ) : null}

      <section
        aria-labelledby="reg-documents-heading"
        className="flex flex-col gap-[var(--hsh-space-4)]"
      >
        <h3
          id="reg-documents-heading"
          className="hsh-h4 text-[var(--hsh-text-primary)]"
        >
          Registration documents
        </h3>
        <ConsentState
          kind="liability_waiver"
          document={docs.liability_waiver}
          variant={variant("liability_waiver")}
          method="signature"
        />
        <ConsentState
          kind="code_of_conduct"
          document={docs.code_of_conduct}
          variant={variant("code_of_conduct")}
          method="signature"
        />
        <ConsentState
          kind="parent_handbook"
          document={docs.parent_handbook}
          variant={variant("parent_handbook")}
          method="acknowledgment"
        >
          <CheckField
            id={fieldId.handbook}
            label={`I acknowledge the Parent Handbook${docs.parent_handbook ? `, version ${docs.parent_handbook.versionLabel}` : ""}.`}
            checked={draft.handbookAcknowledged}
            onChange={(checked) =>
              update((d) => ({ ...d, handbookAcknowledged: checked }))
            }
            error={errorFor(fieldId.handbook)}
            disabled={busy || !docs.parent_handbook}
          />
        </ConsentState>
      </section>

      <section
        aria-labelledby="reg-media-heading"
        className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        <div className="flex flex-col gap-[var(--hsh-space-2)]">
          <h3
            id="reg-media-heading"
            className="hsh-h4 text-[var(--hsh-text-primary)]"
          >
            Photo and video permission
          </h3>
          <p className="hsh-body-sm text-[var(--hsh-text-muted)]">
            Sample preview only. This question is not yet approved for real
            families. It is a separate choice from your signatures.
          </p>
        </div>
        {draft.children.map((child, index) => (
          <ChoiceField
            key={child.key}
            id={fieldId.child(child.key, "media")}
            legend={
              <>
                <span className="block text-[var(--hsh-text-secondary)]">
                  {childLabel(child, index, students)}
                </span>
                <span className="block">{MEDIA_QUESTION}</span>
              </>
            }
            hint={MEDIA_SUPPORT}
            options={MEDIA_OPTIONS}
            value={child.media}
            onChange={(value) =>
              updateChild(child.key, (c) => ({ ...c, media: value as YesNo }))
            }
            error={errorFor(fieldId.child(child.key, "media"))}
            disabled={busy}
          />
        ))}
      </section>

      <section
        aria-labelledby="reg-signatures-heading"
        className="flex flex-col gap-[var(--hsh-space-4)] rounded-[var(--hsh-radius-card)] border border-[var(--hsh-border-default)] bg-[var(--hsh-surface-card)] p-[var(--hsh-space-5)]"
      >
        <div className="flex flex-col gap-[var(--hsh-space-2)]">
          <h3
            id="reg-signatures-heading"
            className="hsh-h4 text-[var(--hsh-text-primary)]"
          >
            Signatures
          </h3>
          <p className="hsh-body-sm text-[var(--hsh-text-secondary)]">
            Typing your full name below is your signature. You sign as the
            parent or guardian; children do not sign.
          </p>
        </div>
        <TextField
          id={fieldId.waiverSignature}
          label={`Liability Waiver${docs.liability_waiver ? ` (version ${docs.liability_waiver.versionLabel})` : ""}: type your full name to sign`}
          value={draft.waiverSignature}
          onChange={(value) =>
            update((d) => ({ ...d, waiverSignature: value }))
          }
          error={errorFor(fieldId.waiverSignature)}
          maxLength={LIMITS.signature}
          disabled={busy || !docs.liability_waiver}
        />
        <TextField
          id={fieldId.conductSignature}
          label={`Code of Conduct${docs.code_of_conduct ? ` (version ${docs.code_of_conduct.versionLabel})` : ""}: type your full name to sign as parent or guardian`}
          value={draft.conductSignature}
          onChange={(value) =>
            update((d) => ({ ...d, conductSignature: value }))
          }
          error={errorFor(fieldId.conductSignature)}
          maxLength={LIMITS.signature}
          disabled={busy || !docs.code_of_conduct}
        />
        <CheckField
          id={fieldId.authority}
          label="I am the parent or legal guardian of each child in this registration."
          checked={draft.authorityAffirmed}
          onChange={(checked) =>
            update((d) => ({ ...d, authorityAffirmed: checked }))
          }
          error={errorFor(fieldId.authority)}
          disabled={busy}
        />
      </section>
    </div>
  )
}
