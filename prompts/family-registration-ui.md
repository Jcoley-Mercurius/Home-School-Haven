# Implementation prompt: Slice 3, family registration UI

Branch: `feat/family-registration-ui`. It was created from `release/foundation-preview` at `a482e4a`, the
PR #29 merge commit (merged 2026-09-19T14:34:57Z), after the preflight checks passed. The PR targets
`release/foundation-preview`. The owner authorized this slice in the request of 2026-09-19. That request waived a
second prompt-approval checkpoint unless a material conflict, a missing product decision, or a security problem
turns up.

The agent applies nothing to a hosted project, changes no Vercel configuration, and adds no migration.

## 1. Goal and scope

Build the authenticated parent/guardian registration experience on top of the Slice 2 and 2.5 foundation: one
protected route, eight steps, and one atomic, idempotent call to `public.submit_family_registration`.

**In scope:**

- the `/family/registration` route, its server action, and its catalog and result reads;
- the client form and the step components;
- honest entry points from the family dashboard and the single-program enroll page;
- a narrow EXTEND of `CheckoutHandoff` (heading id and text);
- removing `stepUp` from the TypeScript registration contract;
- unit and e2e tests (functional, a11y, ARIA, and visual);
- MPS, MDS, MTS, and QA records.

**Out of scope:**

- any migration, RPC, RLS, or grant change;
- STEP UP UI or payload;
- admin registration review;
- educator safety UI;
- checkout implementation beyond the existing handoff;
- document publication, and any change to the approval lock;
- new legal wording;
- public signup;
- real-family activation;
- any hosted database or Vercel operation.

## 2. Applicable IDs

- **MPS:**
  - requirements: MPS-REQ-001/002/003/004/005/012/013/014/015/017/018/021/024;
  - rules: MPS-RUL-003/004/006/008/009/010;
  - acceptance: MPS-ACC-002/003/018/019/020/021/022/023;
  - workflows: MPS-WFL-002/003;
  - decisions: DEC-022, DEC-026 to DEC-033 (DEC-028 as superseded in part by DEC-033);
  - exceptions and gaps: EXC-002; GAP-005, GAP-014, GAP-015, GAP-016.
- **MDS:**
  - DESIGN-SYSTEM §9.1 (MDS-DEC-023, and MDS-DEC-024 for STEP UP out of registration);
  - §6 trust-state rules, `consent_state` (`acceptance_method`), `enrollment_state`, and `payment_handoff`;
  - §7 grid, §8 responsive, §10 accessibility;
  - patterns `forms`, `consent`, `enrollment_handoff`, `empty`, `error`, and `loading`;
  - MDS-GAP-010 (rendered validation is due in this slice).
- **MTS:** SECURITY-ARCHITECTURE mandatory controls; MTS-DEC-003/013 (link-only checkout and manual reconciliation);
  MTS-DEC-025 (Base UI, no Radix); MTS-CHG-012/013 (the UI sends no `step_up`).

## 3. Repository evidence inspected

- **PR #29:** merged. `01b9186` (its head) is an ancestor of `HEAD`. All three migrations are present
  (`20260918120000`, `20260919120000`, `20260919120100`). `npm run db:reset` applied them and printed
  `db:reset verified — reset=canonical …`. `schema_migrations` lists all three.
- **Submit RPC** (`20260919120100` §7):
  - It returns `(outcome, registration_id, blocker_child_index, blocker_program_id)` only, with no per-child
    enrollment state.
  - The fingerprint is `sha256(payload::text)`, and `(caller, idempotency_key)` → `replayed` or
    `idempotency_conflict`.
  - `step_up` is an optional child key, and omitting it takes the ordinary evaluation.
  - Documents must equal `private.presented_document_version(kind)`, which is the approved version or else the
    draft. Otherwise the outcome is `blocked_documents_unavailable` or `blocked_document_version_stale`.
  - `22023` errors carry a path-only message (`children[0].allergy_details`) and never a value.
  - A blocked selection raises `HR001` internally, and the whole body rolls back.
- **RLS:**
  - Parents read `registration_submissions`, `registration_children`, `registration_selections`, and the rest of
    the family's registration evidence (`can_read_registration`).
  - Parents see only the *presented* document version.
  - `program_attendance_*` is readable wherever the program is.
  - Parents read their own `enrollments` and `students`.
- **Seed:**
  - Family A (`sample.parent.one`) has students A1 and A2, with enrollments in Tutoring, Haven Days, and Crochet.
  - The three document versions are `draft` / `sample-draft-v0`, with titles only and no text.
  - Every published program has an attendance rule (verified by query): Haven Days is `family_selects` Tue–Thu
    with plans 1–3; Tutoring is `family_selects` Tue–Thu with no plans; the other seven are `fixed`.
  - No program has a `checkout_url`.
  - The draft `…00ff` has no rule.
- **TS contract** (`src/lib/registration/contract.ts`): strict zod; still has an optional `stepUp`.
  `describeRegistrationFailure("failed")` says "Nothing was recorded", which is not provable after a timeout.
- **Repository** (`src/lib/registration/repository.ts`): cookie-bound client, never logs, maps `42501` and `22023`,
  and has no importer yet.
- **Patterns:**
  - `family/enroll/[slug]` (server action, `requireRole("parent")`, Alert, blocked-as-first-class);
  - `family/page.tsx` (guard, then `<Suspense>` skeleton, not `loading.tsx`, which would break 404 denial);
  - `EnrollmentStateBadge` (the one trust mapping) and `mayOfferCheckout` (`started` only);
  - `CheckoutHandoff` (fixed `id="registration-heading"`, so it is unsafe to repeat per child without EXTEND);
  - UI primitives `Button` (`loading` → `aria-busy`), `Alert`, `Card`, `Input`, `Textarea`, `Checkbox`/`CheckboxRow`,
    `RadioGroup`/`Radio`/`RadioRow` (approved, not used anywhere yet), and `Dialog`.
- **Next.js 16.3 docs read:** `01-app/02-guides/server-actions.md` (an action is a public POST, so it
  re-authenticates and validates, and actions dispatch sequentially), `forms.md`, and `authentication.md`.
- **E2E conventions:**
  - one worker and a shared DB;
  - `admin-reports.spec.ts` restores its own fixture with `psql`;
  - `family-enroll.spec.ts` screenshots at 390/768/1280/1440;
  - an ARIA snapshot on `main`;
  - Axe with `wcag2a/2aa/21a/21aa/22aa`;
  - a console guard in `fixtures.ts`.

## 4. Decisions and interpretations (no new policy)

1. **Documents in the sample preview.**
   - The presented version is a draft for every kind, and the lock keeps it that way.
   - Each document renders the `consent_state` **unavailable** variant: name, version label, "Draft — not
     approved", and no wording.
   - The copy states that a sample signature on a draft is not accepted policy, and that real registration cannot
     be finalized until Home School Haven publishes an approved version.
   - The signature and acknowledgment controls remain, so the sample flow is exercisable, which is exactly what
     the RPC and the Slice 2 seed were built to allow.
   - When a kind has **no** presented version, the **blocked** variant is shown and submission is disabled.
   - An approved version, which cannot exist yet, would render **required**.
2. **Media permission.**
   - The DEC-030 wording is rendered verbatim, once per child (the column is per child).
   - It sits after the document panels and before the signatures (§9.1).
   - A standing note says the question is not yet approved for real families, which fits this sample-only route.
   - The database requires the boolean, so the fieldset cannot be withheld without making submission impossible.
3. **Steps.**
   - There are eight steps, each announced "Step N of 8".
   - Steps 4 (identity and health) and 5 (programs and attendance) both render the collapsible child cards, so each
     child's health and selections live in that child's card.
   - Step 6 is the per-child external-checkout explanation, with no link before submission, because a link is
     offered only for a returned `started` state.
4. **Attempt key.**
   - The page render generates one UUID (`node:crypto`) and holds it in memory for the page's lifetime.
   - Every submit, retry, and edited resubmission reuses it. A blocked or `22023` result wrote nothing, so the key
     is still unused.
   - After an unconfirmed failure, an edited resubmission either commits normally (nothing was recorded) or returns
     `idempotency_conflict` (the earlier attempt was recorded). That conflict is shown as "an earlier attempt was
     recorded", never as success, and never creates a duplicate.
   - A reload generates a new key. The database's duplicate-enrollment check (`blocked_duplicate`) is then the
     backstop.
5. **Entry points.**
   - The dashboard header gets a "Register for programs" secondary action.
   - The dashboard's "no registrations yet" next action points to the registration.
   - `/family/enroll/[slug]` gets a secondary link to `/family/registration?program=<slug>`.
   - The public program rail keeps its approved "Register a Student" link. Retiring the single-program flow is a
     product decision and is reported in §13.
   - `?program=` carries a public slug only, is validated against the loaded catalog, and preselects that program
     on the first child card.
6. **Closed programs.** A program with availability `closed` renders unselectable with its availability badge, the
   same courtesy the enroll page uses. The database still decides.

## 5. Files

**Changed:**

- `src/lib/registration/contract.ts`:
  - remove `stepUp` from the input schema and the mapper, so a strict object refuses it;
  - reword the `failed` sentence to "could not be confirmed".
- `src/lib/registration/repository.ts`:
  - a sanitized `invalidPath` for `22023` (regex-allow-listed path grammar, no values);
  - `getRegistrationCatalog()` for published programs, attendance rules, and presented documents;
  - `getRegistrationResults(registrationId)`, the per-child selection → enrollment state, plus the program's
    checkout URL only when the state is `started`.
- `src/components/program/checkout-handoff.tsx`: optional `headingId`, `heading`, and `headingLevel` props. The
  defaults are unchanged, so the program page and the enrollment page stay byte-identical.
- `src/app/(portal)/family/page.tsx`, `src/lib/family/dashboard-state.ts`, and
  `src/app/(portal)/family/enroll/[slug]/page.tsx`: the entry points.
- `tests/registration-contract.test.mts` and `tests/family-dashboard.test.mts`.

**New:**

- `src/app/(portal)/family/registration/page.tsx`: guard, family read, Suspense skeleton, catalog loader.
- `src/app/(portal)/family/registration/actions.ts`: `submitRegistrationAction(input, attemptKey)`.
- `src/lib/registration/form.ts`: pure and client-safe. It holds:
  - the draft types;
  - per-step validation, producing an error list with step, field id, and child key;
  - `draftToInput` (hidden details, unselected programs, and STEP UP are never emitted);
  - `errorForServerPath`;
  - the attendance helpers.
- `src/components/registration/`:
  - `registration-form.tsx` (client orchestrator);
  - `contact-steps.tsx`;
  - `child-card.tsx`;
  - `children-step.tsx`;
  - `programs-step.tsx`;
  - `checkout-step.tsx`;
  - `documents-step.tsx`;
  - `review-step.tsx`;
  - `progress-rail.tsx`;
  - `error-summary.tsx`;
  - `registration-result.tsx`;
  - `registration-skeleton.tsx`;
  - `consent-state.tsx`.
- `tests/registration-form.test.mts`.
- `tests/e2e/family-registration.spec.ts`, with snapshots.

No migration, no new dependency, no new token or visual convention.

## 6. Server action contract

`submitRegistrationAction(input: unknown, attemptKey: string)`:

1. `requireRole("parent", "/family/registration")`, again, because an action is a public POST. An admin passes the
   guard, but the RPC refuses a non-parent with `42501`.
2. It validates that `attemptKey` is a UUID and calls `submitFamilyRegistration`, which zod-parses and then runs the
   RPC.
3. It returns a serializable union:
   - `recorded` (`submitted` or `replayed`) plus per-child results;
   - `invalid` plus an optional sanitized path;
   - `blocked` plus the outcome, child index, program id, and (for a document outcome) the freshly presented
     documents;
   - `conflict`;
   - `forbidden`;
   - `unavailable`;
   - `unconfirmed` (any other error).

Nothing is logged. No typed value is echoed back.

The client treats a thrown call (network or timeout) as `unconfirmed` too.

## 7. Security, privacy, data handling

- **Identity and trust.** Family, role, and ownership come from `auth.uid()` in the RPC. The browser sends no
  family id, role, price, payment state, enrollment state, or STEP UP value. The strict schema refuses extras.
  Document version ids are assertions that the RPC checks against the presented version.
- **No sensitive data leaves the form.**
  - No sensitive value goes in the URL (only a public program slug), in a log, in `console`, in analytics (PostHog
    is not initialized on portal routes; verified unchanged), or in an error message.
  - The client error text is fixed sentences plus program and child display names already on screen.
- **Hidden fields.** Hidden health details stay in memory only and are never submitted.
- **Checkout.** The checkout URL is returned only for `started` and is never decorated with identifiers.
- **Screenshots.** They use sanitized sample names ("Sample Registration Child …", "555-01xx"). Health details in
  fixtures are neutral placeholders.
- **Cleanup.** The e2e cleanup SQL deletes only rows that the spec created for Family A.

## 8. Responsive and accessibility

- **Layout.**
  - Desktop (≥1024): a 12-column grid, with the form in 8 columns and a 4-column sticky progress/review rail.
  - Below 1024: one column, with the rail rendered inline after the step content.
  - Each child card after the first starts collapsed below 1024.
- **Targets and focus.** Targets are 44 px. The focus ring is the MDS Coral 700 ring on every control.
- **Semantics.**
  - Each radio group and checkbox group is a `fieldset` with a `legend`.
  - Inline errors use `aria-describedby` and `aria-invalid`.
  - Expand controls use `aria-expanded` and `aria-controls`.
  - Conditional details use `aria-controls` and a polite announcement.
- **Error summary.** A `role="alert"` summary with a focused heading and links that switch step, expand the card,
  and focus the field.
- **Announcements.** Step changes focus the step heading and announce "Step N of 8: <name>". Add and remove announce
  politely, and removal returns focus to the list's add action.
- **Submitting.** `aria-busy` plus a polite "Submitting registration…".
- **Motion.** The global rule and `motion-reduce:` cover reduced motion. The card expand has no animation.

## 9. Tests

- **Unit (`registration-form.test.mts`):**
  - required guardian phone, emergency contact, and pickup person;
  - explicit health answers, where blank ≠ No;
  - conditional details excluded when No;
  - fixed, Haven Days 1/2/3, Tutoring, and unconfigured attendance;
  - document blocked;
  - media unanswered;
  - no `step_up` key anywhere in the payload;
  - server-path mapping, including a collapsed child;
  - duplicate existing student.
- **Unit (updated):** the contract refuses `stepUp`, and the `failed` sentence no longer claims nothing was
  recorded.
- **E2E (`family-registration.spec.ts`):**
  - anon → sign-in redirect;
  - educator → 404;
  - a parent without a family → setup;
  - a full two-child submission (one existing student, one new child) with Haven Days 2-day, Sewing (fixed), and
    Tutoring;
  - the success states per child, and checkout never described as payment;
  - add, remove, collapse, and expand, with the removal confirmation;
  - conditional details;
  - the Haven Days mismatch message;
  - keyboard-only completion of step 1;
  - error summary focus and links, including collapsed-card recovery;
  - the review Edit links;
  - server rejection mapping, via a draft program published without a rule (the unconfigured program is blocked in
    the UI);
  - the document-version-changed recovery (a new draft version is inserted with `psql` mid-flow, then restored);
  - a network failure (Playwright aborts the action POST once), then retry with the same key, which gives one
    registration;
  - a double-click, which gives one registration;
  - no sensitive values in the URL;
  - no STEP UP text or payload (the request body is inspected);
  - Axe on every step and on success;
  - an ARIA snapshot of step 1, the child card, and success;
  - screenshots at 390×844, 768×1024, and 1440×900 for step 1, children, documents, the review, error, and
    success.
- **The standing checks in §11.**

## 10. Rollback

**Code:** revert the PR. No data model changed.

**Local data:** `npm run db:reset`.

**Hosted:** nothing to roll back. Sample registrations made in a preview are sample-only by constraint and can be
removed by deleting the family's `registration_submissions` rows (the evidence cascades) and the enrollments they
created.

## 11. Checks

Run:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run db:reset`
- `npm run db:test`
- `npm run db:types:check -- --local`
- `npm run test:e2e` (the full sweep, because this slice adds a route and a Vercel push follows the PR)
- `npm run build`
- `npm run db:advisors`

Also run the targeted `npx playwright test tests/e2e/family-registration.spec.ts`.

## 12. Manual verification (WSL bash)

```bash
npm run db:reset
npm run build && npx next start -p 3100
# Sign in at http://127.0.0.1:3100/sign-in as sample.parent.one@example.com / SampleFoundationReview2026
# Family Overview → "Register for programs" → complete steps 1–8 → Submit registration
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select outcome_count from (select count(*) outcome_count from public.registration_submissions) s;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select count(*) from public.registration_step_up_requests;"   # expect 0
```

## 13. Owner-facing gaps (reported, not resolved)

These stay separate from Slice 3 completion:

- Samantha's formal sign-off on DEC-026 to DEC-033;
- approved sources for the Liability Waiver, Code of Conduct, and Parent Handbook (GAP-014);
- media-release approval (checklist §8);
- retention beyond the 30-day minimum (GAP-016);
- the GoDaddy checkout links and STEP UP coupon behavior (GAP-015);
- production readiness for real families (EXC-002).

**New product question.** The single-program `/family/enroll/[slug]` flow still creates enrollments without the
DEC-026 information. Whether it is retired in favor of family registration is Samantha's call.

## 14. Implementation notes (2026-09-19)

This was implemented under the owner's authorization in the request, with no second approval checkpoint. No material conflict,
missing product decision, or security problem turned up. The notes below record where implementation went beyond this prompt:

- **Result order.** Every row of one submission shares a transaction timestamp, so the database cannot order
  per-child results. They are ordered on the client by the parent's own child and program order (`orderResults`). A
  new child is matched by case-insensitive preferred name, the same key the RPC uses. The first visual run caught the
  nondeterminism.
- **Hydration marker.** The form sets `data-ready` once React owns it, and the tests wait on it. Before hydration a
  native submit only reloads the page, because no field has a `name`, so nothing typed can reach a URL.
- **Viewports.** A 1024 × 768 viewport was added to 390, 768, and 1440, because MDS-GAP-010's resolution asks for
  rendered validation at 1024.
- **CheckoutHandoff `afterRegistration`.** After a recorded registration there is no guidance panel and the child is
  already registered, so the missing-link sentence changes only its closing clause there. The defaults are unchanged.
- **No `beforeunload` guard.** The repository has no established pattern for one, and it would block Playwright
  navigation. It is reported rather than invented.
- **No success ARIA snapshot (deviation from §9).** §9 asked for ARIA snapshots of step 1, the child card, and success.
  Only step 1 and the child card have one. The success state is covered by its functional e2e assertions and by
  screenshots at 390, 768, 1024, and 1440, but its accessibility tree is not pinned. The post-implementation review
  of 2026-09-19 found the gap, and the owner accepted it as a recorded deviation rather than a new snapshot.
- **Attempt key pinned (review follow-up).** The form now holds the first `attemptKey` it receives in state, instead of
  reading the prop on every submit. Nothing in this slice re-renders the page's server component, so behavior is
  unchanged. The pin keeps a later `router.refresh()` or revalidation from swapping the key mid-attempt, which would
  have given up the `replayed` protection.
- **`db:types:check -- --local`** reports only the hosted-template difference adopted in `5511c24`
  (`__InternalSupabase.PostgrestVersion` and parenthesized generics). Every declaration matches. The file was not
  touched.
- **Full e2e sweep:** 635 passed, 46 failed, 1 skipped, and 6 did not run.
  - 34 of the failures reproduce identically on the unmodified base `a482e4a`: FIND-004 stale baselines, plus the
    admin-families, admin-overview, admin-programs, and educator-workspace failures.
  - 9 were this slice's intended dashboard and enroll visual changes. Their baselines were regenerated and reviewed
    (the new button, the new link).
  - 1 was a registration test that waited 5 s for a submission under full-sweep load. The success waits now allow 20 s.
  - 2 (`authorization` "a parent reaches the family area" and the educator-workspace ARIA snapshot) pass in isolation
    on this branch. Every spec that runs before them is untouched by this slice, so they are recorded as shared-account
    ordering contamination.
