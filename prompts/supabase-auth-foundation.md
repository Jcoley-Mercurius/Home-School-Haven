# Implementation Prompt — Supabase Foundation: data, identity, authorization

**Branch:** `feat/supabase-auth-foundation`
**MTS phase:** IMPLEMENTATION-PLAN Phase 1 (foundations) + the data half of Phase 2
**Status:** awaiting owner approval

---

## 1. Goal and scope

Stand up the MTS-approved Supabase foundation so that identity, role, and
ownership are enforced in Postgres and on the server, and so that public program
content is read from the system of record instead of a static module.

### In scope

1. `@supabase/supabase-js` + `@supabase/ssr` + `server-only` dependencies.
2. Environment validation and local / preview / production separation.
3. `supabase/` CLI project: `config.toml`, versioned migrations, sanitized seed,
   pgTAP database tests.
4. Schema: `programs`, `profiles`, `user_roles`, `families`, `family_members`,
   `educator_assignments`, `audit_events`.
5. Deny-by-default RLS on every table, with server-side re-authorization.
6. Generated TypeScript database types + `npm run db:types`.
7. Browser / server / middleware Supabase client boundaries and session refresh.
8. Password sign-in, sign-out, and role-routed `/account`.
9. Protected route groups `/family`, `/educator`, `/admin` with server-enforced
   authorization and minimal role-proving shells.
10. Public program pages read from Supabase.
11. Positive and negative authorization tests (pgTAP + Playwright) and docs.

### Explicitly out of scope (deferred, with reasons in §9)

- Student profiles, consent records, enrollment, and payment state.
- Sign-up, email verification, and recovery flows (MTS Phase 3).
- Educator/admin operational features (MTS Phase 4).
- Supabase Storage, Resend wiring, Turnstile, PostHog, R2.
- Any Course Builder behavior.

---

## 2. Traceability

| Source | IDs |
|---|---|
| MPS requirements | MPS-REQ-004 (private data unreachable by public/unassigned educators), MPS-REQ-007, MPS-REQ-008, MPS-REQ-018 (educator limited to assigned programs), MPS-REQ-020 (one authoritative program truth), MPS-REQ-021 (truthful states), MPS-REQ-024 (attributable history) |
| MPS rules | MPS-RUL-005 (only admin/owner publish), MPS-RUL-006 + MPS-RUL-007 (sanitized data; approved minimum fields only), MPS-RUL-010 (no invented policy language) |
| MPS workflows | MPS-WFL-001, MPS-WFL-005, MPS-WFL-006 (data/authorization substrate only) |
| MPS exception | EXC-001 — sanitized Foundation work may proceed while GAP-005 and GAP-010 remain open |
| MDS | `navigation` (public_header, portal_sidebar, account_menu), `page_shells.authentication` (centered 440px panel), `patterns.authentication`, `patterns.empty`, `patterns.error`, `patterns.loading`, layout grid/breakpoints, WCAG 2.2 AA |
| MTS | TECHNOLOGY-BLUEPRINT "Architecture"/"Environment boundary"/"Data and flow rules", SECURITY-ARCHITECTURE "Mandatory controls", MTS-ARCHITECTURE-ADDENDUM "Still missing before production use" items 1–2 and 5, IMPLEMENTATION-PLAN Phase 1, INTEGRATION-MANIFEST (replaces `INSPECT` rows) |

---

## 3. Repository evidence inspected

- `package.json` — Next 16.3.3, React 19.2.8, TS 5, Tailwind 4, Playwright
  1.62.1, `@axe-core/playwright`, `zod` 4.4.3, `@base-ui/react`. **No Supabase
  package is installed today.** Scripts: `dev/build/start/lint/typecheck/
  format/format:check/test:e2e/test:unit/prebuild/check:demo-assets`.
- `tsconfig.json` — strict, `@/*` → `./src/*`, includes `**/*.mts`.
- `.gitignore` — ignores `.env*` with no exception; needs `!.env.example`.
- `playwright.config.ts` — builds and serves on `127.0.0.1:3100`, single
  `desktop` project, `testDir: ./tests/e2e`.
- `src/content/programs.ts` — 322 lines. Its header already states this is "the
  approved staging step for content that moves to Supabase-backed program
  administration… the `Program` shape is what a Supabase row will provide, so
  replacing this module changes no component contract." Exports `programs`,
  `getProgram`, `featuredPrograms`, `relatedPrograms`, `publishedFacts`,
  `programHref`, `featuredSlugs`, types `Program`, `AvailabilityState`,
  `ImportStatus`, `PlaceholderImage`.
- `src/lib/guidance/recorder.ts` — documents that Supabase is absent and notes
  that the server-only boundary is "maintained by review rather than enforced by
  the compiler" because `server-only` is not a dependency.
- `src/app/programs/page.tsx`, `src/app/programs/[slug]/page.tsx`,
  `src/app/page.tsx` — synchronous static reads of the content module;
  `generateStaticParams` enumerates `programs`.
- `src/components/ui/*` — `button`, `card`, `field`, `input`, `checkbox`,
  `badge`, `text-link`, `select`, `radio-group`, `textarea` exist and are
  reusable for the sign-in form (REUSE before CREATE).
- `src/components/layout/*` — `site-header`, `site-footer`, `skip-link`,
  `breadcrumbs`.
- No `middleware.ts`, no `supabase/` directory, no `.env*` files.

### Toolchain evidence

- `supabase` CLI **2.111.0** and `psql` **18.6** are installed.
- **Docker is not installed and no local Postgres server is present**
  (`postgresql-client` only; no `initdb`/`postgres` binary; `pg_isready` fails).
  `sudo` is non-interactive-blocked.

---

## 4. Assumptions and unresolved gaps

| # | Assumption | Consequence if wrong |
|---|---|---|
| A1 | Foundation identity uses email + password sign-in for accounts provisioned by seed/admin. Self-service sign-up, verification, and recovery (MPS-REQ-011) belong to Phase 3 once Resend SMTP is configured. | Sign-in UI grows a sign-up path later; no schema change. |
| A2 | The `Program` type in `src/content/programs.ts` is the correct row shape, as its own header asserts. | Migration column list changes. |
| A3 | Roles are `parent`, `educator`, `admin`, `owner`, derived from ACT-001/003/004/006. ACT-007 (invited secondary guardian) is modelled as a `family_members.member_role` value, not an app role. | Enum values change. |
| A4 | Publishable/secret key naming (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) per current Supabase SSR docs; legacy `anon`/`service_role` names are not introduced. | Env names change. |
| A5 | No service-role/secret key is used by application runtime code at all in this pass. Seeding is a CLI operation. | — |

**Gaps that stop work rather than get invented** — see §9.

---

## 5. Expected files

### New — Supabase project

```
supabase/config.toml
supabase/migrations/<ts>_foundation_roles_and_identity.sql
supabase/migrations/<ts>_foundation_programs.sql
supabase/migrations/<ts>_foundation_audit_history.sql
supabase/migrations/<ts>_foundation_rls_policies.sql
supabase/seed.sql
supabase/tests/database/00_setup.test.sql
supabase/tests/database/10_rls_programs.test.sql
supabase/tests/database/20_rls_family.test.sql
supabase/tests/database/30_rls_educator.test.sql
supabase/tests/database/40_rls_admin_and_audit.test.sql
supabase/README.md
```

Migration filenames are created with `supabase migration new <name>`, never
hand-invented.

### New — application

```
middleware.ts
.env.example
src/lib/env.ts                       # server-only, zod-validated
src/lib/supabase/database.types.ts   # generated
src/lib/supabase/client.ts           # browser, publishable key
src/lib/supabase/server.ts           # RSC/action/route, cookie-bound
src/lib/supabase/middleware.ts       # session refresh helper
src/lib/auth/session.ts              # server-only identity + role derivation
src/lib/auth/guards.ts               # requireUser / requireRole / requireFamily
src/lib/programs/repository.ts       # Supabase-backed Program reads
src/app/(auth)/sign-in/page.tsx
src/app/(auth)/sign-in/actions.ts
src/app/(auth)/layout.tsx            # MDS authentication shell
src/app/account/page.tsx             # role router
src/app/(portal)/layout.tsx          # portal shell + role sidebar
src/app/(portal)/family/page.tsx
src/app/(portal)/educator/page.tsx
src/app/(portal)/admin/page.tsx
src/components/layout/portal-nav.tsx
src/components/auth/sign-in-form.tsx
src/components/auth/sign-out-button.tsx
```

### Modified

```
package.json          # deps + db:* and test scripts
.gitignore            # !.env.example
src/content/programs.ts        # becomes the documented offline fallback catalog
src/app/programs/page.tsx      # async, repository-backed
src/app/programs/[slug]/page.tsx
src/app/page.tsx               # featured programs from repository
src/components/layout/site-header.tsx   # Sign In / Account entry (MDS navigation.public)
mts/INTEGRATION-MANIFEST.md    # replace INSPECT rows with evidenced paths (the file instructs this)
README.md                      # local setup
```

### New — tests

```
tests/e2e/auth.spec.ts          # unauthenticated redirect, sign-in, sign-out
tests/e2e/authorization.spec.ts # cross-role denial matrix
tests/supabase-env.test.mjs     # env validation unit tests
tests/program-repository.test.mjs # row → Program mapping + fallback behavior
```

---

## 6. Schema and authorization design

### Enums

- `public.app_role`: `parent | educator | admin | owner`
- `public.family_member_role`: `primary_guardian | invited_guardian`
- `public.program_publication_state`: `draft | published | archived`
- `public.availability_state`: `open | limited | waitlist | closed | unknown`
  (exactly the MDS `enrollment_state` vocabulary already used by
  `src/content/programs.ts`)

### Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | one row per `auth.users` | `id uuid pk references auth.users(id) on delete cascade`, `display_name text`, timestamps. Populated by an `after insert on auth.users` trigger. |
| `user_roles` | authoritative role grants | `(user_id, role)` composite pk. **No client write policy exists at all.** Grants are made by migration/seed or a future admin server path. |
| `families` | family account | `id`, `name`, timestamps. |
| `family_members` | user ↔ family | `(family_id, user_id)` pk, `member_role`. |
| `educator_assignments` | educator ↔ program | `(educator_user_id, program_id)` pk, `assigned_at`, `assigned_by`. |
| `programs` | system of record | every column of the `Program` type, plus `publication_state`, `checkout_url`, `sort_order`, `created_at/updated_at`. `slug` unique. |
| `audit_events` | attributable history (MPS-REQ-024) | `id`, `occurred_at`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `changed_fields jsonb`. Append-only: no UPDATE/DELETE policy, and `revoke update, delete` from `anon`/`authenticated`. |

### Authorization helpers

All in schema `private` (not exposed to the Data API), `SECURITY DEFINER`,
`STABLE`, `set search_path = ''`, with `EXECUTE` revoked from `PUBLIC` and
granted only to `authenticated`:

- `private.has_role(target public.app_role) returns boolean`
- `private.is_admin() returns boolean` — true for `admin` or `owner`
- `private.is_family_member(target_family uuid) returns boolean`
- `private.is_assigned_educator(target_program uuid) returns boolean`

They read `public.user_roles` / `public.family_members` /
`public.educator_assignments` with `(select auth.uid())`. `SECURITY DEFINER` is
used **only** to break RLS recursion on those lookup tables, each body performs
its own `auth.uid()` check, and they live outside the exposed schema — per the
Supabase security checklist. Roles are never read from `user_metadata`.

### RLS matrix (deny by default; RLS enabled on every table)

| Table | anon | parent | educator | admin/owner |
|---|---|---|---|---|
| `programs` | SELECT where `publication_state = 'published'` | same | same, **plus** assigned non-published rows | SELECT all; INSERT/UPDATE/DELETE all |
| `profiles` | — | own row SELECT/UPDATE (`USING` + `WITH CHECK`) | own row | SELECT all |
| `user_roles` | — | own rows SELECT | own rows SELECT | SELECT all; **no write policy for anyone** |
| `families` | — | SELECT where `private.is_family_member(id)` | — | SELECT all |
| `family_members` | — | SELECT where `private.is_family_member(family_id)` | — | SELECT all |
| `educator_assignments` | — | — | SELECT where `educator_user_id = auth.uid()` | SELECT/INSERT/DELETE all |
| `audit_events` | — | — | — | SELECT all; no write policy (rows come from a `SECURITY DEFINER` trigger) |

Every policy names its `TO` role explicitly and pairs it with an ownership or
role predicate — `TO authenticated` is never used alone. Every UPDATE policy
carries both `USING` and `WITH CHECK`. `auth.role()` is not used. `auth.uid()`
is always wrapped as `(select auth.uid())`.

A trigger on `programs` writes `audit_events` rows for material changes to
publication state, price presentation, schedule, capacity, and availability
(MPS-REQ-024).

### Server-side enforcement

RLS is the floor, not the fence. `src/lib/auth/guards.ts` re-derives identity and
roles from `supabase.auth.getClaims()` on the server and redirects/404s before
any query runs. `getSession()` is never used for an authorization decision. No
role, family id, or ownership claim is ever read from a request body, query
string, or cookie other than the Supabase auth cookie.

---

## 7. Sanitized seed data (MPS-RUL-007, AGENTS.md §11)

`supabase/seed.sql` is local/preview only and begins with a guard that aborts if
`current_setting('app.environment', true) = 'production'`.

- **Programs:** the published facts already committed in
  `src/content/programs.ts`, which come from `mps/BETA-CONTENT-IMPORT-INVENTORY.md`.
  Unpublished facts stay `NULL`; nothing is invented. One extra `draft` program
  exists solely so the "anon cannot see drafts" test has a target.
- **People:** obviously synthetic. Emails on `@example.com`, names drawn from a
  `Sample` prefix (e.g. `sample.parent@example.com`, "Sample Parent One"). No
  real family, child, educator, or owner identity appears. No student rows exist
  at all in this pass.
- Fixed UUIDs so tests are deterministic; a fixed local-only password constant
  that appears nowhere outside `supabase/seed.sql`.

---

## 8. Public program-data integration

`src/lib/programs/repository.ts` exposes `listPublishedPrograms()`,
`getPublishedProgram(slug)`, `listFeaturedPrograms()`, `listRelatedPrograms()`
returning the **existing `Program` type**, so no component contract changes.

Three honest states (MPS-REQ-021):

1. **Supabase configured and reachable** → rows from `programs`.
2. **Supabase not configured** (no env, e.g. today's demo preview) → the
   committed staging catalog in `src/content/programs.ts`, which is the same
   approved published content. This is documented in the module header as a
   Phase-1 staging fallback, not a second source of truth.
3. **Supabase configured but the query fails** → the approved `patterns.error`
   state. It does **not** silently fall back, because that would present stale
   content as live truth.

Program pages become `async`; `generateStaticParams` reads the repository. The
detail route uses `dynamicParams` so a program added in Supabase after build
still resolves.

---

## 9. Gaps reported, not invented

| ID | Gap | Effect on this work |
|---|---|---|
| **MPS GAP-005 / DEP-BETA-003** | Minimum student-profile fields, consent language, retention, and deletion policy are unconfirmed. MPS-RUL-006 permits "only the approved minimum fields" and no approved list exists. | **No `students`, `consents`, or `enrollments` table is created.** Inventing columns here would be inventing child-data policy. Needs Samantha's checklist sections. |
| **MPS GAP-010** | Financial policy and the authoritative checkout signal are unresolved. | No payment or enrollment-state table. `programs.checkout_url` stores the existing `pay.homeschoolhaven.org` handoff link only. |
| **MDS** | `page_shells.authentication` and `navigation.portal_sidebar` are approved in writing but have **no canonical reference image** (`mds/references/REFERENCE-INDEX.md` covers homepage, family dashboard, educator, admin, foundations, components, navigation blueprint). | Built from the written MDS spec, which outranks visual inference (AGENTS.md §7). Screenshot baselines for `/sign-in` and the portal shell are recorded as *new* baselines and flagged for owner review rather than compared against an approved reference. |
| **MTS / environment** | No Supabase project, credentials, or `.env` exist; **Docker is absent**, so `supabase start`, `supabase db reset`, `supabase test db`, and `supabase gen types --local` cannot execute in this workspace. | Migrations, seed, pgTAP tests, and exact commands are delivered and reviewable, but **the database checks in §11 cannot be run here.** They are listed as owner-owned setup in §12 and will be reported as NOT RUN, never as passed. `database.types.ts` is hand-authored to match the migrations exactly and carries a header requiring regeneration via `npm run db:types` on first connection; a CI drift check is added. |

---

## 10. Security, privacy, and rollback

- Secret key never appears in application code, `NEXT_PUBLIC_*`, fixtures,
  screenshots, or logs. `.env.example` carries names and empty values only.
- `src/lib/env.ts` and every server-only module import `server-only`, which also
  closes the compiler-boundary gap documented in `src/lib/guidance/recorder.ts`.
- Auth errors are returned as generic, non-enumerating messages ("That email and
  password did not match"). No email-existence oracle.
- No child/family/contact value is logged. Sign-in failures log nothing but a
  counter-safe event.
- Every migration ships with a commented `-- rollback:` block; `supabase/README.md`
  documents `supabase db reset` for local and the exact down-SQL for a deployed
  environment. All migrations are additive — no existing data is dropped.
- Middleware matcher excludes static assets and never runs analytics.

---

## 11. Checks to run

| Check | Command |
|---|---|
| Dependency install | `npm install` |
| Type check | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format:check` |
| Unit | `npm run test:unit` |
| Production build | `npm run build` |
| Demo-asset gate | `npm run check:demo-assets` |
| Migrations + seed | `supabase db reset` *(requires Docker)* |
| RLS positive/negative | `supabase test db` *(requires Docker)* |
| Advisors | `supabase db advisors --local` *(requires Docker)* |
| Type drift | `npm run db:types:check` *(requires Docker)* |
| E2E + authz + axe | `npm run test:e2e` *(auth specs skip when Supabase is unconfigured)* |

Docker-dependent checks will be reported as **NOT RUN — no Docker in this
environment**, with exact commands for the owner.

### pgTAP authorization cases

**Positive:** anon reads published programs · parent reads own family and its
members · educator reads own assignments and an assigned draft program · admin
reads every table and inserts a program · the programs trigger writes an
`audit_events` row.

**Negative:** anon selects a draft program → 0 rows · anon selects `families`,
`family_members`, `user_roles`, `audit_events` → 0 rows · parent A selects
family B → 0 rows · parent updates `programs` → error · **parent inserts into
`user_roles` to grant itself `admin` → error** · educator selects an unassigned
program's draft → 0 rows · educator selects `families` → 0 rows · educator
inserts `educator_assignments` → error · authenticated user updates another
user's `profiles` row → 0 rows · anyone updates or deletes `audit_events` →
error.

### Playwright authorization cases

Anonymous GET of `/family`, `/educator`, `/admin` redirects to `/sign-in` with a
safe `redirectTo`; a signed-in parent gets 404/redirect on `/educator` and
`/admin`; an educator gets 404/redirect on `/admin`; sign-out clears the session
and re-protects the routes. Plus `@axe-core/playwright` on `/sign-in` and the
portal shell, keyboard-only sign-in, visible focus, and 44px targets.

---

## 12. Owner-owned external setup (WSL/Ubuntu bash)

1. Install Docker Engine in WSL so the local stack can run:
   `sudo apt-get update && sudo apt-get install -y docker.io && sudo usermod -aG docker $USER`
   (then restart the WSL session).
2. Create three Supabase projects or environments — local, private preview,
   production — and keep credentials separate.
3. `supabase login` then `supabase link --project-ref <preview-ref>`.
4. `cp .env.example .env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project's API settings.
5. Set the same two variables in Vercel Preview, scoped to Preview only.
6. `supabase db reset` (local) or `supabase db push` (preview), then
   `npm run db:types`.
7. Resend custom SMTP, Turnstile, Supabase Pro, and R2 remain later gates and
   are untouched here.

Nothing in this prompt creates an external account, upgrades a plan, or changes
production configuration.

---

## 13. Manual verification steps

1. `npm run dev` **with no `.env.local`** — `/` and `/programs` still render the
   staging catalog; `/family` redirects to `/sign-in`; `/sign-in` renders and
   states that accounts are not yet configured.
2. Add `.env.local`, `supabase db reset`, `npm run dev`. `/programs` now lists
   seeded programs and the draft program is absent.
3. Sign in as `sample.parent@example.com` → `/account` lands on `/family`;
   `/educator` and `/admin` are not reachable.
4. Sign in as `sample.educator@example.com` → `/educator` lists only assigned
   programs; `/admin` is not reachable; `/family` is not reachable.
5. Sign in as `sample.admin@example.com` → `/admin` lists published *and* draft
   programs.
6. In the Supabase SQL editor as an unprivileged role, attempt
   `insert into public.user_roles values (<parent uuid>, 'admin')` → denied.
7. Sign out; every portal route redirects again.
8. Keyboard-only pass of `/sign-in` at 375px, 768px, 1280px, and 1440px; confirm
   visible focus, 44px targets, and the centered 440px panel.
9. Confirm no `NEXT_PUBLIC_` variable holds a secret and that a production build
   bundle contains no secret key: `grep -r "SUPABASE_SECRET" .next/static || echo clean`.

---

## 14. Definition of done

Migrations apply and roll back cleanly; RLS denies by default and both positive
and negative authorization tests are written; server guards re-authorize
independently of the UI; public program data reads from Supabase with truthful
fallback, empty, and error states; no child data, consent policy, financial
policy, or secret is invented or exposed; every check in §11 is reported with its
real result or an explicit NOT RUN reason; and every gap in §9 is reported rather
than closed by invention.
