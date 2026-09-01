# HSH-SLICE-CONTENT-01 — Announcements, Resources, and Private Storage

**Slice type:** Schema + RLS + Storage + server mutations + authoring UI + consumption wiring.
**Branch:** `feat/program-announcements-resources` (created from `main` @ 32a92bd, clean).
**Prepared:** 2026-08-31
**Status:** PLAN — awaiting approval. No code written.

---

## 0. Branch base

`main` @ 32a92bd contains PR #16 (educator assigned-program workspace) and PR #17
(`hsh-heading-sm`). The prerequisite named in the request is merged. Working tree
clean, no stacking required.

---

## 1. Goal

Give permitted administrators and actively assigned educators the authoring half of
MPS-REQ-019 — create, publish, replace, and remove program announcements and learning
resources with a visible content state — and make protected resource files real by
introducing private Supabase Storage with authorized, short-lived signed access.

Published content must reach exactly its authorized audience: the assigned educator,
a permitted administrator, and families holding an eligible enrollment in that program.
Nobody else, by any route.

## 2. Non-goals

Course Builder, lessons, course outlines, content blocks, assignments, grades,
transcripts, certificates, student accounts, organization-wide broadcasting, public
resource publishing, comments, announcement email or Resend delivery, moderation,
scheduling, retention or physical-deletion policy, roster-field changes, and any
widening of `EDUCATOR_ROSTER_COLUMNS`.

**Announcement scheduling is explicitly not implemented.** MDS `announcement` lists a
`scheduled` state (MDS-PROJECT-STATE.yaml:441), but no approved MPS requirement or
workflow authorizes scheduling. A design state is not a product authorization. Per the
request's own instruction, it stays out.

## 3. Active versions

MPS v1.0 · MDS v1.1 · MTS v1.0. This is MTS IMPLEMENTATION-PLAN **Phase 4**, the
announcements/resources clause, and the Storage row of INTEGRATION-MANIFEST
(`Storage | Private program-scoped resources; signed access | INSPECT — not built`).

---

## 4. Requirements traceability

| ID | How this slice satisfies it |
|---|---|
| MPS-REQ-004 | No content or file read is reachable by a public visitor or an unassigned educator. Enforced by RLS on both tables and by `storage.objects` policies on the new private bucket, not by route guards alone. |
| MPS-REQ-018 | An educator's authoring authority is exactly their active assignment set, re-derived per statement from `auth.uid()`. No route, body, or path parameter can widen it. |
| MPS-REQ-019 | The slice is this requirement's authoring half: create, publish, replace, remove, each with a visible state, author attribution, and program context. |
| MPS-REQ-020 | One row is the authority for a content item's state; admin, educator, and family surfaces all read the same `state` column. No second copy, no per-surface recomputation. |
| MPS-REQ-024 | Every material action (created, edited, published, replaced, removed, file attached or changed) writes an attributable `audit_events` row through a database trigger, so it cannot be skipped by a caller. |
| MPS-RUL-003 | Announcements are program-scoped only — there is no family-addressed or student-addressed column, and none is added. Audit rows carry state labels and changed field *names*, never body text. |
| MPS-ACC-005 | pgTAP + e2e: unassigned educator, unenrolled family, signed-out visitor, and `anon` denied every content row and every storage object. |
| MPS-ACC-029 | Assigned program authorable and readable; unassigned program's content denied and indistinguishable from nonexistent (404). |
| MPS-ACC-030 | Publish → enrolled family sees it. Replace → family sees the successor and the predecessor reads `replaced`. Remove → family loses access, and the old file route stops serving. Unauthorized families never see any of it. |
| MPS-ACC-031 | State is consistent across `/admin`, `/educator`, and `/family` surfaces, always carries text (never colour alone), and every state offers a recovery or next action. |

**MPS-WFL-006 main path** — "View assigned schedule and roster → Create resource or
program announcement → Publish within permitted scope → Family views content" — is
completed end to end by this slice, except its `notifications` clause (see §14, D-C3).

**MPS-RUL-005 is not breached.** It reserves publishing a *program, price, public
availability, registration state, or cancellation* to an administrator or Samantha, and
says in the same breath that "educators may contribute content within assigned
programs." Program publication controls are untouched by this slice; an educator
publishing an announcement on their own program is the contribution RUL-005 permits and
WFL-006 step 3 names.

---

## 5. Repository evidence inspected

**Content tables exist and are read-only by construction.**
`supabase/migrations/20260829170000_family_dashboard_records.sql:162` and `:197` define
`public.announcements` and `public.learning_resources`. Both carry six SELECT policies
(family/educator/admin × 2 tables) at `:359–:398`, and the file's closing comment states
plainly: "No INSERT, UPDATE, or DELETE policy for any client role on any of the three
tables." Grants at `:404` are `select` only. Everything this slice writes is genuinely new.

**There is no storage bucket.** `grep` over `supabase/` returns no `storage.buckets`
insert, and `supabase/config.toml:121` still carries the commented-out example. Storage
is unbuilt, exactly as INTEGRATION-MANIFEST:16 records.

**The mutation idiom is a `security definer` RPC, not a table write.**
`20260830090000_admin_program_enrollment_operations.sql` defines
`admin_create_program_draft`, `admin_update_program_facts`, `admin_set_program_publication`,
and `admin_set_enrollment_state`, each `security definer`, `set search_path = ''`,
re-checking `private.is_admin()` inside the transaction, validating its own inputs, and
raising `42501` / `22023`. The migration then *revokes* `insert, update, delete` on
`public.programs` from `authenticated` (`:524`). This slice follows that idiom exactly:
the tables gain no direct write verb.

**Optimistic concurrency already has a shape.** `admin_update_program_facts` takes
`expected_updated_at timestamptz`. Content edits reuse it.

**Server-action idiom.** `src/app/(portal)/admin/programs/new/actions.ts` — zod parse →
`isSupabaseConfigured()` → `requireAdmin(returnTo)` → repository call → typed
`FormState` discriminated union → `revalidatePath`. Its comment states why the guard is
not the only check ("A server action is a public HTTP endpoint"). Reused verbatim in shape.

**Role helpers already exist.** `private.is_admin()`
(`20260827212014_foundation_roles_and_identity.sql:122`) and
`private.is_assigned_educator(target_program uuid)`
(`20260827212017_foundation_programs.sql:112`). The authorization predicate for this
slice is their disjunction; neither needs to be written.

**Family eligibility already exists.** `private.family_has_enrollment_in(check_program_id)`
(`20260829170000:242`) — a non-`canceled` enrollment joined through `family_members` on
`auth.uid()`. This slice does not restate the enrollment rule; it calls this function,
including from the new storage policies.

**Audit architecture.** `public.audit_events`
(`20260827212020_foundation_audit_history.sql:19`), append-only at privilege level
(`revoke update, delete, truncate`), written by `security definer` triggers
(`record_program_audit`, `record_educator_assignment_audit`, `record_enrollment_audit`).
`record_enrollment_audit` sets the privacy precedent: "no student name, no family name,
no email. `changed_fields` holds enum labels, which are not private data."

**Read paths to update.** `src/lib/family/content.ts` and `src/lib/educator/content.ts`
both currently key on the `published` boolean and both carry header comments stating the
authoring half is a later slice. Those comments become false with this slice and will be
rewritten, not left stale.

**Consumption surfaces exist.** `/family/announcements`, `/family/resources`,
`/educator/announcements`, `/educator/resources`, `/educator/programs/[programId]`, and
the admin program detail page are all built. This slice wires authoring into them rather
than creating parallel surfaces.

**Test infrastructure.** 10 pgTAP files in `supabase/tests/database/`, 20 Playwright
specs with four-viewport screenshots + ARIA snapshots + `@axe-core/playwright`, and
`tests/*.test.mts` for pure functions. Seeded actors: `sample.admin@example.com`,
`sample.educator@example.com`, `sample.parent.one@example.com`, password
`SampleFoundationReview2026`.

**Next.js 16.3.3.** `next.config.ts` is empty. Per
`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:83`, server-action
requests are capped at **1 MB** by default — decisive for the upload design (§10).

---

## 6. Data model and migration

One migration: `supabase/migrations/20260901000000_program_content_authoring.sql`,
with a `rollback:` header block matching the house style.

### 6.1 Lifecycle state replaces the `published` boolean

```sql
create type public.content_state as enum ('draft','published','replaced','removed');
```

Added to both tables as `state public.content_state not null default 'draft'`,
backfilled `case when published then 'published' else 'draft' end`, after which the
`published` column is **dropped**.

Dropping rather than keeping both is the MPS-REQ-020 decision: two columns that can
disagree is exactly the "second copy" that requirement forbids. The cost is real and
accepted — four SELECT policies, two indexes, one check constraint, and two application
read modules are rewritten in the same migration/commit. All are named in §7.

Additional columns, both tables: `replaced_by_id uuid references <self>(id) on delete set null`,
`replaced_at timestamptz`, `removed_at timestamptz`, `created_by uuid references auth.users(id) on delete set null`,
`updated_by uuid references auth.users(id) on delete set null`.

`created_by`/`updated_by` are staff attribution (MPS-REQ-019 "author attribution",
MPS-REQ-024 "attributable"). They reference `auth.users`, so a deleted account nulls
rather than orphans.

Constraints restated in terms of `state`:

- `announcements_published_has_time`: `state <> 'published' or published_at is not null`.
- new `..._replaced_has_successor`: `state <> 'replaced' or replaced_by_id is not null`.
- new `..._removed_has_time`: `state <> 'removed' or removed_at is not null`.

Indexes become `(program_id, state, published_at desc)` and `(program_id, state)`.

### 6.2 Resource kinds and stored files

```sql
create type public.resource_kind as enum ('document','link','video','activity','download');
```

Exactly the five MDS `learning_resource` variants (MDS-PROJECT-STATE.yaml:445). No sixth
kind is invented.

`url` becomes **nullable**; new columns `storage_path text`, `file_name text`,
`file_size_bytes bigint`, `content_type text`, and `kind public.resource_kind not null default 'link'`.

A check constraint makes the two forms mutually exclusive and mandatory:

```sql
constraint learning_resources_one_medium check (
  (kind in ('link','video','activity')
     and url is not null and storage_path is null)
  or
  (kind in ('document','download')
     and storage_path is not null and url is null
     and file_name is not null and file_size_bytes is not null
     and content_type is not null)
)
```

The existing `^https?://` scheme constraint is retained, guarded for NULL. A file-backed
resource therefore *cannot* carry an external URL, and a link-backed one cannot carry a
storage path — the renderer never has to decide which to trust.

`storage_path` is `unique` so two rows cannot claim one object.

### 6.3 `is_sample` stays true — and that is a gap, not a decision

Both tables carry `check (is_sample)`. Authored content in the sanitized Foundation
Review is sample content, so the RPCs insert `is_sample = true` and the constraint stands
unmodified. Loosening it is a real-family-activation decision gated by MPS-REQ-005 and
MPS-RUL-007, and this slice will not make it. Recorded as **GAP-CONTENT-06**.

### 6.4 Transition guard

```sql
create function private.content_transition_allowed(
  from_state public.content_state, to_state public.content_state
) returns boolean
```

mirroring `private.enrollment_transition_allowed`. Permitted edges:

| From | To | Meaning |
|---|---|---|
| draft | published | publish |
| draft | removed | discard a draft |
| published | replaced | superseded by a revision |
| published | removed | withdrawn |
| replaced | — | terminal |
| removed | — | terminal |

`removed` and `replaced` are terminal by design: un-removing is a restoration decision
with retention implications nobody has approved. Anything else raises `22023`.

---

## 7. Exact files and routes expected to change

### New migration
- `supabase/migrations/20260901000000_program_content_authoring.sql`

### New database objects
Types `content_state`, `resource_kind`; function `private.content_transition_allowed`;
functions `public.content_*` (§8); triggers `announcements_audit`,
`learning_resources_audit` + their `record_*_audit()` functions; storage bucket
`program-resources` and four `storage.objects` policies (§10).

### New routes
| Route | Purpose |
|---|---|
| `/educator/programs/[programId]/announcements/new` | Create draft |
| `/educator/programs/[programId]/announcements/[announcementId]` | Edit, preview, publish, replace, remove |
| `/educator/programs/[programId]/resources/new` | Create draft (link or file) |
| `/educator/programs/[programId]/resources/[resourceId]` | Edit, publish, replace, remove |
| `/admin/communications` | Administrator content operations across all programs |
| `/resources/[resourceId]/file` | Authorize, then redirect to a fresh short-lived signed URL |

`/admin/communications` fills one of the four MDS admin destinations the shell is missing
(MDS `navigation.specification.admin` names Schedule, Communications, Reports, Settings;
`admin-portal-shell.tsx` currently ends at Educators). It narrows the existing D-AO3
deviation rather than widening it.

### New application files
- `src/lib/content/validation.ts` — zod schemas, the file-type and size allowlist (§13 gaps), shared by every action.
- `src/lib/content/announcements.ts`, `src/lib/content/resources.ts` — RPC callers, `AdminRead<T>`-shaped results.
- `src/lib/content/authority.ts` — server-side "may this viewer author for this program" derivation.
- `src/lib/content/storage.ts` — path derivation, upload, signed-URL issuance.
- `src/lib/content/lifecycle.ts` — pure state/label/transition helpers (unit-testable).
- `src/components/content/` — `announcement-form.tsx`, `resource-form.tsx`, `file-field.tsx`, `content-state-badge.tsx`, `lifecycle-actions.tsx`, `remove-dialog.tsx`, `content-table.tsx`.
- `.../actions.ts` + `.../form-state.ts` beside each new route, per house convention.
- `tests/content-lifecycle.test.mts`, `tests/content-validation.test.mts`
- `supabase/tests/database/90_content_authoring.test.sql`
- `supabase/tests/database/95_storage_program_resources.test.sql`
- `tests/e2e/content-authoring.spec.ts` (+ snapshots)

### Changed files
- `src/lib/family/content.ts`, `src/lib/educator/content.ts` — `published` → `state`; stale "no write path exists" headers rewritten.
- `src/lib/educator/workspace-state.ts` — content types gain `state`.
- `src/components/educator/content-lists.tsx`, `src/components/family/dashboard-cards.tsx` — render the four states.
- `src/app/(portal)/educator/announcements/page.tsx`, `.../resources/page.tsx`, `.../programs/[programId]/page.tsx` — authoring entry points.
- `src/components/layout/admin-portal-shell.tsx` — Communications destination.
- `src/app/(portal)/admin/programs/[programId]/page.tsx` — program-scoped content section.
- `next.config.ts` — `experimental.serverActions.bodySizeLimit` (§10, gated on GAP-CONTENT-02).
- `supabase/seed.sql` — existing sample rows get explicit `state`/`kind`; **no new fixture content invented**.
- `src/lib/supabase/database.types.ts` — regenerated.
- `tests/e2e/authorization.spec.ts` — new routes added to `PROTECTED`.

### Deliberately unchanged
`src/lib/admin/roster-state.ts` (and `EDUCATOR_ROSTER_COLUMNS`), every roster component,
every enrollment and program-publication path, `src/lib/auth/guards.ts`.

---

## 8. Announcement and resource lifecycle

Nine `security definer` RPCs, each granted to `authenticated`, each re-checking authority
inside the writing transaction:

```
content_create_announcement_draft(program_id, title, body) -> uuid
content_update_announcement_draft(id, expected_updated_at, title, body)
content_publish_announcement(id, expected_updated_at)
content_replace_announcement(id, expected_updated_at, title, body) -> uuid
content_remove_announcement(id, expected_updated_at)

content_create_resource_draft(program_id, title, description, kind, url) -> uuid
content_attach_resource_file(id, expected_updated_at, storage_path, file_name, file_size_bytes, content_type)
content_update_resource_draft(id, expected_updated_at, title, description, url)
content_publish_resource(id, expected_updated_at)
content_replace_resource(id, expected_updated_at, ...) -> uuid
content_remove_resource(id, expected_updated_at)
```

Every one opens with:

```sql
if not (private.is_admin()
        or private.is_assigned_educator(target_program)) then
  raise exception 'not authorized' using errcode = '42501';
end if;
```

`target_program` is read **from the stored row**, never from a parameter, on every verb
except create — so a caller cannot pass an id they hold alongside a row they do not.

**Replace** is one transaction: insert a successor draft on the same program, set the
predecessor to `replaced` with `replaced_at = now()` and `replaced_by_id = <new id>`,
return the new id. The predecessor is preserved, never mutated in place — MPS-ACC-030
requires the *replaced* state to be truthful, which is impossible if the old row is
overwritten. The successor starts as a **draft**; publishing it is a second, separately
audited decision.

**Remove** sets `state = 'removed'`, `removed_at = now()`. It does **not** delete the row
and does **not** delete the storage object (§13, GAP-CONTENT-03). Access is revoked by
state, which every policy and every read honours.

**Preview** requires no verb. A draft is already visible to its own author and to
administrators through the existing educator/admin SELECT policies, which do not filter
on state. Preview is a rendering of the draft through the same family-facing component,
labelled as a preview — no new access path, no new endpoint.

---

## 9. Authorization matrix

| Actor | Draft | Published | Replaced | Removed | Author | Publish/Replace/Remove | File bytes |
|---|---|---|---|---|---|---|---|
| Administrator | read | read | read | read | any program | yes | yes |
| Assigned educator | read (own programs) | read | read | read | own programs only | own programs only | own programs |
| Unassigned educator | **denied** | **denied** | **denied** | **denied** | **denied** | **denied** | **denied** |
| Family, eligible enrollment | **denied** | read | read (marked) | **denied** | no | no | yes, published only |
| Family, canceled enrollment | denied | **denied** | denied | denied | no | no | **denied** |
| Family, no enrollment | denied | **denied** | denied | denied | no | no | **denied** |
| Signed-out / `anon` | denied | **denied** | denied | denied | no | no | **denied** |

Notes:

- **A family sees a `replaced` announcement**, marked as superseded, with a link to the
  successor. Withdrawing history a family already read would be a lie about what was
  said; MPS-ACC-030 asks for a truthful state, not a vanished one. A **removed** item is
  gone from family view entirely — that is what removal means.
- Family eligibility is `private.family_has_enrollment_in()` and nothing else, so
  "eligible" means the same thing here as on the dashboard, and a cancellation revokes
  content on the next request with no extra code.
- An educator's authority is re-derived per statement. **Assignment removal revokes on
  the next request** — nothing caches assignment in a session, cookie, or JWT claim, and
  portal routes are already `force-dynamic`.
- Every server action re-authorizes independently of the page guard, and the database
  re-authorizes independently of the action. Three checks, and only the third cannot be
  bypassed by calling the endpoint directly.
- Nothing accepts a role, educator id, family id, enrollment id, program id, or storage
  path from the browser as an *identity*. A route `programId`/`resourceId` is untrusted
  input: UUID shape is validated before any query, and anything outside the viewer's
  authority returns `notFound()` — identical to a nonexistent id, so a prober learns nothing.

---

## 10. Storage and signed-access design

**Bucket:** `program-resources`, created with `public = false`. Registered in
`supabase/config.toml` under `[storage.buckets.program-resources]` so a local
`supabase start` reproduces it.

**Path, derived entirely on the server:**

```
<program_id>/<resource_id>/<gen_random_uuid()>.<ext>
```

The browser never supplies, and is never shown, a storage path. The random middle
segment means a leaked path from one resource says nothing about any other. `program_id`
leading the path is what makes the storage policies expressible as a prefix match, and it
is cross-checked against `learning_resources.storage_path` rather than trusted as a
naming convention — **a path is not authorization**, it is only an index.

**`storage.objects` policies** on `bucket_id = 'program-resources'`:

- `select` — admin, or assigned educator, or an eligible family where the owning
  `learning_resources` row is `state = 'published'`. Resolved by joining `name` to
  `learning_resources.storage_path`, so a `removed` or `draft` resource's object is
  unreadable even with a correct path.
- `insert` — admin or assigned educator, program derived from the path's leading segment
  *and* verified against an existing draft row owned by that program.
- No `update`. No `delete` for any client role (§13, GAP-CONTENT-03).
- Nothing for `anon`, at all.

**No public URL exists.** `getPublicUrl` is never called; an e2e test asserts the string
`/storage/v1/object/public/` appears in no response body from any authenticated surface.

**Signed access.** `/resources/[resourceId]/file` is a route handler that, per request:
re-derives the viewer server-side, re-checks authority for that specific resource,
confirms `state = 'published'` (or that the viewer is staff), then calls
`createSignedUrl(path, 60)` and issues a 302. **60 seconds**, single use in practice
because the application never persists it.

The signed URL is generated with the **request-scoped user client**, not the service
role, so the storage policies above are the enforcing control rather than a bypassed one.
Service-role credentials are not used anywhere in this slice.

The URL is never logged, never placed in a template, never stored client-side, and never
returned in an RSC payload — it exists only in a `Location` header.

**Residual risk, stated rather than papered over:** a signed URL already issued remains
valid for its 60-second TTL even if the resource is removed in that window. Supabase
signed URLs cannot be revoked. The mitigation is the short TTL plus per-request
re-authorization at issuance; the application route stops serving immediately. This is
recorded as **RISK-C1** rather than described as full revocation, because it is not.

**Upload path.** Server actions cap at 1 MB by default in Next 16
(`docs/01-app/02-guides/server-actions.md:83`), which is below any plausible worksheet.
The file is posted to a server action with `experimental.serverActions.bodySizeLimit`
raised to the approved maximum + overhead. The server — not the browser — validates
declared content type against the allowlist, validates real byte length against the
limit, derives the path, uploads with `upsert: false`, then calls
`content_attach_resource_file`. A failed RPC deletes the just-uploaded object so a
rejected upload leaves no orphan.

**Both limits are blocked on approval — see §13.**

---

## 11. Audit-history behavior

Two `security definer` triggers, `record_announcement_audit()` and
`record_learning_resource_audit()`, on `after insert or update or delete`, matching
`record_enrollment_audit` in shape.

Entity types `announcement` and `learning_resource`. Actions: `created`, `updated`,
`published`, `replaced`, `removed`, `file_attached`.

**What `changed_fields` carries:** the state transition (`{"from":"draft","to":"published"}`),
the successor id on replace, the program id, and for edits the **names** of the fields
that changed — `{"changed":["title","body"]}`.

**What it never carries:** announcement or resource body text, description text, any
signed URL, any storage path, any family, student, or parent identifier, and any secret.
Announcement body is free text an educator typed about a program; MPS-RUL-003 keeps
sensitive family matters private, and the safe assumption is that free text may contain
something that should not be duplicated into an append-only table nobody can redact.
Recording that a body changed is the auditable fact; recording what it said is not
required by MPS-REQ-024 and cannot be undone.

The trigger is the writer, so an RPC that forgot to log still logs.

---

## 12. Design, responsive, and accessibility requirements

**REUSE first.** `PortalShell` and the three role shells, `Breadcrumbs`, `SkipLink`,
`Card`, `Field`, `Input`, `Textarea`, `Select`, `Button`, `Dialog`, `Alert`, `Badge`,
`TextLink`, `EmptyState`, `ListSkeleton`, `SectionError`, `ReviewDataBanner`,
`ProgramFilters`/`DirectorySearch` patterns, and the existing table→card treatment in
`program-operations-table.tsx`. The form pattern comes from `program-form.tsx` and
`create-program-form.tsx`, including their error-summary and field-association behaviour.

**COMPOSE** the authoring screens from the approved `forms` page shell
(MDS `page_shells.forms`, required/approved) plus the approved `announcement` and
`learning_resource` components.

**CREATE** only `file-field.tsx` (accessible file input with upload progress, per-state
announcements, and failure recovery) and `content-state-badge.tsx`. Both are flagged as
MDS gaps in §13.

**Explicitly not used: the MDS `content_builder` component and the
`educator_content_studio` page shell.** Both are marked `horizon: "Future LMS; not
Foundation Beta behavior"` (MDS-PROJECT-STATE.yaml:471–474), and that shell's own
`policy_gap` defers create/submit/review/publish authority to future MPS evolution.
Building this slice on them would import Course Builder scope through a design reference,
which the request forbids and the MDS itself disclaims.

**Status is never colour alone.** Draft / Published / Replaced / Removed each carry text
and an icon. Draft additionally carries the existing "families cannot see this yet"
wording already shipped in the educator workspace, so the two surfaces agree.

**Responsive:** 264 px sidebar / 72 px rail / 60 px mobile header + bottom bar; 12/8/4
grid; content tables become labeled cards below the tablet breakpoint; 44 px minimum
targets on every action including the destructive ones in dialogs.

**WCAG 2.2 AA:** semantic `<form>`/`<fieldset>`/`<label>` structure; error summary at the
top of the form linking to fields, with fields `aria-describedby`-associated; visible
focus on every control; `aria-current` in navigation; upload progress via `role="status"`
`aria-live="polite"` with a text percentage, and upload failure via `role="alert"`;
destructive removal behind a `Dialog` with explicit action language and safe cancellation
(MDS dialog rule, MDS-PROJECT-STATE.yaml:354); reduced-motion honoured on progress and
dialog transitions; full keyboard operation of create → edit → preview → publish →
replace → remove without a pointer.

---

## 13. Gaps — policy this slice must not invent

Four of these **block** parts of the slice. I will not choose a value for any of them.

- **GAP-CONTENT-01 — allowed file types (BLOCKING for file resources).** No approved MPS,
  MDS, or MTS artifact names a permitted upload type. Grep over `mps/`, `mds/`, `mts/`
  for MIME, extension, or format policy returns nothing.
  *Proposal for approval, not a decision:* `application/pdf`, `image/png`, `image/jpeg`,
  `text/plain`. Deliberately excludes Office documents (macro-bearing formats) and
  anything executable or archived.
- **GAP-CONTENT-02 — maximum file size (BLOCKING for file resources).** Nothing approved.
  *Proposal:* 10 MB per file, with `serverActions.bodySizeLimit: '12mb'`. Supabase Free
  is the approved review tier (AGENTS.md §9) and has a finite storage allowance, so this
  number has a cost consequence the owner should set, not me.
- **GAP-CONTENT-03 — retention and physical deletion (BLOCKING for hard delete; NOT
  blocking for this slice as designed).** SAMANTHA-POLICY-CONFIRMATION-CHECKLIST §11
  ("Confirm retention periods…", "Confirm deletion, anonymization, or archival
  expectations", "Identify who may approve exports or deletion") is **unchecked**.
  Therefore **"Removed" is a state change and an access revocation, never a physical
  deletion**: the row is retained, the storage object is retained, no client role holds
  `delete` on either. This is the conservative reading and it is reversible; the opposite
  is not. An owner decision is required before any true erasure is built.
- **GAP-CONTENT-04 — who is a "permitted" educator.** MPS-REQ-019 says "permitted
  educators", and MPS-WFL-006's only preconditions are an active account and an existing
  assignment. *Assumption A1:* actively assigned = permitted. If Samantha intends a
  further per-educator authoring grant, that is a schema addition, not a rewrite.
- **GAP-CONTENT-05 — publish notification.** MPS-WFL-006 `notifications` requires
  "Notify enrolled families when a permitted announcement is published." Email and Resend
  are explicitly out of scope for this slice, so the requirement is **not met by this
  slice** and the workflow remains partially unimplemented. Recorded honestly as
  deviation D-C3 rather than silently dropped.
- **GAP-CONTENT-06 — `is_sample` (§6.3).** Authored content is forced `is_sample = true`.
  Must be revisited before real-family activation.
- **MDS-GAP-C1 — no approved accessible file-upload component.** MDS has no upload
  control at Foundation horizon; `content_builder.resource_upload` is Future LMS.
  `file-field.tsx` is a new reusable visual convention and therefore an MDS gap requiring
  approval (AGENTS.md §7).
- **MDS-GAP-C2 — no canonical four-state content badge.** `announcement` and
  `learning_resource` list *their own* state vocabularies (`unread/read/pinned/…`,
  `available/new/viewed/…`), neither of which is the authoring lifecycle. Composed from
  the approved `badge` component; flagged for MDS confirmation.
- **MDS-GAP-C3 — no canonical reference screen** for a Foundation-horizon content
  authoring surface. Composition follows MDS-REF-009's operations shell plus the written
  `forms` and `navigation` specifications.
- **GAP-C4 — admin `Communications` destination** is specified by MDS navigation but
  absent from the shell (existing D-AO3). This slice adds it for content only; Schedule,
  Reports, and Settings remain missing.

---

## 14. Deviations to record

- **D-C1** — `published boolean` dropped in favour of `state`. Justified under
  MPS-REQ-020; touches four policies, two indexes, one constraint, two read modules.
- **D-C2** — A `replaced` item stays visible to families, marked as superseded and linked
  to its successor, rather than disappearing (§9).
- **D-C3** — MPS-WFL-006's family publish notification is not implemented (GAP-CONTENT-05).
- **D-C4** — "Removed" revokes access without erasing data (GAP-CONTENT-03).
- **D-C5** — Announcement scheduling is not implemented despite the MDS `scheduled`
  state, because no MPS requirement authorizes it.

---

## 15. Test plan

**Unit** (`npm run test:unit`) — `content-lifecycle.test.mts`: the transition table
including every rejected edge and both terminal states; state→label mapping; the
replace-successor relationship. `content-validation.test.mts`: title/body/description
bounds matching the database constraints exactly, URL scheme rejection (`javascript:`,
`data:`, protocol-relative), the file-type allowlist, and the size boundary at limit,
limit−1, limit+1.

**pgTAP** (`npm run db:test`) — `90_content_authoring.test.sql`:

1. Every RPC raises `42501` for an unassigned educator, for a parent, and for `anon`.
2. An assigned educator may author on an assigned program and **not** on another.
3. An administrator may author on any program.
4. `program_id` is taken from the stored row: passing a foreign id does not widen reach.
5. Every rejected transition raises `22023`; terminal states accept nothing.
6. `expected_updated_at` mismatch raises rather than clobbering a concurrent edit.
7. A draft is invisible to an enrolled family; publishing makes it visible.
8. A canceled enrollment sees neither.
9. Removal revokes family visibility; replacement leaves the predecessor readable as `replaced`.
10. Assignment deleted inside the transaction → the educator's next statement is refused.
11. `authenticated` holds no direct `insert/update/delete` on either table.
12. An audit row exists for each of created/updated/published/replaced/removed/file_attached,
    and **no audit row's `changed_fields` contains the announcement body text** — asserted
    against the literal seeded body.

`95_storage_program_resources.test.sql`: bucket is `public = false`; the four object
policies admit and refuse exactly the §9 matrix; a correct path to a `draft` or `removed`
resource's object is refused; `anon` is refused everything; no client role holds `delete`.

**e2e** (`npm run test:e2e`) — `tests/e2e/content-authoring.spec.ts`, covering the
request's 18 proof obligations:

- Educator authors, previews, publishes on an assigned program; direct `POST` to the
  server action for an unassigned program is refused (both via UI and via request context).
- Manipulated `programId`/`resourceId`/`storage_path` in body and URL → 404 or refusal;
  no variant succeeds.
- Family: draft invisible → publish → visible → replace → successor shown, predecessor
  marked → remove → gone; unenrolled family denied throughout.
- `/resources/[id]/file` serves for an authorized viewer, refuses for everyone else,
  and refuses after removal — asserted against the **old route**, which is the point of
  obligation 13.
- A signed URL captured from the redirect and replayed after expiry fails safely.
- No response body from any authenticated route contains `/storage/v1/object/public/`,
  a service-role key prefix, or a `token=` signed-URL query string.
- Cross-surface consistency: the same item's state string on `/admin/communications`,
  `/educator/announcements`, and `/family/announcements` agree.
- `EDUCATOR_ROSTER_COLUMNS` unchanged (`git diff` assertion) and no Course Builder route exists.
- Four viewports (1440/1280/768/390) screenshots + ARIA snapshots + `@axe-core/playwright`
  on every new page, including the form in its error state and the removal dialog open.
- Keyboard-only pass: skip link → nav → form → error summary → submit → dialog → confirm.
- Upload states: uploading, upload failed, invalid file type, file too large — each
  asserted for its announced text, not just its styling.

**Also run:** `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run db:types:check`, `npm run db:advisors`.

**Migration validation:** `npm run db:reset` from scratch, then applied against a
database seeded at the pre-migration revision to prove the backfill; the `rollback:`
header block executed and the suite re-run.

---

## 16. Exact manual test steps (WSL/Ubuntu bash)

```bash
npm run db:start && npm run db:reset && npm run dev
```

1. Sign in `sample.educator@example.com` / `SampleFoundationReview2026`.
2. Open assigned program 0004 → **New announcement**. Save a draft. Confirm "Draft —
   families cannot see this yet" and a saved timestamp.
3. Preview the draft. Confirm it renders as a family would see it and is labelled a preview.
4. In a private window, sign in `sample.parent.one@example.com` → `/family/announcements`.
   The draft must **not** appear.
5. Back as the educator: Publish. Reload the family window — it appears. Confirm the same
   state string on both.
6. Educator → **Replace**. Edit the successor, publish it. Family sees the successor;
   the predecessor reads "Replaced" with a link forward.
7. Educator → **Remove** the successor via the dialog. Cancel once, confirm the item is
   unchanged; then confirm removal. Family view loses it.
8. New resource, kind **Document**. Attempt a disallowed type → refused with a readable
   reason. Attempt an oversized file → refused with the limit stated. Upload a valid PDF.
9. Publish it. As the family, open it: it downloads. Copy the `Location` URL from
   DevTools → Network, wait past the TTL, replay it → fails.
10. Remove the resource. As the family, request `/resources/<id>/file` directly → refused.
11. As `sample.parent.two@example.com` (no enrollment in that program), request the same
    route → refused.
12. As the educator, paste an **unassigned** program's authoring URL
    (`10000000-0000-4000-8000-000000000002`) → 404.
13. As `sample.admin@example.com` in another session, unassign the educator from 0004.
    Without signing out, the educator reloads the authoring page → access gone.
14. Admin → `/admin/communications`: the same items, same states, across programs.
15. DevTools → Network, every authenticated route: search response bodies for
    `object/public`, `token=`, `service_role`. Zero hits.
16. Resize to 390 px: forms single-column, content tables as labeled cards, bottom bar
    intact, every target ≥ 44 px.
17. Keyboard-only pass through create → publish → remove, including the dialog.
18. `psql` the audit table: confirm one row per material action, and that no row's
    `changed_fields` contains the announcement body text.

---

## 17. Rollback

The migration carries a `rollback:` header dropping, in order: the two audit triggers and
their functions; the nine content RPCs; `private.content_transition_allowed`; the four
storage policies and the bucket; the added columns; the two enum types; and restoring the
`published boolean` with its original policies and indexes from the backfill.

**Rollback is lossy in one direction and this must be stated before approval:** a
`replaced` or `removed` item cannot be represented by a boolean, so a down-migration
collapses those to `published = false`. Any *file-backed* resource becomes
unrepresentable entirely, because the pre-migration table requires a non-null
`^https?://` URL. Rolling back after files exist therefore requires either deleting those
rows or a data-preserving intermediate — which is itself a retention decision (GAP-CONTENT-03).
Application rollback is a clean revert; the schema is the part that needs the decision.

---

## 18. What I need before implementing

1. **Approval of this plan.**
2. **GAP-CONTENT-01** — the allowed file-type list. Blocks file-backed resources only.
3. **GAP-CONTENT-02** — the maximum file size. Same block.
4. **GAP-CONTENT-03** — confirmation that "Removed" means retained-but-inaccessible, not
   erased, for this release.
5. **GAP-CONTENT-04** — confirmation that actively assigned = permitted to author.

If 2 and 3 are not yet answerable, the link/video/activity half of resources and the whole
of announcements can ship first, with file-backed resources following as CONTENT-02. I do
not recommend guessing an allowlist to keep the slice whole.

---

# 19. Owner decisions — approved 2026-08-31

Plan **approved as written**. The four blocking gaps in §18 are answered:

| Gap | Decision |
|---|---|
| GAP-CONTENT-01 | **PDF and images only**: `application/pdf`, `image/png`, `image/jpeg`, `text/plain`. Macro-bearing Office formats, archives, and executables excluded. |
| GAP-CONTENT-02 | **10 MB** per file. `serverActions.bodySizeLimit: '12mb'`. |
| GAP-CONTENT-03 | **Revoke access, retain data.** Row and storage object kept; no client role holds `delete`. Confirms D-C4. |
| GAP-CONTENT-04 | Actively assigned = permitted to author. Confirms assumption A1. |

GAP-CONTENT-05 (publish notification) and GAP-CONTENT-06 (`is_sample`) remain open and
out of scope, recorded as D-C3 and a pre-activation item respectively.

---

# 20. Implementation record — what changed from this plan, and why

Implemented 2026-09-01 on `feat/program-announcements-resources` from `main` @ 32a92bd.
Five things the plan did not anticipate, all found by running the code rather than
by reading it.

## 20.1 The `published` column could not be dropped where the plan put it

Postgres refuses to drop a column a policy depends on, and both family SELECT
policies test `published`. The drops were moved to the top of the migration and
the `state`-based policies recreated further down. The window with no family
policy is inside the transaction and never observable — and deny-by-default
means that window is CLOSED, not open: with no policy, a family reads nothing.

## 20.2 A `security definer` function is an existence oracle unless you close it

The plan had each verb raise `P0002` for a missing row and `42501` for an
unauthorized one. Because these functions read past RLS, that pair told a direct
PostgREST caller which content ids are real: a fabricated id answered `P0002`
while a real one they did not hold answered `42501`.

Collapsed to a single `42501` for both, in all nine verbs. pgTAP asserts a
fabricated id and a real-but-forbidden id refuse identically.

Found by test 18 of `90_content_authoring.test.sql`, which expected P0002 and got
42501 — the assertion was wrong AND the behaviour was wrong, in opposite
directions.

## 20.3 DEFECT-C1 — the audit trigger made every in-place edit fail

`changed := changed || 'body'` makes Postgres resolve `anyarray || anyarray` and
try to parse the untyped literal as an array literal. It raises `22P02`
"malformed array literal" inside an AFTER trigger, which aborts the UPDATE that
fired it. **Every edit of an existing draft failed**, in both content tables.

Rewritten as `array_append(changed, 'body')`.

The reason no test caught it is worth recording: the suite created, published,
replaced, and removed. It never simply EDITED. `90_content_authoring.test.sql`
§6b now does, and asserts the resulting audit row.

Found by probing a real two-writer sequence against PostgREST, not by reading.

## 20.4 DEFECT-C2 — SQLSTATE 40001 is swallowed by PostgREST

The plan reused the `40001` stale-write code from `admin_update_program_facts`.
PostgREST treats SQLSTATE class 40 (transaction rollback) as a TRANSIENT UPSTREAM
condition: it discards the message and answers `{"message":"The upstream server
is timing out"}` with **no `code` field at all**. So `mapError` saw `undefined`
and reported a recoverable edit conflict as "something went wrong on our side".

Changed to `PT409`, PostgREST's pass-through convention: the code survives and
the response is HTTP 409. Verified against the local stack before and after.

**This defect is PRE-EXISTING in the administrator paths.**
`admin_update_program_facts` and `admin_set_enrollment_state` still raise 40001,
so an administrator hitting a concurrent-edit conflict today is told the server
broke. Not fixed here — it is outside this slice and would change approved
administrator behaviour. Recorded for the owner. See "Needs your attention".

## 20.5 DEFECT-C3 — a refused lifecycle move was silent

Publish and remove are `void` server actions that redirect, so they carried no
form state and no message. A refused publish — the file-backed draft with no file
attached is the common case — redirected back to a page that looked exactly as it
had before the click and said nothing at all. MPS-REQ-021 requires an observable
state and a stated recovery; this had neither.

The action now appends a short token (`?refused=stale|gone|refused|failed`) and
`RefusalBanner` turns it back into a sentence. The TOKEN travels, never the
database's message: a URL is logged, shared, and kept in history, and text put
there is text that escapes the page. An unrecognised token renders nothing, so a
hand-typed `?refused=` cannot put arbitrary claims in front of an author.

## 20.6 Two accessibility defects in the forms

* **Textarea labels were not associated.** `Textarea` is a plain `<textarea>`,
  not a Base UI `Field.Control`, so `FieldLabel` emits no `for`. Both content
  forms now carry the explicit `id`/`htmlFor` pair that `program-form.tsx`,
  `contact-form.tsx`, `enrollment-drawer.tsx`, and `educator-drawer.tsx` already
  use. **Pre-existing gap, not fixed here:** `create-program-form.tsx:170`'s
  Summary textarea still has no association.
* **Two controls shared one accessible name.** The removal dialog's close button
  was labelled "Keep it", the same as its footer button. The close control is
  "Close" again.

## 20.7 Test defects found and fixed (mine, not the product's)

* `waitForURL` after Publish resolved instantly, because publishing redirects to
  the page you are already on. Tests then read another role's view before the
  write had committed. Replaced with `publishAndSettle`, which waits for the
  rendered state.
* A second role signed in via `context.newPage()` shares cookies, so it replaced
  the first session and landed on the first role's dashboard. Now
  `browser.newContext()`, matching `educator-workspace.spec.ts`.
* Several assertions hit strict-mode violations because a message legitimately
  appears twice — once in the form's sr-only live region and once in the visible
  banner. Asserting the visible one; the duplication is the accessibility design,
  not a bug.

# 21. Checks actually run

| Check | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run test:unit` | pass — 174 tests, 0 failures |
| `npm run build` | pass — all 14 new routes emit as `ƒ` (dynamic) |
| `npm run db:test` | pass — 12 files, **332 assertions** |
| `playwright content-authoring` (batch 1: signed-out, authorization, lifecycle, family visibility, removal) | **17 passed, 0 failed** |
| `playwright content-authoring` (batch 2: storage, files, cross-surface, absences, a11y/responsive) | **19 passed, 0 failed** |
| `playwright family-dashboard` (4 viewport baselines) | pass |
| `playwright family-dashboard` (ARIA snapshot) | pass in isolation |
| `playwright authorization educator-workspace family-dashboard` | 89 passed / 5 failed — all 5 are the family-dashboard visuals, and all 5 pass on a healthy stack (§22) |
| `npm run db:types:check` | **FAIL** — regenerates from the LINKED REMOTE, which has not had this migration pushed. Diffed against the LOCAL schema the committed file matches **exactly**. Same situation as the previous slice's §16.5. |

The e2e suite was run in two batches rather than one because of §22.

# 22. Environment — why the suite was batched, and what is not a product signal

The local stack crashed **five times** mid-run. Each time, `docker ps` showed
`supabase_db` and `supabase_auth` with an uptime shorter than the test run that
had just "failed", and one run left the database with **no `public.students` at
all** — `db:reset` had failed silently after a restart.

Cause: the Windows host has **6.3 GB of physical RAM**. `.wslconfig` requests
`memory=8GB`, which the host cannot back, so WSL gets ~5.7 GB and Windows is
squeezed. Twelve Supabase containers, a Next production build, and Chromium do
not fit. This is the same failure the educator slice recorded in its §20.5.

**No result in this document comes from a degraded stack.** Every figure above
was taken on a stack verified healthy immediately before and after. The
mitigations used: build first, start the server separately, then run Playwright
against it; and run the suite in two batches.

Recorded as **RISK-C2**: a full single-worker e2e run is not reliably completable
on this machine. See "Needs your attention" for the `.wslconfig` changes that
would help and the recommendation to move the suite to CI.

# 23. Defects found

* **DEFECT-C1 (fixed here, mine).** Audit trigger aborted every in-place edit. §20.3.
* **DEFECT-C2 (fixed here for content; PRE-EXISTING and NOT fixed for the
  administrator paths).** SQLSTATE 40001 is swallowed by PostgREST, so a
  concurrent-edit conflict reports as a server fault. §20.4.
* **DEFECT-C3 (fixed here, mine).** A refused lifecycle move was silent. §20.5.
* **DEFECT-C4 (fixed here, mine).** Textarea labels unassociated; duplicate
  accessible name in the removal dialog. §20.6.
* **DEFECT-C5 (pre-existing, NOT fixed here).** `create-program-form.tsx:170`'s
  Summary textarea has no label association. Same class as C4, in an
  administrator form outside this slice.

---

# 24. Post-review round — owner instructions of 2026-09-01

* Migration pushed to the linked project. `npm run db:types:check` now **passes**;
  the committed file was regenerated the sanctioned way (`npm run db:types`,
  which reads the linked project) and now carries the `__InternalSupabase`
  block that `--local` generation omits. That was the only difference.
* **DEFECT-C5 fixed.** `create-program-form.tsx`'s Summary textarea now carries
  the explicit `id`/`htmlFor` pair, matching every other textarea in the
  repository. One file, no behaviour change.
* **DEFECT-C2 left alone**, per instruction. The administrator paths still raise
  `40001` and still report a concurrent-edit conflict as a server fault.
* **D-C3 / GAP-CONTENT-05 accepted.** No family publish email. MPS-WFL-006's
  notification clause remains unimplemented by owner decision.

## 24.1 Administrator visual baselines retaken, and why

Adding the approved MDS **Communications** destination changes the administrator
sidebar on every administrator page. Sixteen baselines across `admin-programs`,
`admin-families`, `admin-enrollments`, and `admin-educators` were retaken, plus
`admin-overview`'s tablet baseline and ARIA snapshot.

The diff was inspected before retaking rather than assumed: the only differing
pixels were "Communications" appearing in the rail and "Account" shifting down
one row — 317 pixels at desktop, 0.01 of the image. Nothing else moved.

All retaken baselines verified green on a clean seed after the fact.

## 24.2 DEFECT-C6 — the administrator activity feed was nondeterministic

Found while chasing an intermittent `admin-overview` baseline.

`audit_events` rows written by a migration or the seed all share ONE
`occurred_at`: those run in a single transaction, so `now()` is constant across
every row. The sanitized seed alone produces two dozen at the same instant, and
this slice added eight more. `repository.ts` ordered the activity feed on
`occurred_at` alone with a `LIMIT`, which asks Postgres to pick an arbitrary
subset of a tie — and it is free to pick a different one each run.

Fixed by tiebreaking on `id`, which is `bigint generated always as identity` and
therefore monotonic with insertion, breaking every tie in the same direction as
the intended "newest first". One query, in `src/lib/admin/repository.ts`.

This was a real product defect, not a test problem: the administrator overview
showed a different set of recent actions on each load.

## 24.3 DEFECT-C7 — the overview baseline cannot be stable, and this is not fixed

Even with C6 fixed, `admin-overview`'s visual baseline remains intermittent, and
the cause is now understood precisely: `recent-activity.tsx:85` renders an
ABSOLUTE wall-clock timestamp, and `npm run db:reset` re-seeds those rows with
`now()`. The rendered text therefore changes with the clock, so a screenshot
taken at 08:14 cannot match a baseline captured at 12:07 — no amount of
re-baselining will settle it.

This is pre-existing (the previous slice recorded `admin-overview`'s ARIA
snapshot as failing on clean `main` in its §19) and is NOT fixed here. Fixing it
means masking the `<time>` region from the screenshot, which changes what an
approved baseline asserts — a design-adjacent decision, not one to take while
landing a content slice.

Recorded for the owner. See "Needs your attention".
