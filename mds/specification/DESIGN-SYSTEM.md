# Home School Haven Mercurius Design System

**Version:** 1.1\
**Status:** Approved and locked  
**Active gate:** Implementation readiness  
**Product source:** Current approved Home School Haven MPS state (unversioned draft, Library version 11)  
**Visual method:** GPT Image 2.2 reference workflow, reconciled to approved state

## Purpose

Home School Haven MDS v1.1 defines the visual language, responsive composition, components, interaction states, and design-accessibility behavior for a connected Christ-centered ecosystem spanning the public website and family, educator, and administrator experiences.

The design direction is a **warm boutique learning community**. It preserves and thoughtfully refines the existing identity, while integrating faith in a balanced and natural way.

This specification is authoritative for design. MPS remains authoritative for product behavior and policy. MTS will be authoritative for technology, services, security, data boundaries, and operations.

## 1. Identity

### Canonical logo

Use the supplied “Home School Haven of SWFL” logo as the canonical identity asset.

Preserve:

- handwritten Homeschool wordmark;
- Haven of SWFL descriptor;
- house line art;
- coral heart;
- recognizable spacing and overall composition.

Permitted refinement is limited to production cleanup, spacing, lockups, and small-size legibility. Do not redraw the logo with generative image tools. Do not invent logo variants.

### Brand character

- Warm, boutique, trusted, calm, creative, and relationship-centered.
- Welcoming to children without becoming childish.
- Reassuring to parents and organized for educators.
- Christ-centered through character, values, language, imagery, and service.

## 2. Color system

### Brand palette

| Token | Value | Role |
|---|---:|---|
| Forest 700 | `#31483F` | Hover, active, high-emphasis surfaces |
| Forest 600 | `#3F5C50` | Primary actions, navigation emphasis, brand structure |
| Forest 500 | `#557467` | Botanical emphasis and illustration detail |
| Forest 100 | `#DDE7E1` | Selected and supportive surfaces |
| Forest 50 | `#EFF4F1` | Quiet botanical background |
| Coral 700 | `#A84248` | Accessible coral text, focus, critical accent |
| Logo Coral | `#ED7D7C` | Logo heart and decorative warmth |
| Coral 100 | `#F9E2E1` | Warm highlight surface |
| Gold 700 | `#7A5A20` | Accessible gold-toned text or icon emphasis |
| Heritage Gold | `#B38A42` | Restrained decorative highlight |
| Gold 100 | `#EFE3C8` | Warm highlight panel |

### Neutral, surface, and semantic palette

| Token | Value | Role |
|---|---:|---|
| Ink 900 | `#1F2522` | Primary text |
| Logo Ink | `#292929` | Canonical logo linework |
| Ink 700 | `#4F5954` | Secondary text |
| Ink 600 | `#626B67` | Muted accessible text |
| Neutral 400 | `#9AA29E` | Disabled content and quiet icons |
| Neutral 300 | `#C9CEC9` | Strong borders and dividers |
| Neutral 200 | `#E2E5E2` | Default borders and dividers |
| Logo Ivory | `#F4F1EC` | Page canvas and logo-compatible surface |
| Warm White | `#FBF9F6` | Elevated warm surface |
| White | `#FFFFFF` | High-clarity content surface |
| Success | `#2F6B4F` | Confirmed and successful states |
| Warning | `#8A5A12` | Attention and pending states |
| Error | `#A43C3C` | Error and blocked states |
| Information | `#356A85` | Informational states |

Forest 600 is the principal interactive color. Logo Coral and Heritage Gold are decorative on light surfaces; their 700 variants carry readable meaning. No state may rely on color alone.

## 3. Typography

### Families

- **Display and editorial:** Lora, fallback `Georgia, "Times New Roman", serif`.
- **Body and UI:** Manrope, fallback `Inter, Arial, sans-serif`.
- **Monospace:** not defined for product UI.

### Type roles

| Role | Desktop / mobile | Line height | Family / weight |
|---|---|---:|---|
| Display XL | 56 / 40 px | 1.14 | Lora 600 |
| Display LG | 44 / 34 px | 1.18 | Lora 600 |
| Heading 1 | 40 / 32 px | 1.20 | Lora 600 |
| Heading 2 | 32 / 28 px | 1.25 | Lora 600 |
| Heading 3 | 24 / 24 px | 1.33 | Lora 600 |
| Heading 4 | 20 / 20 px | 1.40 | Manrope 700 |
| Body Large | 18 / 18 px | 1.67 | Manrope 400 |
| Body | 16 / 16 px | 1.625 | Manrope 400 |
| Body Small | 14 / 14 px | 1.57 | Manrope 400 |
| Label | 14 / 14 px | 1.43 | Manrope 600 |
| Caption | 12 / 12 px | 1.50 | Manrope 500 |

Use Lora for storytelling, titles, and warm editorial moments. Use Manrope for navigation, forms, buttons, dashboards, tables, schedules, labels, and sustained reading.

## 4. Spacing, shape, and elevation

The base spacing unit is 4 px. Approved scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96 px.

- Page gutters: 32 px desktop, 24 px tablet, 16 px mobile.
- Section rhythm: 80 px desktop, 64 px tablet, 48 px mobile.
- Common component spacing: 8 px compact, 16 px standard, 24 px comfortable, 32 px grouped.
- Radii: 6 px small, 10 px controls, 14 px cards, 20 px feature surfaces, 999 px pills.
- Borders: soft 1 px neutral structure; focus uses a 2 px Coral 700 ring with 2 px offset.
- Shadows: subtle `0 1px 2px rgba(31,37,34,.06)`; card `0 8px 24px rgba(31,37,34,.08)`; overlay `0 20px 48px rgba(31,37,34,.16)`.

Use shadows only to communicate hierarchy or layering. Avoid heavy boxes and excessive compartmentalization.

## 5. Iconography and imagery

Icons use a warm outlined language with a 1.75 px rounded stroke and simple human geometry. Default sizes are 16, 20, 24, and 32 px. The implementation library is an MTS decision; the treatment above is authoritative.

Icons support labels and never replace critical enrollment, payment, consent, privacy, or assistance language.

Imagery should feel natural, candid, warm, and learning-centered. Generated imagery establishes art direction only and must not be represented as a real student, family, educator, or approved production photograph.

## 6. Core component contract

All applicable components include default, hover, focus, active or selected, disabled, loading, success, warning, error, and empty states where meaningful. Reuse order is **REUSE → COMPOSE → EXTEND → CREATE**.

### Primitives

- Buttons: primary, secondary, quiet, text, destructive; 36, 44, and 52 px heights.
- Icon buttons: 44 or 48 px; accessible name required.
- Inputs, textarea, select, checkbox, radio, search, and optional immediate-setting switch.
- Badges/tags, explicit status indicators, step/bar progress, cards, tabs, alerts, dialogs, tables, and navigation.

### Project components

- Program card: catalog, featured, compact, enrolled; truthful verified content only.
- Enrollment state: open, limited, waitlist, pending review, awaiting external payment, payment pending verification, enrolled, not confirmed, closed, cancelled.
- Payment handoff: external checkout notice, return pending, status unknown.
- Consent state: required, accepted, renewal required, unavailable, blocked. Acceptance method is either a **signature** (typed name, for the liability waiver and Code of Conduct) or an **acknowledgment** (a checkbox with no signature, for the Parent Handbook). The two are never visually merged (v1.2, MDS-DEC-023).
- STEP UP review state (v1.2): pending verification, needs information, verified, declined, canceled. Uses the enrollment-state badge and inline-panel sizes. It is never shown as payment, a discount, or enrollment. **On hold (v1.2.1, MDS-DEC-024):** STEP UP is a coupon applied at the end of checkout (MPS DEC-033), so registration does not render this state. The checkout slice decides whether it is kept, changed, or retired.
- Assistance request: private, dignified, manually reviewed, no promised outcome.
- Family student selector: parent-controlled and minimum-information.
- Schedule item, announcement, learning resource, empty state, and skeleton.
- Content Builder: approved visual direction for the **future LMS only**.

### Trust-state rules

- External checkout is never successful payment.
- Payment activity is never confirmed enrollment without an authoritative enrollment outcome.
- Waitlist is never enrollment.
- Missing verified program facts remain unset or use “Contact for details.”
- Consent requires owner-approved policy content and an explicit acceptance state.
- STEP UP is never shown as payment, a discount, or enrollment. Enrollment is shown only from the enrollment state.

## 7. Layout and composition

### Containers

| Context | Maximum width |
|---|---:|
| Public standard | 1200 px |
| Public wide | 1280 px |
| Portal standard | 1280 px |
| Operations wide | 1440 px |
| Reading | 720 px |

### Grid and navigation

- Desktop: 12 columns, 24 px gap.
- Tablet: 8 columns, 20 px gap.
- Mobile: 4 columns, 16 px gap.
- Public desktop header: 72 px sticky.
- Portal top bar: 64 px with 264 px expanded sidebar.
- Tablet portal: 72 px accessible navigation rail.
- Mobile portal: 60 px header plus at most five primary bottom-navigation destinations; secondary destinations move to account or More.

### Approved page shells

- Public home: editorial hero, value band, featured programs, process, community story, guidance CTA, footer.
- Catalog: heading/search, desktop filter rail, responsive program results, guidance pathway.
- Program detail: identity and verified facts, long-form content, sticky status/action rail, related programs.
- Family dashboard: family/student context, next action, enrollments, schedule, announcements, resources.
- Educator workspace: assigned programs, schedule, roster access, announcements, resources, scoped actions.
- Admin operations: operational overview, programs, enrollments, families, educators, filters, tables, and detail drawers.
- Authentication: centered 440 px account panel with brand, help, and privacy context.

## 8. Responsive behavior

Breakpoints:

- Mobile: 0–639 px.
- Tablet: 640–1023 px.
- Desktop: 1024–1439 px.
- Wide: 1440 px and above.

Responsive implementation changes composition rather than shrinking desktop:

- Program grid: three columns desktop/wide, two tablet, one mobile.
- Detail action rail becomes an inline priority panel below 1024 px.
- Dashboard grids become one prioritized mobile feed.
- Catalog filters become an accessible drawer on tablet/mobile.
- Tables become labeled cards when column meaning cannot be preserved.
- Required trust and privacy meaning is never hidden.
- Body copy remains 16 px with readable line length.
- Touch targets remain at least 44×44 px with at least 8 px separation.

## 9. Page and interaction patterns

Required patterns: landing, dashboard, search/results, detail, forms, authentication, empty, error, loading, program discovery, enrollment handoff, waitlist, consent, assistance request, and admin operations.

### 9.1 Family registration pattern (v1.2, MDS-DEC-023)

It resolves MDS-GAP-010 at the specification level. It is composed from `forms`, `consent`, `enrollment_handoff`, `consent_state`, `enrollment_state`, and `payment_handoff`, with no new token, color, type role, or visual convention. No canonical visual reference exists yet, so this written pattern governs, and rendered validation belongs to the registration UI slice.

**Structure.** The pattern is one route with one final atomic submission, but not one long screen. The sections run in a fixed, family-first order:

1. Parent or guardian contact information.
2. Emergency contacts.
3. Approved pickup persons.
4. Children, as repeating child cards.
5. Per-child program and attendance selections, inside each child card.
6. External-checkout handoff, per child. STEP UP is not part of registration; it belongs to checkout (MPS DEC-033).
7. Documents, media permission, acknowledgments, and signature.
8. Review and submit.

Multi-step progress (`forms`: “progress when multi-step”) may present sections 1–8 as steps. Moving between steps never submits anything, and nothing is recorded until section 8.

**Contacts.**

- The guardian phone is required.
- At least one emergency contact and one approved pickup person are required.
- Each list offers an “Add another” text action, up to its limit.
- Removing an entry is a quiet destructive action with an accessible name that includes the person’s position, for example “Remove emergency contact 2”.

**Child cards.**

- Each card is a bordered card using the existing card, radius, and spacing tokens, with the child’s preferred name (or “New child”) as its heading.
- Cards may be collapsed. A collapsed card shows a one-line summary and, when relevant, its error count (“2 items need attention”).
- The expand control is a 44 px button with `aria-expanded` and `aria-controls`.
- “Add another child” is a secondary button after the last card, up to 10 children. Removing a card asks for confirmation.

**Health questions.**

- There are three explicit Yes/No radio groups: allergies, medical needs, and accommodation needs.
- Neither option is preselected, and a blank is an unanswered error, never “No”.
- The details textarea appears only after Yes. It is inserted directly after its radio group, linked by `aria-controls`, and announced politely.
- Switching back to No hides the textarea and excludes it from submission. The typed text is kept in memory only until the page is left, so an accidental toggle is recoverable.

**Attendance, per selection.**

- A fixed-day program shows its configured day or days as read-only text (for example “Meets Tuesday and Thursday”) with no control.
- Haven Days asks for a plan first (a one-, two-, or three-day radio group), then shows Tuesday, Wednesday, and Thursday as checkboxes. The helper text states the count (“Choose 2 days”).
- Tutoring shows its available days as checkboxes, with “Choose at least one day”.
- The server remains the authority. A mismatch it reports is shown on the selection, never silently corrected.

**Checkout handoff, per child.**

- Each child shows the existing `payment_handoff` external-checkout notice.
- STEP UP is not shown in registration. It is a scholarship coupon applied at the end of checkout (MPS DEC-033, v1.2.1, MDS-DEC-024). Its presentation is designed in the checkout slice, which may reuse, change, or retire `step_up_review_state`.

**Documents, permissions, and signature.**

- Each document is a `consent_state` panel showing its name and version.
- The waiver and Code of Conduct take a typed-name signature field. The Parent Handbook takes an acknowledgment checkbox and has no signature field.
- The signature and the acknowledgments are separate controls, never one “I agree to everything” checkbox.
- Unapproved policy language stays in the `consent_state` *unavailable* or *blocked* variant. When a newly published version supersedes one already accepted, the *renewal_required* variant is used.
- Media permission is its own fieldset, placed after the documents and before the signature. It is headed by the approved question, “Do you give Home School Haven permission to photograph or record your child and use those photos or videos for educational and promotional purposes?”, with the radios “Yes, I give permission.” and “No, I do not give permission.” Neither is preselected. The supporting copy reads “Choosing No will not affect your child’s registration eligibility.” Both options have the same visual weight. The fieldset is not active for real families until approved (MPS DEC-030).

**Review and submit.**

- The review section is a read-only summary grouped by section, each group with an “Edit” text link back to it.
- There is one primary “Submit registration” button.

**States.**

- *Loading:* a layout-preserving skeleton while programs, attendance rules, and document versions load. While submitting, the primary button shows a spinner and disables itself (`aria-busy`), and a polite status reads “Submitting registration…”.
- *Empty:* with no children yet, the children section shows the `empty` pattern with one action, “Add a child”.
- *Validation error:* all entered values are preserved. An error summary (a `role="alert"` region) appears at the top of the current step and lists each problem as a link. Focus moves to the summary heading. Activating a link expands any collapsed child card and moves focus to the field. Each field shows its message inline via `aria-describedby`.
- *Blocked outcome* (for example program full, closed, unavailable, attendance not configured, or document version changed): the `error` pattern names the affected child and program and preserves every value. For a changed document version it shows the new version for acceptance.
- *Network failure or timeout:* plain-language “Nothing was recorded” reassurance and a “Try again” action. The retry reuses the same attempt key, so a retry can never create a second registration. It is never presented as success.
- *Success:* a confirmation listing each child’s enrollment state (from `enrollment_state`) and, per child, the external-checkout handoff.

**Responsive.**

- Desktop and wide: the form spans 8 of 12 columns, and a 4-column sticky review rail summarizes progress.
- Below 1024 px the rail becomes the inline review section at the end, as the detail action rail does (§8).
- Tablet and mobile are one column. Child cards default to collapsed after the first, and every control keeps a 44 px target.

**Keyboard and screen reader.**

- Everything is operable by keyboard in visual order.
- Radio groups and checkboxes use `fieldset` and `legend`.
- Step changes move focus to the new step heading and announce “Step N of 8: <name>”.
- Added and removed entries announce politely.
- Reduced motion disables card expand animation.

The educator Content Studio is optional future-platform scope. Its approved reference may guide later MPS evolution but grants no Foundation Release permissions.

## 10. Accessibility

Target: **WCAG 2.2 AA**.

- 4.5:1 minimum contrast for normal text; 3:1 for large text and meaningful non-text UI.
- Visible 2 px Coral 700 focus ring with 2 px offset.
- Full keyboard operation for navigation, dialogs, forms, enrollment, and dashboards.
- Semantic headings, landmarks, labels, lists, tables, buttons, links, and form associations.
- Screen-reader announcement of validation, loading, success, pending, blocked, waitlist, handoff, and confirmation changes.
- Respect `prefers-reduced-motion`; motion is never required for meaning.
- Meaningful imagery receives useful alternatives; decoration receives empty alternatives.

## 11. Canonical visual references

The approved reference set includes:

1. Home School Haven design foundations sheet.
2. Proposed component library visual reference.
3. Home School Haven Navigation Blueprint.
4. Home School Haven homepage preview.
5. Home school dashboard with pending payment warning.
6. Home School Haven course builder dashboard — future platform.
7. Home School Haven admin dashboard — Foundation Release.
8. Home School Haven public calendar — Foundation Release.

The state and this written specification outrank generated imagery if a conflict exists. Static references establish only what they clearly show; they do not define unseen states or technical architecture.

## 12. Release and authority boundaries

- Foundation Release may use current authorized website program content and the existing program-specific external checkout procedure.
- Sample or sanitized family/student data may be used for private beta design and validation.
- Real-family activation remains blocked pending approved child-data, consent, retention, and deletion policy.
- Automated financial-policy behavior remains blocked pending authoritative pricing, scholarship, discount, refund, cancellation, credit, and transfer rules.
- Full educator course authoring belongs to a future platform release.

## 13. Change control

MDS v1.2 is locked. v1.2 (2026-09-19) is a backward-compatible pattern addition: the family registration pattern in §9.1, the STEP UP review state, and consent-state acceptance methods (MDS-DEC-023, MDS-CHG-012). v1.2.1 (2026-09-19) removes STEP UP from the registration pattern and puts the STEP UP review state on hold for the checkout slice, following MPS DEC-033 (MDS-DEC-024, MDS-CHG-013). It adds nothing visual. A clarification with no intended behavior change is a patch. A backward-compatible token, component, pattern, or state addition is a minor release. A foundational or breaking change is a major release.

No coding agent may redesign, modernize, embellish, simplify, or “improve” this system without explicit approval and state propagation.
