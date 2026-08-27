# MDS Part One — Creation Standard

Use this reference when creating or continuing the visual Design System.

## Core structure

1. Identity
2. Colors
3. Typography
4. Type Scale
5. Spacing
6. Shape & Elevation
7. Icons
8. Buttons
9. Inputs
10. Badges / Tags
11. Status / Indicators
12. Progress
13. Cards
14. Navigation
15. Layout & Grid
16. Responsive
17. Interaction States
18. Visual Language
19. Page Patterns
20. Accessibility
21. UI References
22. Principles and Do / Don't guidance

Do not force irrelevant areas. Classify optional/not applicable components and patterns.

## Color

Define brand, neutral, semantic, text, border, and surface roles. Prefer semantic naming for implementation. Do not select colors only as decorative swatches; record how they are used.

## Typography

Separate font-family decisions from type-scale decisions. Define display, body/UI, optional monospace, weights, line heights, letter spacing, and semantic roles.

## Spacing

Prefer a coherent base unit and scale. Record page, section, and component-spacing rules.

## Shape & elevation

Define radii, border treatment, dividers, shadows, and elevation philosophy.

## Components

For each applicable primitive, define variants, sizes, and states. Reuse a consistent state vocabulary such as default, hover, focus, active, selected, disabled, loading, success, warning, error, and empty where applicable.

## Layout and composition

Define content widths, page gutters, section rhythm, grids, header/sidebar/footer behavior, and canonical page shells.

## Responsive

Do not treat responsiveness as “shrink desktop.” Define composition changes across desktop/tablet/mobile: stacking, collapsing, navigation, sidebar behavior, grids, spacing, typography, visibility, media, and touch targets.

## Visual language

Record the product’s personality, density, contrast, surface philosophy, border philosophy, shadow philosophy, color usage, typography character, icon character, and whitespace philosophy.

## Principles

Use 3–5 governing principles when useful. Principles must influence downstream implementation and QA, not exist as decorative slogans.

## Do / Don't

Define specific positive and prohibited behaviors that help a coding agent preserve the intended visual language.

## UI references

Use a small set of canonical screens that demonstrate the system in composition: landing/home, dashboard, detail/content, search/results, or other patterns relevant to the product.

A reference image is a visual contract for what it clearly shows, not authority for unseen states or technical architecture.

## Visual output package

When applicable, generate:
1. Core Design System
2. Layout & Behavior
3. Component Library
4. Canonical UI reference screens

Generated imagery must consume approved state. Reconcile imagery against approved state after generation.

## Gate behavior

Do not call Part One complete until blocking design decisions are approved or explicitly not applicable.
