# Home School Haven MDS QA Protocol

**MDS version:** 1.0  
**Status:** Approved and current  
**Compliance:** Not yet run; implementation does not exist in the inspected workspace  
**Accessibility target:** WCAG 2.2 AA

## Evidence rule

Never report a pass without running the stated check and retaining meaningful evidence. Do not claim pixel-perfect, exact, or identical unless a real visual comparison supports that claim.

Overall results are `PASS`, `PASS WITH APPROVED EXCEPTIONS`, `REVIEW REQUIRED`, or `FAIL`.

## Gate 1 — Foundation Compliance

Verify:

- approved palette and semantic aliases are implemented;
- Logo Coral and Heritage Gold are not used as normal-size text on light surfaces;
- Lora and Manrope load correctly at approved weights with valid fallbacks;
- approved type roles, spacing scale, radii, borders, shadows, and elevations are used;
- the supplied logo is used without generative redrawing or invented variants;
- icon treatment is warm, rounded, outlined, and consistently sized;
- reusable components cover required variants, sizes, and states;
- focus treatment is visible and consistent;
- hardcoded values do not bypass existing approved tokens;
- pages reuse shared components instead of duplicating conventions.

Fail Gate 1 for unauthorized foundational values, inaccessible text-color use, missing required states, unapproved logo treatment, or systematic component duplication.

## Gate 2 — Visual Fidelity

For each implemented reference screen, compare the rendered product with the relevant canonical reference and written specification.

Verify:

- page structure, content width, grid, gutter, and alignment;
- section rhythm, whitespace, density, and hierarchy;
- typography relationships and readable line length;
- surface, border, radius, shadow, and color-emphasis treatment;
- component proportions and state presentation;
- role-specific navigation and page-shell character;
- warm boutique learning-community direction;
- calm operational clarity on family, educator, and admin screens;
- Do / Don't compliance;
- generated placeholder content is not mistaken for authoritative program data.

Reference-specific checks:

- Homepage: editorial warmth, value hierarchy, program discovery, guidance pathway, compatible logo surface.
- Family dashboard: parent-controlled student context, next-action hierarchy, explicit pending payment/not-confirmed language.
- Admin operations: attention hierarchy, program operations, payment/consent/content states, owner-authority framing.
- Educator Content Studio: compare only when an approved future release authorizes implementation.

## Gate 3 — Product Quality

Verify at representative mobile, tablet, desktop, and wide viewports:

- responsive composition changes follow the written rules;
- desktop navigation transforms correctly to rail/menu/bottom navigation;
- bottom navigation has no more than five primary destinations;
- action rails, filters, grids, tables, forms, and dashboards transform without losing meaning;
- 44×44 px minimum targets and 8 px adjacent-action spacing are preserved;
- keyboard operation, focus order, focus visibility, dialogs, menus, and form behavior work;
- headings, landmarks, labels, table semantics, announcements, and image alternatives are correct;
- reduced-motion preference is respected;
- validation, loading, empty, success, warning, error, pending, blocked, and recovery states work;
- long names, long program titles, missing images, missing optional facts, and multiple students do not break layouts;
- external checkout remains distinct from payment verification and enrollment confirmation;
- waitlist, consent, privacy, and assistance states use explicit language and do not rely on color;
- no real child/family data is used before applicable product and technology approval;
- functional flows and runtime quality remain intact.

MPS owns product-scope, business-rule, and acceptance validation. MTS owns architecture, integration, security, data, and operations verification. MDS QA must not claim those passes on their behalf.

## Required manual scenarios

1. Keyboard-only public discovery to program detail and guidance path.
2. Enrollment handoff through the external-checkout notice, return-pending state, and not-confirmed state.
3. Family dashboard switching between multiple parent-controlled student profiles.
4. Program with missing optional facts and a long title.
5. Waitlist and assistance-request submissions.
6. Consent-required and consent-unavailable states using approved policy content only.
7. Admin table transformed into labeled mobile record cards.
8. Error recovery without loss of entered form data where technically feasible.
9. Screen-reader announcement of validation, loading, pending, blocked, and confirmation changes.
10. Reduced-motion behavior.

## Compliance report format

Record for every finding:

- gate and area;
- viewport or environment;
- expected MDS behavior;
- observed behavior;
- evidence;
- severity: critical, major, minor, or observation;
- classification: gap, approved exception, or deviation;
- owner and next action;
- retest result.

## Release threshold

- No critical or major unapproved deviation.
- No inaccessible primary flow.
- No ambiguous enrollment, payment, waitlist, consent, privacy, or assistance state.
- No unauthorized design-system convention.
- All approved exceptions are documented.
- MPS and MTS validation are separately complete for the intended release.
