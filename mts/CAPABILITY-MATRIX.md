# Home School Haven Capability Matrix

| Capability | Need | Strategy / approved selection | Foundation status | Key boundary |
|---|---|---|---|---|
| Responsive application | Required | Next.js App Router + TypeScript | Approved; inspect repo | Must implement MDS v1.0 |
| Hosting and preview | Required | Vercel | Approved; inspect config | Separate preview and production |
| Identity | Required | Supabase Auth | Approved | No student beta accounts |
| Authorization | Required | Server-derived roles + RLS | Approved | Deny by default; test ownership and assignment |
| Relational operations data | Required | Supabase Postgres | Approved | One system of record |
| Learning-resource files | Required | Private Supabase Storage | Approved | Signed/scoped access; validate uploads |
| Public/program publishing | Required | In-app Supabase-backed admin | Approved direction | Sanity deferred |
| External checkout | Required | Existing links | Approved handoff; integration unknown | Handoff is not payment truth |
| Inquiry and assistance | Required | Application + Supabase | Approved direction | Assistance remains private |
| Email | Required/Should | Resend custom SMTP | Approved | SPF/DKIM/DMARC; no secrets in client |
| Audit history | Required | Postgres append/attribution model | Approved requirement | Material changes only; immutable attribution |
| Testing | Required | Repository-native tests; Playwright/axe candidate | Reconcile in repo | Do not add duplicate tooling without inspection |
| Runtime logs | Required | Vercel logs | Approved baseline | Scrub sensitive data |
| Product analytics | Optional for first walkthrough | PostHog Free after core stability | Approved staged | Public anonymous routes only; no session replay/person profiles |
| Bot protection | Activation control | Cloudflare Turnstile | Approved | Required before public/real-family activation |
| Database backups | Activation control | Supabase Pro daily backups | Approved stage | Restore test required |
| File-object recovery | Activation control | Scheduled Cloudflare R2 object copy | Approved | Restore test required |
| Full Course Builder | Deferred | No beta implementation | Deferred | Future platform only |

Implementation and validation remain unverified until repository inspection and actual tests are completed.
