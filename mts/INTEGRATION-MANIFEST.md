# Home School Haven Integration Manifest

**Status:** Approved service contract; repository mapping recorded 2026-08-27 from the `feat/supabase-auth-foundation` implementation pass.

Do not invent paths. Each row below is evidenced by the file it names. A row still marked `INSPECT` has not been built yet.

| Area | Approved contract | Repository mapping |
|---|---|---|
| Next.js application | App Router + TypeScript | `src/app/` — Next.js 16.3.3, React 19.2.8, TypeScript 5, `@/*` → `./src/*` |
| Styling | Consume `mds/tokens/tokens.css` or map tokens exactly into existing conventions | `src/app/globals.css` — MDS tokens as `--hsh-*` CSS variables; Tailwind 4 via `@tailwindcss/postcss` |
| Supabase client/server utilities | Separate browser-safe and server-only clients | `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (`server-only`), `src/lib/supabase/middleware.ts` + root `middleware.ts` (session refresh). `@supabase/ssr` 0.12.5, `@supabase/supabase-js` 2.112.4, both pinned. |
| Database schema/migrations | Versioned migrations; generated TS types | `supabase/migrations/` (4 migrations, each with a `-- rollback:` block); types at `src/lib/supabase/database.types.ts` via `npm run db:types`, drift-checked by `npm run db:types:check`. **Types are currently hand-authored and unverified — see the gap below.** |
| RLS policies/tests | Deny-by-default family, assignment, and admin controls | `supabase/migrations/*_foundation_rls_policies.sql`; pgTAP tests in `supabase/tests/database/` run by `npm run db:test`. Server-side re-authorization in `src/lib/auth/guards.ts`. |
| Authentication surface | Sign-in, sign-out, recovery, emailed-link verification, server-derived role routing | `src/app/(auth)/` (sign-in, forgot-password, reset-password, link-expired), `src/app/auth/confirm/route.ts` (server-side `verifyOtp` / `exchangeCodeForSession`), `src/lib/auth/` (`session.ts`, `guards.ts`, `return-to.ts`, `link-types.ts`, `recovery-cookie.ts`). One return-destination allow-list, unit-tested in `tests/auth-return-to.test.mts`. |
| Auth email templates | Links verified on the server, not in the browser | `supabase/templates/{recovery,invite,confirmation,email-change}.html`, wired via `[auth.email.template.*]` in `supabase/config.toml`. They build the link from the token hash pointed at `/auth/confirm` rather than the default confirmation URL, whose fragment-borne tokens the server cannot read. |
| Storage | Private program-scoped resources; signed access | `INSPECT` — not built. MTS IMPLEMENTATION-PLAN Phase 4. |
| Resend | Server-only transactional delivery and custom SMTP | `INSPECT` — **still not configured.** The recovery and verification *flows* are built (rows above) and are exercisable against a local stack's Mailpit. What is missing is delivery: hosted email falls back to Supabase's shared sender, limited to two per hour. Blocks real-family activation, and blocks the account-creation half of MPS-REQ-011 — which is also blocked by an undefined provisioning policy, a product gap rather than a technical one. |
| External checkout | Program-specific URL handoff and explicit pending state | `programs.checkout_url` column + `src/components/program/checkout-handoff.tsx`. NULL for every program: the approved artifacts authorize the current links but record no URL. |
| CI and E2E | Typecheck, lint, unit/integration, Playwright, accessibility, visual checks | `npm run typecheck` · `lint` · `format:check` · `test:unit` (`node --test`, `.mjs` + `.mts`) · `test:e2e` (Playwright against a production build on `127.0.0.1:3100`, with `@axe-core/playwright`) · `check:demo-assets` (release gate, wired into `prebuild`) |

## Environment-variable contract

Recorded from repository evidence. The authoritative copy is `.env.example`, which carries names and empty values only.

| Name | Purpose | Exposure |
|---|---|---|
| `HSH_RELEASE_TARGET` | Environment identity: `local` \| `preview` \| `production`. Falls back to `VERCEL_ENV`. Reused from the existing release-gate convention in `scripts/check-demo-placeholders.mjs`. | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser, by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. RLS is what protects the data. | Browser, by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accepted alias for the same value. Supabase is mid-migration from legacy `anon` keys to publishable keys and a project's dashboard shows one or the other; both work with `@supabase/ssr`. `PUBLISHABLE` wins when both are set. | Browser, by design |
| `NEXT_PUBLIC_SITE_URL` | Canonical application URL. Now has a consumer: `src/app/(auth)/forgot-password/actions.ts` builds the `/auth/confirm` callback from it. Must match the Supabase site URL for the same environment, and the callback must be in Supabase's redirect allow-list. | Browser, by design |

**No Supabase secret / service-role key is defined, read, or required by any application code path.** Seeding, migration, and type generation are Supabase CLI operations that carry their own credentials. Adding a secret to the runtime requires an approved server-side need (SECURITY-ARCHITECTURE, least privilege). A Resend credential will be added, server-only, when Phase 3 wires transactional email.

Validation lives in `src/lib/env.ts`: absent configuration is a supported state that returns `null` so public pages still render, while a partially set or malformed value throws rather than silently degrading to staged content. Failure messages never echo the offending value, so a secret pasted into the wrong variable cannot reach a log.

## Integration rules

- Validate all external and form input at the server boundary.
- Treat external checkout responses and redirects as untrusted.
- Use idempotency for enrollment, payment reconciliation, invitations, and email-triggering mutations.
- Verify any future webhook signature and handle replay, ordering, retries, and timeouts.
- Keep private data out of URLs and analytics.
- Record external DNS, Supabase, Resend, and Vercel setup as explicit human-owned steps.

## Finding recorded 2026-08-27 — Data API privilege surface

The linked Supabase project (`uedgcwoxyhtirsihvrnf`) applies the **legacy auto-expose behavior** for new tables: after the first four migrations, `anon` and `authenticated` held `INSERT, UPDATE, DELETE, TRUNCATE` on every table in `public`, including `user_roles`. The local `config.toml` applies the newer always-revoked behavior and grants nothing, so the same migrations produced two different privilege surfaces.

Nothing was exposed. RLS is deny-by-default, no policy grants `anon` a row, and `user_roles` has no write policy for any role, so the escalation path was already closed. The defects were that the privilege layer contradicted the documented least-privilege design (SECURITY-ARCHITECTURE), and that local tests would not have exercised the production surface.

Resolved by `supabase/migrations/20260828010906_foundation_least_privilege_grants.sql`, which revokes everything from both Data API roles and re-grants exactly the documented matrix, in every environment. Verified against the live project:

| Table | anon | authenticated |
|---|---|---|
| `programs` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `profiles` | — | SELECT, UPDATE |
| `user_roles` | — | SELECT |
| `families` | — | SELECT |
| `family_members` | — | SELECT |
| `educator_assignments` | — | SELECT, INSERT, DELETE |
| `audit_events` | — | SELECT |

Regression-tested by `supabase/tests/database/00_setup.test.sql`, which fails if any table grants a write privilege to `anon`.

## Open gap recorded 2026-08-27

**Resolved 2026-08-27.** The project is linked to the hosted Supabase project `uedgcwoxyhtirsihvrnf` (`Home-School-Haven`, us-east-1, Postgres 17.6). All five migrations are applied remotely and `supabase migration list --linked` shows local and remote in sync. `src/lib/supabase/database.types.ts` is now genuinely generated from the live schema, and `npm run db:types:check` passes against it. The hand-authored stand-in it replaced turned out to match the real schema on every column and enum.

`npm run db:types` and `npm run db:types:check` run against `--linked`, not `--local`.

**Still open:** `supabase test db` (the pgTAP authorization suite) runs only against a local stack, which needs Docker. Those 53 assertions remain unexecuted. The equivalent boundary has been verified against the live project by direct HTTP probe as an anonymous client — every private table returns `401 permission denied`, `programs` returns 200, and both an anonymous role-grant insert and an anonymous program insert are refused — but that is not a substitute for the full role matrix.

Owner action to close: install Docker in WSL, then `npm run db:start && npm run db:reset && npm run db:test`.

## Finding recorded 2026-08-27 — public-page rendering and freshness

Three defects surfaced only once a real Supabase project was connected, and all three are fixed:

1. **`generateStaticParams` used the cookie-bound client.** It runs at build time with no HTTP request, so `cookies()` threw. Build-time and public reads now use a request-less anonymous client (`src/lib/supabase/anonymous.ts`), which is also subject to the `anon` RLS policy — so nothing prerendered can be anything a signed-out visitor may not see.
2. **Public pages read through the session-bound client**, which made them fail with `DYNAMIC_SERVER_USAGE` and returned HTTP 500 instead of 404 for an unpublished program. Public program reads are now anonymous, so `/` and `/programs` render statically again and a missing program is a clean 404.
3. **Middleware ran on every request**, including Next.js link prefetches of public pages, adding a Supabase Auth round trip to each. It is now scoped to `/account`, `/family`, `/educator`, `/admin`, and `/sign-in`, and additionally returns immediately when the request carries no Supabase auth cookie. Route authorization was never done in middleware — each protected page calls its own guard — so narrowing it removes no control.

**Accepted limitation.** Public program pages are statically prerendered with no time-based revalidation. Time-based ISR was tried and reverted: with `revalidate` set, Next.js 16.3.3 left prefetch RSC requests in flight for 25+ seconds each. A static prerender therefore captures the database as of build time, and a published program change will not reach the public site until the next deploy. That is acceptable while no administrator write surface exists — every program change currently goes through a migration or seed followed by a deploy. When that surface lands (IMPLEMENTATION-PLAN Phase 4), the remedy is on-demand `revalidatePath()` from the publishing server action, which preserves MPS-REQ-020 consistency without the prefetch behavior.

## Finding recorded 2026-08-27 — test harness

The Playwright runner did not load `.env.local` (Next.js loads it; the test process does not), so every `test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL)` guard skipped unconditionally. The cross-role authorization matrix would have reported "skipped" indefinitely while appearing healthy. `playwright.config.ts` now calls `loadEnvConfig()` so the runner sees the same environment as the app.

Separately, a stale `next start -p 3100` was silently reused by the Playwright `webServer` (`reuseExistingServer`), causing a full suite to pass against a build made before Supabase was configured. Kill stray servers before trusting a run; the README already warns about this.
