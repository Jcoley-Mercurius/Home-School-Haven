# Implementation prompt — Public contact page

Target visual: `mds/references/proposed/public-contact-proposed.png`
Requested by owner, 2026-08-28. Branch: `feat/public-contact`.

## 0. Authority notice (read first)

`mds/references/proposed/README.md` marks this image **Proposed — not approved,
not canonical**, with no MDS-REF ID. It has no design authority. This prompt
treats it as *layout intent* only. Authority for every visual decision remains
`mds/specification/DESIGN-SYSTEM.md`, `mds/tokens/`, and the canonical
references (MDS-REF-004 components, MDS-REF-005 shell/grid, MDS-REF-006 public
hierarchy, MDS-REF-010 public page precedent).

Approving this prompt authorizes building the page. It does **not** promote the
image into `mds/references/assets/` or the reference index — that stays an MDS
governance action for the owner, as it was for MDS-REF-010.

## 1. The problem this page raises (read before approving)

Unlike About and Resources, this image does not draw an empty surface. It draws
a **second inquiry form**, and `/guidance` already implements the approved one
(MPS-REQ-009, MPS-REQ-010) with server-side validation, per-field errors, an
honest `unavailable` outcome, and `tests/e2e/guidance.spec.ts` pinning it.

Building the drawn form as new code would create two public inquiry surfaces
with two validation schemas, two sets of states, and two places to wire the real
destination when one is approved. That is the duplication AGENTS.md §14 and the
REUSE-first component order exist to prevent.

Three specific conflicts between the image and approved state:

1. **Two routes, one flow.** The header draws both a live "Contact" nav item and
   the "Request Guidance" button. Today `guidanceHref = "/guidance"` and
   `primaryNav` has Contact `available: false`.
2. **A fourth request type.** The four cards are Request Guidance, Plan a Visit,
   General Question, Private Assistance. The approved type union is
   `guidance | visit | assistance` (`src/lib/guidance/recorder.ts`), from
   MPS-REQ-009's "general guidance, a visit request, or discounted-class
   assistance" (its fourth path, direct registration, is the program checkout
   handoff and already lives on the program pages). "General Question" has no
   approved type.
3. **A success panel with nothing behind it.** The image draws "Request
   received. We'll be in touch." as a resting state at the bottom of the page.
   `recordGuidanceRequest` returns `unavailable`: there is no authorized
   destination, so no submission can truthfully produce that panel. Rendering it
   unconditionally is exactly the false confirmation MPS-ACC-014 forbids.

### Recommended resolution (what this prompt builds)

**One inquiry surface, at `/contact`, using the existing form.**

- `/contact` ships the drawn composition: hero, the four pathway cards, the
  "We're here for you" reassurance panel, and the inquiry form in the drawn
  two-column layout.
- The form is the **existing** `GuidanceForm` component and the existing
  `submitGuidanceRequest` server action, re-laid-out — not a new form. One
  schema, one recorder, one place to wire the destination.
- `/guidance` becomes a redirect to `/contact` (`redirect()` in a route file),
  so the header CTA, the resources bands, the program action rail, and any link
  already sent to a reviewer keep working. `guidanceHref` becomes `"/contact"`;
  the visible CTA label "Request Guidance" is unchanged.
- The four cards are **in-page selectors**: activating one sets the form's
  request type and moves focus to the form, announcing the change. No card links
  to a route that does not exist (standing owner decision, 2026-08-27; the
  D-R3 precedent from Resources).
- The success panel is built as the `recorded` state of the form and is
  unreachable until a destination is approved. The page keeps the existing,
  truthful "online requests are not open yet" notice above the form, and a
  submission still returns the `unavailable` state (MPS-ACC-014).

Alternatives the owner may prefer, each a smaller edit to this prompt:

- **B — Keep both routes.** `/contact` renders the composition and `/guidance`
  stays as it is today. Two public surfaces host the same form; the "Request
  Guidance" card links to `/guidance`. More faithful to the drawn header, but it
  leaves two inquiry pages to keep consistent.
- **C — Defer.** Leave Contact `available: false`. Nothing is built.

## 2. Goal and scope

Ship `/contact` as a public, statically rendered page composed of: the contact
hero, four request-pathway cards, the "We're here for you" panel, the inquiry
form in the drawn two-column layout with its request-type select, and the
already-approved not-open-yet notice. Make Contact a live destination in the
primary navigation and footer, and redirect `/guidance` to it.

Out of scope: any real submission destination (Supabase table, Resend send,
recipient address); any change to `recordGuidanceRequest`'s outcome; Turnstile
(MTS stages it before public activation, not for sanitized review); any
authenticated surface; any child or student data field; analytics.

## 3. Applicable IDs

- MPS-REQ-009 (choose guidance, a visit, or assistance from the public
  experience), MPS-REQ-010 (record each inquiry with type, contact information,
  time, state, and an authorized owner; assistance stays private),
  MPS-REQ-020 / MPS-REQ-021 (consistency; never present invented state).
- MPS-ACC-012 (confirmation only when a record is created once), MPS-ACC-013
  (assistance requests not disclosed), MPS-ACC-014 (never claim success;
  offer retry plus an alternate contact path).
- MPS-RUL-004 (no promised outcome for assistance), MPS-RUL-006 (no child data
  in a public inquiry).
- MPS-WFL-001, MPS-WFL-004.
- DESIGN-SYSTEM.md §2 colour, §3 type roles, §4 spacing/shape/elevation,
  §5 iconography (Lucide 1.75 px; no generated imagery), §6 component contract
  (card, input, select, textarea, checkbox, button, text link), §7 containers
  and public shell, §8 responsive behaviour, §10 accessibility.
- MTS: no new integration, no data read, no cookie, no environment variable.

## 4. Content truth

| Group | Source | Use |
|---|---|---|
| Hero eyebrow, heading, summary; the four card titles and descriptions; the "We're here for you" panel copy; field labels and helper text | Owner-approved image copy, as for About and Resources | Rendered verbatim |
| Phone number, address | `mps/BETA-CONTENT-IMPORT-INVENTORY.md` via `contact` in `src/content/foundation-content.ts` | Unchanged |
| Not-open-yet notice, submission outcomes | Existing approved implementation | Unchanged |

`src/content/contact.ts` holds the page strings with a
`source: "owner-approved-contact-reference"` tag, mirroring `about.ts` and
`resources.ts`. No price, schedule, capacity, educator, enrollment state, or
partner name appears. No email address is published (none is in the inventory).

Deviations from the image, each with its reason:

- **D-C1 — The decorative photograph and botanical illustration are omitted.**
  The image bleeds a styled vase photo into the hero and a painted branch into
  the reassurance panel. No such asset exists; DESIGN-SYSTEM.md §5 forbids
  generating one, and `public/placeholder/` is owner-authorized for the home and
  program surfaces only. The Lucide leaf mark carries the role, as on About
  (D-A5) and Resources (D-R1).
- **D-C2 — The footer is the existing approved `SiteFooter`.** The image draws a
  different footer (accessibility glyph, tagline rule, heart mark). That is a
  separate approved-design change (same reasoning as D-A7, D-C5, D-R2).
- **D-C3 — The four cards select a request type in place** rather than linking
  to four routes that do not exist. §1 above.
- **D-C4 — The success panel is a submission state, not a resting section.**
  §1 above; MPS-ACC-014.
- **D-C5 — The message counter shows the real server limit.** The image draws
  `0 / 1000`; the approved schema allows 2000 (`src/app/guidance/actions.ts`).
  The counter renders the schema's limit so the two cannot disagree; changing
  the limit itself would be a product change, not a layout one.
- **D-C6 — The request type stays a labelled control, and the assistance notice
  stays.** The image replaces the radio group with a "What can we help with?"
  select; that is adopted. The existing private-assistance explanation
  (MPS-RUL-004, DO-DONT.md "Trust states") is kept beneath it — the image drops
  it, and dropping it would promise nothing and explain nothing about a
  policy-sensitive path.
- **D-C7 — The optional program select is kept.** The image omits it; it exists
  today, is used by the program action rail's "ask about this program" path, and
  removing it would lose recorded context MPS-REQ-010 benefits from.
- **D-C8 — "View tips" is a plain expandable, not an external link.** The image
  draws it with an external-link glyph; no such destination exists. It becomes a
  `<details>`-style disclosure of the same guidance, or is omitted if the owner
  prefers (see §12).
- **D-C9 — A breadcrumb trail (Home / Contact) is added,** which the image does
  not draw, matching every other public page and `public-shell.spec.ts`.

### Open product decision — the consent checkbox and the fourth type

Two items in the image are product decisions, not layout, and are called out in
§12 for the owner rather than decided here:

- **"Yes, you may contact me about my inquiry."** Recorded consent is
  policy-sensitive (AGENTS.md §10: consent decisions remain Samantha's). The
  recommendation is to build it as a required, server-validated acknowledgement
  that carries no new personal data and is not stored anywhere until a
  destination exists.
- **"General Question"** requires a fourth type, `question`, in the approved
  union. The recommendation is to add it; the alternative is to drop that card
  to three and keep the union as approved.

## 5. Repository evidence inspected

- `src/app/guidance/{page,actions,form-state}.ts(x)`,
  `src/components/guidance/guidance-form.tsx`, `src/lib/guidance/recorder.ts` —
  the approved inquiry flow, its states, and the single destination boundary.
- `src/app/resources/page.tsx`, `src/content/resources.ts`,
  `prompts/public-resources-page.md` — the proposed-image precedent, the
  content-provenance pattern, and the deviation-recording convention.
- `src/app/about/page.tsx`, `src/content/about.ts`.
- `src/content/foundation-content.ts` — `primaryNav` (Contact `available:
  false`), `guidanceHref`, `accountNav`, `contact`.
- `src/components/layout/{site-header,site-footer,breadcrumbs,skip-link}.tsx`.
- `src/components/ui/{card,button,input,textarea,select,checkbox,field,text-link}.tsx`
  — REUSE targets; `Checkbox` and `Select` exist and are unused by this flow so
  far.
- `src/components/program/program-action-rail.tsx` — an existing consumer of
  `guidanceHref`.
- `tests/e2e/{guidance,resources,about,public-shell}.spec.ts` — Playwright, axe,
  ARIA-snapshot, and viewport conventions.
- `package.json` — check commands (§10).

## 6. Files expected

New:
- `src/content/contact.ts` — hero copy, the four pathways (id, title,
  description, icon key, tone), the reassurance panel, the form helper strings.
- `src/app/contact/page.tsx` — static page: shell, hero, pathway cards,
  reassurance panel, form region.
- `src/components/contact/contact-pathways.tsx` — `"use client"`; the four cards
  as type selectors, wired to the form's type control with focus movement and a
  polite announcement.
- `tests/e2e/contact.spec.ts` — render, headings, axe, ARIA snapshot, keyboard,
  target size, pathway selection, the not-open-yet notice, the truthful
  `unavailable` outcome, screenshots at 1440 / 1280 / 768 / 390.

Changed:
- `src/components/guidance/guidance-form.tsx` — request type moves from the
  radio fieldset to the drawn labelled select; the character counter is added;
  the consent acknowledgement is added (pending §12); the layout becomes the
  drawn two-column grid at `lg`. States and validation are untouched.
- `src/app/guidance/{actions.ts,form-state.ts}`, `src/lib/guidance/recorder.ts`
  — move to `src/app/contact/` alongside the page, with the `question` type and
  the consent field added (pending §12). Behaviour otherwise unchanged.
- `src/app/guidance/page.tsx` — replaced by a redirect to `/contact`.
- `src/content/foundation-content.ts` — Contact `available: true`;
  `guidanceHref = "/contact"`.
- `tests/e2e/guidance.spec.ts` — retargeted to `/contact`, plus a redirect
  assertion.
- Existing screenshot baselines for public pages whose header and footer now
  show one more live nav item, re-recorded and diffed to confirm the nav item is
  the only change.

No schema, migration, environment, dependency, or configuration change.

## 7. Design and interaction requirements

- One `h1`; sections use `h2` with `aria-labelledby`; pathway cards are `h3`.
- All colour, type, spacing, radius, elevation from `--hsh-*` tokens; icons
  Lucide at `strokeWidth={1.75}`; the four pathway marks reuse the existing
  glyph surface/ink pairs (neutral / gold-tint / coral-tint / gold) already used
  on home, programs, about, and resources.
- Hero: copy left; the decorative image area of the reference is left empty
  (D-C1) and the copy keeps the drawn measure.
- Pathways: 4-up from `lg`, 2-up at `sm`, 1-up below; each card is a single
  button-role target ≥ 44 px with a pressed state exposed via `aria-pressed`
  and reflected by more than colour.
- Form region: reassurance panel left (5 of 12), form right (7 of 12) from `lg`,
  stacked below, panel first.
- Form fields: two-column pairs from `md` (name/email, phone/type), message full
  width; every control labelled visibly, never placeholder-only; the counter is
  a polite live region that does not announce on every keystroke.
- Submission states keep their existing treatment: assertive announcement,
  per-field errors, typing preserved, `unavailable` shown with the phone path.
- 44 px minimum targets; visible focus using `--hsh-focus`; reduced motion
  respected; no meaning by colour alone; no horizontal scroll at any viewport.

## 8. Security, privacy, data handling

Public route. No authentication, no `cookies()`, no Supabase read, no storage
access, no analytics, no new logging. Adult contact details only — no child or
student field is added (MPS-RUL-006). Validation stays server-side in the
existing action; the client adds no native constraint, so the server boundary is
always exercised. Submitted values are still never logged, never placed in a
URL, and echoed only back to the sender's own form. The recorder still returns
`unavailable`, so nothing is transmitted or persisted anywhere. The consent
acknowledgement, if approved, is validated and discarded with the rest until a
destination exists; it is not a marketing opt-in and no list is created.

## 9. Rollback

Additive plus one route move. Reverting means deleting the new page, content,
component, and spec; restoring `src/app/guidance/page.tsx` and the action,
form-state, and recorder module paths; flipping Contact back to
`available: false` and `guidanceHref` back to `/guidance`; and restoring the
re-recorded baselines. No data or schema state to unwind.

## 10. Checks to run

`npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:unit`, `npm run build`, then
`npx playwright test tests/e2e/contact.spec.ts tests/e2e/guidance.spec.ts
tests/e2e/public-shell.spec.ts tests/e2e/home.spec.ts tests/e2e/about.spec.ts
tests/e2e/resources.spec.ts tests/e2e/programs.spec.ts` (the nav flip and the
`guidanceHref` change touch every public baseline), and manual review of the
render against the proposed image and the approved tokens at 1440 / 1280 / 768 /
390.

## 11. Manual test steps (WSL/Ubuntu bash)

```bash
npm run dev
```
1. Open http://localhost:3000/contact — hero, four pathway cards, reassurance
   panel, and form render in that order.
2. Confirm the "online requests are not open yet" notice is visible above the
   form, before anything is typed.
3. Activate "Plan a Visit" — the request type control changes to the visit
   option, focus moves into the form, the card shows a pressed state, and the
   change is announced.
4. Submit empty — per-field errors appear, the summary says the request was not
   sent, and focus/announcement behaviour matches `/guidance` today.
5. Submit a valid request — the truthful "your request was not sent" state
   appears with the phone path, every typed value survives, and no success
   panel is shown.
6. Type in the message field — the counter tracks and does not announce on every
   keystroke; exceeding the limit is reported by the server, not silently
   truncated.
7. Open http://localhost:3000/guidance — it redirects to `/contact`.
8. Tab through: skip link → header → pathway cards → every field → consent →
   submit. Focus is always visible; nothing is pointer-only.
9. Resize to 768 and 390 px: columns stack, nothing scrolls horizontally, all
   targets stay ≥ 44 px.
10. Confirm Contact is live in the desktop header, in the mobile menu, and in
    the footer, and that the header "Request Guidance" button reaches `/contact`.
11. With `prefers-reduced-motion: reduce`, confirm nothing animates.

## 12. Owner decisions, 2026-08-28

Taken at approval:

1. **A-1 resolved: resolution A.** One inquiry surface at `/contact`; `/guidance`
   redirects to it; `guidanceHref` becomes `/contact`. The existing form, schema,
   and recorder are reused, not duplicated.
2. **A-2 resolved: add the `question` type.** The approved union becomes
   `guidance | question | visit | assistance`, so the drawn "General Question"
   card has a type to record under MPS-REQ-010. All four cards are built.
3. **A-3 resolved: the consent checkbox is NOT built.** Recorded consent stays
   Samantha's decision (AGENTS.md §10), so the drawn "Yes, you may contact me
   about my inquiry" control is omitted rather than shipped ahead of it. The
   existing reply-use statement under the email field carries the honest
   version: the address is used only to answer this request.
4. **A-5 resolved: "View tips" is NOT built.** No destination and no approved
   tips content exist; the existing per-field helper text stays.
5. **A-4 stands:** the image's copy is Home School Haven's own words and is
   rendered verbatim, as for About and Resources.
6. **A-6 stands:** `public-contact-proposed.png` is not promoted into
   `mds/references/assets/` or the reference index by this work.

The original wording of each item, for the record:

- **A-1 — Route shape.** Recommendation A in §1: one surface at `/contact`, with
  `/guidance` redirecting to it. Alternative B keeps both.
- **A-2 — The fourth request type.** Add `question` to the approved
  `guidance | visit | assistance` union so the drawn "General Question" card has
  a type to record (MPS-REQ-010 records a type), or drop that card.
- **A-3 — The consent acknowledgement.** Build the drawn checkbox as a required
  acknowledgement, or omit it until Samantha's consent decisions are recorded.
- **A-4 — Image copy.** As for About and Resources: the image's wording is
  treated as Home School Haven's own words and rendered verbatim.
- **A-5 — "View tips".** Build as an in-page disclosure (D-C8) or omit.
- **A-6 — Promotion.** `public-contact-proposed.png` is **not** promoted into
  `mds/references/assets/` or the reference index by this work.

### Still open after this page

- Where an inquiry actually goes. Until a destination is approved and
  configured, `recordGuidanceRequest` returns `unavailable` and the page says so
  — the success panel this reference draws stays unreachable by design.

## 13. As built (2026-08-28)

Owner decisions taken at approval are recorded in §12: resolution **A** (one
inquiry surface at `/contact`, `/guidance` redirecting to it) and **add the
`question` type**. The consent checkbox and "View tips" were **not** approved
and are not built.

Implemented as specified, with these refinements made while comparing the render
with the reference:

- **D-C10 — The pathway card is a card with a button inside it, not a button.**
  It was first built as one large button per card. A heading is flow content and
  cannot legally live inside a `button`, and the drawn cards each carry an `h3`.
  The structure now matches the Resources category cards: `Card` + `h3` +
  description + a "Choose — <title>" / "Selected — <title>" action.
- **D-C11 — The reassurance panel sizes to its content** (`lg:items-start`)
  rather than stretching to the form's height. In the reference the botanical
  illustration fills that column; with the illustration omitted (D-C1) a
  stretched panel is several hundred pixels of empty surface.
- **D-C14 — The lone decorative leaf in the reassurance panel was removed.**
  It was added where the reference draws the botanical illustration, and it read
  as a floating orphan once the panel stopped stretching — the same judgement
  made on Resources. D-C1 already says the illustrations are omitted.
- **D-C12 — "Reach us directly" is carried over from `/guidance`.** The
  reference does not draw it, but `/contact` replaces the page that published
  the approved address and phone, and losing them from the page a visitor lands
  on to make contact would be a content regression. The strings are unchanged
  inventory facts.
- **D-C13 — "Section pages open later in this review" is removed** from the
  mobile menu and the footer. Every primary destination is now live, so the
  sentence had become false. The disabled-item treatment in `NavLabel` and the
  footer list is untouched and still applies to any future item.

`src/lib/guidance/recorder.ts`, `src/app/guidance/{actions,form-state}.ts`, and
`src/components/guidance/guidance-form.tsx` moved to their `contact`
equivalents so the whole flow lives with the page that hosts it;
`tests/e2e/guidance.spec.ts` was replaced by `tests/e2e/contact.spec.ts`, which
keeps every rule the old spec pinned and adds the page, pathway, redirect, and
counter checks. The exported symbol names (`GuidanceRequest`,
`submitGuidanceRequest`, `guidanceHref`) keep the MPS-REQ-009 "Request Guidance"
vocabulary, which is still the visible CTA label.

Checks run and their real results are recorded in the completion report.
