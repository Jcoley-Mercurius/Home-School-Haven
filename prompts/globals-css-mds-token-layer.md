# Implementation Prompt — Align `src/app/globals.css` with MDS v1.0

**Status:** Awaiting owner approval
**Date:** 2026-08-27
**Scope owner:** MDS (design authority) with MTS styling-system constraint

## Goal and scope

Replace the create-next-app / shadcn default theme layer in
`src/app/globals.css` with the approved Home School Haven MDS v1.0 token layer,
and map the shadcn/Tailwind v4 variable contract onto those tokens.

In scope: `src/app/globals.css` only.
Out of scope: font loading in `src/app/layout.tsx`, component restyling,
`src/app/page.tsx` boilerplate, new components.

## Applicable approved sources

- `mds/tokens/tokens.css` (canonical CSS token reference — values copied verbatim)
- `mds/tokens/tokens.json` (canonical token source: type scale, control heights,
  breakpoints, gutters, grid gaps, focus width/offset)
- `mds/specification/DESIGN-SYSTEM.md` §2 color, §3 typography, §4 spacing/shape/
  elevation, §7 containers/grid, §8 breakpoints, §10 accessibility
- `mds/implementation/MDS-IMPLEMENTATION.md` — "Required runtime foundations":
  token/theme layer is implementation step 1; tokens must map into the styling
  system "without changing values or semantic intent"
- `AGENTS.md` §7 (UI work), §9 (MDS CSS variables with constrained Tailwind)

## Repository evidence inspected

- `src/app/globals.css` (129 lines): Tailwind v4 `@import "tailwindcss"`,
  `tw-animate-css`, `shadcn/tailwind.css`; `@theme inline` mapping shadcn color
  names; neutral oklch `:root` palette and a `.dark` palette; `@layer base`
  applying `border-border`, `bg-background`, `text-foreground`, `font-sans`.
  Defects found: `--font-sans: var(--font-sans)` is self-referential, and
  `--font-mono: var(--font-geist-mono)` points at a Geist variable.
- `src/app/layout.tsx`: loads Geist / Geist_Mono as `--font-geist-sans` /
  `--font-geist-mono`. Neither Lora nor Manrope is loaded yet.
- `package.json`: Next 16.3.3, Tailwind v4 via `@tailwindcss/postcss`,
  `@base-ui/react`, `shadcn@4`, `lucide-react`. No `tailwind.config`.
- `components.json`: `cssVariables: true`, css entry `src/app/globals.css`.
- `src/components/ui/button.tsx`: consumes `--primary`, `--secondary`, `--muted`,
  `--border`, `--ring`, `--destructive`, `--radius-md`, and `dark:` variants.
- `grep "dark:" src` → 15 hits (default shadcn button + boilerplate page).

## Planned change

1. Keep the existing `@import` lines and the `@custom-variant dark` declaration
   so shadcn's `dark:` utilities still compile.
2. Add the canonical MDS token block to `:root`, values copied verbatim from
   `mds/tokens/tokens.css`, extended only with tokens that already exist in
   `mds/tokens/tokens.json` but are absent from the CSS file: warm-highlight and
   inverse/link colors, type sizes, control heights, focus width/offset, gutters,
   grid gaps.
3. Map the shadcn contract to MDS tokens (no new values invented):
   - `--background` → surface page, `--foreground` → text primary
   - `--card`/`--popover` → surface card, foregrounds → text primary
   - `--primary` → Forest 600 ("principal interactive color"), foreground → white
   - `--secondary` → Forest 50, foreground → Forest 700
   - `--muted` → Ivory 50, `--muted-foreground` → Ink 600
   - `--accent` → Forest 100, foreground → Forest 700
   - `--destructive` → Error, `--border`/`--input` → border default
   - `--ring` → Coral 700 (approved 2 px focus ring color)
   - `--radius` → 10 px control radius
   - sidebar tokens → portal surfaces (elevated / Forest 100 / border default)
4. Remove the `.dark` palette. MDS v1.0 approves no dark theme; keeping a
   generated neutral dark palette would be an unapproved design invention.
   No element sets a `.dark` class today.
5. Remove `--chart-*` (no approved MDS chart palette) and `--font-mono`
   (MDS §3: "Monospace: not defined for product UI").
6. `@theme inline`: expose `--font-sans` → MDS UI stack, `--font-serif`/
   `--font-heading` → MDS display stack, radius scale from MDS radii, and the
   MDS container widths and breakpoints so Tailwind utilities stay on-token.
7. `@layer base`: page background/text, Manrope as the default UI family, Lora
   600 for `h1`–`h3` with the approved sizes and line heights and their mobile
   values, a visible 2 px Coral 700 focus ring at 2 px offset, 44 px minimum
   interactive target, and a `prefers-reduced-motion` block.

## Assumptions and gaps

- The shadcn→MDS mapping in step 3 is an implementation mapping, not new design.
  Where the shadcn contract has no MDS counterpart (charts, monospace, dark) the
  token is dropped rather than invented.
- Fonts: the token stacks fall back to Georgia/Inter/Arial until Lora and Manrope
  are loaded in `layout.tsx`. That is a separate, still-required task.

## Security / privacy

None. Presentation-layer only; no data, secrets, or authorization affected.

## Responsive and accessibility

Breakpoints 640/1024/1440 px and container widths come from the approved tokens.
Base layer enforces 16 px body copy, 2 px Coral 700 focus ring with 2 px offset
(WCAG 2.2 AA, MDS §10), 44 px minimum targets, and reduced-motion support.

## Rollback

Single-file change; `git checkout -- src/app/globals.css` restores it.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- Manual: `npm run dev`, confirm the page renders on the ivory canvas with
  Forest primary buttons and a visible coral focus ring on keyboard tab.
- Not runnable in this repo yet: Playwright, `@axe-core/playwright`, screenshot
  comparison — none are installed.

## External setup required from the owner

None for this change. Loading Lora 400/600 and Manrope 400/500/600/700 through
`next/font` remains outstanding.
