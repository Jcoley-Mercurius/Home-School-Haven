# Demo placeholder imagery — NOT approved photography

These files exist so Samantha can review **layout** during the private Foundation
Review. They are owner-authorized for demo only (decision 2026-08-27).

- Source: regions cropped from `mds/references/assets/homepage-reference.png`
  (MDS-REF-006). They are generated art direction, reused rather than newly
  generated, per `mds/references/REFERENCE-INDEX.md`.
- They are **not** approved production photography and the people in them are
  **not** real students (`mds/specification/DESIGN-SYSTEM.md` §5, `DO-DONT.md`).
- Every usage carries alt text beginning "Placeholder photo — demo only".
- They must not ship to a live or production environment.

## Replacing them with real photography

Overwrite these files in place, keeping the same filenames and aspect ratios,
then update the alt text in `src/content/foundation-content.ts` (`heroImage`,
`communityImage`, and each program's `image.alt`). No layout change is required.

| File | Used by | Aspect |
|---|---|---|
| `hero.jpg` | home hero panel | ~2.44 : 1 |
| `community.jpg` | home community story panel | ~0.65 : 1 |
| `program-art-lab.jpg` | Art Lab card | ~0.96 : 1 |
| `program-haven-days-enrichment.jpg` | Haven Days Enrichment card | ~1.05 : 1 |
| `program-harvest-explorers.jpg` | Harvest Explorers card | 1 : 1 |
