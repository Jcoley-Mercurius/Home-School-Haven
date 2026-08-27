# Home School Haven MTS — Approved Selection Record

**System:** Mercurius Technology System  
**Gate:** Approval complete; repository inspection active  
**Verified:** August 26, 2026  
**Decision status:** All recorded selections approved on August 26, 2026  
**Delivery constraint:** Sanitized Samantha-review build in 2–5 days after repository availability  
**Budget constraint:** Below $100/month; credible free tiers preferred  
**Scale:** Fewer than 100 families in year one

**Account ownership:** Josh Coley owns the Vercel and Supabase accounts and will cover their costs. No Home School Haven project configuration has yet been inspected.

## Bottom line

The approved core is a TypeScript/Next.js application deployed on Vercel, with Supabase consolidating authentication, Postgres data, row-level authorization, and file storage, and Resend providing transactional and authentication email through the controlled domain. MDS tokens remain canonical and are implemented through CSS variables plus a constrained styling layer; Radix Primitives and Lucide may supply accessible behavior and the approved icon character without importing a competing visual system.

The providers are **approved, subject to repository compatibility inspection**. The target repository must still be inspected before MTS can finalize versions, paths, dependencies, and deployment commands. Optional additions and plan upgrades remain separately governed.

## Approved technology layers

| Concern | Provisional direction | Status | Why it fits |
|---|---|---|---|
| Application framework | Current stable Next.js App Router with TypeScript | Approved, repository-compatible implementation pending | One codebase for public pages, authenticated portals, server actions/routes, and role-specific shells; strong Josh-and-Codex implementation fit. |
| Commercial hosting | Vercel | Approved; plan level remains staged | Zero-configuration Next.js path, previews and rollback, and low operational burden. Vercel Hobby is restricted to personal or non-commercial use, so the commercial release targets Pro. |
| Identity, database, authorization, and files | Supabase Auth + Postgres + Storage | Approved | Consolidates four required capabilities; Auth integrates with Postgres RLS, and Storage supports RLS-based access. |
| Review-stage backend plan | Supabase Free | Approved for sanitized review only | $0, sufficient published capacity for this scale, but pauses after one week of inactivity and lacks automatic backups. |
| Real-family backend plan | Supabase Pro | Approved requirement before real-family activation | $25/month, no pausing, daily backups, and expanded capacity. Policy approval and security verification remain separate blockers. |
| Transactional/auth email | Resend through Supabase custom SMTP | Approved | Supabase's default SMTP is explicitly non-production and restricted. Verify a dedicated sending subdomain with SPF, DKIM, and DMARC. |
| Public content operations | Custom admin publishing inside the application | Approved; Sanity deferred | Avoids a separate CMS, reduces cost and vendor sprawl, and directly enforces Samantha/admin publishing authority. Sanity may be revisited for future public editorial workflows, never as enrollment or child-data truth. |
| External checkout | Store approved per-program URLs; explicit handoff; manual admin verification | Approved until provider evidence supports an authoritative integration | Preserves approved beta behavior without inventing APIs, webhooks, or successful-payment truth. |
| UI styling | Canonical MDS CSS variables with a constrained Tailwind CSS layer if compatible with the repository | Approved | Supports rapid composition while keeping exact MDS values authoritative. Tailwind must not introduce default design decisions. |
| Accessible interaction primitives | Radix Primitives, selectively | Approved | Supplies focus management, keyboard behavior, and WAI-ARIA-oriented primitives without imposing visual styling. |
| Icons | Lucide React configured to 1.75 px rounded strokes | Approved | Tree-shakable and customizable to the approved MDS icon character. |
| Engineering and MDS QA | TypeScript, ESLint, Playwright, `@axe-core/playwright`, and screenshot/ARIA snapshots | Approved | Covers deterministic checks, primary-flow testing, accessibility automation, and visual/reference comparison. Manual WCAG and MDS checks remain required. |
| Product analytics | PostHog Free after core flow stability; public routes only, cookieless, no person profiles, no session replay | Approved staged | Adds public funnel analytics and feature flags without sending private family/student data. |
| Error monitoring | Vercel logs plus privacy-scrubbed PostHog browser errors; defer Sentry | Approved | Minimizes vendor sprawl while preserving an upgrade path if deeper server tracing is later needed. |
| Runtime AI | None | Approved not applicable for Foundation Beta | The approved beta requirements do not evidence a runtime AI capability. Codex is an implementation tool, not a production service. |

## Cost posture

### Sanitized Samantha-review build

| Service | Expected monthly cost |
|---|---:|
| Vercel Pro | $20 |
| Supabase Free | $0 |
| Resend Free, if custom SMTP is needed | $0 |
| Open-source UI/testing packages | $0 |
| External analytics/error monitoring | Deferred or free |
| **Estimated recurring total** | **Approximately $20/month, excluding domain registration** |

### Before real-family activation

| Service | Expected monthly cost |
|---|---:|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Resend Free at stated scale | $0 |
| Optional free analytics/error-monitoring tiers | $0 |
| **Estimated recurring baseline** | **Approximately $45/month, excluding domain registration and usage overages** |

Both estimates remain below the approved $100/month ceiling. Usage-based charges, taxes, domain costs, and future paid add-ons are not included. Spend caps and alerts should be enabled where available.

Josh owns and funds the two core service accounts, and the full MTS selection is approved. Approval does not itself perform a plan upgrade, create a project, expose credentials, or bypass the staged implementation and repository-inspection workflow.

## Security and data architecture direction

- Use a single Home School Haven organization boundary; do not build generalized multi-tenancy.
- Create authenticated accounts only for parents/guardians, educators, administrators, and Samantha. Student profiles are data records owned by the family, never beta authentication identities.
- Store role and assignment relationships in protected database tables. Do not trust a role, family ID, student ID, program ID, or administrator flag supplied by the browser.
- Enable RLS on every exposed table, revoke default grants, grant only necessary operations, and test both allow and deny cases with database policy tests.
- Keep Supabase secret keys and other private credentials in server-side deployment environments. Never expose them in browser bundles, logs, URLs, analytics, or artifacts.
- Use private storage buckets for learning resources and program-scoped authorization for upload/download operations.
- Keep assistance requests separated from general inquiries and ordinary educator access.
- Store consent evidence and policy versions structurally, but keep real-family activation blocked until Samantha supplies approved policy language and lifecycle rules.
- Store external checkout URLs and manual verification state. A return visit is `pending_verification` or `status_unknown`, never `paid` or `enrolled` without an authoritative administrative outcome.
- For the review build, use sanitized fixtures and sample identities only. Do not send real family, child, consent, assistance, or payment details to analytics or monitoring services.

## Delivery feasibility

The 2–5 day window is feasible for a **sanitized private review build** if the repository is supplied promptly and does not materially conflict with this direction. The fastest credible review scope is:

1. MDS token/theme foundation and role-aware application shell.
2. Public homepage, catalog, program detail, and external-checkout trust states using approved imported content.
3. Invite-only sample parent, educator, administrator, and owner experiences.
4. Parent-controlled sample students, family dashboard, assigned educator workspace, and admin operations using sanitized data.
5. Manual payment-verification and explicit not-confirmed states.
6. Responsive, keyboard, automated accessibility, and primary-flow checks appropriate to the review build.

This window does **not** establish production readiness, authorize real-family data, resolve Samantha's policy checklist, verify the unknown payment provider, or complete every optional/Should feature.

## Alternatives considered

### Cloudflare Workers + D1 + R2

Cloudflare provides an attractive free/low-cost platform: Workers Paid starts at $5/month, D1 has substantial free allowances, and R2 includes a free storage/operations tier with no Internet egress charge. It remains a conditional alternative if minimizing hosting cost becomes more important than delivery speed.

It is not the leading direction for this review window because identity, relational authorization, admin operations, and Next.js deployment would require more custom architecture and platform-specific implementation. That increases risk for Josh and Codex inside 2–5 days.

### Vercel Hobby

Rejected for this commercial product. Vercel's current terms restrict Hobby to personal or non-commercial use.

### Separate Clerk + database + file provider

Not prioritized. It adds provider boundaries and recurring/operational complexity when Supabase can cover identity, relational data, RLS authorization, and files coherently at this scale.

### Separate headless CMS

Not prioritized for Foundation Beta. Administrator program operations and publishing are already approved product capabilities; implementing them in the same application avoids duplicate roles, content models, and authorization systems.

## MDS feedback requirements

MDS v1.0 already defines most necessary states. Implementation should explicitly include:

- invite sent, invite expired, session expired, and access removed;
- save conflict and recovery;
- email delivery failure;
- file processing, rejected file, and unavailable resource;
- degraded service and retry;
- payment status unknown and manual verification required.

These are implementation mappings of existing MDS trust/error patterns, not changes to the approved visual system. Any genuinely new reusable experience convention must return to MDS as a proposed gap.

## Primary-source research record

- Next.js deployment and App Router: https://nextjs.org/docs/app and https://nextjs.org/docs/app/getting-started/deploying
- Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
- Vercel pricing and commercial restriction: https://vercel.com/pricing, https://vercel.com/docs/plans/hobby, and https://vercel.com/legal/terms
- Supabase pricing: https://supabase.com/pricing
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Storage: https://supabase.com/docs/guides/storage
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Resend pricing: https://resend.com/pricing
- Tailwind with Next.js: https://tailwindcss.com/docs/guides/nextjs
- Radix accessibility: https://www.radix-ui.com/primitives/docs/overview/introduction
- Lucide React: https://lucide.dev/guide/react/
- Playwright accessibility testing: https://playwright.dev/docs/accessibility-testing
- Cloudflare Workers, D1, and R2 pricing: https://developers.cloudflare.com/workers/platform/pricing/, https://developers.cloudflare.com/d1/platform/pricing/, and https://developers.cloudflare.com/r2/pricing/
- PostHog pricing and privacy controls: https://posthog.com/pricing and https://posthog.com/docs/privacy/data-collection
- Sentry pricing: https://sentry.io/pricing/

## Next action

Treat this as the approved target architecture. When the repository arrives, inspect it and classify every existing technology before implementation. Reconcile exact versions, paths, dependencies, commands, and deployment configuration without silently changing the approved selections.
