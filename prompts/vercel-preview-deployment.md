# Vercel private preview deployment — Foundation Review

## Goal and scope

Put the Foundation Release on a **private Vercel preview** so Samantha Dodson can
review it in a browser, against the linked hosted Supabase project
(`uedgcwoxyhtirsihvrnf`) and its sanitized fixtures.

In scope: the Vercel project, its environment-variable contract, deployment
protection, the Supabase dashboard redirect allow-list, and the branch/merge
sequence that decides what actually deploys.

Out of scope: production deployment, a custom domain, Resend custom SMTP,
Turnstile, PostHog, the Cloudflare R2 recovery copy, and Supabase Pro. All of
those are separate approved gates and none of them blocks a sanitized preview.

## Applicable approved state

- MTS IMPLEMENTATION-PLAN Phase 5: "Deploy a private Vercel preview with
  sanitized fixtures."
- MTS TECHNOLOGY-BLUEPRINT / MTS-ARCHITECTURE-ADDENDUM: Vercel is the approved
  host, with separate preview and production environments.
- MTS-SELECTION-RECORD: Vercel **Hobby is rejected for this product** — its
  terms restrict it to personal or non-commercial use. The commercial release
  targets **Pro ($20/month)**. Account ownership is Josh Coley's.
- MTS INTEGRATION-MANIFEST "Environment-variable contract": the authoritative
  copy is `.env.example`.
- MTS INTEGRATION-MANIFEST "Integration rules": external Vercel and Supabase
  setup is recorded as an explicit **human-owned step**.
- AGENTS.md §5: the release is a private, sanitized Foundation Review; real-family
  activation stays blocked.
- AGENTS.md §9: do not create an external account, upgrade a paid plan, or modify
  external production configuration without owner coordination.

## Repository evidence inspected

- `package.json` — `prebuild` runs `scripts/check-demo-placeholders.mjs`; no
  `vercel.json` exists; no `.vercel/` project link exists; the Vercel CLI is not
  installed on this machine.
- `src/lib/env.ts` — `releaseTarget()` reads `HSH_RELEASE_TARGET` and falls back
  to `VERCEL_ENV`; `supabaseConfig()` returns `null` when unset and **throws**
  when partially set or malformed; `siteUrl()` falls back to
  `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`.
- `scripts/check-demo-placeholders.mjs` — the release gate.
- `src/content/programs.ts:183,221,274` — three program images still point at
  `/placeholder/`.
- `src/lib/supabase/admin.ts` — **reads `SUPABASE_SECRET_KEY` (or
  `SUPABASE_SERVICE_ROLE_KEY`) and is required at runtime.** Corrected after the
  merge: this file does not exist on `feat/public-footer-and-about-content`, so
  an inspection of that branch alone concluded no secret was needed. It is on
  `main`, reached from `src/app/(auth)/invitation/accept/actions.ts`,
  `src/app/(portal)/admin/families/actions.ts`, and `src/lib/admin/invitations.ts`.
  `.env.example` on `main` lists it. MTS INTEGRATION-MANIFEST still says "no
  Supabase secret / service-role key is defined, read, or required by any
  application code path" — **that is now out of date and is an MTS gap to
  record.**
- `supabase/config.toml` — `[auth].site_url` and `additional_redirect_urls` are
  **local-stack config only**; the hosted project's equivalents are dashboard
  state that `config.toml` does not push.
- `supabase/seed.sql` — local-stack fixtures only. `supabase db push` never runs
  it.
- Git: `HEAD` (`feat/public-footer-and-about-content`) is **20 commits ahead of
  `main`**, with 16 migration files to `main`'s 11.

## Verified before writing this prompt

- `npm run typecheck` — pass, no output.
- `npm run lint` — pass, no output.
- `HSH_RELEASE_TARGET=preview npm run build` — pass; full route manifest emitted.
- `HSH_RELEASE_TARGET=production node scripts/check-demo-placeholders.mjs` —
  **exit 1, build blocked** (see Blocker 1).
- Hosted Supabase `uedgcwoxyhtirsihvrnf`: all six sample accounts present,
  email-confirmed, unbanned, correct `public.user_roles` grants, and the seed
  password verified against the stored hashes.
- `npm run test:e2e` — full sweep, result recorded at execution time.

## Blockers and decisions the owner must settle

### Blocker 1 — production is gated; preview is the correct target

`check-demo-placeholders.mjs` fails any build where `HSH_RELEASE_TARGET` or
`VERCEL_ENV` is `production` while `public/placeholder/` assets are referenced.
Three program photographs still are. The gate's own words: *"This gate is
intentional. Do not bypass it to get a deploy out."*

Therefore: **deploy to a preview environment, not production.** This matches the
approved Phase 5 intent. It is not a workaround — a production deploy needs the
remaining three program photographs replaced first, which is owner-supplied
content, not an engineering task.

### Blocker 2 — the hosted database is one migration behind `main`

Corrected. The earlier reading of this — "the hosted database carries schema from
an unmerged branch" — was drawn from the feature branch, which did not carry the
`family_invitation_*` migrations. `main` does carry them, plus a fourth the
hosted project has never had:

| Version | Name | On `main` | On hosted |
|---|---|---|---|
| `20260902170123` | `family_invitation_provisioning` | yes | yes |
| `20260902171500` | `family_invitation_anon_grant_hardening` | yes | yes |
| `20260902174500` | `family_invitation_terminal_state_guard` | yes | yes |
| `20260903014639` | `family_invitation_mutation_claim` | yes | **no** |

So the direction of the drift is the opposite of what was first recorded: the
database is behind the code, not ahead of it. `20260903014639` adds
`family_invitations.processing_token` and replaces `accept_family_invitation`
and `family_invitation_status`. The deployed code expects those newer
definitions, so the administrator invitation revoke/resend path is the one that
misbehaves until it is applied.

Its timestamp sorts before the last remote migration, so a plain push refuses it
and `--include-all` is required:

```bash
supabase db push --linked --include-all
```

The migration carries its own rollback notes in its header.

### Blocker 3 — `main` is 20 commits behind what you have been reviewing

Vercel's GitHub integration deploys production from the default branch. `main`
today lacks the announcements, schedule/capacity, conversion journey, inquiry
capture, evidence, footer, and photography work, and five migrations. Deploying
`main` as-is would show Samantha a materially older product.

Sequence: open a PR from `feat/public-footer-and-about-content` → merge to
`main` → let Vercel build. Until then, only the branch's preview URL is current.

### Blocker 4 — hosted sample data is not reproducible from the repository

`supabase/seed.sql` runs only against the local stack. The hosted sample accounts
and fixtures exist right now (verified above), but nothing in the repository
restores them if that project is ever reset. Not a deploy blocker; a recovery
gap worth an owner decision separately.

## Environment-variable contract for the Vercel project

Set on the **Preview** environment (and Production too, when Blocker 1 clears):

| Name | Value | Exposure |
|---|---|---|
| `HSH_RELEASE_TARGET` | `preview` | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://uedgcwoxyhtirsihvrnf.supabase.co` | Browser, by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the hosted project's publishable key | Browser, by design |
| `NEXT_PUBLIC_SITE_URL` | the deployment's canonical URL, no trailing slash | Browser, by design |

Plus one **server-scope** variable:

| Name | Value | Exposure |
|---|---|---|
| `SUPABASE_SECRET_KEY` | the hosted project's secret key | **Server only — never `NEXT_PUBLIC_`** |

`main` requires it: `src/lib/supabase/admin.ts` throws without it, and the
invitation accept and administrator family actions reach that module. Set it in
Vercel with server scope only. Putting it in a `NEXT_PUBLIC_` name would ship a
service-role credential to every browser.

`supabaseConfig()` throws on a partially set or malformed value, so a half-filled
Vercel environment fails loudly at request time rather than quietly serving the
offline catalog. Set all of them or none.

If `NEXT_PUBLIC_SITE_URL` is left unset, `siteUrl()` falls back to `VERCEL_URL`,
which changes per deployment. Password-recovery links would then be built from a
URL that is not in Supabase's allow-list. Set it explicitly.

## Owner-executed steps (external configuration — I cannot and should not do these)

1. **Vercel account and plan.** Confirm the account is on **Pro**, not Hobby, per
   MTS-SELECTION-RECORD. This is a commercial product and a paid-plan decision.
2. **Create the Vercel project** from `Jcoley-Mercurius/Home-School-Haven`.
   Framework preset Next.js; no build-command override — `prebuild` must run.
3. **Set the five environment variables** above on Preview — four public, and
   `SUPABASE_SECRET_KEY` at server scope only.
4. **Turn on Deployment Protection** (Vercel Authentication, or a shared password)
   for both Preview and Production. The Foundation Review is private and holds
   sanitized child-shaped records; an unprotected preview URL is a public URL.
5. **Supabase dashboard → Authentication → URL Configuration**: set Site URL to
   the deployment URL and add `<deployment-url>/auth/confirm` to the redirect
   allow-list. `supabase/config.toml` does not push this, so recovery and
   verification links stay broken until it is done by hand.
6. **Confirm `enable_signup` is off** on the hosted project. It is `false` in
   local `config.toml`; the hosted value is dashboard state and must be checked.

## What I would do in the repository

Nothing is strictly required — the app builds and deploys as it stands. Proposed,
pending approval:

1. Add `docs/DEPLOYMENT.md` (or a README section) recording the environment
   contract, the preview-vs-production gate, and the owner-executed steps above,
   so the next deploy is not re-derived from scratch.
2. Record the MTS gap: INTEGRATION-MANIFEST's "no Supabase secret / service-role
   key is defined, read, or required by any application code path" no longer
   matches `main`. `src/lib/supabase/admin.ts` requires one. This is an MTS
   authority change, so it is reported rather than edited here.
3. No `vercel.json`. Vercel's zero-configuration Next.js path is the approved
   posture and nothing here needs an override.

## Security, privacy, and data handling

- Only `NEXT_PUBLIC_` values reach the browser; all four are public by design and
  RLS is the protection (SECURITY-ARCHITECTURE).
- No service-role credential enters the runtime.
- Deployment protection keeps the sanitized review private (step 4). This is the
  one step whose omission would actually expose data.
- Only sanitized sample records exist in the hosted project — verified.
- Vercel runtime logs are the approved observability baseline. No PostHog, no
  Sentry, no session replay in this deployment.

## Rollback

Vercel keeps every prior deployment; rollback is promoting the previous one. No
migration runs as part of a deploy, so a rollback is code-only and the database
is untouched. If the environment variables are wrong, the failure mode is a loud
throw, not silent bad data.

## Checks

Run before the merge: `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:unit`, `npm run test:e2e`, and
`HSH_RELEASE_TARGET=preview npm run build`.

After the deploy, manually verify against the preview URL: a public program page
renders; sign-in as `sample.admin@example.com` reaches `/admin`; sign-in as
`sample.educator@example.com` reaches `/educator` and shows only the two assigned
programs; sign-in as `sample.parent.one@example.com` reaches `/family`; an
unauthenticated request to `/admin` redirects to sign-in; and the deployment
protection challenge appears for a signed-out visitor.
