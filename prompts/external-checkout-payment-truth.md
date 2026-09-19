# Slice 4 — GoDaddy Checkout Activation, STEP UP Guidance, and Payment Truth

**Branch:** `feat/external-checkout-payment-truth` from `release/foundation-preview` (PR #30 merged at `5c285ae`)
**Authorization:** the user's Slice 4 instruction of 2026-09-19 authorizes planning and implementation. It asks for a stop only on an ambiguous mapping, an unapproved destination, or a material product or security conflict.
**Owner decision taken during planning (2026-09-19):** Omit the STEP UP coupon line (see §5).

---

## 1. Goal and scope

Turn on the existing external checkout handoff using the exact checkout destinations Samantha Dodson approved on `https://homeschoolhaven.org/classes`. Three things stay unchanged: payment truth is never inferred, only an administrator reconciles, and STEP UP policy is not invented.

In scope:

- recording the checkout mapping as canonical content evidence;
- one additive migration that sets `programs.checkout_url` for exact matches only and tightens the host allowlist to the verified destination;
- the TypeScript validation change that matches it;
- reconciling `CheckoutHandoff` across the public program page, the enrollment page, registration results, and the dashboard next action;
- tests, visual validation, and MPS, MDS, and MTS traceability.

Out of scope:

- internal payment processing, payment records, amounts, transaction IDs, coupon fields, and refund controls;
- a checkout-return page;
- any change to the live GoDaddy site, the hosted Supabase project, or Vercel;
- removing the Slice 2.5 STEP UP schema.

## 2. Governing IDs

- **MPS:** MPS-REQ-012, 013, 014, 015, 017, 020, 021, 023, 024. MPS-ACC-018 to 023. MPS-RUL-002, 004, 005, 010. MPS-WFL-003, 005, 007. DEC-025, DEC-028 (in part), DEC-033. GAP-010, GAP-012, GAP-015. EXC-001 and EXC-002. Import rules 1, 3, 4, 5, and 7. QA-001 and QA-007.
- **MDS:** DESIGN-SYSTEM §6 (`payment_handoff`: external checkout notice, return pending, status unknown), §9.1 ("Checkout handoff, per child", "Success"), DO-DONT "Trust states" ("Say when checkout leaves the platform"; "Do not represent an external checkout handoff as successful payment"), MDS-REF-004 §5 "Continue to Secure Checkout", MDS-REF-005 action-rail rules, and MDS-DEC-024 (the STEP UP review state is on hold).
- **MTS:** INTEGRATION-MANIFEST "External checkout", SECURITY-ARCHITECTURE "Payments and notifications" and "keep private data out of URLs", TECHNOLOGY-BLUEPRINT flow step 4, and ARCHITECTURE-ADDENDUM item 8 (manual checkout reconciliation).

## 3. Repository evidence inspected

- `src/components/program/checkout-handoff.tsx` renders the only handoff component. Every URL was `null`, so only the "Registration link not published" state had ever rendered.
- `src/lib/admin/validation.ts` defined `CHECKOUT_HOST = "pay.homeschoolhaven.org"`, required HTTPS, and refused any query or fragment.
- In `supabase/migrations/20260916000000_public_offering_model.sql`, `admin_update_program_facts` enforces the same host with an inline regex. No table-level constraint exists.
- In `supabase/migrations/20260829170000_family_dashboard_records.sql`, `enrollment_state` has the values `started, approval_pending, payment_pending, waitlisted, confirmed, payment_failed, canceled, blocked`.
- In `src/lib/admin/transitions.ts` and `private.enrollment_transition_allowed`, an administrator may set only `confirmed, waitlisted, blocked, canceled`, and every change is audited through `record_enrollment_audit`.
- `src/lib/enrollment/eligibility.ts` defines `mayOfferCheckout`, which is true for `started` and nothing else.
- `src/components/program/program-action-rail.tsx` renders `CheckoutHandoff` for anonymous visitors, with no enrollment state.
- `src/lib/family/dashboard-state.ts` has a `started` next action titled "Checkout was started", which the product cannot know.
- `src/components/admin/program-list.tsx` and `program-operations-table.tsx` already show "No checkout link published" to administrators.
- `src/lib/educator/assignments.ts` does not select `checkout_url`.
- `supabase/seed.sql` does not write `checkout_url`. It sets Gardening to instant confirmation, and Gardening is the MPS-ACC-021 `started` fixture.
- `record_program_audit` treats `checkout_url` as a material field.

## 4. Checkout-link discovery (verified 2026-09-19)

**Method.** Headless Chromium (repository Playwright 1.62) loaded `https://homeschoolhaven.org/classes`, and every anchor was read. All eight checkout buttons have `href="#"` and `data-pay-button`, which makes them GoDaddy pay buttons. On click, GoDaddy's script opens an in-page modal iframe at `https://poynt.godaddy.com/checkout/<business-id>/<short-name>?sourceApp=wam.paybutton`. Navigation was logged for every button:

- no HTTP redirect (3xx) occurred on any checkout request;
- the main page URL never changed;
- no popup opened.

Each bare URL, with the `?sourceApp=wam.paybutton` query removed, was then loaded top-level. Each returned HTTP 200 and rendered the same item and price as the modal. `sourceApp=wam.paybutton` is a constant GoDaddy source tag, identical on every button, and it carries no family data. It is dropped because the allowlist forbids query strings.

**Hostnames.** Every destination is `poynt.godaddy.com`, and every path uses Home School Haven's GoDaddy business ID `2bf1b322-d362-4d5d-a4a7-5e5791473f14`. `pay.homeschoolhaven.org` resolves to GoDaddy's paylinks service, a Home School Haven-controlled alias. `https://pay.homeschoolhaven.org/<short-name>` also returns 200, but no button on the approved page uses it, so it is not used as a destination.

| # | Source section | Visible offering | Button | `data-pb-checkout-url-id` | Final destination | Repository program | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | Class cards (no section heading) | Stay & Play Sensory Day | Register & Pay | `2f095262-28a4-4714-a180-d4753fd67175` | `https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/2f095262-28a4-4714-a180-d47` | none | **missing**. No program in the approved offering inventory (DEC-024), so not activated. |
| 2 | Class cards | Haven Days Enrichment | Register & Pay | `0342bb2d-f9c2-4573-a196-943133241098` | `…/0342bb2d-f9c2-4573-a196-943` | `…0002` `haven-days-enrichment` | **exact** |
| 3 | Class cards | Ready Set Prep & Learn | Pay Now | `1232e79c-3492-461d-a305-eb1bafc694c2` | `…/1232e79c-3492-461d-a305-eb1` | `…0009` `ready-set-prep` and `…000a` `ready-set-learn` | **exact, shared**. The checkout page names both classes ("Prep class ages 3/4 9:15 - 11:30 Learn class ages 4/5 11;45 - 2:00"). The archived `…0001` `ready-set-prep-and-learn` is not activated. |
| 4 | Class cards | Ready Set Sensory | PAY NOW | `f5bbc6ae-3bb3-424e-a014-24aa92a26e98` | `…/f5bbc6ae-3bb3-424e-a014-24a` | `…000b` `ready-set-sensory` | **exact** |
| 5 | Class cards | Beginners Crocheting Class | Pay Now | `a8c851d1-9461-426f-924d-7c51374a1a9a` | `…/a8c851d1-9461-426f-924d-7c5` | `…000e` `crochet` | **exact** (checkout item "Crocheting class"). Schedule drift is flagged in §11. |
| 6 | Class cards | Sewing ( EVENING CLASS) | Pay Now | `568b1ef2-952a-499b-878a-5992850c3133` | `…/568b1ef2-952a-499b-878a-599` | `…0005` `sewing` | **exact** (checkout item "Sewing ( evening)") |
| 7 | Check out our Clubs | Gardening Club | PAY NOW | `cd911575-37c3-4e2e-ad66-1b222c943122` | `…/cd911575-37c3-4e2e-ad66-1b2` | `…0006` `gardening` | **exact**. The checkout page shows "Weekly fee $35", which is new evidence for QA-007. No price is changed. |
| 8 | Check out our Clubs | MONTHLY THEMED CLUBS | PAY NOW | `7fa2bfc8-430f-48e3-8ea7-c0111da5a66f` | `…/7fa2bfc8-430f-48e3-8ea7-c01` | `…000d` `monthly-clubs` | **exact** (checkout item "Monthly Clubs") |
| — | Class cards | Beginners Drumming Class ("COMING SOON") | none | — | — | none | **inactive** |
| — | — | Tutoring | none on the page | — | — | `…000c` `tutoring` | **missing**. Stays `null`. |

Result: 8 of the 9 published programs are activated with 7 distinct destinations. Tutoring stays `null`.

## 5. STEP UP: owner decision during planning

**Finding.** None of the eight GoDaddy checkout pages exposes a coupon, promo, discount, or voucher field, including inside the embedded payment frames. Each page offers only price options, tip, card, billing, Google Pay, and Pay. The required sentence, "enter that coupon during checkout", would therefore describe a step the approved checkout does not offer.

**Decision (user, 2026-09-19): "Omit coupon line (Recommended)".** No STEP UP coupon instruction is shown anywhere until Samantha confirms where families use a coupon. GAP-015 stays open, and this evidence is recorded against it. Payment-truth copy stays. As before:

- no STEP UP input, code, or sample is shown;
- nothing writes to `registration_step_up_requests`;
- no STEP UP value is added to the registration payload.

The Slice 2.5 STEP UP schema stays in place. Its deprecation is a recorded future decision.

## 6. Payment and enrollment truth (no new state)

The existing model supports the manual workflow, so there is no migration to the state machine.

| Concept | Representation | Who changes it |
|---|---|---|
| Checkout available | `started` and a non-null `checkout_url` | `family_request_enrollment` or `submit_family_registration` evaluation |
| Checkout opened | **Not recorded.** Navigation only. | nobody |
| Payment unknown or pending verification | `started` ("Awaiting checkout") or `payment_pending` | evaluation; `payment_pending` is displayed but set by no current path |
| Payment verified by manual reconciliation | the administrator sets `confirmed` with an optional note, audited | administrator only |
| Enrollment confirmed | `confirmed` | administrator (or an instant evaluation where approved) |
| Approval pending | `approval_pending` | evaluation |
| Waitlisted | `waitlisted` | evaluation or administrator |
| Payment failed | `payment_failed`, displayed. The approved graph does not let an administrator set it (GAP-ADMIN). | none today |
| Canceled / Blocked | `canceled` / `blocked` | administrator |

Checkout renders only when `mayOfferCheckout(state)` is true, meaning `started`, and a URL exists.

## 7. Changes

**Data.** New migration `supabase/migrations/20260919200000_external_checkout_activation.sql`:

1. `private.is_approved_checkout_url(text)`, immutable. It allows exactly:
   - the existing `^https://pay\.homeschoolhaven\.org(/[A-Za-z0-9._~/-]*)?$`;
   - `^https://poynt\.godaddy\.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/[A-Za-z0-9-]+$`, which is Home School Haven's business path only and not "any GoDaddy URL".
2. `admin_update_program_facts` is re-created with the same signature and body. Only the host check calls the helper, and the message names both forms.
3. A table CHECK, `programs_checkout_url_approved`, so no write path, including service role and seed, stores an unapproved destination.
4. A content update by fixed ID. It sets `checkout_url` only where it is `null` and the row is `published`. That makes it idempotent and never overwrites an administrator's value. `record_program_audit` records each change.

No price, availability, date, capacity, or confirmation mode is touched. Rollback instructions are in the header.

**Code.**

- `src/content/checkout-sources.ts` (new) is the code mirror of §4. `src/content/programs.ts` (the staging catalog) uses it.
- In `src/lib/admin/validation.ts`, the allowlist becomes two exact rules. The `CHECKOUT_HOST` export becomes `CHECKOUT_DESTINATION_HINT` for the admin form's help text.
- `src/components/admin/program-form.tsx` updates its help text and placeholder.
- `src/components/program/checkout-handoff.tsx` changes as follows:
  - it gains a `placement` prop. `"catalog"`, used on the public page, renders no link and explains that checkout opens after registration. `"eligible"` is used only after `mayOfferCheckout`;
  - it gains an optional `studentName`, so accessible names are unique when two children share a program;
  - a visible "opens in a new tab" line and the payment-verification expectation are added;
  - the program name appears in the heading;
  - no STEP UP copy is added.
- `program-action-rail.tsx` uses `placement="catalog"`.
- The enrollment page and registration result use `placement="eligible"` with a program-named heading. The result also gets the sentence "Each program below has its own checkout…", shown when more than one checkout is offered.
- In `src/lib/family/dashboard-state.ts`, the `started` next action becomes truthful ("A registration is waiting on checkout") and links to that enrollment's page.

**Docs.**

- MPS: BETA-CONTENT-IMPORT-INVENTORY (the mapping), the MPS-PROJECT-STATE change and GAP-015 note, and PRODUCT-IMPLEMENTATION.
- MDS: MDS-IMPLEMENTATION, MDS-QA, and MDS-PROJECT-STATE.
- MTS: INTEGRATION-MANIFEST, SECURITY-ARCHITECTURE, IMPLEMENTATION-PLAN, and MTS-PROJECT-STATE.
- REQUIREMENTS-RULES: the checkout-host sentence.
- AGENTS.md changes only if a durable rule changed. The host allowlist is durable, so one line is added.

## 8. Security, privacy, authorization

- Nothing is appended to a checkout URL, and no child or family information reaches GoDaddy.
- `rel="noopener noreferrer"` means no Referer is sent, so the enrollment ID in the page URL is not leaked.
- Opening checkout writes nothing: no server action, no fetch, and no analytics.
- Returning from checkout changes nothing. There is no return route.
- Only `private.is_admin()` callers can change a checkout URL, which is enforced in SQL. Parents, educators, and anonymous callers are refused, and pgTAP asserts this.
- Educators never select `checkout_url`.
- Nothing changes in the RLS policies.
- The public page shows no checkout link, so MPS-REQ-012 evaluation cannot be bypassed from the catalog.

## 9. Responsive and accessibility

- Reuse the Button, Badge, and card tokens; no new visual convention.
- Links are at least 44 px (`size="md"`).
- Accessible names read "Continue to Secure Checkout for {program} ({student}) — opens … in a new tab".
- Each heading ID is unique per enrollment.
- The new-tab indication is visible, and the ExternalLink icon is decorative.
- Status meaning is carried by label and sentence, never by colour alone.
- Validate at 390×844, 768×1024, 1024×768, and 1440×900 with Axe, ARIA snapshots, and screenshots.

## 10. Checks

`npm run format:check`, `lint`, `typecheck`, `test:unit`, `db:reset`, `db:test`, `db:types:check -- --local`, and `db:advisors` (local), plus targeted Playwright (`programs`, `family-enroll`, `family-registration`, `family-dashboard`, `admin-programs`, `authorization`), then `npm run test:e2e` and `npm run build`.

**Pre-existing, recorded at base `5c285ae`:** `db:types:check -- --local` fails on generator formatting and the linked-only `__InternalSupabase` block, not on schema drift. The e2e baseline has known failures (see memory: 34 at `a482e4a`).

**Manual steps.**

1. `npm run db:reset && npm run dev`.
2. Open `/programs/gardening` signed out. Confirm there is no checkout link and that the rail says checkout opens after registration.
3. Sign in as the sample parent and register Gardening. The enrollment page shows "Checkout for Gardening" and a link to `poynt.godaddy.com/checkout/…`. The link opens in a new tab.
4. Reload the page and return to it. The state is still "Awaiting checkout".
5. As an administrator, open `/admin/programs`. Tutoring shows "No checkout link published".
6. Try to save `https://poynt.godaddy.com/checkout/<other-id>/x`. It is refused.
7. Confirm the Gardening enrollment in `/admin/enrollments`. The family now sees "Enrolled", and the audit history shows the actor.

## 11. Gaps and owner decisions left open

- **GAP-015 (open):** where STEP UP coupons are entered. No coupon field exists on the approved checkout.
- **Stay & Play Sensory Day:** a live checkout with no approved program (DEC-024 inventory). Does Samantha want it as a program?
- **Crochet schedule drift:** the live page says Fridays, November 6–27, 2–4 PM. DEC-024 evidence says Mondays in November. Flag only; nothing is changed.
- **Gardening price (QA-007):** the checkout item reads "Weekly fee $35". This is evidence for Samantha to confirm. No price is published yet.
- **Tutoring:** has no online checkout.
- **Fee rules (DEC-033 "open"):** the checkouts show:
  - Haven Days: one-, two-, or three-day monthly options, plus a $100 registration fee as a separate option;
  - Ready Set Sensory: $50 registration fee, $45 weekly, or $180 "pay in 4";
  - Sewing: $20 registration fee, $45 weekly, or $360 in full;
  - Ready Set Prep & Learn: $80 weekly or $320 "pay in 4".

  These are recorded as observed, not adopted as policy.
- The Slice 2.5 STEP UP tables, states, and admin RPCs: future deprecation decision.
- Hosted rollout: the owner runs `supabase db push`, then `npm run db:types:check`.

## 12. Rollback

- Revert the branch.
- On a database where the migration ran, apply the SQL in the migration header in order:
  1. clear the eight values where they still equal the recorded URL;
  2. drop the CHECK;
  3. re-create `admin_update_program_facts` from `20260916000000`;
  4. drop the helper.
- The audit history of the clears remains.

## 13. Results (2026-09-19)

- **Checks:**
  - Format, lint, typecheck, and build: pass.
  - Unit tests: 387/387.
  - `db:test`: 888 pass, including the 34 new tests.
  - `db:advisors`: the same 18 pre-existing findings.
  - `db:types:check -- --local`: shows only the known hosted-template difference.
- **Full e2e sweep:** 637 passed, 43 failed, 1 skipped, and 32 did not run. None of the failures comes from this slice.
  - The following specs failed on the base as well: password-recovery (8), educator-workspace (6), admin-families (6), family-setup (4), auth (4), admin-overview (4), admin-programs (2, the duplicate "External checkout link" label), resources (1), contact (1), and about (1).
  - family-dashboard had 5 failures. Four are screenshots whose session times come from the seed's `now()`. The fifth is the ARIA snapshot, contaminated by announcements that `content-authoring.spec.ts` leaves behind. It passes in isolation.
  - admin-enrollments had 1 failure and 32 tests that did not run. A `supabase db reset` inside the spec hung for 41 minutes (a Docker flake) and was killed. Rerun in isolation, all 33 tests pass.
- **Visual evidence reviewed:**
  - new `enrollment-checkout` baselines at 390, 768, 1024, and 1440;
  - `programs` detail baselines, regenerated because the checkout-rail copy changed;
  - `admin-programs` baselines, regenerated because 8 rows now read "External checkout", with ARIA hand-edited for those rows only.
- **Hosted:** the owner ran `supabase db push` on 2026-09-19.
