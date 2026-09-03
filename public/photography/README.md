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
| `children-science-experiment.webp` | Four children at a colour-mixing experiment | Supplied by Samantha Dodson via owner, 2026-09-02 | Owner confirmed parental consent for the children shown, 2026-09-03 |
| `learning-room.webp` | A learning room; one child, face not visible | Supplied by Samantha Dodson via owner, 2026-09-02 | Owner confirmed parental consent for the children shown, 2026-09-03 |
| `classroom-group.webp` | A group class in session | Supplied by Samantha Dodson via owner, 2026-09-02 | Owner confirmed parental consent for the children shown, 2026-09-03 |

## Handling applied on ingest

All files were re-encoded with `ffmpeg -map_metadata -1`, which strips EXIF —
including any GPS coordinates. Phone photographs taken at a location children
attend carry that data silently; it must never reach the public bundle. Verify
with `file public/photography/*.webp`: the output must not say "EXIF metadata".

`staff-samantha.webp` is a 300×300 square crop of a 600×300 source. The
original is a wide storefront shot; the crop keeps her and a sliver of the
window decal. The uncropped original is unmodified in the owner's folder if a
banner treatment is ever wanted.

## Children shown here

`children-science-experiment.webp`, `learning-room.webp`, and
`classroom-group.webp` show identifiable children. They are published on the
owner's confirmation of parental consent, recorded above on 2026-09-03.

That confirmation is the whole basis for publishing them. If it is ever
withdrawn for any child in any of these frames, the file comes out of this
directory and out of the slots listed below — it is not enough to stop
referencing it, because the file itself is served from `public/`.

Alt text for these describes the activity and never names a child.

Any FURTHER photograph showing an identifiable child needs its own consent
record here before it is committed. Do not add one to "stage" it; an
unreleased photograph of a child in version control is already a disclosure.

## Where these are used

| File | Slot |
|---|---|
| `children-science-experiment.webp` | home hero |
| `learning-room.webp` | home community panel |
| `classroom-group.webp` | About hero |
| `staff-*.webp` | About "Meet our team" portraits |
