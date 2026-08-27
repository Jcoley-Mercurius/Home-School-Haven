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

## Payments and notifications

The external checkout redirect is not authoritative evidence. Enrollment/payment remains pending or unknown until a trustworthy provider signal or authorized manual verification exists. Retry paths must not create duplicate enrollment or unintended duplicate charges. Email must disclose only the minimum necessary information.

## Backup and incident readiness

Before real-family activation, verify database backup/restore, separate Storage object recovery, migration rollback, credential rotation, and access revocation. Record evidence; do not infer security from an absence of observed failures.

## Open risks

- Owner policy for child data, consent, retention/deletion, media, communications, and staff access is incomplete.
- Financial-policy and checkout-provider truth remain incomplete.
- File safety and recovery controls require implementation and testing.
- Repository and dependency posture are not yet inspected.
