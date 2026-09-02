# HSH-SLICE-PUBLIC-03a — Inquiry Capture Foundation

Conversion-critical first portion of HSH-SLICE-PUBLIC-03.

## 1. Goal and scope

Give every public inquiry a durable, single, administrator-owned record; give
the family a truthful received state; keep discounted-class assistance requests
private to administrators; and offer honest retry when recording fails.

**Authority IDs.** MPS-REQ-009, MPS-REQ-010; MPS-WFL-001 (notification "Notify
administrator of submitted inquiry, tour, or assistance request"), MPS-WFL-004
(states `submitted, under_review, awaiting_family, approved_path_provided,
not_available, closed`; "Confirm receipt privately", "Notify only authorized
administrators"); MPS-ACC-011, 012, 013, 014; MPS-RUL-003, MPS-RUL-004,
MPS-RUL-007, MPS-RUL-010; MPS-REQ-021, MPS-REQ-024.

**In scope**

1. `public.inquiries` with type, contact details, program, message, submitted
   time, WFL-004 state, and an authorized administrative owner.
2. One server-side write door for an unauthenticated visitor, idempotent under
   retry.
3. Real `recorded` / `failed` / `unavailable` outcomes behind the existing
   contact form seam.
4. `/admin/inquiries` list + detail: state transitions and owner assignment.
5. Attributable history for material state and ownership changes.
6. Deny-by-default privacy: no educator path to an inquiry, ever.

**Explicitly out of scope** (do not build)

- **Resend / email notification.** MPS names no confirmation *channel* for
  MPS-ACC-012 or WFL-004 "Confirm receipt privately"; an on-screen private
  confirmation plus an administrator queue satisfies both as written.
  INTEGRATION-MANIFEST still records Resend as `INSPECT — not configured`.
  Logged below as **GAP-PUBLIC-001** rather than invented here.
- Eligibility, discount, scholarship, award, or price outcomes of any kind
  (MPS-RUL-004). The record carries a *review state*, never a decision.
- Cloudflare Turnstile (gated to public / real-family activation, AGENTS.md §9)
  — logged as **GAP-PUBLIC-002**.
- Family-side inquiry history, threaded replies, program-page inline forms, and
  the rest of HSH-SLICE-PUBLIC-03.

## 2. Repository evidence inspected

- `src/lib/contact/recorder.ts` — the seam is already built and deliberately
  returns `unavailable`; its own header says to implement the destination
  "here and here only". `GuidanceRequestType` = guidance | question | visit |
  assistance.
- `src/app/contact/actions.ts`, `src/app/contact/form-state.ts`,
  `src/components/contact/contact-form.tsx` — server-side zod validation, and
  `recorded` / `unavailable` / `failed` states with `role="status"`,
  `aria-live="assertive"`, retained typing, and a phone fallback already
  render. **No UI states are added by this slice.**
- `supabase/migrations/20260828010906_foundation_least_privilege_grants.sql`
  and `supabase/tests/database/00_setup.test.sql` — `anon` holds no write
  privilege on any table and reaches exactly `programs` and `program_sessions`.
  A public insert must therefore go through a SECURITY DEFINER function, not a
  table grant.
- `supabase/migrations/20260903000000_family_conversion_journey.sql` — the
  house pattern for a guarded write door: re-derive the actor server-side,
  accept no state from the caller, document rollback in the header.
- `private.is_admin()` (used throughout `20260827212023_foundation_rls_policies.sql`),
  `public.audit_events` + `record_*_audit()` triggers.
- `src/components/layout/admin-portal-shell.tsx` nav; `src/lib/admin/*` and
  `src/app/(portal)/admin/*` list/detail conventions; `requireAdmin()`.

## 3. Data and server changes

**Migration** `supabase/migrations/20260904000000_inquiry_capture_foundation.sql`

- `public.inquiry_type` enum — the four existing `GuidanceRequestType` values.
- `public.inquiry_state` enum — the six MPS-WFL-004 states verbatim, no others.
- `public.inquiries`: `id`, `reference` (unique, opaque, no PII), `type`,
  `submitted_at`, `state` default `submitted`, `owner_user_id` (admin owner,
  nullable until claimed), `contact_name`, `contact_email`, `contact_phone`,
  `program_id` → `programs(id)` nullable, `message`, `submission_token`
  (unique, idempotency), `created_at`, `updated_at`.
- RLS enabled, deny-by-default. **Only** `private.is_admin()` SELECT/UPDATE.
  No educator policy, no family policy, no anon policy — assistance privacy
  (MPS-ACC-013) is a property of there being no policy to reach a row, not a
  filter on type. Grants: nothing to `anon`, nothing to `authenticated`.
- `public.submit_inquiry(p_type, p_name, p_email, p_phone, p_program_slug,
  p_message, p_submission_token) returns text` — SECURITY DEFINER,
  `search_path` pinned, EXECUTE granted to `anon` and `authenticated`. Length
  and shape checks mirror the zod schema; program slug is resolved against
  published programs or rejected; state is always `submitted`; owner is always
  null. On a repeated `submission_token` it returns the **existing** reference
  and writes nothing (MPS-ACC-012 "created once").
- `public.admin_set_inquiry_state(p_inquiry_id, p_next_state, p_owner_user_id)`
  — admin-only, guarded transition map derived from WFL-004
  (`submitted → under_review | not_available | closed`;
  `under_review → awaiting_family | approved_path_provided | not_available | closed`;
  `awaiting_family → under_review | approved_path_provided | not_available | closed`;
  `approved_path_provided → closed`; `not_available → closed`; `closed` terminal).
  `approved_path_provided` records only that a path was given — no amount, no
  discount, no eligibility (MPS-RUL-004).
- `record_inquiry_audit()` trigger → `audit_events` on state and ownership
  change only. **The payload carries id, type, states, and actor — never the
  name, email, phone, or message** (SECURITY-ARCHITECTURE: sensitive fields
  must not enter logs or artifacts).
- Header comment carrying MPS/MDS/MTS IDs and an explicit `rollback:` block,
  matching the existing migration house style.
- Add `public.inquiries` to the grants migration's table inventory expectations.
- Regenerate `src/lib/supabase/database.types.ts` via `npm run db:types`.

**Application**

- `src/lib/contact/recorder.ts` — implement `recordGuidanceRequest`: build a
  server-side `submission_token`, call the RPC with the anon-capable server
  client, return `{status:"recorded", reference}`; `unavailable` when Supabase
  is unconfigured; `failed` on any RPC error. Request fields are never logged.
  Its "no destination configured" header comment is rewritten to match reality.
- `src/app/contact/actions.ts` — unchanged apart from passing the idempotency
  token, so a double submit from one form instance yields one row.
- `src/lib/admin/inquiries.ts` — admin reads, filters, and the transition map
  (unit-testable, mirroring `src/lib/admin/transitions.ts`).
- `src/app/(portal)/admin/inquiries/page.tsx` and `[id]/page.tsx` behind
  `requireAdmin()`, plus a nav entry in `admin-portal-shell.tsx`.

## 4. Design

REUSE only. Existing admin table→card responsive pattern, state pill, filter
bar, breadcrumb, detail two-column shell, and MDS tokens; Lucide at the
approved 1.75 px stroke. State meaning is carried by label text, not color
alone. 44 px targets. No new visual convention is introduced; if one appears
necessary, stop and report it as an MDS gap.

## 5. Security and privacy

- Public write reaches exactly one SECURITY DEFINER function; the table stays
  ungranted to `anon` and `authenticated`.
- Educators have no policy, no route, no query path, and no audit payload
  containing inquiry content.
- No child or student fields are collected — adult contact details only
  (MPS-RUL-006).
- No contact detail or message text in logs, URLs, audit payloads, screenshots,
  fixtures, or seed data. Review-environment rows are sanitized samples
  (MPS-RUL-007).
- No rate limiting in this slice; abuse protection is Turnstile at activation
  (GAP-PUBLIC-002).

## 6. Checks (fast lane — no full regression sweep)

1. `npm run typecheck`
2. `npm run lint`
3. `npm run db:types:check`
4. `npm run test:unit` (adds `tests/inquiry-transitions.test.mts`)
5. `npm run db:test` (adds
   `supabase/tests/database/120_inquiry_capture.test.sql`: anon cannot select,
   insert, update, or delete `inquiries`; **an educator role selects zero rows,
   including an assistance row**; admin can; the RPC creates one row and a
   repeat token creates none; an illegal transition raises; the audit payload
   contains no contact or message text)
6. Targeted Playwright only: `tests/e2e/contact.spec.ts`,
   `tests/e2e/authorization.spec.ts`, and a new `tests/e2e/admin-inquiries.spec.ts`
   with `@axe-core/playwright`, an ARIA snapshot, and desktop/tablet/mobile
   screenshots for the new admin page.
7. `npm run build` (new routes).

Full `npm run test:e2e` is deliberately deferred to the pre-handoff sweep.

## 7. Manual steps (WSL/Ubuntu bash)

```bash
npm run db:start
node scripts/db-reset.mjs   # then seed via psql; verify 9 programs
npm run dev
```

- Submit each of the four types at `/contact`; confirm a private on-screen
  received state with a reference, and one row per submission.
- Double-click submit; confirm one row.
- Stop Supabase, submit; confirm `failed`, no success claim, typing retained,
  phone path offered (MPS-ACC-014).
- As admin: `/admin/inquiries`, claim ownership, walk a state path, attempt an
  illegal transition.
- As educator: `/admin/inquiries` and the detail URL are refused; nothing about
  an assistance request is visible anywhere in the educator workspace.
- Keyboard-only pass, visible focus, reduced motion, 360 px width.

## 8. Gaps and owner attention

- **GAP-PUBLIC-001** — MPS names no confirmation channel for MPS-ACC-012 /
  WFL-004 "Confirm receipt privately". Implemented as on-screen confirmation +
  administrator queue. Email confirmation requires a product decision and the
  Resend configuration step.
- **GAP-PUBLIC-002** — no abuse protection on a public write until Turnstile is
  added at the activation gate.
- **GAP-PUBLIC-003** — MPS-WFL-004 assigns owner ACT-006 (Samantha) but states
  no automatic assignment rule; owner is claimed manually. Confirm.
- **GAP-PUBLIC-004** — no retention or deletion rule exists for inquiry contact
  details; blocked with the rest of real-family activation.
- **MPS-ACC-011** (distinguishable registration vs guided-help paths on a
  program) is the remaining part of HSH-SLICE-PUBLIC-03 and is not implemented
  here; `/contact` already presents the four pathways.

## 9. Rollback

Single migration, reversible by the header's `rollback:` block (drop trigger,
functions, table, enums; restore the grants inventory). Application changes
revert with the commit; `recordGuidanceRequest` returning `unavailable` again
is a safe, truthful state.

---

## 10. As built — deviations from the plan above

Recorded after implementation. The plan is what was approved; this is what
differs and why.

1. **Placement.** `/admin/inquiries` became
   `/admin/communications/inquiries`. MDS `navigation.specification.admin`
   names nine administrator destinations and Inquiries is not among them, so a
   tenth top-level nav entry would have been a navigation decision the MDS owns
   (AGENTS.md §3). The queue sits inside the approved Communications
   destination and is reached from a section there. Logged as **MDS-GAP-P2**.

2. **No record id in the URL.** The plan implied a `[id]` detail route. Built
   as a list plus detail drawer instead, matching the approved
   `admin_operations` composition and the `admin/enrollments` precedent: a
   private request about the cost of a class gets no shareable address, and
   nothing lands in browser history.

3. **Public contact copy corrected — this was a defect the slice created.**
   `/contact` carried an owner-approved standing banner reading "Online
   requests are not open yet … nothing you send is recorded or seen by anyone",
   plus a matching reassurance line. Both became false the moment a destination
   existed, and the falsehood ran the wrong way for privacy: a family told
   nobody would read their message writes a different message. Replaced with a
   truthful statement of what now happens, promising no timeline and no outcome
   (MPS-RUL-010). **This is public copy and needs owner sign-off** —
   **GAP-PUBLIC-005**.

4. **Confirmation now carries the reference.** The received panel shows the
   `HSH-XXXXXX` code. It carries no contact detail, which is what makes it safe
   to show and to read aloud on the phone — the fallback MPS-ACC-014 offers.

5. **Idempotency key is content-derived**, not generated: a double-clicked
   button and a resubmitted form arrive as separate server-action invocations,
   so a fresh token per invocation would defeat the guard. Keyed on the content
   plus the UTC date, so the same words sent again next week are a follow-up
   with their own record rather than a silently reused reference.

6. **`admin-inquiries.spec.ts` restores its fixture with a scoped psql restore**
   rather than `npm run db:reset`. The suite mutates only inquiries, and
   `db:reset` is currently broken in this WSL environment — it applies every
   migration (this one included) and then exits 1 restarting containers,
   leaving the database empty. That is a pre-existing environment failure, not
   a defect in this slice, but it also breaks `admin-enrollments.spec.ts` and
   is worth its own fix.

7. **`contact.spec.ts` now cleans up after itself.** A submission on that page
   creates a real record, so the suite writes to the shared fixture and deletes
   its own rows (`reference not like 'HSH-SAMPLE%'`) in `afterAll`.

### Checks actually run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | pass |
| `npm run test:unit` | 221 pass, 0 fail |
| `npm run db:test` | 482 pass across 15 files, `Result: PASS` |
| `npm run build` | compiled successfully, exit 0 |
| `npx playwright test admin-inquiries` | 27 passed |
| `npx playwright test contact` | 32 passed |

Not run, deliberately: the full `npm run test:e2e` sweep, and
`authorization.spec.ts`. The new route's cross-role denials are covered by
`admin-inquiries.spec.ts`. Both belong to the pre-handoff sweep.

`npm run db:types:check` was **not** run: it regenerates from the linked
project, which does not have this migration until it is pushed. Types were
generated from the local stack instead and will report drift against the linked
project until `supabase db push` runs.
