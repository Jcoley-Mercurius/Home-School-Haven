# HSH-SLICE-EVIDENCE-01 — Beta Review Evidence and Feedback Classification

## 1. Goal and scope

Give Samantha a place to walk the eight approved beta success signals, record
what she says, classify each item, and approve its disposition — without any of
it silently changing approved scope.

**Authority IDs.** MPS-REQ-022 (preserve enough beta-review evidence to
demonstrate each approved beta success signal and classify Samantha's feedback
without silently changing scope); MPS-REQ-024 (attributable history);
MPS-WFL-008 (main path "Walk through success signals → Record feedback →
Classify issue or idea → Approve disposition → Update affected MPS state";
states `not_reviewed, in_review, feedback_recorded, decision_pending,
disposition_approved, review_complete`; alternate paths "Must-fix beta defect",
"Launch requirement", "Next or Later idea", "Rejected change"; recovery
"Unresolved items remain explicit gaps; they do not silently enter launch
scope"); MPS-ACC-032 (the MPS-REQ-022 half); SIG-BETA-001 through 008;
MPS-RUL-005, MPS-RUL-010; `mps/qa/MPS-QA.md` lines 11–12.

**In scope**

1. The eight SIG-BETA signals as first-class rows, each carrying its own
   MPS-WFL-008 walkthrough state.
2. Feedback items recorded against a signal, each with a required
   classification drawn from MPS-WFL-008's alternate paths.
3. Owner/administrator approval of a disposition, as a distinct act from
   recording the feedback.
4. The per-criterion evidence fields `mps/ACCEPTANCE-CRITERIA.md` §"Required
   evidence" names: result, environment/build identifier, method, actor.
5. Attributable history for every state, classification, and disposition change.
6. A truthful review-completeness summary that counts what is genuinely
   demonstrated and never rounds up.

**Explicitly out of scope** (do not build)

- **Any automatic edit to an MPS, MDS, or MTS file.** MPS-WFL-008's last step,
  "Update affected MPS state", is a governance act performed in ChatGPT Work by
  the owning system (AGENTS.md §3). This slice records the approved disposition
  and stops. Writing an approved decision back into `mps/` from application
  code would let the beta rewrite its own authority.
- Any change to scope, priority, requirement, or acceptance text.
- Evidence **file** upload (screenshots, recordings). Private Storage exists
  from HSH-SLICE-CONTENT-01, but ACC-032 is satisfiable with a written evidence
  record plus the audit trail, and a second upload surface is a slice of its
  own. Logged as **GAP-EVIDENCE-001**.
- Email or notification of any kind (GAP-PUBLIC-001 unchanged).
- Anything that decides a financial outcome (MPS-RUL-004).

## 2. Repository evidence inspected

- `grep -rln "SIG-BETA\|feedback" src/` returns nothing: this is greenfield.
- MDS `navigation.specification.admin` names **Reports** among the nine
  approved administrator destinations, and nothing occupies it yet
  (`src/app/(portal)/admin/` has no `reports`). This slice belongs there — an
  approved destination, so unlike HSH-SLICE-PUBLIC-03a it introduces **no**
  MDS navigation gap (contrast MDS-GAP-P2).
- `src/components/layout/admin-portal-shell.tsx:105-120` narrows D-AO3 to
  "Reports and Settings remain missing". This closes the Reports half.
- `supabase/migrations/20260904000000_inquiry_capture_foundation.sql` is the
  closest structural precedent: an enum state machine, a
  `private.*_transition_allowed` guard, a `security definer` write door,
  admin-only RLS, and an audit trigger that records states rather than content.
- `src/lib/admin/inquiry-transitions.ts` + `tests/inquiry-transitions.test.mts`
  are the precedent for a UI-side transition table pinned against the SQL one.
- `public.audit_events` (`20260827212020_*.sql`) and `private.is_admin()`
  (`20260827212014_*.sql`) are reused unchanged.

## 3. Data and server changes

**Migration** `supabase/migrations/20260905000000_beta_review_evidence.sql`

- `public.review_signal_state` enum — the six MPS-WFL-008 states, verbatim.
- `public.review_disposition` enum — MPS-WFL-008's alternate paths, verbatim
  and exhaustive: `must_fix_beta_defect`, `launch_requirement`, `next_idea`,
  `later_idea`, `rejected_change`. No sixth value.
- `public.review_signals`: `id` (the SIG-BETA identifier as the primary key, so
  the approved id is the key rather than a label beside one), `statement`
  (verbatim from `MPS-PROJECT-STATE.yaml`), `display_order`, `state` default
  `not_reviewed`, `state_changed_at`, `result` (`pass | fail | blocked |
  not_tested`, default `not_tested`), `environment`, `build_identifier`,
  `method`, `actor`, timestamps. Seeded in the migration itself with all eight
  approved rows — these are approved MPS constants, not sanitized demo data, so
  they do not belong in `supabase/seed.sql`.
- `public.review_feedback`: `id`, `signal_id` → `review_signals`, `note`
  (Samantha's words), `disposition` (nullable until classified),
  `disposition_approved_at`, `disposition_approved_by`, `recorded_by`,
  timestamps. A `CHECK` requiring `disposition` to be present whenever
  `disposition_approved_at` is — an approved disposition with no
  classification is the silent scope change MPS-REQ-022 forbids.
- RLS enabled, deny-by-default, admin-only on both tables via
  `private.is_admin()` (which covers `admin` and `owner`, the ACT-004/ACT-006
  actors MPS-WFL-008 names). No educator policy, no family policy. No INSERT or
  DELETE grant to any client role.
- `private.review_transition_allowed(from, to)` — the MPS-WFL-008 graph:
  `not_reviewed → in_review`; `in_review → feedback_recorded, review_complete`;
  `feedback_recorded → decision_pending, in_review`;
  `decision_pending → disposition_approved, feedback_recorded`;
  `disposition_approved → review_complete, in_review`;
  `review_complete → in_review` (a signal may be re-opened; a *review* is not
  a record of a family's request and reopening one loses nothing).
- `public.admin_record_signal_evidence(...)` — sets result, environment, build,
  method, actor, and optionally the next state, admin-only, transition-guarded.
- `public.admin_record_review_feedback(...)` — appends one feedback item.
- `public.admin_classify_review_feedback(...)` — sets or changes the
  disposition. Separate from the approval below, because MPS-WFL-008 separates
  "Classify issue or idea" from "Approve disposition".
- `public.admin_approve_review_disposition(...)` — records who approved and
  when. **Refuses when `disposition is null`**, in the database, not only in
  the form.
- `record_review_audit()` triggers on both tables → `audit_events` with
  `entity_type` `review_signal` / `review_feedback`, carrying ids, states,
  results, and dispositions. **Samantha's note text is not written into the
  audit payload** — `audit_events` is readable by every authenticated user
  (`grant select ... to authenticated`, `20260828010906`), and her candid
  assessment of an educator's workspace is not something an educator reads.
- Header comment carrying MPS/MDS/MTS IDs and an explicit `rollback:` block.
- Regenerate `src/lib/supabase/database.types.ts`.

**Application**

- `src/lib/admin/review-transitions.ts` — states, dispositions, labels,
  meanings, and the transition table as pure data (no `server-only`, so the
  Node test runner can reach it — the lesson recorded in
  `src/lib/admin/transitions.ts`).
- `src/lib/admin/review.ts` — the authorized reads and the four write wrappers,
  `server-only`, discarding driver errors rather than logging them.
- `src/app/(portal)/admin/reports/page.tsx` — the eight signals, their states,
  results, and a truthful completeness summary; feedback recorded and
  classified in a drawer, matching the `admin_operations` composition.
- `src/app/(portal)/admin/reports/actions.ts` + `form-state.ts`.
- A **Reports** entry in `admin-portal-shell.tsx` (`onMobileBar: false`, for the
  44 px reason already recorded there), and the D-AO3 comment narrowed to
  Settings alone.

## 4. Design

REUSE only. The existing admin table→card responsive pattern, state pill,
drawer, `Alert`, `Field`, and MDS tokens; Lucide at 1.75 px. State and result
meaning carried by words, never colour alone. A `fail` or `blocked` result must
be as legible as a `pass` — a review surface that makes bad news quiet is worse
than no review surface. **MDS-GAP-E1** to flag: the approved component set has
no `review_signal` state vocabulary, so the badge is composed from the approved
`badge` component rather than invented, the same way
`src/components/admin/inquiry-state.tsx` was.

## 5. Security and privacy

- Admin/owner only, at the policy layer and behind `requireAdmin()`.
- No educator or family reach, and no note text in any audit payload.
- Samantha's feedback is business-sensitive, not child data, but the same rule
  applies: it is never logged, never placed in a URL, and never echoed in an
  error.
- No child, family, or student field is read or written anywhere in this slice.
- The eight seeded statements are approved MPS text quoted verbatim
  (MPS-RUL-010); nothing here authors policy language.

## 6. Checks (fast lane — no full regression sweep)

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run test:unit` (adds `tests/review-transitions.test.mts`: the graph, the
   six states, the five dispositions, and an assertion that no label words a
   disposition as an accepted scope change)
4. `npm run db:test` (adds
   `supabase/tests/database/130_beta_review_evidence.test.sql`: no client
   INSERT/DELETE privilege; **an educator and a parent each read zero rows from
   both tables**; the eight approved signals are present with their verbatim
   statements; an illegal transition raises; approving a disposition that is
   null raises; the audit payload contains no note text)
5. `npm run build`
6. Targeted Playwright only: a new `tests/e2e/admin-reports.spec.ts` with
   `@axe-core/playwright`, an ARIA snapshot, desktop/tablet/mobile/wide
   screenshots, keyboard and focus-return checks, and cross-role 404s.

Full `npm run test:e2e` stays deferred to the pre-handoff sweep.
`npm run db:types:check` will report drift until `supabase db push` runs.

## 7. Manual steps (WSL/Ubuntu bash)

```bash
npm run db:start
# db:reset is unreliable here; seed directly and verify 9 programs:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -v hsh_seed_environment=local -f supabase/seed.sql
npm run dev
```

- As admin: `/admin/reports` shows eight signals, all `not_reviewed`.
- Walk one signal: record evidence, record feedback, classify it, approve the
  disposition, complete it. Confirm each step is a distinct recorded act.
- Attempt to approve an unclassified item; confirm refusal in words.
- Attempt an illegal transition; confirm refusal.
- Confirm the summary never reports a signal as demonstrated on the strength of
  a `blocked` or `not_tested` result.
- As educator and as parent: `/admin/reports` 404s, and nothing about a signal
  or a note is visible anywhere in either workspace.
- Keyboard-only pass, visible focus, reduced motion, 360 px width.

## 8. Gaps and owner attention

- **GAP-EVIDENCE-001** — no evidence file attachment (screenshot, recording).
  Written evidence plus audit history only.
- **GAP-EVIDENCE-002** — MPS-WFL-008's "Update affected MPS state" is
  deliberately not automated. After Samantha approves a disposition, someone
  must carry it into `mps/` through ChatGPT Work. This slice makes the pending
  set visible; it does not close it.
- **MDS-GAP-E1** — no approved `review_signal` state vocabulary; composed from
  the approved `badge`.
- MPS-ACC-032 also spans MPS-REQ-023 and MPS-REQ-024. Those halves are already
  served; **this slice does not itself run the walkthrough**, it builds the
  place the walkthrough is recorded. Closing ACC-032 still needs the Phase 5
  sweep and Samantha's actual session.

## 9. Rollback

Single migration, reversible by its header `rollback:` block (drop triggers,
functions, tables, enums). The Reports nav entry and the route revert with the
commit. No other slice reads these tables, so removal is self-contained.

---

## 10. As built — deviations and findings

1. **Recording feedback walks an untouched signal.** The plan implied feedback
   would simply move a signal to `feedback_recorded`, but the MPS-WFL-008 graph
   has no `not_reviewed → feedback_recorded` edge, so an untouched signal kept
   its state while displaying feedback — a card reading "nobody has walked this
   signal yet" directly above the owner's words about it. It is now walked
   through `in_review` first: two approved edges, two audit rows, nothing
   skipped. Pinned by four assertions in `130_beta_review_evidence.test.sql`.

2. **`review_result` became its own enum.** The plan described `result` as a
   free-standing set of four values; it is a Postgres enum
   (`public.review_result`) so the four words
   `mps/ACCEPTANCE-CRITERIA.md` §"Required evidence" names are the only ones
   representable, and a test asserts there is no fifth.

3. **`admin_record_signal_evidence` derives the actor from the session** rather
   than accepting it. ACCEPTANCE-CRITERIA.md asks who performed the check, and
   a caller-supplied name would make that answer worthless. It reads
   `profiles.display_name` and falls back to `auth.users.email` — the same
   staff pair `AdminPortalShell` already shows as `viewerLabel`.

4. **Two runtime defects found and fixed during the build.** A
   `Field.Description` and a `Field.Error` rendered outside a `Field.Root` threw
   Base UI error #28, which broke hydration for the entire signal card and
   silently stopped every form inside it from submitting — the page looked
   correct and did nothing. Both now sit inside a root with a comment saying
   why. The lesson generalises: `Field*` components from
   `src/components/ui/field.tsx` are Base UI primitives and are runtime errors
   outside a `Field` root, not merely unstyled.

5. **`demonstratedCount()` is the single definition of "demonstrated"**, tested
   in isolation, rather than a filter written inline where the summary renders.

### Checks actually run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | pass |
| `npm run test:unit` | 237 pass, 0 fail |
| `130_beta_review_evidence.test.sql` | 40 assertions, all pass |
| `npm run db:test` | 524 / 525 — the one failure is pre-existing test 54 of `100_schedule_capacity_attendance` (diagnosed in commit bc79dde) |
| `npm run build` | compiled, exit 0 |
| `npx playwright test admin-reports` | 25 passed |

Not run, deliberately: the full `npm run test:e2e` sweep. `npm run db:types:check`
will report drift until `supabase db push`.

### Still open

- **GAP-EVIDENCE-001** — no evidence file attachment.
- **GAP-EVIDENCE-002** — "Update affected MPS state" is not automated. After a
  disposition is approved, someone must carry it into `mps/` through ChatGPT
  Work. This slice makes the pending set visible; it does not close it.
- **MDS-GAP-E1** — no approved `review_signal` state vocabulary; the badges are
  composed from the approved `badge` component.
- **MPS-ACC-032 is not closed.** This slice builds where the walkthrough is
  recorded. Closing the criterion needs the Phase 5 sweep and Samantha's actual
  session, and the eight signals will sit at "0 of 8 demonstrated" until then —
  correctly.
