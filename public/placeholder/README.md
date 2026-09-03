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

## Temporary Foundation Demo Preview exception (2026-09-03)

So Samantha can review layout in a browser, a **Vercel Preview** deployment may
build with these files present. That exception is opt-in and narrow:

| `VERCEL_ENV` | `HSH_ALLOW_DEMO_PLACEHOLDERS` | Build |
|---|---|---|
| `production` | anything, including `true` | **blocked** |
| `preview` | `true` | allowed, with a warning naming the imagery |
| `preview` | unset or anything else | **blocked** |
| any other or missing value on Vercel | anything | **blocked** |
| not on Vercel (local build) | — | allowed, with the same warning |

Set `HSH_ALLOW_DEMO_PLACEHOLDERS=true` on the Vercel **Preview** environment
only. It is not a production override and cannot become one — the production
check runs first and never consults the flag. The value must be the exact string
`true`; `TRUE`, `1`, and `yes` fail closed. The exception ends when the files
below are replaced.

## Replacing them with real photography

Do not overwrite these in place. Approved photography goes in
`public/photography/`, typed `ApprovedPhoto` rather than `PlaceholderImage`,
with a provenance row in that directory's README — then the placeholder it
replaced is deleted from here. That is how `hero.jpg` and `community.jpg` were
retired; follow the same path for the three below by updating each program's
`image` in `src/content/programs.ts`. No layout change is required.

When the last file here goes, delete this directory and
`scripts/check-demo-placeholders.mjs` stops blocking production builds.

`hero.jpg` and `community.jpg` were replaced with approved photography on
2026-09-03 and deleted. What remains:

| File | Used by | Aspect |
|---|---|---|
| `program-art-lab.jpg` | Art Lab card | ~0.96 : 1 |
| `program-haven-days-enrichment.jpg` | Haven Days Enrichment card | ~1.05 : 1 |
| `program-harvest-explorers.jpg` | Harvest Explorers card | 1 : 1 |
