# Implementation Prompt — MDS-REF-003 Foundations Layer

**Status:** Awaiting owner approval
**Date:** 2026-08-27
**Reference:** MDS-REF-003 `mds/references/assets/design-foundations.png`
**Scope owner:** MDS (design authority); MTS constrains the styling and component libraries

## Goal and scope

Implement the foundations shown on the approved design-foundations sheet:
identity/mood surfaces, palette, typography roles, spacing and shape language,
and the component examples in sheet section 5 (buttons, card, form controls,
text link). This covers steps 2–4 of the MDS implementation order — the token
layer (step 1) landed in `src/app/globals.css` on 2026-08-27.

In scope:

- `src/app/layout.tsx` — load Lora and Manrope, remove Geist.
- `src/app/globals.css` — exact type-role line heights, type-role utility
  classes, container/gutter helpers.
- `src/components/ui/button.tsx` — retarget to MDS variants and control heights.
- New `src/components/ui/`: `input.tsx`, `label.tsx`, `select.tsx`,
  `checkbox.tsx`, `radio-group.tsx`, `card.tsx`, `text-link.tsx`.
- Optional design-QA route `src/app/design/foundations/page.tsx` rendering the
  sheet's sections for side-by-side comparison with the reference.

Out of scope: the component library sheet (MDS-REF-004) beyond what MDS-REF-003
shows, page shells, navigation, the homepage (MDS-REF-006), dashboards, any
product behavior, and replacing `src/app/page.tsx` boilerplate.

## Applicable approved sources

- MDS-REF-003 design foundations sheet (appearance)
- `mds/specification/DESIGN-SYSTEM.md` §2 color, §3 typography, §4 spacing/shape/
  elevation, §6 core component contract, §10 accessibility
- `mds/specification/DO-DONT.md` — color and typography, layout and components
- `mds/specification/PRINCIPLES.md` — calm structure, warmth with clarity
- `mds/implementation/MDS-IMPLEMENTATION.md` — "Required runtime foundations":
  Lora 400/600 and Manrope 400/500/600/700 through the repository-compatible
  Next.js font strategy; primitives before page compositions
- `mds/references/REFERENCE-INDEX.md` — written state outranks generated imagery;
  do not infer unseen states
- `AGENTS.md` §7 UI work, §9 approved stack

## Repository evidence inspected

- `design/*.png` are byte-identical (md5) to `mds/references/assets/*` — the
  upload introduces no new authority, it is MDS-REF-000/003–009.
- `src/app/layout.tsx` loads Geist/Geist_Mono as `--font-geist-sans` /
  `--font-geist-mono`. Lora and Manrope are not loaded.
- `src/app/globals.css` now carries the MDS token layer and the shadcn mapping;
  base layer sets body type, `h1`–`h4`, focus ring, 44 px targets, reduced motion.
- `src/components/ui/button.tsx` is the shadcn `base-nova` default: heights
  h-8/h-7/h-9 (32/28/36 px), `rounded-lg`, `text-sm`, and `dark:` variants. It
  imports `@base-ui/react/button`.
- `package.json`: `@base-ui/react@^1.7.0`, `shadcn@4`, `lucide-react@^1.34.0`,
  `class-variance-authority`, `tailwind-merge`, Tailwind v4, Next 16.3.3.
  No `@radix-ui/*` package is installed.
- `components.json`: style `base-nova`, `cssVariables: true`, `iconLibrary: lucide`.
- Only `button.tsx` exists under `src/components/ui/`.

## Planned change

### 1. Fonts

Load `Lora` (400, 600) and `Manrope` (400, 500, 600, 700) via `next/font/google`
as `--font-lora` and `--font-manrope`; drop Geist/Geist_Mono. Point the token
stacks at them with the approved fallbacks retained:
`--hsh-font-display: var(--font-lora), Georgia, "Times New Roman", serif` and
`--hsh-font-ui: var(--font-manrope), Inter, Arial, sans-serif`.
Set `metadata` to Home School Haven instead of "Create Next App".

### 2. Type roles

Encode the exact size/line-height pairs printed on the sheet, which agree with
the ratios in `DESIGN-SYSTEM.md` §3:

| Role | Desktop | Mobile | Family / weight |
|---|---|---|---|
| Display XL | 56/64 | 40/46 | Lora 600 |
| Display LG | 44/52 | 34/40 | Lora 600 |
| H1 | 40/48 | 32/38 | Lora 600 |
| H2 | 32/40 | 28/35 | Lora 600 |
| H3 | 24/32 | 24/32 | Lora 600 |
| H4 | 20/28 | 20/28 | Manrope 700 |
| Body Large | 18/30 | 18/30 | Manrope 400 |
| Body | 16/26 | 16/26 | Manrope 400 |
| Body Small | 14/22 | 14/22 | Manrope 400 |
| Label | 14/20 | 14/20 | Manrope 600 |
| Caption | 12/18 | 12/18 | Manrope 500 |

Add line-height tokens and `.hsh-display-xl`, `.hsh-display-lg`, `.hsh-h1`…`.hsh-h4`,
`.hsh-body-lg`, `.hsh-body`, `.hsh-body-sm`, `.hsh-label`, `.hsh-caption` utility
classes in a components layer, with the desktop step at 1024 px. Element defaults
for `h1`–`h4` and `body` stay in the base layer and reuse the same tokens.

### 3. Components (sheet section 5)

All get default, hover, focus-visible, active/selected, and disabled states from
`DESIGN-SYSTEM.md` §6; buttons also get a loading state. No state is invented
beyond the written contract.

- **Button** — extend the installed Base UI button. Variants: `primary`
  (Forest 600 fill, white text, Forest 700 hover), `secondary` (white surface,
  1 px Neutral 300 border, Forest 700 text), `accent` (Coral 700 fill, white
  text), `quiet`, `text`, `destructive` (Error). Sizes 36 / 44 / 52 px per
  `control.height`, 10 px control radius, Manrope 600. Default size 44 px.
- **Text link** — Forest 700 body links; Coral 700 for the accent call-to-action
  with a trailing Lucide arrow marked `aria-hidden`.
- **Card** — white surface, 14 px radius, 1 px default border, `shadow-card`,
  Lora 600 title, Manrope body, optional botanical Lucide leaf glyph.
- **Form controls** — Label (Manrope 600 / 14 px), Input, Select, Checkbox, and
  RadioGroup on the installed Base UI primitives, 44 px control height, 10 px
  radius, default border, Coral 700 focus ring at 2 px offset, error state
  paired with text (never color alone).

### 4. Optional design-QA route

`/design/foundations` renders palette swatches, the type ramp, spacing and radius
scales, and the component examples in the sheet's order, for screenshot
comparison. It is a design surface with no product data and no authenticated
content. If approved, it must be removed or access-restricted before public
release; that gate goes in `Needs your attention` on every report until resolved.

## Assumptions, gaps, and deviations

1. **Accent button color — deviation from the reference image.** The sheet shows
   the accent button as Logo Coral `#ED7D7C` with white text. That pairing is
   about 2.7:1 and fails the WCAG 2.2 AA requirement in `DESIGN-SYSTEM.md` §10,
   and `DO-DONT.md` reserves the 700 variants for hues that must carry readable
   meaning. Per `REFERENCE-INDEX.md`, written state outranks generated imagery,
   so the accent button uses Coral 700 `#A84248` with white text (about 5.9:1).
   Logo Coral remains decorative. **Flagged for owner awareness — this is a
   visible difference from the sheet.**
2. **Base UI instead of Radix — repository/MTS conflict, reported not resolved.**
   `AGENTS.md` §9 and the MDS manifest name "selective Radix Primitives". The
   repository ships `@base-ui/react` (shadcn `base-nova` style) and no Radix
   package. Per §9's KEEP → CONFIGURE order and "repository inspection comes
   first", this prompt uses the installed Base UI primitives and records the
   conflict as an MTS reconciliation item. Installing Radix alongside would
   create the duplicate dependency §9 forbids.
3. Sheet section 6 (principles) and 7 (do/don't) are guidance, not UI to build.
4. Lora Semibold is weight 600; the sheet's "Manrope Semibold" label maps to 600
   and "Manrope Bold" to 700.
5. Icons use Lucide at the approved 1.75 px rounded stroke, set explicitly via
   `strokeWidth={1.75}` since Lucide's default is 2 px.

## Security, privacy, and data handling

Presentation layer only. No data access, no secrets, no authorization surface.
The optional QA route renders static sample copy — no family, student, program,
price, or enrollment facts, invented or real.

## Responsive and accessibility

Breakpoints 640 / 1024 / 1440 px from the approved tokens; type roles step at
1024 px. Body copy stays 16 px. Controls are at least 44 x 44 px with at least
8 px separation. Visible 2 px Coral 700 focus ring at 2 px offset. Labels are
programmatically associated; checkbox and radio groups are keyboard operable and
grouped; error and status meaning is carried by text plus icon, never color
alone. Decorative botanical and arrow glyphs are `aria-hidden`.

## Rollback

Additive except `layout.tsx`, `globals.css`, and `button.tsx`. Rollback is
`git checkout -- src/` plus deleting the new files; no data or schema involved.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Manual in `npm run dev`: compare `/design/foundations` against
  `mds/references/assets/design-foundations.png`; tab through every control and
  confirm the coral focus ring; confirm Lora renders on headings and Manrope on
  body; check 390 px, 768 px, 1280 px, and 1440 px widths; confirm reduced-motion.
- Not runnable — none installed: Playwright, `@axe-core/playwright`, screenshot
  comparison, ARIA snapshots. Their absence will be reported, not worked around.

## External setup required from the owner

- Decision on the Coral 700 accent-button deviation (item 1 above).
- Decision on the Base UI / Radix reconciliation in MTS (item 2 above).
- Decision on whether `/design/foundations` ships or stays local-only.
