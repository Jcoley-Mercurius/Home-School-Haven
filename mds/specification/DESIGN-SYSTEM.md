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
- Consent state: required, accepted, renewal required, unavailable, blocked.
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

MDS v1.1 is locked. A clarification with no intended behavior change is a patch. A backward-compatible token, component, pattern, or state addition is a minor release. A foundational or breaking change is a major release.

No coding agent may redesign, modernize, embellish, simplify, or “improve” this system without explicit approval and state propagation.
