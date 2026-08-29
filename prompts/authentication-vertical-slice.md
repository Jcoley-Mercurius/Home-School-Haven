# Implementation Prompt — Authentication vertical slice

**Branch:** `feat/authentication-ui`
**MTS phase:** IMPLEMENTATION-PLAN Phase 3 (identity half only — family setup, student profiles, and the family dashboard stay out)
**Status:** awaiting owner approval

---

## 1. Goal and scope

Complete the authentication surface so that a provisioned parent, educator,
administrator, or owner can sign in, recover a forgotten password, act on an
emailed verification or recovery link, and reach only the area their
server-derived role authorizes — with a truthful state for every outcome
including expiry.

Sign-in, sign-out, server-derived role routing, and the protected route guards
already exist and were approved in `prompts/supabase-auth-foundation.md`. This
slice adds the missing half of the surface and hardens what is there.

### In scope

1. **Recovery request** — `/forgot-password` page, form, and Server Action
   calling `supabase.auth.resetPasswordForEmail()`.
2. **Link handling** — `/auth/confirm` Route Handler that verifies an emailed
   link and establishes the session, covering `recovery`, `invite`, `signup`,
   and `email_change` link types, plus a PKCE `code` fallback.
3. **Password reset** — `/reset-password` page, form, and Server Action calling
   `supabase.auth.updateUser({ password })`, reachable only from a verified
   recovery link.
4. **Expired / invalid link state** — `/auth/auth-code-error` equivalent: a
   truthful screen offering a new link rather than a dead end (MPS-REQ-021,
   MPS-ACC-017).
5. **Committed Supabase email templates** for recovery, invite, confirmation,
   and email change, wired in `supabase/config.toml`, so links carry
   `token_hash` to our own route instead of relying on the implicit-flow
   fragment the server cannot read.
6. **Auth shell completion** — the `(auth)` layout gains the MDS help and
   privacy context for every page in the group, and sign-in gains the
   "Forgot your password?" recovery affordance that
   `patterns.authentication` requires ("recovery/help") and that is missing
   today.
7. **Hardening of what exists** — one shared, tested `safeReturnTo()` helper
   replacing the three separate copies of the redirect allow-list, and
   propagation of the return destination through the whole recovery round trip.
8. **Loading, error, expired, and success states** for every new surface,
   announced to screen readers, never colour-only.
9. **Tests** — positive and negative Playwright coverage, unit coverage for the
   redirect allow-list and link-type parsing, and axe/keyboard/viewport checks.

### Explicitly out of scope

- **Self-service registration and invitation policy.** `enable_signup = false`
  stays. No "Create account" UI, no invite-sending UI, no invitation policy of
  any kind. MPS-REQ-011's account *creation* half stays blocked (see §9).
- Family setup, student profiles, consent records, enrollment, the family
  dashboard (MPS-REQ-015 / MDS-REF-002) — Phase 3 remainder, blocked by
  MPS GAP-005 and GAP-010.
- MFA, passkeys, OAuth providers, magic-link-as-primary sign-in.
- Cloudflare Turnstile. Approved and required *before* public or real-family
  activation, not for the sanitized review (see §9 and §12).
- Resend / custom SMTP account setup — owner-owned external step (§12).
- Any real child or family data. Sample accounts only.

---

## 2. Traceability

| Source | IDs |
|---|---|
| MPS requirements | MPS-REQ-004 (private data unreachable), MPS-REQ-011 (verify, recover from expired verification, safely resume — recovery half only), MPS-REQ-018 (educator limited to assigned programs), MPS-REQ-021 (observable confirmation, current state, and recovery action for submitted / pending / failed / expired / blocked outcomes), MPS-REQ-024 (attributable history) |
| MPS acceptance | MPS-ACC-016 (existing identity must not create a duplicate; an appropriate recovery path is offered), MPS-ACC-017 (expired verification can be safely renewed), MPS-ACC-031 (consistent state and next action) |
| MPS actors | ACT-001 parent, ACT-002 student (never signs in), ACT-003 educator, ACT-004 administrator, ACT-006 owner, ACT-007 invited secondary guardian (out of scope — policy undefined) |
| MPS rules | MPS-RUL-006/007 (sanitized data, approved minimum fields), MPS-RUL-010 (no invented policy language) |
| MPS exception | EXC-001 — sanitized Foundation work proceeds while GAP-005 and GAP-010 remain open |
| MDS | `page_shells.authentication` (centered 440 px panel on warm brand surface, trust/help/privacy context), `patterns.authentication` (brand context, account form, **recovery/help**, privacy reassurance), `patterns.loading`, `patterns.empty`, `patterns.error`, §8 responsive behavior, §10 WCAG 2.2 AA, 44 px targets, 2 px Coral 700 focus ring |
| MTS | TECHNOLOGY-BLUEPRINT "Identity: Supabase Auth" and "Email: Resend + Supabase custom SMTP", SECURITY-ARCHITECTURE mandatory controls, INTEGRATION-MANIFEST (Resend row `INSPECT`), IMPLEMENTATION-PLAN Phase 3 |

---

## 3. Repository evidence inspected

- `package.json` — Next 16.3.3, React 19.2.8, `@supabase/ssr` 0.12.5,
  `@supabase/supabase-js` 2.112.4, `zod` 4.4.3, `@base-ui/react`, Playwright
  1.62.1, `@axe-core/playwright`. Scripts: `typecheck`, `lint`, `format:check`,
  `test:unit` (`node --test tests/*.test.mjs tests/*.test.mts`), `test:e2e`,
  `db:start`, `db:reset`, `db:test`, `db:types`, `db:types:check`,
  `check:demo-assets` (wired into `prebuild`). **No new dependency is needed.**
- `src/lib/auth/session.ts` — `getViewer()` via `getClaims()` (signature
  verified), roles from `public.user_roles`, `homeRouteFor()` ordering
  admin/owner → educator → parent → `null`. Reused unchanged.
- `src/lib/auth/guards.ts` — `requireViewer` / `requireRole` / `requireAdmin`;
  signed-out → `/sign-in?redirectTo=…`, wrong role → `notFound()`. Contains a
  private `safeRedirectTarget()`.
- `src/app/(auth)/sign-in/page.tsx` — contains a second copy of the same
  allow-list, named `safeRedirect`.
- `src/app/(auth)/sign-in/actions.ts` — a third copy; `signIn` returns one
  message for every failure cause and logs nothing; `signOut` redirects to `/`.
- `src/app/(auth)/sign-in/form-state.ts` — `status` union already declares a
  `failed` member that no code path currently produces.
- `src/components/auth/sign-in-form.tsx` — `useActionState`, `noValidate`,
  `sr-only` `role="status"` announcement keyed on status, per-status alert
  cards. **No recovery link** — the MDS `patterns.authentication` "recovery/help"
  element is absent.
- `src/app/(auth)/layout.tsx` — the 440 px centered panel, with an MDS
  reference-gap note already recorded.
- `src/lib/supabase/server.ts` / `client.ts` / `middleware.ts` /
  `anonymous.ts` — client boundaries; server client swallows cookie writes when
  called from a Server Component. **A Route Handler can write cookies**, which
  is why link verification belongs in one.
- `middleware.ts` — matcher `/account`, `/family`, `/educator`, `/admin`,
  `/sign-in`; refresh only, no authorization. Must gain the new auth paths.
- `src/lib/env.ts` — `supabaseConfig()` returns `null` when unconfigured;
  `siteUrl()` already exists "for auth redirect construction" and is currently
  **unused** — this slice is its first consumer.
- `supabase/config.toml` — `enable_signup = false` (both `[auth]` and
  `[auth.email]`), `enable_confirmations = true`, `minimum_password_length = 12`,
  `password_requirements = "lower_upper_letters_digits"`,
  `otp_expiry = 3600`, `[auth.rate_limit] email_sent = 2`,
  `site_url = "http://127.0.0.1:3000"`,
  `additional_redirect_urls = ["https://127.0.0.1:3000"]` (note: `https`, so the
  local `http` callback is **not** currently allow-listed), all email templates
  commented out, no `supabase/templates/` directory.
- `supabase/seed.sql` — sample accounts share the password
  `SampleFoundationReview2026`; role grants in `public.user_roles`; roles
  deliberately **not** in `app_metadata`.
- `tests/e2e/auth.spec.ts` — axe, h1, keyboard, 44 px, server validation,
  password-never-echoed, unconfigured state, four viewport baselines marked
  "NEW BASELINES AWAITING OWNER REVIEW", 440 px panel, 16 px mobile gutter.
- `tests/e2e/authorization.spec.ts` — signed-out redirect matrix, off-site
  `redirectTo` refusal, cross-role denial via `page.request.get(...,
  {maxRedirects: 0})`, sign-out re-protection. Credentialed cases skip loudly
  when `NEXT_PUBLIC_SUPABASE_URL` is unset.
- `tests/e2e/fixtures.ts` — auto console/pageerror guard on every test.
- `playwright.config.ts` — `loadEnvConfig`, production build on
  `127.0.0.1:3100`, `desktop` project only.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  — `route.ts` cannot sit at the same segment level as `page.tsx`; Route
  Handlers are uncached by default; `NextResponse` available.
- `mts/INTEGRATION-MANIFEST.md` — Resend row reads `INSPECT — not configured.
  Blocks self-service account verification (MPS-REQ-011) and therefore Phase 3.`

---

## 4. Design decisions requiring a recorded rationale

### 4.1 `token_hash` links, not implicit-fragment links

Supabase's default recovery email points at the Auth server's `/verify`
endpoint, which redirects back with the tokens in the **URL fragment**. A
fragment is never sent to the server, so a Server Component or Route Handler
cannot see it; only client-side JavaScript can. Establishing the session there
would put the recovery token in the browser's history and require a client
component to hold it.

Instead this slice commits email templates that build the link themselves:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=%2Freset-password
```

`/auth/confirm` calls `supabase.auth.verifyOtp({ type, token_hash })` on the
server, writes the session cookie from a Route Handler, and redirects. The token
never reaches client JavaScript, and the flow works even if the link is opened
in a different browser from the one that requested it — which the PKCE `code`
flow cannot do, because its verifier lives in a cookie on the requesting
browser.

The handler still accepts `?code=` and calls `exchangeCodeForSession()`, so a
link generated before the templates land, or by a Supabase dashboard action,
still works rather than dead-ending.

### 4.2 A recovery marker cookie gates `/reset-password`

After `verifyOtp({ type: 'recovery' })` the visitor holds a full session. Left
alone, `/reset-password` would then be reachable by any signed-in viewer who
typed the URL, and `secure_password_change = false` means Supabase would not
demand reauthentication. Because the MDS surface is a *reset* screen and not a
*change password* screen, the route must reflect how the visitor got there.

`/auth/confirm` therefore sets a `hsh-recovery` cookie — `httpOnly`, `secure`
outside local, `sameSite: 'lax'`, `path: '/reset-password'`, 15-minute
`maxAge` — and `/reset-password` renders the form only when it is present. The
Server Action clears it on success. The cookie is a **marker, not a
credential**: it carries no token and grants nothing. The session is what
authorizes `updateUser`, and Supabase re-verifies that independently.

### 4.3 One shared return-destination allow-list

The same rule is written three times today (`guards.ts`, `sign-in/page.tsx`,
`sign-in/actions.ts`). The recovery round trip adds two more places that need
it — the `next` parameter on `/auth/confirm` and the destination carried
through `/forgot-password`. Five hand-copied allow-lists is how an open redirect
eventually ships.

New module `src/lib/auth/return-to.ts` exporting `safeReturnTo(raw: unknown):
string`, defaulting to `/account`, rejecting anything that is not a relative
single-slash path — including `//host`, `/\host`, protocol-relative and
backslash variants, control characters, and non-string input. Unit-tested
directly. The three existing copies are replaced by it.

### 4.4 Non-enumeration extends to recovery

`/forgot-password` returns the **same** confirmation for a known and an unknown
address, and never reveals whether an account exists. Supabase's
`resetPasswordForEmail` already returns success for unknown addresses; the UI
must not undo that by rendering anything conditional on the result. Nothing is
logged — not the address, not the outcome.

The rate limit is real and low (`email_sent = 2` per hour). A rate-limited
response must read as "we could not send another email just now, try again
shortly" — truthful, and still not an account oracle.

### 4.5 Password rules are stated before submission, not after

`minimum_password_length = 12` and `password_requirements =
"lower_upper_letters_digits"` are enforced by the Auth server. The reset form
states both requirements in a `FieldDescription` before the visitor types, and
validates them with zod server-side so the message comes back in the approved
form-state shape rather than as a raw Supabase error string. Supabase remains
the enforcement point; the zod schema mirrors it so the two cannot silently
diverge without the test in §8 failing.

---

## 5. Expected files

### New

| Path | Purpose |
|---|---|
| `src/lib/auth/return-to.ts` | `safeReturnTo()` — the single redirect allow-list |
| `src/app/(auth)/forgot-password/page.tsx` | Recovery request page |
| `src/app/(auth)/forgot-password/actions.ts` | `requestPasswordReset` Server Action |
| `src/app/(auth)/forgot-password/form-state.ts` | Form-state shape (a `"use server"` module may export only async functions) |
| `src/components/auth/forgot-password-form.tsx` | Client form with states |
| `src/app/(auth)/reset-password/page.tsx` | New-password page, gated on the recovery marker |
| `src/app/(auth)/reset-password/actions.ts` | `resetPassword` Server Action |
| `src/app/(auth)/reset-password/form-state.ts` | Form-state shape |
| `src/components/auth/reset-password-form.tsx` | Client form with states |
| `src/app/(auth)/link-expired/page.tsx` | Expired / invalid / already-used link state with a route back to a new link |
| `src/app/auth/confirm/route.ts` | Route Handler: `verifyOtp` / `exchangeCodeForSession`, sets the recovery marker, redirects |
| `src/lib/auth/link-types.ts` | Parse + allow-list of accepted `type` values; unit-tested |
| `supabase/templates/recovery.html` | Recovery email, `token_hash` link |
| `supabase/templates/invite.html` | Invitation email (provisioned accounts only) |
| `supabase/templates/confirmation.html` | Address confirmation email |
| `supabase/templates/email-change.html` | Address-change email |
| `tests/auth-return-to.test.mts` | Unit: allow-list, incl. hostile inputs |
| `tests/auth-link-types.test.mts` | Unit: link-type parsing |
| `tests/e2e/password-recovery.spec.ts` | E2E: recovery round trip, expired link, gating |

### Modified

| Path | Change |
|---|---|
| `src/lib/auth/guards.ts` | Use `safeReturnTo`; drop the private copy |
| `src/app/(auth)/sign-in/page.tsx` | Use `safeReturnTo`; drop the private copy |
| `src/app/(auth)/sign-in/actions.ts` | Use `safeReturnTo`; produce the declared `failed` state on an unexpected error |
| `src/components/auth/sign-in-form.tsx` | Add the MDS "recovery/help" affordance — "Forgot your password?" carrying the return destination |
| `src/app/(auth)/layout.tsx` | Note that the shell now serves four pages; no visual change to the 440 px panel |
| `middleware.ts` | Add `/forgot-password`, `/reset-password`, `/auth/:path*` to the matcher |
| `supabase/config.toml` | Wire the four templates; add the local `http` callback to `additional_redirect_urls` |
| `.env.example` | Document that `NEXT_PUBLIC_SITE_URL` now has a consumer and must match Supabase `site_url` |
| `tests/e2e/auth.spec.ts` | Cover the recovery affordance; refresh baselines for the changed sign-in panel |
| `tests/e2e/authorization.spec.ts` | Extend the off-site `redirectTo` matrix to the new surfaces |
| `mts/INTEGRATION-MANIFEST.md` | Update the Resend row and the env table to reflect what is now built vs still blocked |
| `README.md` | Manual verification steps for the recovery flow against the local stack |

**No migration.** This slice adds no table, column, policy, or grant. Rollback
is `git revert` plus `supabase stop && npm run db:start` to drop the
`config.toml` template wiring; no data migration to reverse.

---

## 6. Route and state matrix

| Route | Signed out | Signed in, no role | Signed in, with role | Notes |
|---|---|---|---|---|
| `/sign-in` | Form | → `/account` | → role home | Already built |
| `/forgot-password` | Form | Form | Form | Deliberately reachable while signed in |
| `/auth/confirm` | Verifies → `next` | Verifies → `next` | Verifies → `next` | Never renders; always redirects |
| `/reset-password` | Marker present → form; absent → `/link-expired` | same | same | Marker + session both required |
| `/link-expired` | Renders | Renders | Renders | Offers a new link |

Every form surface carries the five states already conventional in this
repository (`idle` / `invalid` / `unavailable` / `failed` / a success member),
each with an `sr-only` `role="status"` announcement keyed on status, an icon
plus text (never colour alone), and a `pending` submit label.

| State | Sign-in | Forgot password | Reset password |
|---|---|---|---|
| Loading | "Signing in…" | "Sending…" | "Saving…" |
| Invalid | Field errors | Field errors | Field errors + password rules |
| Rejected | Same message for every cause | *(never — non-enumerating)* | — |
| Rate limited | — | "Could not send another email just now" | — |
| Expired | — | — | → `/link-expired` |
| Unavailable | Existing card | Same shape | Same shape |
| Failed | Existing card | Same shape | Same shape |
| Success | redirect | Confirmation panel, identical for known/unknown | → role home, signed in |

---

## 7. Security, privacy, and authorization implications

- **No new trust boundary.** Role resolution stays in `getViewer()` from
  `public.user_roles`; the guards and RLS are unchanged. A recovered password
  grants exactly the roles the database already recorded.
- **No open redirect.** One allow-list, unit-tested against hostile inputs,
  applied to `redirectTo`, to `next` on `/auth/confirm`, and to the destination
  carried through recovery.
- **No account enumeration**, in sign-in or recovery.
- **No credential or token in a URL, log, screenshot, or fixture.** The
  `token_hash` reaches the server and is exchanged for a cookie; `/auth/confirm`
  redirects rather than rendering, so the token does not persist in the address
  bar of a rendered page. No new `console` call anywhere in this slice.
- **No secret added.** No service-role key, no Resend credential in application
  code. `siteUrl()` reads a public variable.
- **The recovery marker carries no authority** (§4.2).
- **Session cookies** are written by `@supabase/ssr` with its own attributes;
  this slice does not weaken them, and the marker cookie is `httpOnly` +
  `sameSite=lax` + path-scoped.
- **Sign-out** remains a POST, unreachable by prefetch or image tag.
- **Attributable history (MPS-REQ-024):** authentication events are *not*
  written to `audit_events`. That table records material program, enrollment,
  and reconciliation changes; Supabase Auth keeps its own audit log. Recorded
  here so the omission is a decision rather than an oversight.

---

## 8. Checks to run, and exact manual steps

### Automated

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run db:types:check
npm run build
npm run db:start && npm run db:reset && npm run db:test   # unchanged RLS must still pass
npm run test:e2e
```

New E2E coverage (`tests/e2e/password-recovery.spec.ts`), positive and negative:

**Positive**
1. `/sign-in` → "Forgot your password?" → `/forgot-password`, destination preserved.
2. Submit a seeded address → confirmation panel.
3. Read the link from the local Mailpit API (`http://127.0.0.1:54324`), open it,
   land on `/reset-password` with the form.
4. Set a valid new password → signed in → routed to the seeded role's home.
5. Sign out, sign in with the **new** password → succeeds.

**Negative**
6. An unknown address returns the **identical** confirmation (byte-comparable text).
7. `/reset-password` visited directly, no marker → `/link-expired`.
8. A reused link → `/link-expired`.
9. A tampered `token_hash` → `/link-expired`, no session established.
10. `/auth/confirm?next=https://example.com/steal` → redirects to `/account`, never off-site.
11. `/auth/confirm?type=magiclink&token_hash=…` (type outside the allow-list) → `/link-expired`.
12. A password below 12 characters, and one missing a required class → field error, no session change.
13. The submitted password never appears in the returned HTML.
14. After reset, the **old** password no longer signs in.

Accessibility and MDS, per new page: axe (`wcag2a/2aa/21a/21aa/22aa`), single
`h1`, full keyboard operation with visible focus, 44 px submit targets,
`role="status"` announcement on every state change, four viewport screenshots
(390 / 768 / 1280 / 1440), 440 px panel and 16 px mobile gutter.

### Manual (WSL/Ubuntu bash)

```bash
npm run db:start
npm run db:reset
cp .env.example .env.local     # fill NEXT_PUBLIC_SUPABASE_URL + publishable key
npm run dev
```

1. Open `http://127.0.0.1:3000/family` signed out → sign-in with
   `redirectTo=/family`.
2. Click "Forgot your password?" → `/forgot-password`.
3. Enter `sample.parent.one@example.com`, submit → confirmation panel.
4. Open Mailpit at `http://127.0.0.1:54324`, open the recovery email, click the link.
5. Confirm you land on `/reset-password` and the address bar holds **no token**.
6. Enter `NewSampleReview2026`, submit → land on `/family` signed in.
7. Sign out; sign in with the old password → the single non-enumerating failure.
8. Sign in with the new password → `/family`.
9. Re-open the used link → `/link-expired`, with a route to request a new one.
10. Visit `/reset-password` directly → `/link-expired`.
11. Repeat 2–3 with `nobody@example.invalid` → **identical** panel.
12. Tab through each new page: focus visible everywhere, no keyboard trap.
13. Set the OS to reduced motion → no motion is required to understand a state.
14. Repeat step 6 at 390 px, 768 px, 1280 px, 1440 px.

---

## 9. Assumptions and unresolved gaps

1. **Email delivery is not production-ready, and this slice does not make it
   so.** Resend + custom SMTP is `INSPECT — not configured`
   (INTEGRATION-MANIFEST). Locally, Supabase's Mailpit captures the mail and the
   flow is fully exercisable. On a hosted project the built-in sender applies a
   low shared rate limit and is explicitly not for production. **The flows are
   built and correct; delivery remains an owner-owned external step (§12).**
   Recorded as an assumption, not a claim that email works.
2. **MPS-REQ-011 remains partly unmet, by design.** Its recovery and expiry
   halves ("recover from expired verification", MPS-ACC-017) are delivered here.
   Its *account creation* half needs an approved provisioning policy — who may
   create an account, on what evidence, with what consent record — which is not
   written in any approved artifact and which AGENTS.md forbids inventing. The
   user's instruction not to invent self-registration or invitation policy is
   consistent with that. **Product gap for Samantha; MPS owns it.**
3. **ACT-007 (invited secondary guardian) has no approved permission set.** The
   `invite` link type is handled so that an administrator-issued Supabase invite
   is not a dead link, but no invitation UI, policy, or permission grant is
   built. **Product gap.**
4. **MDS reference gap, already recorded and now wider.** No canonical image
   exists for the authentication screen; four more screens now inherit that.
   They are built from the written specification, which outranks visual
   inference (AGENTS.md §7). Their screenshots are **new baselines awaiting
   owner review, not proof of MDS conformance.** **Design gap.**
5. **`additional_redirect_urls` currently lists `https://127.0.0.1:3000`** while
   local dev serves `http`. Adding the `http` local callback is required for the
   flow to work locally and is a local-config fix, not a production loosening.
6. Hosted-project auth settings (site URL, redirect allow-list, template
   overrides) are dashboard state that `config.toml` does not push. Listed in §12.
7. Password strength beyond Supabase's configured rules (breach-list checking)
   is not implemented; not required by any approved artifact.

---

## 10. Responsive and accessibility requirements

Centered 440 px panel at tablet and above; full-width with a 16 px gutter below
640 px; body copy stays 16 px; touch targets at least 44×44 px with 8 px
separation; visible 2 px Coral 700 focus ring at 2 px offset; single `h1` per
page; every state announced via a live region and conveyed by icon plus text,
never colour alone; `prefers-reduced-motion` respected; no meaning depends on
motion. Verified at 390 / 768 / 1280 / 1440 px.

---

## 11. Rollback

`git revert` the merge. No migration, no schema change, no data change. The
`config.toml` template wiring reverts with the file; a running local stack picks
it up on `supabase stop && npm run db:start`. Nothing in this slice writes to
the database, so there is no state to reconcile after a revert.

---

## 12. External setup still required (owner-owned)

1. **Resend account + verified sending domain + DNS (SPF/DKIM/DMARC)**, then
   Supabase custom SMTP pointed at it. Until then, hosted email is rate-limited
   and unsuitable for real families. Blocks activation.
2. **Hosted Supabase Auth settings**: site URL and redirect allow-list for the
   preview and production origins; template overrides matching
   `supabase/templates/`.
3. **`NEXT_PUBLIC_SITE_URL`** set per environment, matching Supabase's site URL.
4. **Cloudflare Turnstile** on the recovery form before public or real-family
   activation — the form triggers outbound email from an unauthenticated
   surface, which is exactly the abuse case AGENTS.md §9 names. Not built here;
   flagged as an activation gate item.

---

## 13. Definition of done

Functional correctness; MPS acceptance for the requirements claimed in §2 and
no claim on those listed as gaps in §9; MDS compliance against the written
specification with the reference gap recorded; MTS verification; responsive
behavior at four viewports; WCAG 2.2 AA; the security controls in §7; rollback
readiness per §11; and a completion report stating the real result of every
check in §8, including any that could not be run.
