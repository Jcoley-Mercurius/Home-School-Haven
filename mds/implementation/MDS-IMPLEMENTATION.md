# Home School Haven MDS Implementation Manifest

**System:** Mercurius Design System  
**Version:** 1.0  
**Status:** Design handoff locked; MTS runtime selections approved; repository mapping pending inspection  
**Date:** 2026-08-26

## Authoritative design resources

- State: `mds/MDS-PROJECT-STATE.yaml`
- Design specification: `mds/specification/DESIGN-SYSTEM.md`
- Principles: `mds/specification/PRINCIPLES.md`
- Do / Don't: `mds/specification/DO-DONT.md`
- Canonical token source: `mds/tokens/tokens.json`
- CSS token reference: `mds/tokens/tokens.css`
- Reference index: `mds/references/REFERENCE-INDEX.md`
- QA protocol: `mds/qa/MDS-QA.md`

## Technical mapping status

MTS v1.0 has approved the technology selections below. Exact installed versions and repository paths remain unresolved until the target repository is inspected:

| Implementation concern | Status |
|---|---|
| Framework and version | Next.js App Router; exact compatible version pending repository inspection |
| Language | TypeScript |
| Styling system | Canonical MDS CSS variables with constrained Tailwind CSS when repository-compatible |
| Component system | MDS-owned components with selective Radix Primitives |
| Runtime token location | Pending repository inspection |
| Shared component directory | Pending repository inspection |
| Global style/theme location | Pending repository inspection |
| Font loading method and path | Lora and Manrope through the repository-compatible Next.js font strategy; path pending inspection |
| Icon library and implementation | Lucide React configured to the approved rounded 1.75 px outline character |
| Accessibility tooling | Playwright, `@axe-core/playwright`, ARIA snapshots, and required manual checks |
| Testing and visual comparison tooling | Repository-compatible TypeScript/ESLint, Playwright, screenshots, canonical-reference comparison |
| Deployment target | Vercel |

No path or technology may be invented to make this table appear complete.

## Required runtime foundations

Implementation must map the canonical tokens into the approved styling system without changing values or semantic intent. Load Lora 400/600 and Manrope 400/500/600/700 through the repository-compatible Next.js font strategy. Use Lucide React only where it can consistently produce the approved rounded 1.75 px outline character.

Implement reusable primitives before page-specific compositions. The preferred order is:

1. Token/theme layer.
2. Typography and layout primitives.
3. Focus, status, and accessibility primitives.
4. Core form and action components.
5. Program, enrollment, payment-handoff, consent, assistance, family, schedule, announcement, and resource components.
6. Public, family, educator, and administrator page shells.
7. Canonical screen compositions.

## Component and pattern map

Required shared components are specified in `DESIGN-SYSTEM.md` and the canonical state. The implementation must use **REUSE → COMPOSE → EXTEND → CREATE**. A new reusable visual convention is an MDS gap and requires approval.

Required patterns: public landing, program catalog/results, program detail, forms, authentication, family dashboard, enrollment handoff, waitlist, consent, assistance request, admin operations, loading, empty, and error.

The educator Content Studio/Course Builder is future-platform visual direction. Do not implement it as Foundation Release functionality without an approved MPS change.

## Responsive implementation

Use the repository-compatible implementation direction identified during inspection, but the output must honor the approved 4/8/12-column behavior, gutters, container limits, role navigation transformations, table-to-card behavior, action-rail movement, readable type, and 44 px touch targets.

Required QA viewports must include representative mobile below 640 px, tablet from 640–1023 px, desktop from 1024–1439 px, and wide at 1440 px or above.

## Accessibility implementation

WCAG 2.2 AA is required. The MTS selection must provide a credible path for automated and manual accessibility checks, keyboard testing, focus visibility, semantic structure, announcements, contrast, reduced motion, touch targets, and alternative text.

## Approved exception

Private beta references and validation may use sample or sanitized family and student data until child-data and consent policy gaps are resolved.

## Known external blockers

- Real-family activation: blocked by MPS-GAP-005 covering child data, consent, retention, deletion, and related policy.
- Authoritative financial automation: blocked by MPS-GAP-010 covering pricing, scholarships, discounts, refunds, cancellations, credits, and transfers.
- Production implementation activation: MTS is approved; repository inspection and reconciliation remain required.

## Maintenance

Update this manifest after repository inspection. Record actual versions, paths, and commands, then reconcile token and component locations, QA commands, and deployment guidance. Never retain placeholder paths after the implementation repository is known.
