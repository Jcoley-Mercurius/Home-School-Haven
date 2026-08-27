# Home School Haven Technology Blueprint

**MTS:** v1.0  
**Consumes:** MPS v1.0 and MDS v1.0  
**Architecture status:** Fully approved, subject to repository compatibility inspection

## Goals and constraints

- Deliver Samantha's sanitized private review in 2–3 days when possible and within 5 days.
- Support fewer than 100 families in year one.
- Keep recurring software below $100/month; use credible free tiers where safe.
- Favor a small managed stack that Josh and Codex can operate.
- Preserve approved product policy and MDS behavior without technology-created scope.

## Architecture

| Layer | Approved selection | Responsibility |
|---|---|---|
| Web application | Next.js App Router + TypeScript | Public, family, educator, and admin surfaces |
| Hosting | Vercel | Preview and production environments |
| Identity | Supabase Auth | Parent, educator, administrator, and owner identity; no student beta login |
| Data | Supabase Postgres | Programs, cohorts, enrollment, assignments, announcements, resources, audit records |
| Authorization | Server-derived roles + Supabase RLS | Deny-by-default ownership, assignment, and privileged-operation enforcement |
| Files | Private Supabase Storage | Program-scoped learning resources using signed access |
| Email | Resend + Supabase custom SMTP | Verification and transactional messages |
| Payments | Existing program-specific external links | Handoff only; manual or authoritative reconciliation required |

Supabase is the Foundation Release operational system of record. Sanity is deferred because program, enrollment, roster, resource, and access-control data are permissioned operational data.

## Environment boundary

Maintain separate local/development, private-preview, and production environments and credentials. The private preview may use sanitized fixtures. Do not load real-family data until the owner policy and security gates are satisfied.

## Data and flow rules

1. The browser sends validated requests to server-controlled application boundaries.
2. Identity and role are derived from the authenticated session, never browser-supplied role claims.
3. Server actions/routes and RLS independently enforce family ownership, educator assignment, and privileged admin operations.
4. External checkout starts a pending/unknown payment path; browser return alone never marks paid or enrolled.
5. Private resources remain in private buckets and are delivered only through scoped signed access.
6. Material program, price, schedule, capacity, enrollment, assignment, consent, and publication changes retain attributable history.

## Observability and analytics

Vercel runtime logs are the approved Foundation baseline. Never log secrets, child/family details, assistance content, consent text, or checkout data. PostHog is approved after the core flow is stable, limited to anonymous public routes with cookieless capture, `person_profiles: 'never'`, session replay disabled, and a sensitive-data denylist. It is disabled on authenticated routes. Privacy-scrubbed PostHog browser errors are approved; Sentry is deferred until deeper server tracing is evidenced.

## Reliability and recovery

Use migrations, generated database types, deterministic seed fixtures, retry-safe mutations, explicit degraded states, and rollback instructions. Supabase Free is approved for the sanitized review; Supabase Pro daily database backups and a scheduled independent Cloudflare R2 copy of Storage objects are approved requirements before real-family activation. Neither recovery path is verified until restore tests pass. Cloudflare Turnstile is approved before public or real-family activation.

## Open gates

- Inspect and classify the target repository.
- Identify the current checkout provider and authoritative payment-status signal.
- Complete Samantha's child-data/consent and financial-policy decisions before real-family activation.
- Reconcile exact packages, paths, commands, environment variables, migrations, CI, and deployment configuration from repository evidence.
