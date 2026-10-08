# Implementation prompt — Closeout Slice 1 audit fixes

Branch: `feat/public-offering-model` (continues the Slice 1 work; not merged, not pushed to `main`).
Requested 2026-09-17, after a full audit of the Slice 1 changes against the repository.

## 1. Goal and scope

Close the gaps the 2026-09-17 audit found in Closeout Slice 1 before the hosted
`supabase db push` and the Samantha handoff:

1. fix the one functional test defect the fixture re-pointing introduced;
2. regenerate the nine ARIA baselines and the screenshot baselines the re-pointing
   invalidated, reviewing every diff rather than accepting it blind;
3. correct the migration's rollback header, which overstates what is recoverable;
4. remove the two orphaned placeholder images and the archived rows that point at them;
5. derive the admin offering-type validator from the taxonomy module instead of a
   second hard-coded list;
6. stop `password-recovery.spec.ts` leaving the shared sample parent's password changed,
   which makes four unrelated specs fail in any full sweep;
7. record the audit outcome in MPS/MDS/MTS traceability.

**Out of scope, deliberately:** every other pre-existing e2e failure (§7), any change to
offering facts, prices, schedules, the address, RLS, the offering taxonomy itself, or the
hosted database. No `supabase db push` is run by the agent.

## 2. Applicable IDs

- MPS-REQ-007, MPS-REQ-008, MPS-REQ-016, MPS-REQ-020, MPS-REQ-024; MPS-RUL-005, MPS-RUL-007;
  DEC-024; QA-007; import rules 1, 3, 7.
- MDS: MDS-DEC-021, MDS-DEC-022; DESIGN-SYSTEM §6 program card, §8 responsive, §10 accessibility.
  No new visual convention is introduced, so no MDS gap is opened.
- MTS: Supabase remains the system of record; writes only through authorized `security definer`
  functions; attributable history through `record_program_audit`.

## 3. Audit evidence this responds to

Checks run on 2026-09-17 against the local stack, on `feat/public-offering-model`:

| Check | Result |
|---|---|
| `format:check`, `lint`, `typecheck` | pass |
| `test:unit` | 293/293 pass |
| `db:reset` | 21 migrations apply; `db-reset.mjs` reports canonical |
| `db:test` | 591 pgTAP assertions across 18 files, all pass |
| `db:types:check` | fail — regenerates from the **linked** project, which has not received the migration |
| `test:e2e` | 577 passed, 63 failed, 1 skipped, 26 did not run |

Each failure class was re-run in isolation on a freshly reset database to separate
slice defects from pre-existing debt. The migration applies cleanly and every database
assertion passes; the defects below are all in the test and asset layer, plus documentation.

## 4. The fixes

### 4.1 `admin-programs.spec.ts` searches for a term no program contains

[`tests/e2e/admin-programs.spec.ts:164`](../tests/e2e/admin-programs.spec.ts#L164) navigates to
`/admin/programs?q=art` while the assertion beneath it was changed from `"Art Lab"` to
`"Tutoring"`. The query was not changed with it. `matchesSearch` in
`src/lib/admin/filters.ts:126` is a plain normalized substring match, so `art` matched
`Art Lab` and matches nothing in the reconciled catalog: the page renders the
"No programs match these filters" empty state and the assertion fails.

Change the query to `?q=tutor`. It matches `Tutoring` and does not match
`Sample Unpublished Draft (test fixture)`, so the test keeps both halves of its point.
Leave `?q=zzzznotaprogram` (line 177) and `?status=deleted&q=` (line 191) alone; both are
correct as written.

### 4.2 Nine ARIA baselines are stale

Every one of these still asserts an archived offering, an archived UUID, or a program count
that no longer holds. All nine were confirmed failing:

| Baseline | What is stale |
|---|---|
| `admin-programs-main.aria.yml` | "Showing 9 of 9 programs"; the five archived rows as `Published` |
| `admin-overview-main.aria.yml` | archived program links |
| `admin-educators-main.aria.yml` | "Art Lab, Sample Unpublished Draft" as the assignment |
| `admin-enrollments-main.aria.yml` | Art Lab, Harvest Explorers, Haven Days Enrichment rows |
| `educator-overview-main.aria.yml` | Art Lab throughout; `/educator/programs/…0004` |
| `family-dashboard-main.aria.yml` | Art Lab links, `Sample session — Art Lab meeting` |
| `family-enrollment-approval-pending.aria.yml` | "Ready Set Prep & Learn — Sample Student A2" |
| `contact-main.aria.yml` | the eight old program `<option>`s |
| `admin-families-main.aria.yml` | archived program names **and** pre-existing drift (§7) |

`contact-main.aria.yml` is the one to be most careful with: it was hand-edited in the Slice 1
pass for the address line only, so its program list was never regenerated. Regenerate the whole
file rather than editing another line by hand.

Regenerate with `npx playwright test <spec> --update-snapshots`, then **read each diff** and
confirm it contains only the expected fixture rename, the new program set, and the new address.
An unexplained structural change (a lost heading level, a dropped landmark, a changed accessible
name) is a finding, not a baseline to accept.

### 4.3 Screenshot baselines invalidated by the re-pointing

Regenerate and review:

- `admin-overview` (mobile, tablet, desktop, wide)
- `admin-programs` (mobile, tablet, desktop, wide)
- `educator-workspace` overview (mobile, tablet, desktop, wide) and roster (desktop)
- `family-dashboard` (mobile, tablet, desktop, wide)
- `family-enroll` registration form (mobile, tablet, desktop, wide)
- `admin-educators` (mobile), `admin-enrollments` (mobile), `admin-inquiries` (tablet)

The last three are **suspicious and must be classified before acceptance**: a content change
would fail at every viewport, not one. A single-viewport failure points at height or layout
drift, which may belong to the pre-existing bucket in §7 instead. If a diff cannot be explained
by this slice, do not rebaseline it — record it in §7 and leave the baseline alone.

### 4.4 The migration's rollback header overstates recovery

[`supabase/migrations/20260916000000_public_offering_model.sql:37`](../supabase/migrations/20260916000000_public_offering_model.sql#L37)
says prior content of `…0002`, `…0005`, and `…0006` "is recoverable from
`audit_events.changed_fields`". That is false for every column the upsert writes that
`record_program_audit` does not treat as material: `audience`, `import_status`, `source`,
`unverified_details`, `image_src`, `image_alt`, `image_width`, `image_height`,
`image_is_placeholder`, and `sort_order`.

The concrete loss on the hosted project is Gardening's existing QA-001 note,
`["Two hours per session (association unproven)"]`, which the upsert replaces with the QA-007
note and which no audit event captures.

Correct the comment to state exactly which columns are recoverable and which are not, and note
that the superseded Gardening detail is preserved in
`mps/BETA-CONTENT-IMPORT-INVENTORY.md` under the website-capture section. **Do not** add these
columns to `record_program_audit`'s material list in this prompt: widening the audited set is an
MPS-REQ-024 decision, and `unverified_details` in particular is review scaffolding rather than
published fact. Record it as a question for the owner instead.

This is a comment-only change to an already-written migration. The migration has **not** been
applied to the hosted project (`supabase migration list --linked` on 2026-09-17 shows
`20260916000000` with an empty remote), so editing it is safe and does not need a follow-up
migration.

### 4.5 Orphaned placeholder art

`scripts/check-demo-placeholders.mjs` reports `3 asset(s) in public/placeholder/, 2 reference(s)
in src/`. `program-art-lab.jpg` and `program-harvest-explorers.jpg` are no longer referenced from
`src/`, and the Slice 1 footer edit narrowed the disclaimer to name only the Haven Days image —
so generated art of children is still served at those URLs with nothing labelling it.

- Delete `public/placeholder/program-art-lab.jpg` and
  `public/placeholder/program-harvest-explorers.jpg`.
- Set `image_src`, `image_alt`, `image_width`, `image_height` to `null` and
  `image_is_placeholder` to `false` on the archived Art Lab (`…0004`) and Harvest Explorers
  (`…0007`) rows in `supabase/seed.sql`, so no row points at a missing file.
  `programs_image_complete_check` requires all four to move together.
- Update `public/placeholder/README.md` to drop the two removed files.
- Confirm the gate then reports `1 asset(s) … 1 reference(s)` and still exits 0.

The archived rows lose their image, which only an administrator viewing an archived program
would see. That is the intended trade: the offering is withdrawn and the art was never approved.

### 4.6 The offering-type validator duplicates the taxonomy

`src/lib/admin/validation.ts` hard-codes the five enum values. `OFFERING_GROUPS` in
`src/lib/programs/offering-groups.ts` is exhaustive by construction — adding an enum value
without a label is a type error — but the validator is not, so a sixth offering type would pass
type checking while silently being unselectable.

Derive the validator's accepted values from `OFFERING_ORDER`. Keep the `""` → `null` transform
and the existing message; this is a source change, not a behaviour change, and the existing
pgTAP and unit assertions must still pass unchanged.

### 4.7 `password-recovery.spec.ts` contaminates the shared sample parent

`tests/e2e/password-recovery.spec.ts` changes `sample.parent.one@example.com`'s password to
`RenewedFoundation2026` and never restores it. Proving the old password stops working is the
point of the test, so the reset itself is correct — but the account is shared, so every later
spec that signs that parent in with `SampleFoundationReview2026` fails.

Confirmed: `authorization.spec.ts:118` and three `schedule-capacity.spec.ts` tests failed in the
full sweep with `page.waitForURL` timeouts, and the auth container logged
`400: Invalid login credentials`. All four pass on a freshly reset database. These are not
product defects and they are not Slice 1 defects — they are ordering damage that makes any full
sweep unreadable.

Add a `test.afterAll` to the "recovery round trip" describe that runs one more recovery round
trip through the same public `/forgot-password` + Mailpit path, setting the password back to
`SampleFoundationReview2026`. Use the public flow, not a privileged reset: no spec may hold a
service-role credential (AGENTS.md §11).

Note the alternative in the completion report rather than implementing it here: give the
recovery spec its own seeded sample parent so it can never touch a shared fixture. That is
cleaner but adds a seed user and a `db-reset.mjs` expectation, which is more churn than this
fix warrants.

### 4.8 Traceability

- `mps/MPS-PROJECT-STATE.yaml`: record the audit under `governance.changes` as CHG-004, naming
  the defect found (the `?q=art` miss), the baselines regenerated, and the checks that were
  actually run with their real results. Do **not** promote any further requirement to
  `implemented` in this prompt — see §8.
- `mds/MDS-PROJECT-STATE.yaml`: record that the MDS-DEC-021 and MDS-DEC-022 compositions were
  verified against regenerated ARIA and screenshot baselines at 390 / 768 / 1024 / 1440,
  and that `admin-families` and the pages in §7 remain unverified.
- `mts/MTS-PROJECT-STATE.yaml`: record under MTS-CHG-008 that the migration is still unapplied
  on the hosted project, that `db:types:check` cannot pass until it is, and that the rollback
  note was corrected.

## 5. Security, privacy, data

No new data collection, no schema change, no RLS change, no new dependency. Deleting two
placeholder images **reduces** the unapproved generated imagery being served. The recovery-spec
fix uses only the public password-reset flow and the local Mailpit inbox; no test gains a
privileged credential. No secret, child name, or family detail enters a baseline, a log, or a
screenshot — every regenerated baseline is reviewed before it is committed, which is also the
privacy review for this change.

## 6. Accessibility and responsiveness

The regenerated ARIA baselines are the accessibility evidence: heading order, landmarks, table
semantics, and accessible names must be unchanged apart from the fixture renames. Run
`@axe-core/playwright` on the affected authenticated surfaces and on `/programs`,
`/programs/[slug]`, `/calendar`, `/contact`, and `/`. Confirm no horizontal scroll and the
44 px minimum target at 390 / 768 / 1024 / 1440. No token, component, or layout rule changes.

## 7. Known pre-existing failures — recorded, NOT fixed here

Verified as predating this slice. Owner decision of 2026-09-17: fix only the contamination in
§4.7 and record the rest, so a content slice does not carry a large unreviewed visual diff.

| Failure | Cause | Evidence |
|---|---|---|
| `admin-programs.spec.ts:302`, `:320` | `getByLabel("External checkout link")` matches two elements | the confirmation-mode radio description gained that phrase in `251c97d`, after this spec was last touched |
| `admin-families.spec.ts:257` | `getByRole("table")` matches two tables | the family-invitations table landed after the spec |
| `educator-workspace.spec.ts:453` | expects a "Not published" badge | that string exists nowhere in `src/` |
| `auth` ×4, `password-recovery` ×8, `family-setup` ×4, `admin-families` visual ×4 + ARIA, `resources`, `about`, `contact` composition | baselines captured 2026-08-28/29 and 2026-09-01, before `9c793b2` recomposed the public footer on 2026-09-02 | sign-in mobile expects 1833 px, receives 2219 px |

`admin-families` is affected by **both** buckets — it carries archived program names *and*
pre-2026-09-02 footer drift. It will still fail after this prompt. Say so plainly in the report
so a later reader does not treat it as a regression.

Also record that no full sweep to date has completed cleanly.

### Found during execution, 2026-09-17/18 — recorded, not all fixed

1. **A stale `next-server` poisoned an entire round of testing.** A process 8 hours old
   (cwd `/home/josh/home-school-haven`) held `*:3100` while `.next` was rebuilt and then deleted
   under it, serving HTML whose CSS returned 500. That produced 545 failures and 274 axe
   `target-size` violations on a static page. It survived `pkill -f "next start"` (the process
   renames itself to `next-server`) and was invisible to `lsof -ti:3100` (it binds the IPv6
   wildcard); `ss -lptn` found it. **Before trusting any Playwright result, confirm with
   `ss -lptn | grep :3100` and let Playwright own the build and server.**
2. **`admin-educators.spec.ts`'s `afterAll` reset cascaded in three consecutive sweeps**, each
   time taking out the specs that follow it. Top follow-up: replace it with a scoped psql
   restore, as `admin-inquiries`, `admin-reports`, `contact` and `family-setup` already do.
3. **`db:reset` can fail silently and leave the database empty.** Seen twice. Never redirect its
   output to `/dev/null`; gate the run on its `verified` line, as §9 now does.
4. **FIXED — `admin-overview` ARIA snapshot was viewport-dependent.** The preceding test sets
   1920x1080 for the 1440px cap check and does not restore it, so the snapshot inherited whatever
   width ran before it and alternated between `text: Review` and `text: ""`. It regenerated to one
   value and verified against the other. An explicit viewport before the capture makes it
   deterministic; verified stable across separate resets.
5. **NOT FIXED — `family-dashboard` visual baselines cannot match across two resets.** The page
   renders several clock-derived values (sessions at `now() + interval '7 days'`, announcements at
   `now() - interval '9 days'`), and differing string lengths shift wrapping and page height.
   Masking `time` was tried and is insufficient. The real fix is deterministic seed timestamps,
   which changes seed data other specs depend on and needs its own prompt. Documented in the spec
   so a failure there is read as unproven, not as a regression.
6. **`admin-overview` has an order-dependent sign-in timeout** at `:110` that recurs when the whole
   spec runs but passes when the test runs alone. Its visual baselines were regenerated during runs
   where that test timed out, so in a serial describe the later screenshots may have captured a bad
   page. **The structural ARIA snapshot is the trustworthy evidence for that page; its four visual
   baselines should be re-verified in a healthier session before they are relied on.**

## 8. Authority boundaries — flagged, not decided here

Per AGENTS.md §3 these belong to the owning system, and this prompt does not resolve them:

1. The Slice 1 scripted state pass closed `MTS-GAP-001`, flipped the MTS `inspection` gate to
   `complete` with a backdated `completed_at: "2026-08-27"`, and cleared three MDS
   `implementation_readiness` blockers. Owner decision of 2026-09-17: keep them and flag them
   for ratification by ChatGPT Work as the control room. They appear factually right — the
   repository really was inspected on 2026-08-27 — but gate status is not the agent's to close.
2. The same pass set `MPS-REQ-008` to `implemented` while MPS-REQ-007, 016, 020, 023, and 024 —
   cited in the same prompt and the same migration header — remain `absent`. REQ-007 in
   particular owns the published location, which is exactly what the address change touched.
   Left inconsistent on purpose, for the owner to settle.
3. Whether `unverified_details`, `audience`, `import_status`, `source`, `image_*`, and
   `sort_order` should join `record_program_audit`'s material fields (§4.4) is an MPS-REQ-024
   question.

## 9. Checks to run

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run db:reset
npm run db:test
node scripts/check-demo-placeholders.mjs
rm -rf .next/cache/fetch-cache && npm run build
npx playwright test admin-programs.spec.ts admin-overview.spec.ts admin-educators.spec.ts \
  admin-enrollments.spec.ts admin-inquiries.spec.ts educator-workspace.spec.ts \
  family-dashboard.spec.ts family-enroll.spec.ts contact.spec.ts programs.spec.ts \
  calendar.spec.ts authorization.spec.ts schedule-capacity.spec.ts password-recovery.spec.ts
```

Then one **full** `npm run test:e2e` on a freshly reset database, since §4.7 only matters across
specs. Report the real pass/fail/did-not-run counts and reconcile every remaining failure against
§7. `db:types:check` is expected to fail until the hosted push; report it as blocked, not passed.

`rm -rf .next/cache/fetch-cache` before building is required: the cache holds program-session
reads that survive a `db:reset` and will serve archived offerings on `/calendar`.

## 10. Rollback

Every change is a test file, a baseline, a comment, two deleted images, or a state record.
Revert the branch to undo. No migration is added and no hosted state is touched, so there is no
database rollback. The two deleted placeholder files are recoverable from git history.

## 11. Manual test steps (WSL bash)

```bash
npm run db:reset && rm -rf .next/cache/fetch-cache && npm run build && npx next start -p 3100
# /admin/programs?q=tutor   Tutoring is listed; the draft fixture is not
# /admin/programs           15 programs; the five archived ones show Archived
# /educator                 assigned program reads Tutoring, never Art Lab
# /family                   sessions read "Sample session — Tutoring meeting"
# /contact                  the program list is the nine current offerings
# curl -I localhost:3100/placeholder/program-art-lab.jpg   404
```

## 12. External setup still required from the owner

- `supabase db push --linked` against `uedgcwoxyhtirsihvrnf`. Connectivity was verified on
  2026-09-17: the direct host resolves IPv6-only, IPv6 egress from this WSL environment works,
  port 5432 accepts connections, and `supabase migration list --linked` authenticates and
  returns remote state. The earlier transport error is consistent with a Supabase Free project
  waking from auto-pause; retry. The CLI is v2.111.0 with v2.117.0 available.
- After the push, `npm run db:types:check` should pass; it cannot before.
- Hosted sample fixtures still point at the archived offerings. After the push a parent cannot
  read those rows at all — `programs_select_published_authenticated` restricts them to
  `published` — so family A's Art Lab and Harvest Explorers enrollments render with no program
  attached rather than with a stale name. Refreshing the hosted fixtures is a separate
  authorized action and is not part of this prompt.
