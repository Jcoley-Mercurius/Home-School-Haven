# Home School Haven Security Architecture

**Status:** Approved control architecture; implementation unverified

## Actors and data

Roles are public visitor, parent/guardian, educator, administrator, owner, and service identities. Protected assets include accounts, contact data, student profiles, rosters, enrollment/payment state, consent evidence, assistance requests, learning resources, and audit history. Minor/family data, consent, assistance, and payment/enrollment references are high sensitivity; credentials are critical.

## Trust boundaries

- Public browser → public application
- Authenticated browser → server-controlled application
- Application server → Supabase, Resend, Vercel, and external checkout
- Administrator/owner operations → protected data and audit controls

## Mandatory controls

- Derive identity and role from authenticated server context.
- Enforce family ownership, educator program assignment, and privileged actions in RLS and server logic.
- Deny by default and apply least privilege to human and service identities.
- Keep service-role and email credentials server-only and environment-separated.
- Validate inputs, encode outputs, constrain uploads by allowed type/size, and keep buckets private.
- Prevent sensitive fields from entering logs, analytics, URLs, errors, prompts, or fixtures.
- Preserve attributable audit history for material administrative changes.
- Rate-limit abuse-prone actions; add an approved bot-control before public/real-family activation.
- Use sample or sanitized child/family data for the private review.

## Registration data (Slice 2, 2026-09-18; Slice 2.5, 2026-09-19)

Registration health data (allergy, medical, accommodation), guardian, emergency, and pickup contacts, STEP UP references, and acceptance evidence are high-sensitivity minor and family data. They live only in the nine `registration_*` tables, never on `students` or any other broadly read table.

- **Write path:** only `public.submit_family_registration(uuid, jsonb)`.
  - It derives the family and parent role from `auth.uid()`, rejects unknown payload keys, is idempotent per (parent, key), and is atomic.
  - It requires a guardian phone, at least one emergency contact and one pickup person, and explicit health answers.
  - It validates attendance against `program_attendance_rules`.
  - Its errors name payload paths, never values.
- **Renewal path:** `public.renew_registration_documents`, for a parent in the registration's family.
- **Admin path:** `admin_set_step_up_state` (STEP UP outcomes only; never enrollments) and `owner_publish_registration_document` (owner role only; blocked while the approval lock stands).

**Access matrix (MPS DEC-027):**

| Data | Family (own) | Assigned educator | Unassigned educator / anon | Admin / owner |
|---|---|---|---|---|
| Guardian contacts, medical, accommodation, media choice, signatures, acceptances, STEP UP | read (RLS) | — | — | read (RLS) |
| Allergy answer and details, emergency contacts, pickup persons | read (RLS) | confirmed children in assigned programs, via `educator_child_safety(program)` only | — | read (RLS) |

- Educators have **no** policy on any registration table.
- The function refuses a nonexistent program and an unassigned one identically (`42501`).
- Neither roster view reads registration data.

**Evidence:** immutable once written, except the STEP UP review state, which may change only along the allowed transitions, enforced by a guard trigger. The audit trail holds counts, states, and ids only.

**Activation locks:**

- `check (is_sample)` on every table.
- `demo-unapproved-v0`.
- `registration_document_versions_approval_locked`: no document version can be approved, so no draft acceptance qualifies.

STEP UP gained outcomes in Slice 2.5 but stays sample-only by table constraint. Each lock must be lifted by an owner-approved migration carrying the approval evidence (MPS GAP-014, GAP-016).

**Retention:** there is a minimum only. Data may remain at least 30 days after the child leaves (DEC-031). No deletion job exists. Deletion still cascades from student and family removal, and deletion policy is GAP-016.

## Payments and notifications

The external checkout redirect is not authoritative evidence. Enrollment/payment remains pending or unknown until a trustworthy provider signal or authorized manual verification exists. Retry paths must not create duplicate enrollment or unintended duplicate charges. Email must disclose only the minimum necessary information.

## Backup and incident readiness

Before real-family activation, verify database backup/restore, separate Storage object recovery, migration rollback, credential rotation, and access revocation. Record evidence; do not infer security from an absence of observed failures.

## Open risks

- Owner policy for child data, consent, retention/deletion, media, communications, and staff access is incomplete.
- Financial-policy and checkout-provider truth remain incomplete.
- File safety and recovery controls require implementation and testing.
- Repository and dependency posture are not yet inspected.
