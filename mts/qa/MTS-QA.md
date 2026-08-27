# Home School Haven MTS QA

Record evidence and use `verified`, `partially_verified`, `unverified`, or `failed`. Never claim a pass without running the check.

## Gate 1 — Architecture

- Approved Next.js/TypeScript, Vercel, Supabase, and Resend architecture matches the repository.
- No unapproved overlapping CMS, auth, data, storage, or analytics provider was introduced.
- Local, private-preview, and production boundaries are distinct.
- Repository paths, packages, commands, migrations, and deployment configuration are recorded.

## Gate 2 — Integration and data integrity

- Schemas and migrations are repeatable; generated types are current.
- Validation covers public forms, privileged mutations, uploads, and external responses.
- Enrollment and payment transitions are idempotent and never infer success from redirect/navigation.
- Failure, retry, timeout, pending, waitlist, canceled, and degraded states are tested.

## Gate 3 — Security and privacy

- Secrets remain server-only and absent from source, browser bundles, logs, analytics, and fixtures.
- RLS and server tests prove family ownership, educator assignment, and administrator/owner boundaries.
- Unauthorized users cannot access child/family, assistance, roster, resource, or consent data.
- Sanitized beta fixtures are demonstrably non-real.
- Upload, signed-access, audit, rate-limit, and dependency controls are checked.

## Gate 4 — Reliability and operations

- Logs provide useful operational evidence without sensitive data.
- Migration rollback, credential rotation, deployment rollback, and service-outage behavior are documented.
- Database and file-object restore tests pass before real-family activation.
- Cost posture remains below the approved $100/month ceiling.

## Gate 5 — MPS/MDS synchronization

- Every implemented feature traces to an approved MPS requirement and acceptance criterion.
- All screens consume MDS v1.0 tokens, components, layouts, states, responsive behavior, and WCAG 2.2 AA rules.
- Technology-created states are represented in MDS or reported as gaps.
- Course Builder remains outside Foundation Release.

Overall result: `PASS`, `PASS WITH APPROVED EXCEPTIONS`, `REVIEW REQUIRED`, or `FAIL`.
