# Invite-only family account creation and verification (MPS-REQ-011)

Fast-lane slice. Owner decision recorded 2026-09-02: **family provisioning is
invite-only.** Only an authorized administrator may invite a family; there is no
public self-service signup; an invitation may create only the `parent` role.

## Goal and scope

Close the account-creation half of MPS-REQ-011 (MPS-ACC-015/016/017) with an
administrator-initiated invitation lifecycle: invite → pending → emailed link →
accept + set password → `parent` grant → existing `/family/setup`. Plus revoke,
resend, expiry, single use, and administrator status visibility.

Out of scope, unchanged: public signup (`enable_signup = false` stays),
student logins, social login, educator/admin self-provisioning, retention or
deletion policy, consent automation, enrollment or payment truth.

## Authority references

- MPS: MPS-REQ-011, MPS-ACC-015/016/017, MPS-REQ-004, MPS-REQ-021 (observable
  state + recovery), MPS-REQ-024 (attributable history), MPS-RUL-006 (approved
  minimum fields), MPS-RUL-007 (sanitized data).
- MDS: `page_shells.authentication` (acceptance screen reuses the existing
  440px panel and the four pages already in `src/app/(auth)`),
  `page_shells.admin_operations` + existing list/state-pill/drawer patterns for
  the administrator surface. No new visual convention.
- MTS: SECURITY-ARCHITECTURE (deny-by-default, least privilege, server-derived
  identity), INTEGRATION-MANIFEST (Resend not configured), IMPLEMENTATION-PLAN
  Phase 3.

## Repository evidence inspected

- `supabase/config.toml` — `[auth].enable_signup = false`;
  `[auth.email].enable_signup = true` (provider on); `[auth.email.template.invite]`
  already wired to `supabase/templates/invite.html`; local Mailpit on 54324.
- `src/app/auth/confirm/route.ts` + `src/lib/auth/link-types.ts` — `invite` is
  already an accepted link type and already redirects to a safe `next`.
- `src/lib/auth/{session,guards}.ts` — roles read from `public.user_roles`,
  never metadata; `requireAdmin()` exists.
- `src/lib/supabase/server.ts` — **no service-role path exists today.**
- `supabase/migrations/20260827212014_…roles_and_identity.sql` — `user_roles`
  has no client write policy by design; `private.is_admin()` exists.
- `supabase/migrations/20260827212020_…audit_history.sql` — `audit_events` is
  the attributable-history table.
- `src/app/(portal)/admin/families/page.tsx` — read-only today; the natural home
  for invitations. `src/app/(portal)/admin/communications/inquiries/actions.ts`
  is the action + form-state pattern to copy.

## Design

**1. Migration `supabase/migrations/20260902170123_family_invitation_provisioning.sql`**

- `public.invitation_state` enum: `pending`, `accepted`, `revoked`. Expiry is
  derived from `expires_at`, not a stored state, so a clock change cannot strand
  a row in a lie.
- `public.family_invitations`: `id`, `email` (stored lowercased, adult contact
  only), `invited_user_id` (the auth user the invite provisions),
  `invited_by`, `created_at`, `expires_at`, `sent_count`, `last_sent_at`,
  `accepted_at`, `revoked_at`, `revoked_by`, `state`. Unique partial index on
  `lower(email)` where `state = 'pending'` → a repeated invite for the same
  address is idempotent (it resends, it does not fan out).
- RLS: SELECT / INSERT / UPDATE administrator-only (`private.is_admin()`). No
  anon policy, no parent policy, no grant to `anon`. No DELETE policy.
- `public.accept_family_invitation()` — SECURITY DEFINER, `authenticated` only,
  empty `search_path`. Matches `auth.uid()` against `invited_user_id`,
  conditionally updates `state = 'pending' and expires_at > now()` → `accepted`
  (single use, race-safe), and inserts **the literal role `'parent'`** into
  `user_roles`. It takes no arguments at all, so there is no family id, role, or
  invitation id a caller could substitute — the only escalation surface is
  removed rather than validated.
- `public.family_invitation_status()` — SECURITY DEFINER read for the accepting
  viewer: returns their own invitation's state and expiry, nothing else.
- Audit trigger → `audit_events` with `entity_type = 'family_invitation'` and
  actions `invited`, `resent`, `revoked`, `accepted`. Records ids and actors.
  **No token, no email address** in history.
- Rollback block, per repository convention.

**2. Server-only service-role client — an MTS deviation, called out**

Creating an auth user without public signup requires the Supabase Admin API.
`src/lib/supabase/admin.ts` (`import "server-only"`, never imported by a client
component) reads `SUPABASE_SECRET_KEY` and is used by exactly two calls in one
module: `auth.admin.inviteUserByEmail` (create + send) and `auth.admin.deleteUser`
(revoke or resend of an invitation that was never accepted — deleting the
provisioned account is what actually invalidates the outstanding link). Absent
key → the surface reports "not configured in this environment", the same
truthful setup state `supabaseConfig()` already models. This is the "approved
server-side need" INTEGRATION-MANIFEST line 33 requires; it needs owner
acknowledgement and is listed as a deviation in the report.

**3. Email delivery**

Supabase Auth sends the invitation using the existing committed
`supabase/templates/invite.html` (link changed to `next=%2Finvitation%2Faccept`).
Locally that lands in Mailpit; hosted it uses Supabase's shared sender until
Resend custom SMTP is configured. **No second email provider is introduced.**
The template carries no child, assistance, enrollment, or family detail — the
current copy already does not, and stays that way.

**4. Routes and files**

| Path | Change |
| --- | --- |
| `src/app/(portal)/admin/families/page.tsx` | Adds an Invitations section above the read-only directory |
| `src/app/(portal)/admin/families/{actions.ts,form-state.ts}` | new — invite / resend / revoke, each `requireAdmin()`-gated |
| `src/components/admin/{invite-family-form,invitation-list}.tsx` | new — reuse Alert, state pill, list-to-card patterns |
| `src/app/(auth)/invitation/accept/{page.tsx,actions.ts,form-state.ts}` | new — password completion on the approved auth panel |
| `src/components/auth/accept-invitation-form.tsx` | new — modeled on `reset-password-form.tsx` |
| `src/lib/admin/invitations.ts` | new — the only module touching the admin client |
| `src/lib/admin/invitation-state.ts` | new — pure state/label derivation, unit-tested |
| `src/lib/supabase/admin.ts` | new — server-only service-role client |
| `supabase/templates/invite.html`, `supabase/config.toml` (redirect allow-list), `.env.example` | updated |

Acceptance sets the password through the **invited viewer's own session**
(`updateUser`), not the service role, then calls the RPC. Non-pending, expired,
revoked, or already-accepted → the approved message + a sign-in path; a missing
or tampered link → the existing `/link-expired`. Nothing on this route accepts an
email, a family id, a role, or an invitation id from the URL.

## Security properties

Server-only creation; administrator authority from `requireAdmin()` **and**
`private.is_admin()` in RLS; only the literal `parent` role can ever be granted;
no client-supplied role, family id, email, or invitation id anywhere in the
accept path; single-use conditional update; expiry enforced in SQL and by
Supabase's own token TTL; revoke deletes the unaccepted account so the emailed
link dies with it; no token or auth link is ever logged; the public surface
discloses nothing about whether an address has an account (administrator-facing
status is shown to an already-authorized administrator only).

## Validation (fast lane)

`prettier --check` on changed files, `eslint`, `tsc --noEmit`,
`npm run test:unit` (new invitation-state tests), new pgTAP
`supabase/tests/database/140_family_invitations.test.sql` covering admin-only
RLS, parent/educator/anon denial, single use, expired, revoked, and
role-escalation refusal, an end-to-end invite→Mailpit→accept check against the
running local stack, a sign-in/recovery smoke check, and `next build`.
Deferred to HSH-PHASE-QA-01: full Playwright, axe, visual-snapshot, and RLS
sweeps.

## Owner-owned setup still required

Resend API key + domain verification + Supabase custom SMTP + DNS (SPF/DKIM/
DMARC); `SUPABASE_SECRET_KEY` set in Vercel (preview and production, server
scope only, never `NEXT_PUBLIC_`); hosted redirect allow-list entry for
`/auth/confirm`. Live invitation delivery is **unverified** until those exist.

---

## As built — deviations, findings, and what remains open

### Deviations from the plan above

1. **`accept_family_invitation()` returns the enum, and NULL means "not open".**
   Planned as a boolean-ish outcome; a NULL return keeps expired, revoked,
   already-accepted, and never-invited indistinguishable to the caller with no
   extra branching.
2. **`family_invitations_expiry_after_creation`** was added while writing the
   pgTAP suite: a row cannot be born already expired. The test had to set
   `created_at` explicitly to represent an invitation issued two hours ago under
   a one-hour window, which is the honest way that state arises.
3. **`INVITATION_WINDOW_SECONDS = 3600`, equal to `auth.email.otp_expiry`.**
   The plan left the window open. Making the invitation record and the emailed
   link expire together is what stops the administrator's list from showing an
   invitation as waiting over a dead link. Recorded as **GAP-INVITE-001**:
   lengthening it means raising `otp_expiry`, which also lengthens every
   password-recovery link — an owner decision, not an implementation one.
4. **No `/admin/families` route parameter was added.** Resend and revoke post an
   invitation id in a form body, read back under RLS before use. The page still
   takes no URL parameter, so no identifier reaches the address bar.

### Findings

* **MDS-GAP-I1.** The administrator invitation states (`Waiting to be
  accepted` / `Expired` / `Accepted` / `Revoked`) are composed from the approved
  `badge` component with an icon and a word, in the same way the inquiry states
  were (MDS-GAP-P1). They are not a state vocabulary the MDS names, and are
  flagged for confirmation rather than treated as approved.
* **Pre-existing, unrelated:** `supabase/tests/database/100_schedule_capacity_attendance.test.sql`
  test 54 ("a title-only edit preserves the existing reschedule explanation")
  fails on the local stack — `admin_update_program_session` clears `change_note`
  when the caller passes none. Present before this slice, untouched by it, and
  out of scope here.
* **`npm run db:types:check` fails by design until the migration is pushed.** It
  regenerates from the LINKED (hosted) project, which does not yet carry
  `20260902170123`. The committed types were regenerated from the local stack.

### Checks actually run

`npm run format:check` (the twelve pre-existing warnings are all files this
slice does not touch), `npm run lint`, `npm run typecheck`, `npm run test:unit`
(253 pass), `supabase test db` (all files pass except the pre-existing schedule
failure above; the new `140_family_invitations.test.sql` is 39/39),
`npx playwright test tests/e2e/family-invitation.spec.ts` (10/10) plus
`auth.spec.ts` and `password-recovery.spec.ts` as the sign-in and recovery
regression smoke (48 passed, 1 conditional skip), and `npm run build`.

Deferred to HSH-PHASE-QA-01: the full Playwright, axe, ARIA-snapshot, visual
baseline, and complete RLS sweeps.

### Still open, and owner-owned

* Resend API key, domain verification, Supabase custom SMTP, and DNS
  (SPF/DKIM/DMARC). **Live invitation delivery is unverified** — every round trip
  above ran against the local stack's Mailpit.
* `SUPABASE_SECRET_KEY` in Vercel (server scope, preview and production).
  Without it the invitation surface reports itself as not configured.
* `supabase db push` to the hosted project, then `npm run db:types`.
* GAP-INVITE-001 (the one-hour window), GAP-ADMIN-011 (retention: no accepted
  account can be removed here), and ACT-007 secondary-guardian invitation, which
  this slice does not implement.

---

## Closure — HSH-SLICE-AUTH-02

Closed 2026-09-02 against the owner's eight closure items.

### 1. Migration renamed

`20260906000000` → **`20260902170123`**, the real clock time of closure. It sorts
before three already-applied round-dated migrations; that is safe (it depends
only on the four foundation migrations, and nothing later depends on it) and was
proved by a full `supabase db reset`, which applied the whole set in filename
order without error. Both history tables were repaired with
`supabase migration repair`, so neither database will re-apply it.

### 2. Two findings the closure work produced, both fixed

* **`anon` held EXECUTE on both invitation functions on the HOSTED project.**
  The provisioning migration revokes from `PUBLIC` and grants `authenticated`,
  which is correct locally — but the hosted project carries
  `ALTER DEFAULT PRIVILEGES … GRANT ALL ON ROUTINES TO anon`, so a grant is made
  to `anon` by name as the function is created, and a `PUBLIC` revoke does not
  remove it. Verified true against the linked project, then closed by
  `20260902171500_family_invitation_anon_grant_hardening.sql`. Neither function
  could do anything for `anon` (both derive the caller from `auth.uid()`), so
  this was a privilege surface rather than a known escalation.
  **51 of 51 functions in `public` are anon-executable on the hosted project for
  the same reason.** That is pre-existing and project-wide; correcting it needs
  an allow-list (`submit_inquiry` is deliberately anon-executable) and the full
  authorization suite — carried to HSH-PHASE-QA-01, not swept in here.
* **An accepted invitation could be pushed back to `pending`.**
  `family_invitations_state_consistent` only required the timestamps to agree
  with the state, so clearing `accepted_at` while setting `state = 'pending'`
  was permitted — the one shape in which the withdraw path would consider a real
  family's account for deletion. Closed by
  `20260902174500_family_invitation_terminal_state_guard.sql`: accepted and
  revoked are terminal, their timestamps are immutable, and a non-pending
  invitation cannot be re-pointed at an account.

### 3. Partial-failure recovery, as built

* `resendInvitation` deletes the old account before sending. If the send then
  fails, `closeUnsendableInvitation()` sets `expires_at` to now, so the row reads
  **Expired** — true, and actionable, because Expired offers Resend — instead of
  claiming a destroyed link still works. Same recovery if the row update fails,
  plus the new account is removed so no invitation-less account survives.
* `inviteFamily` already removed the account it provisioned when the insert
  failed.
* `accountIsEstablished()` refuses to delete any account holding a role grant or
  a family membership, and answers "established" when it cannot tell — not
  knowing is not permission to delete.

### 4. Hosted state

The linked project already carried the provisioning migration when closure
began; `db push --dry-run` reported it up to date, and its schema contained the
objects. The two hardening migrations were pushed during closure. The linked
project now reports up to date, `anon` EXECUTE is gone, `authenticated` retains
it, and the invitation table holds zero rows — no account has been provisioned
against the hosted project.

### 5. Types

`npm run db:types` regenerated from the linked project; `npm run db:types:check`
**passes**. The diff is purely additive.

### 6–7. MPS state

`mps/MPS-PROJECT-STATE.yaml`: MPS-REQ-011 is `implemented` /
`locally_validated`, carrying its hosted-verification-pending and
email-delivery-blocked notes; MPS-ACC-015/016/017 each carry
`validation_status: locally_validated` with their evidence. **DEC-022** records
invite-only provisioning; **DEC-023** records the one-hour window as an approved
Foundation Demo limitation that explicitly does not change the shared
password-recovery lifetime. **GAP-013** closes the provisioning-policy gap.

### 8. Checks at closure

All green on a freshly reset local stack: `format:check` (12 pre-existing
warnings, none in this slice's files), `lint`, `typecheck`, `test:unit` 253/253,
`supabase test db` **17/17 files, including `140_family_invitations` at 45/45**,
`family-invitation` + `auth` + `authorization` + `password-recovery` Playwright
suites 77 passed / 1 conditional skip, `npm run build`, and
`npm run db:types:check`.

### Carried to HSH-PHASE-QA-01

1. **The `admin_update_program_session` `change_note` failure did not survive a
   database reset.** It was stale local data from earlier end-to-end runs, not a
   code defect: `supabase test db` is now 17/17. Re-confirm on a clean stack
   before spending the phase's first task on it.
2. **`npm run db:reset` always fails**, and has since `a979aa0`: its expectation
   in `scripts/db-reset.mjs` lists five enrollments while `supabase/seed.sql`
   seeds seven. The database it produces is correct; the verifier is stale.
3. **Project-wide `anon` EXECUTE on all 51 `public` functions** on the hosted
   project (finding 2 above).
4. `service_role` holds no privileges on `family_invitations` (or `user_roles`)
   on the LOCAL stack while the hosted project grants them by default. The
   application depends on neither, but the two environments differ.
5. Live invitation email delivery remains unverified pending Resend, custom
   SMTP, and DNS, and `SUPABASE_SECRET_KEY` is still needed in Vercel.
