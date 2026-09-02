# Implementation Prompt — Family-Side Conversion Journey (MPS-REQ-012 / MPS-REQ-013)

**Branch:** `feat/family-conversion-journey`
**Prepared:** 2026-09-01
**Phase:** MTS `IMPLEMENTATION-PLAN.md` — family workflows; MPS-WFL-003
**Status:** Approved for execution by Josh Coley, 2026-09-01 (see §9 decisions)
**Implemented:** 2026-09-01 on `feat/family-conversion-journey`

---

## 1. Goal and scope

Make MPS-WFL-003 reachable by a parent. Today every ingredient exists —
programs, students, capacity, waitlist flag, the eight-state enrollment enum,
the admin transition RPC, the family dashboard, the public checkout-handoff
component — and there is **no path by which a parent creates an enrollment**.
`public.enrollments` has no client write privilege and
`src/lib/enrollment/repository.ts` says so in its header. Every enrollment in
the review environment arrives from the sanitized seed.

This slice adds the missing path:

1. a **per-program confirmation mode** (MPS-RUL-001), which closes
   **GAP-ADMIN-006** and makes **MPS-ACC-019** satisfiable for the first time;
2. a **server-side eligibility evaluation** performed before any payment path is
   offered (MPS-REQ-012) — program publication, availability, capacity,
   waitlist, confirmation mode, duplicate enrollment, family readiness, student
   ownership, and guardian-authority affirmation;
3. a **parent registration surface** that names the blocker when one exists
   (MPS-ACC-018) and never initiates payment when it does;
4. an **enrollment outcome surface** carrying one authoritative state
   (MPS-REQ-014) and, only for an eligible instant-confirmation registration,
   the existing external **checkout handoff** (MPS-REQ-013, MPS-ACC-021);
5. the public program page and the family dashboard **wired** to that path.

### In scope

- one migration: `confirmation_mode`, enrollment affirmation columns, and the
  `family_request_enrollment` function;
- `admin_update_program_facts` extended with confirmation mode, plus the admin
  program form field and the MPS-REQ-024 material-audit array;
- routes `/family/enroll/[slug]` and `/family/enrollments/[enrollmentId]`;
- CTA wiring on `/programs/[slug]` and on the family dashboard enrollment cards;
- reuse of `EnrollmentStateBadge`, `CheckoutHandoff`, `AvailabilityBadge`,
  `StudentSelector`, `Field`/`Checkbox`/`Button`;
- pgTAP, unit, e2e, axe, and screenshot coverage for every path.

### Out of scope (and why)

- **Any payment record, webhook, or provider callback.** MPS-REQ-013 is a
  handoff; INTEGRATION-MANIFEST approves no return signal. Nothing infers
  payment from navigation.
- **Notifications.** MPS-WFL-003 names them; no notification capability exists
  (GAP-ADMIN-005). None is invented.
- **Waitlist ordering or promotion.** GAP-ADMIN-011 is open and unchanged.
- **Refund, credit, transfer, cancellation, or scholarship outcomes**
  (MPS-RUL-004, MPS GAP-010).
- **Real consent or waiver language** (MPS-RUL-010, MPS GAP-005, checklist §6).
- **Real-family data.** `enrollments_sample_only` stays; parent-created rows are
  sample rows (MPS-RUL-007).

---

## 2. Applicable approved IDs

| Source | IDs |
|---|---|
| Requirements | MPS-REQ-002, 003, 012, 013, 014, 020, 021, 023, 024 |
| Rules | MPS-RUL-001, 002, 004 (respected, not implemented), 005, 007, 008, 009, 010 |
| Workflow | MPS-WFL-003 (states, main/alternate/failure paths, recovery), MPS-WFL-007 |
| Acceptance | MPS-ACC-002, 003, 018, **019**, **020**, **021**, 022, 023, 031, 032 |
| Features | MPS-FEA-004 (enrollment + payment handoff), MPS-FEA-005, MPS-FEA-010, MPS-FEA-012 |
| Design | DESIGN-SYSTEM.md §6 enrollment_state (all ten variants), payment-handoff and trust-state rules; §7 form and detail shells; §8 responsive; §10 accessibility (§10 announcement of "validation, loading, success, pending, blocked, waitlist, handoff, and confirmation changes") |
| Design refs | MDS-REF-004 §5 trust states and "Continue to Secure Checkout"; MDS-REF-005 §2 detail + form shells, §5 responsive; MDS-REF-007 family shell, student context, pending-payment warning |
| Technology | MTS SECURITY-ARCHITECTURE (deny-by-default RLS, least privilege, no private data in URLs); INTEGRATION-MANIFEST "External checkout" and integration rules; CAPABILITY-MATRIX capacity/waitlist |

---

## 3. Repository evidence inspected

- `supabase/migrations/20260827212017_foundation_programs.sql` — `programs` has
  `availability`, `publication_state`, `checkout_url`. **No confirmation-mode
  column.**
- `supabase/migrations/20260829170000_family_dashboard_records.sql` —
  `enrollment_state` is MPS-WFL-003's eight states verbatim; `enrollments` has
  `enrollments_one_per_student_program` (unique), `enrollments_sample_only`,
  `enrollments_family_matches_student` trigger, and an audit trigger. Table
  comment: *"No client role holds any write privilege."*
- `supabase/migrations/20260902000000_schedule_capacity_waitlist_attendance.sql`
  — `programs.capacity` (nullable = not published) and
  `programs.waitlist_enabled` (default false); `capacity`/`waitlist_enabled`
  added to the material audit array; **no capacity-driven enrollment mutation of
  any kind**, deliberately deferred to this slice.
- `supabase/migrations/20260830090000_admin_program_enrollment_operations.sql` —
  `admin_update_program_facts(...)` (optimistic `expected_updated_at`, checkout
  host allowlist), `admin_set_enrollment_state`, transition guard.
- `src/lib/enrollment/repository.ts` — read-only by design; its header names
  MPS-REQ-012/013 as the missing conversion journey.
- `src/components/enrollment/enrollment-state.tsx` — the single WFL→MDS state
  mapping used by both family and admin views (MPS-ACC-022).
- `src/components/program/checkout-handoff.tsx` — `HANDOFF_NOTICE`, the
  null-`checkoutUrl` truthful state, nothing appended to the URL.
- `src/components/program/program-action-rail.tsx` — availability, handoff,
  guidance; **no register action**.
- `src/app/(portal)/family/setup/actions.ts` and `students/new/actions.ts` —
  the established Server Action shape: re-guard, zod parse, `isSupabaseConfigured`,
  typed form state, `redirect()` outside the try.
- `src/lib/family/validation.ts` — `AFFIRMATION_VERSION = "demo-unapproved-v0"`
  and the guardian-authority `z.literal("on")` affirmation, plus the
  `students_affirmation_unapproved` CHECK. **This is the precedent this slice
  follows for enrollment affirmation.**
- `src/lib/auth/guards.ts` (`requireRole`), `src/lib/auth/return-to.ts`
  (`safeReturnTo`), `src/components/family/student-selector.tsx`.
- `tests/e2e/fixtures.ts`, `supabase/tests/database/`, `tests/*.test.mts`.

---

## 4. Missing facts — reported, never invented

| # | Missing fact | Handling |
|---|---|---|
| C-1 | **Which enrollment states occupy a seat.** MPS defines capacity but no seat-holding rule. | Only `confirmed` is counted against `capacity`. It is the only state the approved trust language calls a place (`enrollment-state.tsx` rule 1). Recorded as **GAP-FAM-001**. |
| C-2 | **Per-program confirmation mode values.** MPS-RUL-001 approves the capability and names the administrator as configurer; no program's value is published. | Column added, default `administrator_approval` (see §9 Q1). No program is set to `instant` by this slice; an administrator sets it. |
| C-3 | **Consent and waiver language** (MPS GAP-005, checklist §6). | No policy language is written. Enrollment records a guardian-authority *affirmation* only, versioned `demo-unapproved-v0`, with the same CHECK the students table uses. MPS-ACC-003 is demonstrated for that affirmation; the approved-consent half stays open. |
| C-4 | **Checkout URLs.** Still unrecorded for every program. | Unchanged. `CheckoutHandoff` renders its truthful "Registration link not published" state, and an eligible `started` enrollment says so plainly. |
| C-5 | **Waitlist ordering / promotion** (GAP-ADMIN-011). | A waitlisted row is created; no position, priority, or promise is shown. |
| C-6 | **Notification of state changes** (GAP-ADMIN-005). | The dashboard and enrollment page are the only carriers; nothing claims a message was sent. |

---

## 5. Data changes — `supabase/migrations/20260903000000_family_conversion_journey.sql`

Header comment in the house style (MPS/MDS/MTS ids, what is deliberately
absent, full `rollback:` block).

### 5.1 `program_confirmation_mode` (closes GAP-ADMIN-006)

```
create type public.program_confirmation_mode as enum
  ('instant', 'administrator_approval');

alter table public.programs
  add column confirmation_mode public.program_confirmation_mode
    not null default 'administrator_approval';
```

Two values, exactly MPS-RUL-001's two. `administrator_approval` is the default
because a program nobody has configured must not route a family to a payment
page (§9 Q1). Added to `record_program_audit()`'s `material` array
(MPS-REQ-024) and to `admin_update_program_facts` — the old signature is dropped
and re-created, and the rollback restores it verbatim.

### 5.2 Enrollment affirmation columns

```
alter table public.enrollments
  add column authority_affirmation_version text,
  add column authority_affirmed_at timestamptz,
  add column requested_by uuid references auth.users (id) on delete set null;

alter table public.enrollments
  add constraint enrollments_affirmation_unapproved
    check (authority_affirmation_version is null
           or authority_affirmation_version = 'demo-unapproved-v0'),
  add constraint enrollments_affirmation_paired
    check ((authority_affirmation_version is null) = (authority_affirmed_at is null));
```

Nullable because seeded rows have no affirmation; the CHECK makes it impossible
for any row to claim approved language was accepted (MPS-RUL-010). `requested_by`
satisfies MPS-REQ-024's attributability for a family-initiated change.

### 5.3 `public.family_request_enrollment(target_student uuid, target_program uuid, authority_affirmed boolean)`

`security definer`, `set search_path = ''`, returns
`table (outcome text, enrollment_id uuid, state public.enrollment_state)`.
`revoke all from public`, `grant execute to authenticated`. **No INSERT
privilege or policy is added to `public.enrollments`** — the table's zero-client-
write posture is preserved and this function is the only door.

Evaluation order, each step returning a distinct `outcome` string so the UI can
name the blocker (MPS-ACC-018) — and every blocked outcome returns **before any
row is written and before any checkout path is offered**:

| Order | Check | Blocked outcome | Authority |
|---|---|---|---|
| 1 | `auth.uid()` is a parent in the student's family (re-derived; no client family id) | `not_authorized` (raise `42501`) | MPS-REQ-004, SECURITY-ARCHITECTURE |
| 2 | `authority_affirmed` is true | `blocked_authority` | MPS-RUL-008, MPS-ACC-002 |
| 3 | program exists and `publication_state = 'published'` (`for update`) | `blocked_unavailable` | MPS-REQ-012 |
| 4 | `availability <> 'closed'` | `blocked_closed` | MPS-REQ-012, MPS-RUL-002 |
| 5 | no existing row for `(student, program)` | `duplicate` + the existing state | MPS-REQ-014, MPS-ACC-022/023 |
| 6 | capacity: `capacity is not null and confirmed_count >= capacity` | full → `waitlist_enabled` ? insert `waitlisted` : `blocked_full` | **MPS-ACC-020**, MPS-RUL-002 |
| 7 | `confirmation_mode = 'administrator_approval'` | insert `approval_pending` | **MPS-ACC-019** |
| 8 | otherwise | insert `started` | MPS-WFL-003 main path |

Notes that matter:

- The program row is locked `for update` before the confirmed count is read, so
  two concurrent registrations cannot both pass a capacity of one
  (MPS-WFL-003 failure path *"stale capacity"*). A retry that still races loses
  to `enrollments_one_per_student_program`, which is caught and returned as
  `duplicate` — never a second row, never a second charge (MPS-REQ-014,
  MPS-WFL-003 recovery).
- The function **can never write `confirmed`, `payment_pending`,
  `payment_failed`, or `canceled`.** Those remain administrator decisions
  through `admin_set_enrollment_state`. A parent action cannot confirm an
  enrollment or assert a payment outcome.
- `waitlisted` is inserted with no payment path anywhere on the resulting page
  (MPS-ACC-020, MPS-RUL-002).
- `is_sample` stays `true` by default; the sample-only CHECK is untouched.
- The existing `enrollments_audit` trigger records the insert; no new audit code.

---

## 6. Application changes

### 6.1 `src/lib/enrollment/`

- `eligibility.ts` — the `outcome` → presentation table: heading, plain
  sentence naming the blocker, whether a payment path may be offered (only
  `started`), and the recovery action (guidance link, phone, or dashboard).
  Pure and unit-testable; **the server function remains the control**, this maps
  its answer to words.
- `repository.ts` — add `requestEnrollment()` calling the RPC and
  `getFamilyEnrollment(id)` reading one enrollment (RLS-scoped, no `.eq` on
  family), both `server-only`. The header note is updated, not deleted.

### 6.2 `/family/enroll/[slug]`

`requireRole("parent", …)`. Server-rendered: program identity and
`AvailabilityBadge`, the student selector (a plain `<select>` in the form —
students come from the viewer's own family), the guardian-authority checkbox
reusing the students-form wording verbatim, `HANDOFF_NOTICE` shown **before**
the submit so the meaning of what follows is never inferred, and a submit
labelled "Request registration" (not "Pay" — nothing here takes money).

Pre-submit the page also renders any *already-known* blocker (program closed, no
students yet, no family yet) with the recovery action, so a parent is not walked
into a dead end.

`actions.ts` — Server Action in the established shape: re-guard, zod parse,
`isSupabaseConfigured` short-circuit, call the RPC, then `redirect()` to
`/family/enrollments/[id]` on any outcome that produced a row; blocked outcomes
return typed form state rendered in an `Alert` with `role="status"` (DESIGN-SYSTEM
§10 announcements). Nothing is logged — student and family data.

### 6.3 `/family/enrollments/[enrollmentId]`

The single authoritative state view (MPS-REQ-014, MPS-ACC-022):
`EnrollmentStateBadge withSentence`, program identity, and **only when the state
is `started`** the existing `CheckoutHandoff` — which, with today's null
`checkout_url`, renders its truthful unpublished-link state. `approval_pending`,
`waitlisted`, and every blocked state render no payment control at all
(MPS-ACC-019, MPS-ACC-020, MPS-ACC-021).

### 6.4 Wiring

- `program-action-rail.tsx` — a "Register a student" action above the handoff
  panel, linking to `/family/enroll/[slug]` for a signed-in parent and to
  `/sign-in?returnTo=…` (via `safeReturnTo`) otherwise. The rail's existing
  availability, handoff, and guidance content is unchanged.
- `dashboard-cards.tsx` — each enrollment row links to its enrollment page.
- Admin program form + `admin/programs/[programId]` — a confirmation-mode
  radio group with both values described in plain words, plus the same optimistic
  `expected_updated_at` guard the other fields use (MPS-RUL-005).
- `enrollment-state.tsx` — the `started` sentence is corrected so it is true both
  before and after a checkout click ("Your registration is started. Payment is
  completed on Home School Haven's checkout page; enrollment is not confirmed.").
  No other state's copy changes; both audiences still read from this one table.

**No state transition is triggered by clicking the checkout link.** A click is
navigation, not payment activity we can verify (MPS-REQ-013, DO-DONT trust
states). `started` already means "handed off, nothing verified".

---

## 7. Security, privacy, and authorization

- Authorization is re-derived three times: page guard, Server Action guard,
  and `auth.uid()` inside the `security definer` function. No client supplies a
  family id, role, price, capacity, or state.
- The function is the only write path; `public.enrollments` keeps zero client
  write privilege and its deny-by-default policies.
- Nothing is appended to `checkout_url` — no enrollment id, student id, or
  contact detail leaves in a URL (SECURITY-ARCHITECTURE, INTEGRATION-MANIFEST).
- No student name, family name, or enrollment id is logged, put in a query
  string, or captured in a screenshot fixture.
- Enrollment ids appear in the path of a route whose read is RLS-scoped to the
  owning family; an id from another family returns not-found, and an e2e test
  asserts it.

---

## 8. Checks to run

`npm run typecheck` · `npm run lint` · `npm run format:check` ·
`npm run test:unit` (eligibility mapping) · `npm run db:reset` + `npm run db:test`
(new pgTAP file covering all eight outcomes, the not-a-parent denial, the
cross-family student denial, the duplicate retry, and the capacity race) ·
`npm run db:types:check` · `npm run db:advisors` · `npm run build` ·
`npm run test:e2e` including new `family-enroll.spec.ts` with axe, keyboard,
ARIA snapshot, and screenshots at 1440/1024/768/375 · rollback review of the
migration's `rollback:` block.

Manual steps (WSL/Ubuntu bash) will be listed in the completion report, covering:
approval-required program → `approval_pending` and no payment control
(MPS-ACC-019); full waitlist-enabled program → `waitlisted` and no payment
control (MPS-ACC-020); instant program → `started` and the handoff with its
unpublished-link state (MPS-ACC-021); missing affirmation → blocked, named,
no row (MPS-ACC-018/002); double submit → one row (MPS-ACC-023).

---

## 9. Questions for the owner

**Q1 — Default confirmation mode for existing programs. DECIDED 2026-09-01:**
`administrator_approval`. MPS-RUL-001 approves the capability but no program's
value is published, so no program routes a family toward payment until an
administrator deliberately sets `instant`. Implemented as the column default and
asserted in `110_family_conversion_journey.test.sql`.

**Q2 — Seat-holding states (GAP-FAM-001). DECIDED 2026-09-01:** only `confirmed`
counts against `capacity`. `approval_pending` and `started` do not hold a seat,
which means an approval-required program can accumulate more pending requests
than seats — visible to the administrator, decided by them.

## 9a. Deviations from the prompt as written

| # | Prompt said | What was built | Why |
|---|---|---|---|
| D-FCJ1 | `CONFIRMATION_MODE` under `src/components/enrollment/` | `src/lib/enrollment/confirmation-mode.ts` | It is a data table with no JSX, and `node --test` cannot import `.tsx`. Moving it made the mapping unit-testable, which was the point of having one table. |
| D-FCJ2 | `CheckoutHandoff` reused as-is | Its prop narrowed to `Pick<Program, "name" \| "checkoutUrl">` | Those are the only two fields it reads. The enrollment page has no whole `Program` and should not have to fabricate one to reuse the component. No rendering or copy changed. |
| D-FCJ3 | — | The `started` sentence in `ENROLLMENT_STATE` was corrected | It said "Checkout was started with … payment provider", which claims an event the product cannot observe. It now states the recorded fact and the two non-confirmations. |

---

## 10. Gaps, exceptions, deviations

| ID | Statement | Owner |
|---|---|---|
| **GAP-ADMIN-006 (closed)** | Confirmation mode now has a column, an administrator surface, and audit coverage. MPS-ACC-019 becomes satisfiable and is claimed. | — |
| GAP-FAM-001 (new) | MPS defines no rule for which enrollment states occupy capacity. Only `confirmed` is counted. | MPS |
| GAP-FAM-002 (new) | MPS-WFL-003 lists `payment_failed` as a failure path, but no provider signal exists to produce it. It stays administrator-set only. | MPS + MTS |
| GAP-005 (carried) | Approved consent language still absent; only a `demo-unapproved-v0` guardian-authority affirmation is recorded. | MPS |
| GAP-010 (carried) | No financial policy is decided or automated anywhere in this slice. | MPS |
| GAP-ADMIN-005 / 011 / 004 (carried) | Notifications, waitlist ordering, and per-program capacity numbers unchanged. | MPS |
