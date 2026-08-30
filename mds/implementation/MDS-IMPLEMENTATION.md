# Home School Haven MDS Implementation Manifest

**System:** Mercurius Design System  
**Version:** 1.0  
**Status:** Design handoff locked; MTS runtime selections approved; repository mapped on 2026-08-27; verification tooling rows refreshed 2026-08-27  
**Date:** 2026-08-27

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

Recorded from the inspected repository at `/home/josh/home-school-haven` on
2026-08-27. Every row below is repository evidence, not a placeholder.

| Implementation concern | Actual value |
|---|---|
| Framework and version | Next.js 16.3.3, App Router, Turbopack build (`next.config.ts` holds no overrides) |
| Language | TypeScript 5, React 19.2.8 |
| Styling system | Tailwind CSS v4 through `@tailwindcss/postcss` (`postcss.config.mjs`); no `tailwind.config` file — theme is CSS-first via `@theme inline` |
| Component system | MDS-owned components over `@base-ui/react` 1.7, installed through the shadcn `base-nova` setup (`components.json`). MTS-DEC-025 supersedes MTS-DEC-022: do not add Radix. |
| Runtime token location | `src/app/globals.css` — canonical `--hsh-*` token block plus the shadcn variable mapping and `@theme inline` exposure |
| Shared component directory | `src/components/ui/` (alias `@/components/ui`); helpers in `src/lib/utils.ts` (`cn`) |
| Global style/theme location | `src/app/globals.css`, imported once by the root layout `src/app/layout.tsx` |
| Font loading method and path | `next/font/google` in `src/app/layout.tsx`: Lora 400/600 as `--font-lora`, Manrope 400/500/600/700 as `--font-manrope`, both `display: swap`, consumed by `--hsh-font-display` / `--hsh-font-ui` |
| Icon library and implementation | `lucide-react` 1.34 with `strokeWidth={1.75}` set explicitly at each call site; Lucide's own default is 2 px |
| Accessibility tooling | Playwright 1.62 + `@axe-core/playwright` 4.13, installed. `npm run test:e2e` runs axe with the `wcag2a/2aa/21a/21aa/22aa` tag set at the four approved viewports on every implemented public route. |
| Testing and visual comparison tooling | TypeScript (`npm run typecheck`), ESLint 9 (`npm run lint`), Prettier (`npm run format:check`), Playwright (`npm run test:e2e`) with `toHaveScreenshot` baselines committed under `tests/e2e/*-snapshots/`, and `node --test` unit tests (`npm run test:unit`). |
| Deployment target | Vercel. No `vercel.json` and no `.env*` file is committed; project settings live in the Vercel dashboard. |

### Commands (WSL/Ubuntu bash)

Node 24.17.0, npm 11.13.0, no `packageManager` field pinned.

```bash
npm run dev          # next dev
npm run build        # next build (prebuild runs the demo-placeholder gate)
npm run start        # next start
npm run lint         # eslint (flat config)
npm run typecheck    # tsc --noEmit
npm run format:check # prettier
npm run test:unit    # node --test tests/*.test.mjs
npm run test:e2e     # playwright: axe, keyboard, responsive, visual baselines
```

### Design QA surface

`src/app/design/foundations/page.tsx` renders MDS-REF-003 for comparison at
`/design/foundations`. It calls `notFound()` when `NODE_ENV === "production"`,
so it is reachable in development only (owner decision, 2026-08-27).

### Approved deviation from MDS-REF-003

The accent button and accent text links use Coral 700 `#A84248` with white text
(about 5.9:1) rather than the Logo Coral `#ED7D7C` drawn on the reference sheet,
which reaches only about 2.7:1 against white and fails the WCAG 2.2 AA
requirement in `DESIGN-SYSTEM.md` §10. Logo Coral remains `#ED7D7C` and stays
decorative. Approved by Josh Coley on 2026-08-27; **pending Samantha Dodson's
awareness as a visible difference from the approved reference.**

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
- Production implementation activation: no longer blocked on reconciliation. MTS is approved, and repository inspection and reconciliation completed 2026-08-27; the table above is the record. Activation remains gated by MPS-GAP-005 and MPS-GAP-010 above, and by the MTS activation gate.

## Maintenance

Repository inspection is complete and the table above records actual versions,
paths, and commands. Update it whenever those change. The accessibility and visual-comparison
tooling named in `mds/qa/MDS-QA.md` is installed and the rows above record its
real commands (updated 2026-08-27). Never retain placeholder paths.
