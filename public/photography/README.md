# Approved photography

Real, owner-approved photographs. Unlike `public/placeholder/`, these are
cleared to ship — the demo-asset release gate
(`scripts/check-demo-placeholders.mjs`) does not scan this directory.

Every file here must have a row below before it is referenced from `src/`.

## Provenance

| File | Shows | Source | Authorization |
|---|---|---|---|
| `staff-samantha.webp` | Samantha, founder | Supplied by Samantha Dodson via owner, 2026-09-02 | Samantha approved her own likeness |
| `staff-heidi-endress.webp` | Heidi Endress, Lead Educator | Supplied by Samantha Dodson via owner, 2026-09-02 | Owner confirmed Heidi is aware and agreed, 2026-09-02 |
| `staff-celina-carlin.webp` | Celina Carlin, Community Engagement & Campus Culture Coordinator | Supplied by Samantha Dodson via owner, 2026-09-02 | Owner confirmed Celina is aware and agreed, 2026-09-02 |

## Handling applied on ingest

All files were re-encoded with `ffmpeg -map_metadata -1`, which strips EXIF —
including any GPS coordinates. Phone photographs taken at a location children
attend carry that data silently; it must never reach the public bundle. Verify
with `file public/photography/*.webp`: the output must not say "EXIF metadata".

`staff-samantha.webp` is a 300×300 square crop of a 600×300 source. The
original is a wide storefront shot; the crop keeps her and a sliver of the
window decal. The uncropped original is unmodified in the owner's folder if a
banner treatment is ever wanted.

## Not admitted here

Photographs showing identifiable children require a signed parental photo
release per child before they may be stored in this repository or published.
Three such files were supplied on 2026-09-02 and were deliberately NOT ingested
pending that release — see the slice report. Do not add them to this directory
to "stage" them; an unreleased photograph of a child in version control is
already a disclosure.
