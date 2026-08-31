# Implementation prompt — Administrator Program and Enrollment Operations

**Branch:** `feat/admin-program-enrollment-operations`
**Builds on:** `feat/admin-operations-foundation` (`prompts/admin-operations-foundation.md`)
**Status:** Phase 1 complete — awaiting approval before any production code changes
**Prepared:** 2026-08-29

---

## 1. Goal and slice boundaries

Give an authorized administrator two working destinations — Programs and
Enrollments — that support only the operations the approved MPS explicitly
grants, enforce every state transition on the server, and leave an attributable
history.

### In scope

1. `/admin/programs` — searchable, filterable program list (desktop table →
   mobile labeled record cards).
2. `/admin/programs/[programId]` — program detail with the approved edit,
   availability, checkout-link, and publication actions.
3. `/admin/programs/new` — approved create-draft workflow.
4. `/admin/enrollments` — filterable enrollment list with a detail drawer and
   the approved enrollment state-change actions.
5. Server-enforced validation, transition rules, authorization, idempotency,
   stale-conflict detection, and audit for every mutation.
6. Restoration of the parts of MDS-REF-009 that deviations D-AO1, D-AO2, and
   D-AO3 removed because their targets did not exist.

### Explicitly out of scope in this branch

Families, Educators, Schedule, Communications, Reports, and Settings
destinations; educator assignment management; announcement or resource
authoring; family/student profile administration; program cancellation or
completion states; capacity numbers; any financial operation; any
payment-verification record; enrollment creation by an administrator; export,
download, or print of roster data; real-family activation; new dependencies.

---

## 2. Active system versions

| System | Version | Status |
|---|---|---|
| MPS | v1.0 | Approved; GAP-005 and GAP-010 open, EXC-001 in force |
| MDS | v1.0 | Approved and locked; MDS-REF-009 canonical for this slice |
| MTS | v1.0 | Fully approved; repository reconciled 2026-08-27 |

Stack as inspected: Next.js 16.3.3 App Router, React 19.2.8, TypeScript 5,
Tailwind v4 (CSS-first), `@base-ui/react` 1.7, `lucide-react` 1.34, Zod 4.4,
`@supabase/ssr` 0.12.5, Playwright 1.62 + `@axe-core/playwright` 4.13,
`node --test`. No dependency is added by this slice.

---

## 3. Requirements and acceptance criteria

**Implemented:** MPS-REQ-016, MPS-REQ-017 (enrollment states only),
MPS-REQ-020, MPS-REQ-021, MPS-REQ-023, MPS-REQ-024; supporting MPS-REQ-008,
MPS-REQ-013, MPS-REQ-014, MPS-REQ-004/005.

**Rules applied:** MPS-RUL-004 (records status, decides no financial outcome),
MPS-RUL-005 (only an administrator or the owner publishes), MPS-RUL-007
(sanitized data), MPS-RUL-010 (no invented policy language).

**Acceptance criteria targeted:** MPS-ACC-026 (lifecycle transitions appear
consistently and retain attributable history), MPS-ACC-027 (an educator cannot
publish a price, open registration, or cancel a program), MPS-ACC-022 (family
and admin views show one consistent enrollment state), MPS-ACC-031 (material
changes stay consistent across views), MPS-ACC-004/005 (sanitized data, no
private disclosure), MPS-ACC-006 (no unapproved policy language),
MPS-ACC-032 (attributable material changes).

**Not addressed here:** MPS-ACC-028 (roster field visibility to an assigned
educator — the Educators slice), MPS-ACC-019/020/021/023 (they belong to the
family-side conversion journey, which does not exist yet; see §12 GAP-ADMIN-006).

---

## 4. Repository evidence inspected

- `src/app/(portal)/admin/page.tsx`, `src/lib/admin/{repository,attention,activity}.ts`
- `src/components/admin/*`, `src/components/layout/{portal-shell,admin-portal-shell}.tsx`
- `src/lib/auth/{guards,session}.ts`, `src/app/(portal)/layout.tsx`, `middleware.ts`
- `src/lib/programs/{repository,map-program-row}.ts`, `src/content/programs.ts`
- `src/app/programs/page.tsx`, `src/app/programs/[slug]/page.tsx`
- `src/components/program/{checkout-handoff,availability-badge,verified-facts}.tsx`
- `src/lib/enrollment/repository.ts`, `src/components/family/enrollment-state.tsx`
- `src/lib/family/{repository,validation}.ts`, `src/app/(portal)/family/students/new/{actions,form-state}.ts`
- `src/components/ui/*` — button, badge, card, field, input, textarea, select,
  checkbox, radio-group, text-link. **No dialog, alert, drawer, or table
  primitive exists yet.**
- All eight migrations, `supabase/seed.sql`, all seven pgTAP suites
- `tests/e2e/{authorization,admin-overview,family-dashboard}.spec.ts`, `tests/e2e/fixtures.ts`
- `package.json`, `playwright.config.ts`, `.env.local`

---

## 5. PROGRAM AUTHORITY MATRIX

Authority is taken from the approved MPS text only. An existing schema column,
RLS policy, or drawn reference element is evidence that something is *possible*,
never that it is *authorized*.

| Operation | Authorized actor | Approved requirement / rule | Required validation | Audit | Reversible | Decision |
|---|---|---|---|---|---|---|
| **View program** (any publication state) | ACT-004, ACT-006 | MPS-REQ-016, MPS-REQ-020; `programs_select_admin` | UUID format on the detail route; no other input | none (read) | n/a | **Implement** |
| **Create draft program** | ACT-004, ACT-006 | MPS-REQ-016; MPS-WFL-005 main path step 1 ("Create draft") | Name 1–160; slug unique, `^[a-z0-9-]+$`, 1–80; summary optional ≤600. Every `published_*` fact left NULL. `publication_state='draft'` forced. | `program:created` (existing trigger) | Yes — archive it | **Implement** |
| **Edit program facts** | ACT-004, ACT-006 | MPS-REQ-016 ("create, review…"), MPS-REQ-008, MPS-RUL-005 | Per-field length bounds; empty string → NULL, never `""`; no field is derived from another | `program:updated` with per-field from/to (existing trigger, material fields) | Yes — edit again; audit holds the prior value | **Implement** |
| **Configure enrollment availability** (`open`/`limited`/`waitlist`/`closed`/`unknown`) | ACT-004, ACT-006 | MPS-REQ-016 ("open, close"), MPS-REQ-008 ("capacity state"), MPS-RUL-002 (capacity behavior is program-specific) | Enum membership only | `program:updated` `availability` | Yes | **Implement** |
| **Configure capacity numbers / seat counts** | — | Checklist §1 "confirm … capacity" is **unanswered** | — | — | — | **Blocked** — GAP-ADMIN-004. No column exists; do not add one. `limited` is a state, not a number. |
| **Configure external checkout link** | ACT-004, ACT-006 | MPS-REQ-013, MPS-RUL-005, BETA-CONTENT-IMPORT-INVENTORY rule 4 and the `pay.homeschoolhaven.org` row | `https://` required; host must be `pay.homeschoolhaven.org`; no query string or fragment; ≤300 chars; empty → NULL | `program:updated` `checkout_url` | Yes | **Implement.** The administrator supplies the URL; the agent invents none, and the host allowlist stops any other destination being stored. |
| **Publish program** (`draft`→`published`) | ACT-004, ACT-006 only | MPS-REQ-016, **MPS-RUL-005**, MPS-ACC-026/027 | Transition rule; a truthfulness precondition — name and summary present — surfaced as a blocking message, not a silent failure (MPS-ACC-008/009) | `program:updated` `publication_state` | Yes — unpublish | **Implement** |
| **Unpublish** (`published`→`draft`) | ACT-004, ACT-006 | MPS-REQ-016; MPS-WFL-005 recovery "correct errors through authorized edits" | Transition rule | as above | Yes | **Implement** |
| **Archive program** (`draft`/`published`→`archived`) | ACT-004, ACT-006 | MPS-REQ-016 ("…and archive"), MPS-WFL-005 states include `archived` | Transition rule; confirmation dialog with explicit language | as above | Yes — restore to draft | **Implement** |
| **Restore archived** (`archived`→`draft`) | ACT-004, ACT-006 | MPS-WFL-005 recovery | Transition rule | as above | Yes | **Implement** |
| **Cancel program / mark completed** | — | MPS-WFL-005 lists `canceled` and `completed` states **and** requires "Notify affected families of approved material schedule, status, or cancellation changes" | — | — | — | **Defer** — GAP-ADMIN-005. Two dependencies are absent: no enum value exists for either state, and no notification capability exists. Cancelling a program silently, without telling the enrolled families the workflow requires be told, would be the workflow half-built. |
| **Delete program** | — | No approved requirement; `enrollments.program_id` is `on delete restrict`; retention and deletion are checklist §11, **unanswered** | — | — | Irreversible | **Blocked** — archive is the approved alternative and is implemented. The existing `programs_delete_admin` policy is left in place but no application path reaches it. |

**Publication state vocabulary.** `public.program_publication_state` holds
`draft`/`published`/`archived`. MPS-WFL-005 names eleven states. The remaining
eight are either availability (`enrollment_open`, `full`, `waitlist`, `closed`
→ covered by `public.availability_state`), review workflow (`review` — no
approved reviewer distinct from the publisher), or the deferred pair above. No
enum value is added by this slice.

---

## 6. ENROLLMENT AUTHORITY MATRIX

| Operation | Authorized actor | Approved requirement / rule | Required validation | Audit | Reversible | Decision |
|---|---|---|---|---|---|---|
| **View enrollment** | ACT-004, ACT-006 | MPS-REQ-017, MPS-REQ-020, MPS-ACC-022; `enrollments_select_admin` | none (no ID in any URL) | none | n/a | **Implement** |
| **Review submitted enrollment** | ACT-004, ACT-006 | MPS-WFL-003 owner is ACT-004; MPS-ACC-019 (`approval_pending`) | none | none | n/a | **Implement** as the detail drawer plus the actions below. There is no separate "mark as reviewed" state in MPS-WFL-003, so none is invented. |
| **Request missing information from a family** | — | No approved workflow, no approved language (MPS-RUL-010), communications are MPS-FEA-009 / Phase 4 | — | — | — | **Blocked** — GAP-ADMIN-001 |
| **Change enrollment status** (the approved subset) | ACT-004, ACT-006 | **MPS-REQ-017** ("manage … family enrollments, enrollment states"), MPS-WFL-003 states + owner ACT-004 | Enum membership; transition table (§8); mandatory 1–400 char note; `expected_updated_at` concurrency token | `enrollment:state_changed` `{from,to}` (existing trigger) | See per-transition rules | **Implement** |
| **Record external-payment verification** | — | Checklist §2 "Confirm how successful, pending, failed, canceled, reversed, and disputed payments are identified" is **unanswered**. MPS defines no evidence standard, no payment record, no correction procedure. | — | — | — | **Blocked** — GAP-ADMIN-002. `payment_pending` is displayed read-only and its meaning ("payment status pending verification; enrollment not yet confirmed") is stated in words. **No payment table, no payment column, no "verified" flag, no evidence field is created.** |
| **Confirm enrollment** (→ `confirmed`) | ACT-004, ACT-006 | MPS-REQ-017; MPS-WFL-003 `confirmed` with owner ACT-004; MTS SECURITY-ARCHITECTURE "…until a trustworthy provider signal **or authorized manual verification** exists"; MTS addendum item 8 (manual checkout reconciliation, approved) | Transition table; mandatory note; concurrency token | yes | Correctable → `blocked` or `canceled` | **Implement.** Framed as an *administrative enrollment decision*, never as a payment record. The UI says so explicitly. This is the one operation where the boundary between GAP-ADMIN-002 and MPS-REQ-017 matters: the administrator's judgment is authorized; a system claim about payment is not. |
| **Place on waitlist** (→ `waitlisted`) | ACT-004, ACT-006 | MPS-REQ-017; MPS-RUL-002 ("joining a waitlist does not collect payment"); MDS `enrollment_state.waitlist` "do not imply enrollment" | Transition table; mandatory note | yes | Yes | **Implement** |
| **Cancel enrollment** (→ `canceled`) | ACT-004, ACT-006 | MPS-REQ-017; **MPS-RUL-004** — "an authorized administrator handles it manually under existing policy; the beta **records status** but does not decide or issue the outcome automatically" | Transition table; mandatory note; destructive confirmation dialog | yes | **No** — terminal in this release | **Implement, status only.** The dialog states in plain words that no refund, credit, transfer, or other financial outcome is decided or issued here and that those remain Home School Haven's existing offline policy. Reinstating a cancelled enrollment is **blocked** (GAP-ADMIN-003). |
| **Place on hold** (→ `blocked`) | ACT-004, ACT-006 | MPS-WFL-003 `blocked` with owner ACT-004; MPS-WFL-003 recovery "administrative review" | Transition table; mandatory note | yes | Yes | **Implement** — from every non-confirmed, non-cancelled state. **Not** reachable from `confirmed`: the owner declined that correction path (GAP-ADMIN-008). |
| **Set `started` / `approval_pending` / `payment_failed`** | — | These are outcomes of the family-side journey and the payment path, not administrative decisions. `payment_failed` is a payment claim → checklist §2. | — | — | — | **Blocked.** They are displayed, never set. |
| **Add scholarship or discount** | — | **GAP-010** open; checklist §4 unanswered; MPS-RUL-004; AGENTS.md §5 | — | — | — | **Blocked** |
| **Issue refund, credit, or transfer** | — | **GAP-010** open; checklist §5 unanswered; MPS-RUL-004 | — | — | — | **Blocked** |
| **Create enrollment as an administrator** | — | MPS-REQ-002/MPS-RUL-008 require parent authority affirmation and consent before enrollment; an admin-created enrollment has neither | — | — | — | **Blocked** |
| **Delete enrollment** | — | Retention and deletion are checklist §11, **unanswered**; MPS-REQ-024 requires history be preserved | — | — | Irreversible | **Blocked** |

---

## 7. Data classification and trust boundaries

| Data | Class | Where it may appear |
|---|---|---|
| Program facts, publication state, availability, checkout URL | Public / operational | Anywhere, including URLs and screenshots |
| Student preferred name | **Child data**, sanitized sample only | Enrollment list row and drawer, for an authenticated administrator only. Never in a URL, query string, log, error message, audit payload, or committed screenshot. |
| Family name | Family data, sample only | Same as above |
| Enrollment state, state-changed time | Operational | Admin and family views; audit payload carries the enum labels only |
| `state_note` | Administrator free text | Drawer only. **Not** written to `audit_events` — free text cannot be guaranteed free of a name. |
| Enrollment / student / family UUIDs | Identifiers | Form bodies only (POST). Never a route segment, never a query parameter. |

Trust boundary: the browser supplies (a) filter values, (b) a record UUID in a
form body, (c) a target state, (d) a note, (e) a concurrency token. Every one is
re-validated on the server and the authorization decision is taken from the
session, never from the request. The service-role key is not used anywhere; all
reads and writes run under the viewer's session against RLS.

---

## 8. Approved enrollment transition table

Enforced in SQL (authoritative) and mirrored in `src/lib/admin/transitions.ts`
(pure, unit-tested, used only to decide which buttons to render).

| From ↓ | → `confirmed` | → `waitlisted` | → `blocked` | → `canceled` |
|---|:--:|:--:|:--:|:--:|
| `started` | ✅ | ✅ | ✅ | ✅ |
| `approval_pending` | ✅ | ✅ | ✅ | ✅ |
| `payment_pending` | ✅ | ✅ | ✅ | ✅ |
| `waitlisted` | ✅ | — | ✅ | ✅ |
| `blocked` | ✅ | ✅ | — | ✅ |
| `payment_failed` | ❌ | ✅ | ✅ | ✅ |
| `confirmed` | — | ❌ | ❌ | ✅ |
| `canceled` | ❌ | ❌ | ❌ | — |

`payment_failed → confirmed` is refused deliberately: confirming an enrollment
whose payment is recorded as failed is a financial judgment, and checklist §2
and §5 are unanswered. The two-step `payment_failed → blocked → confirmed`
remains available and leaves two audit rows explaining the correction.

`canceled` is terminal (GAP-ADMIN-003).

**`confirmed → blocked` is NOT implemented.** It was proposed as the correction
path for an incorrect confirmation and the owner declined to confirm it on
2026-08-29, so no approved correction path exists — see GAP-ADMIN-008. A
confirmation is therefore effectively irreversible except by cancelling the
enrollment, which MPS-RUL-004 permits as a status record. The confirmation
dialog says so before the administrator commits.

Every allowed transition requires a note. A no-op (target equals current) is
accepted and reported as "no change", writes nothing, and creates no audit row.

---

## 9. Reuse plan (REUSE → COMPOSE → EXTEND → CREATE)

**Reuse unchanged:** `PortalShell`, `AdminPortalShell`, `requireAdmin`,
`createClient`, `isSupabaseConfigured`, `Button`, `Badge`, `Card`, `Field`,
`FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `Textarea`, `Select`,
`Checkbox`, `TextLink`, `Breadcrumbs`, `SkipLink`, `SectionError`,
`ReviewDataBanner`, `AdminRead<T>`, the `SectionState<T>` shape, the
`{status:"idle"|"invalid"|...}` form-state convention, the
`error.code === "42501" → forbidden` mapping.

**Reuse verbatim for meaning:** `ENROLLMENT_STATE` in
`src/components/family/enrollment-state.tsx`. The administrator sees the same
label and the same sentence the family sees, which is how MPS-ACC-022's "one
consistent authoritative state" is achieved rather than asserted. The module is
moved to `src/components/enrollment/enrollment-state.tsx` and re-exported so no
family import changes; the mapping table itself is not edited.

**Compose:** program table extends the existing `program-operations-table.tsx`
column set with the NEXT ACTION column that D-AO2 removed, now pointing at
routes that exist.

**Extend (new shared primitives, both already approved MDS components — not new
conventions):**

- `src/components/ui/dialog.tsx` — MDS `components.dialog`, variants
  `confirmation` and `destructive`, over `@base-ui/react/dialog`. Focus trap and
  focus return come from the primitive.
- `src/components/ui/alert.tsx` — MDS `components.alert`, variants
  `success`/`warning`/`error`/`info`/`neutral`, sizes `inline`/`banner`.

**Create (page-specific, not reusable conventions):** program filters, program
form, enrollment filters, enrollment table/cards, enrollment detail drawer,
enrollment action form.

No new dependency. No new visual convention — if implementation finds one is
needed, it stops and reports an MDS gap (DO-DONT).

---

## 10. Files expected to change

### New

| Path | What it is |
|---|---|
| `src/app/(portal)/admin/programs/page.tsx` | Program list; `searchParams` filters |
| `src/app/(portal)/admin/programs/new/page.tsx` | Create-draft form |
| `src/app/(portal)/admin/programs/new/{actions,form-state}.ts` | Create-draft action |
| `src/app/(portal)/admin/programs/[programId]/page.tsx` | Program detail + edit |
| `src/app/(portal)/admin/programs/[programId]/{actions,form-state}.ts` | Edit, availability, checkout, publication actions |
| `src/app/(portal)/admin/enrollments/page.tsx` | Enrollment list + drawer |
| `src/app/(portal)/admin/enrollments/{actions,form-state}.ts` | State-change action |
| `src/lib/admin/programs.ts` | `server-only` program reads/writes |
| `src/lib/admin/enrollments.ts` | `server-only` enrollment reads/writes |
| `src/lib/admin/transitions.ts` | Pure transition tables (program + enrollment) |
| `src/lib/admin/validation.ts` | Zod schemas |
| `src/lib/admin/filters.ts` | Pure `searchParams` parsing and clamping |
| `src/components/ui/dialog.tsx`, `src/components/ui/alert.tsx` | MDS primitives |
| `src/components/admin/program-filters.tsx` | Search + status filter |
| `src/components/admin/program-list.tsx` | Table → record cards |
| `src/components/admin/program-form.tsx` | Facts, availability, checkout |
| `src/components/admin/program-publication-actions.tsx` | Publish/unpublish/archive + confirmation dialogs |
| `src/components/admin/enrollment-filters.tsx` | State + program filters |
| `src/components/admin/enrollment-list.tsx` | Table → record cards |
| `src/components/admin/enrollment-drawer.tsx` | Detail drawer + actions |
| `src/components/admin/list-skeleton.tsx` | Suspense fallbacks |
| `supabase/migrations/20260830090000_admin_program_enrollment_operations.sql` | §11 |
| `supabase/tests/database/70_rls_admin_operations.test.sql` | pgTAP for every RPC × 5 callers |
| `tests/admin-transitions.test.mts` | Unit tests: transitions, validation, filters |
| `tests/e2e/admin-programs.spec.ts`, `tests/e2e/admin-enrollments.spec.ts` | E2E, axe, keyboard, responsive, visual, ARIA |

### Modified

- `src/components/layout/admin-portal-shell.tsx` — add Programs and Enrollments
  destinations (partially resolves D-AO3; the remaining six stay out).
- `src/app/(portal)/admin/page.tsx` — summary tiles link to the two live
  destinations; add the Quick Actions panel with only the two actions that exist
  (partially resolves D-AO1).
- `src/components/admin/program-operations-table.tsx` — restore the NEXT ACTION
  column as real links (resolves D-AO2); extract the shared publication badge.
- `src/components/family/enrollment-state.tsx` → moved to
  `src/components/enrollment/enrollment-state.tsx`, re-exported from the old
  path. **Mapping unchanged.**
- `supabase/tests/database/10_rls_programs.test.sql` — the direct-UPDATE
  assertions become RPC assertions if §11 option A is approved.
- `supabase/seed.sql` — three additional sample enrollments so `started`,
  `payment_failed`, and `blocked` are demonstrable; one already-archived sample
  program. No checkout URL is seeded (owner must confirm each link).
- `supabase/README.md`, `prompts/admin-operations-foundation.md` §18 (mark
  slices 1–3 done).

### Deliberately unmodified

`middleware.ts`, `src/lib/auth/*`, `src/lib/supabase/*`,
`src/app/(portal)/layout.tsx`, every public route, `src/lib/programs/*`,
`src/lib/family/*`, `src/lib/enrollment/repository.ts`, every family and
educator route, and every existing RLS *select* policy.

---

## 11. Proposed schema, RLS, and migration changes

One migration, `20260830090000_admin_program_enrollment_operations.sql`, with a
`rollback:` header block in the established style.

1. **`enrollments` `updated_at` trigger.** The column exists but nothing
   maintains it. It becomes the optimistic-concurrency token, so it must be
   correct: `create trigger enrollments_set_updated_at before update … execute
   function public.set_updated_at()`.

2. **`private.enrollment_transition_allowed(from, to)`** — the §8 table as a
   `stable` SQL function. The database, not the browser and not the UI, decides
   what is legal.

3. **`public.admin_set_enrollment_state(target_id uuid, next_state
   public.enrollment_state, note text, expected_updated_at timestamptz)`** —
   `security definer`, `set search_path = ''`. In order: `private.is_admin()`
   else `raise … errcode '42501'`; `select … for update` the row (absent →
   `'P0002'`); `expected_updated_at` mismatch → `'40001'` (stale); no-op if
   `next_state = state` → returns `'unchanged'`; transition not allowed →
   `'23514'`; note length 1–400 → `'22023'`; then `update` setting `state`,
   `state_changed_at = now()`, `state_note`. Returns `'updated'`. The existing
   `enrollments_audit` trigger records `{from,to}` with `auth.uid()`.

4. **Program RPCs**, same shape and same `security definer` discipline:
   `admin_create_program_draft(name, slug, summary)`,
   `admin_update_program_facts(target_id, …, expected_updated_at)`,
   `admin_set_program_publication(target_id, next_state, expected_updated_at)`.
   Each checks `private.is_admin()` first, enforces the §5 transition rules, and
   relies on the existing `programs_audit` trigger for history.

5. **Grants.** `revoke all` then `grant execute … to authenticated` on each new
   function. No new table, no new column, no new enum value, no widened RLS
   policy. `public.enrollments` gains **no** INSERT/UPDATE/DELETE policy and
   **no** table-level write grant — every write goes through a SECURITY DEFINER
   function, exactly as `families`/`students` already do.

6. **Least-privilege decision required from the owner.**
   - **Option A (recommended):** also `revoke insert, update, delete on
     public.programs from authenticated`, so `programs` matches every other
     table — no client role holds a write verb, and the RPCs are the only write
     path. This *removes* privilege and exposes nothing new. Cost: two
     assertions in `10_rls_programs.test.sql` (an admin can UPDATE directly; the
     update audits) must be rewritten against the RPC.
   - **Option B:** leave the existing grants and policies untouched. Cost: an
     administrator retains a Data API write path that bypasses the §5 transition
     rules. RLS still confines it to administrators and the audit trigger still
     fires, so this is a least-privilege concern rather than an exposure.

   **Please choose at approval.** Implementation defaults to A if you do not
   state otherwise.

**Rollback:** drop the five functions, drop the `enrollments_set_updated_at`
trigger, and (under A) re-grant the three program verbs. No data migration, so
rollback loses nothing.

---

## 12. Gaps reported, not filled

| ID | Statement | Owning system |
|---|---|---|
| GAP-ADMIN-001 | No approved workflow or language for requesting missing information from a family | MPS |
| GAP-ADMIN-002 | Checklist §2 does not define how a successful payment is identified, what evidence is required, or how an incorrect verification is corrected. No payment-verification record may exist. | MPS |
| GAP-ADMIN-003 | No approved behavior for reinstating a cancelled enrollment (touches checklist §5) | MPS |
| GAP-ADMIN-004 | Program capacity numbers are unconfirmed (checklist §1) | MPS |
| GAP-ADMIN-005 | Program `canceled` / `completed` states require a family-notification capability that MPS-WFL-005 mandates and no system provides | MPS + MTS |
| GAP-ADMIN-006 | MPS-RUL-001's per-program confirmation mode (instant vs administrator approval) has no column and no configuration surface; MPS-ACC-019 cannot be satisfied until the family-side conversion journey exists | MPS + MTS |
| GAP-ADMIN-008 | An enrollment confirmed in error has no approved correction path. `confirmed → blocked` was proposed and declined 2026-08-29; only `confirmed → canceled` remains, and cancelling carries a different meaning to the family. | MPS |
| GAP-ADMIN-007 (carried) | `supabase/seed.sql` populates no `programs.checkout_url`; the approved `pay.homeschoolhaven.org` links need the owner's per-program confirmation | MPS content |
| MDS-GAP-ADMIN-003 (carried) | No approved "destination not yet available" navigation pattern | MDS |

---

## 13. Responsive and accessibility requirements

- Desktop/wide: 12-column operations layout, 1440 px content cap
  (`hsh-container-operations`), semantic `<table>` with `<caption>`,
  `<th scope="col">`, and a row header per record.
- Tablet 640–1023 px: 72 px navigation rail; table retained while column meaning
  survives; filters remain visible.
- Mobile <640 px: table → labeled record cards (`<dl>` with a visible `<dt>` per
  field), one rendering in the accessibility tree at a time — the DEFECT-AO3
  lesson: scope every test locator.
- Drawer and dialogs: Base UI focus trap, focus return to the invoking control,
  `Escape` closes, background inert, and a labelled close control ≥44×44 px.
- ≥44×44 px targets, ≥8 px separation between adjacent actions.
- Lora for page headings; Manrope for all operational UI, tables, and forms.
- Every state pairs an icon with an explicit text label — never colour alone.
- Validation errors: `aria-describedby` per field plus an error summary that
  receives focus; results announced through a polite live region.
- `prefers-reduced-motion` honoured by the drawer and dialog transitions.
- No hover-only information anywhere.
- Consent, payment, and privacy language is never compressed (DEFECT-AO4).

---

## 14. Failure, concurrency, idempotency, recovery

| Case | Behavior |
|---|---|
| Not signed in | `requireViewer` → `/sign-in?redirectTo=…` |
| Signed in, not an administrator | `notFound()` (404, does not confirm the area exists) |
| Role revoked mid-session | Next request denied; role is read per request, never cached |
| Supabase unconfigured | `status:"unavailable"` — never rendered as "empty" |
| Read fails | `status:"failed"` per section; the rest of the page still renders |
| No rows | Empty state with the approved next action |
| Filters match nothing | Distinct no-results state with a clear-filters action |
| Invalid input | Field errors + focused summary; **all submitted values preserved** |
| Manipulated / non-existent record ID | RPC finds no row → the same neutral "that record is no longer available" for both cases |
| Non-admin calling the action directly | `requireAdmin` denies, and `private.is_admin()` denies independently |
| Duplicate submission | Target equals current → `unchanged`, no write, no audit row, neutral message |
| Stale record (changed since load) | `expected_updated_at` mismatch → conflict alert, form values preserved, "reload to see the current state" |
| Invalid transition | Refused by SQL with a plain-language message naming the current state |
| Success | `revalidatePath` on `/admin`, the list, and the detail; success alert announced |

---

## 15. Checks to run (WSL/Ubuntu bash)

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run build
npx playwright test tests/e2e/admin-programs.spec.ts tests/e2e/admin-enrollments.spec.ts \
  tests/e2e/admin-overview.spec.ts tests/e2e/authorization.spec.ts \
  tests/e2e/family-dashboard.spec.ts tests/e2e/programs.spec.ts --workers=2
npm run db:start && npm run db:reset && npm run db:test   # requires Docker
npm run db:advisors
npm run db:types:check
```

**Known environment limit, carried from the previous slice:** Docker is not
installed here (`which docker` → nothing), so `npm run db:test`,
`db:advisors`, and `db:types:check` cannot run locally. The pgTAP suite will be
written and will be reported as **NOT RUN** unless Docker becomes available. It
must pass before merge. `supabase/tests/database/60_rls_admin_overview.test.sql`
from the previous slice is also still unexecuted.

**pgTAP coverage (`70_rls_admin_operations.test.sql`)** — each RPC called as an
administrator, a parent, an assigned educator, an unassigned educator, a
role-less account, and a caller whose JWT metadata falsely claims `admin`;
plus: every §8 transition allowed, every §8 transition refused, the stale-token
refusal, the no-op path, the not-found path, direct-table-write refusal for
`enrollments` (and for `programs` under option A), audit rows written with the
correct actor, and `state_note` absent from every audit payload.

**E2E coverage:** rendering, filters, empty/no-results/error states, each
approved action end to end, invalid-transition and stale-conflict refusals,
duplicate submission, keyboard-only operation of filters/drawer/dialog/form,
focus trap and return, axe at four viewports, table→card transformation,
ARIA snapshots, four visual baselines per page, the denial matrix for parent and
educator on both new routes, and regression checks that the public catalog,
program detail, and family dashboard are unchanged.

---

## 16. Visual comparison method

Capture at 1440, 1280, 768, and 390 px and compare against
`mds/references/assets/admin-dashboard-reference.png` (MDS-REF-009) for: shell,
sidebar, top bar, private-beta band, typography roles, operational table
density, status semantics, spacing, borders, radii, shadows, filters, drawer,
dialogs, and the mobile record-card transformation. Written MDS state outranks
the image. Every screenshot contains sample data only. Deviations are recorded
as D-PE1…n with a reason, in the file that carries each one.

---

## 17. Exact manual test steps (WSL/Ubuntu bash)

```bash
npm run build && npx next start -p 3100
```

1. Signed out → `/admin/programs` and `/admin/enrollments` redirect to
   `/sign-in?redirectTo=…`.
2. Sign in as `sample.parent@example.com` → both routes return **404**.
3. Sign in as `sample.educator@example.com` → both routes return **404**.
4. Sign in as `sample.admin@example.com` → both render.
5. Programs: filter to Draft — only drafts; search a program name — matches
   only; search nonsense — no-results state with a clear-filters action.
6. Open a draft → detail. Edit the summary, save → success announced; the
   Overview's Recent Activity shows the change with an actor.
7. Publish it → confirmation dialog with explicit language; confirm → published.
   Open `/programs` in a private window → it is now publicly listed.
8. Archive it → confirm → it leaves `/programs`; restore to draft → it is a
   draft again. Confirm each step appears in Recent Activity.
9. Attempt an invalid checkout URL (`http://`, another host, one with a query
   string) → refused with a field error and the value preserved.
10. Create a draft with a duplicate slug → refused, values preserved.
11. Enrollments: filter by state and by program; verify empty and no-results.
12. Open the `payment_pending` sample → the drawer states that payment is
    pending verification and that enrollment is **not** confirmed, and offers no
    payment action.
13. Confirm that enrollment with a note → success; sign in as the owning parent
    and confirm `/family` shows the identical label and sentence (MPS-ACC-022).
14. Submit the same confirmation twice (two tabs) → the second reports "no
    change", and Recent Activity holds exactly one entry.
15. Open the drawer in two tabs, change state in tab 1, then submit tab 2 →
    stale-conflict message, values preserved, nothing written.
16. Attempt `canceled → confirmed` by editing the form's state field in devtools
    → refused server-side.
17. Cancel an enrollment → the dialog states no refund, credit, or transfer is
    decided or issued; confirm → cancelled, and no financial control appears.
18. Keyboard only: reach and operate every filter, row action, drawer, dialog,
    and form; verify focus trap and focus return.
19. At 390 px: tables are labeled record cards, no horizontal page scroll, no
    compressed payment or consent sentence, all targets ≥44 px.
20. Confirm no student name, family name, or record UUID appears in any URL.

---

## 18. Assumptions

**Owner decisions recorded 2026-08-29 (Josh Coley):** plan approved as written;
§11 **Option A** approved; assumption 2 below **confirmed**; assumption 1
**declined** → GAP-ADMIN-008.

1. ~~`confirmed → blocked` is the approved correction path for an incorrect
   confirmation.~~ **Declined.** Not implemented; recorded as GAP-ADMIN-008.
2. An administrator setting an enrollment to `confirmed` is an authorized
   administrative decision under MPS-REQ-017, distinct from the blocked
   payment-verification record (GAP-ADMIN-002). **Confirmed.**
3. Recording a `canceled` enrollment state is the "records status" MPS-RUL-004
   permits, and carries no financial meaning.
4. `pay.homeschoolhaven.org` is the only permitted checkout host.
5. Program facts entered by an administrator are the owner's authority; the
   "do not invent" rule binds the agent, not the administrator.
6. The existing `family-dashboard.spec.ts` and `admin-overview.spec.ts` failures
   are fixture gaps in the linked review project, not defects, and will resolve
   under a local `db:reset`.

## 19. External setup required from the owner

- Confirm the per-program `pay.homeschoolhaven.org` checkout URLs (GAP-ADMIN-007).
- Docker (or database credentials) so the pgTAP suites can actually run.
- Re-seed the linked review project, or run locally, so enrollment fixtures exist.

## 20. Recommended next slice

Educators destination (MPS-REQ-017 assignment management) — it restores the last
quick action, and educator assignment is the remaining half of MPS-REQ-017.
