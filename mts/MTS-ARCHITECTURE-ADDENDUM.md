# Home School Haven MTS — Architecture Approval and Add-on Recommendation

**System:** Mercurius Technology System  
**Recorded:** August 26, 2026  
**Release:** Private, sanitized Foundation Release review  
**Scale:** Fewer than 100 families in year one  
**Budget:** Below $100/month

## Approved core

Josh approved the following target architecture, subject only to repository compatibility inspection when the application repository arrives:

| Layer | Approved selection | Foundation use |
|---|---|---|
| Application | Next.js App Router + TypeScript | Public site, family portal, educator workspace, and administration |
| Hosting | Vercel | Preview and production deployment |
| Backend | Supabase Auth + Postgres + Row Level Security + Storage | Identity, relational data, server-enforced access, and private learning resources |
| Email | Resend | Supabase custom SMTP and transactional email using the controlled Home School Haven domain |

The repository inspection gate remains open. Inspection may change package versions or implementation details, but it must not silently replace these approved providers.

## Course and program architecture

Do **not** add Sanity to the Foundation Release.

For the approved beta, course and program information is operational product data, not merely editorial content. Supabase should be the single source of truth for:

- programs, terms or cohorts, schedules, capacity, availability, and publication state;
- family enrollments and manual payment-verification state;
- educator-to-program assignments and rosters;
- announcements and learning-resource metadata;
- private files in program-scoped Supabase Storage buckets; and
- future module, lesson, and progress records only when MPS approves that later scope.

The application should provide small, role-aware admin and educator editing surfaces. This keeps publication authority, enrollment truth, and authorization in one model.

Sanity remains a future candidate for independently managed public editorial content—such as articles, guides, or marketing pages—if Samantha later needs a richer nontechnical editorial workflow. It must not become the source of truth for enrollment, pricing, availability, rosters, progress, child data, or access control. Sanity's Free plan is viable for public content, but private datasets are a paid-plan capability; adding it now would duplicate content, identity, and publishing boundaries without closing a Foundation requirement.

## Approved staged services and controls

| Concern | Recommendation | Release timing | Cost posture |
|---|---|---|---:|
| Product analytics | PostHog Cloud Free for anonymous public-site funnels and feature flags | Add after core beta flow is stable | $0 within free allowance |
| Session replay | Disabled by default | Reconsider only after policy, consent, masking, and QA approval | $0 while disabled |
| Authenticated analytics | No identification or private-area autocapture in Foundation Release | Reconsider after child/family privacy policy approval | $0 |
| Error visibility | Vercel runtime logs plus PostHog browser error tracking, with sensitive fields scrubbed | Add after core beta flow is stable | $0 within free allowance |
| Dedicated APM | Do not add Sentry yet | Reconsider if repository inspection or beta defects show a need for deeper server traces | $0 deferred |
| Bot protection | Cloudflare Turnstile on public inquiry/assistance forms and Supabase auth flows | Required before public or real-family activation; optional for Samantha-only review | $0 on Free plan |
| Database recovery | Supabase Pro daily backups before real-family activation | Required before real-family activation | Included in approved Supabase Pro stage |
| File recovery | Scheduled copy of private Supabase Storage objects to Cloudflare R2 | Required before real-family activation | Likely $0 at this scale within R2 free allowance |

### PostHog privacy profile

Foundation configuration should use cookieless public web analytics with `person_profiles: 'never'`, no `identify()` calls, session recording disabled, and an explicit event allowlist. Do not send names, email addresses, family IDs, student IDs, form values, assistance-request content, checkout details, or URLs containing private identifiers. Disable PostHog entirely on family, educator, and administrator routes for the Foundation Release.

PostHog is recommended because one free service can cover lightweight funnel analytics, feature flags, and browser error visibility. Its current free plan stops ingestion at free-tier limits rather than creating an unexpected charge. It does not replace server logs, audit history, or security monitoring.

### Email and domain configuration

Use a dedicated authentication/transactional sending subdomain where DNS control permits, for example `auth.homeschoolhaven.com`, and keep marketing mail separate. Configure and verify SPF and DKIM through Resend, publish DMARC initially in monitoring mode, confirm delivery from every sending system, then tighten the DMARC policy. Use Resend as Supabase custom SMTP before inviting addresses outside the Supabase project team.

### Recovery boundary

Supabase database backups include Storage metadata but not the stored file objects. Database recovery and file recovery are therefore separate controls. Before real-family use, test both a database restore procedure and restoration of a deleted learning-resource object from the secondary object store.

## Still missing before production use

These are architecture controls, not additional paid platforms:

1. Separate local/development, private-preview, and production environments and credentials.
2. Database migrations, generated TypeScript database types, seed fixtures, and deny-by-default RLS tests.
3. Secret inventory and rotation procedure; no service-role or SMTP secret in browser code.
4. Upload allowlist, size limits, server-side validation, private buckets, signed download URLs, and recovery checks.
5. Material-change audit records for enrollment, assignments, publication, consent evidence, and administrative actions.
6. Rate limiting and Turnstile verification for public forms and authentication abuse paths.
7. CI checks for TypeScript, linting, database policy tests, Playwright flows, accessibility, and MDS reference states.
8. Manual checkout reconciliation until the payment provider and authoritative status signal are inspected.
9. Owner-approved child-data, consent, retention, deletion, communication, and financial policy before real-family activation.

## Cost checkpoint

The recommended working baseline remains approximately **$20/month** for a sanitized review build (Vercel Pro; Supabase, Resend, PostHog, and Turnstile on free tiers) and approximately **$45/month** before real-family activation when Supabase Pro is added. Cloudflare R2 should remain free at the stated scale if backup storage stays within its current 10 GB-month allowance. This leaves substantial room under the approved $100/month ceiling.

## Primary-source record

- Sanity plans, limits, and private datasets: https://www.sanity.io/docs/platform-management/plans-and-payments, https://www.sanity.io/docs/content-lake/technical-limits, https://www.sanity.io/docs/content-lake/datasets
- PostHog pricing, privacy controls, and Next.js integration: https://posthog.com/pricing, https://posthog.com/docs/privacy/data-collection, https://posthog.com/docs/libraries/next-js
- Supabase custom SMTP, CAPTCHA, and backups: https://supabase.com/docs/guides/auth/auth-smtp, https://supabase.com/docs/guides/auth/auth-captcha, https://supabase.com/docs/guides/platform/backups
- Resend domain authentication: https://resend.com/docs/dashboard/domains/introduction, https://resend.com/docs/dashboard/domains/dmarc
- Cloudflare Turnstile and R2: https://developers.cloudflare.com/turnstile/, https://developers.cloudflare.com/r2/pricing/

## Approval boundary

The complete architecture is approved. This includes the Sanity exclusion for Foundation Release, privacy-limited PostHog, Turnstile, R2 recovery, staged Supabase plan, manual checkout reconciliation, constrained UI/testing layer, and the deferral of Sentry and runtime AI. The course-builder horizon remains governed by MPS and is not expanded by this approval.
