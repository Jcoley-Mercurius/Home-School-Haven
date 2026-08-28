# Home School Haven MDS Reference Index

**MDS version:** 1.0  
**Status:** Approved and canonical  
**Date:** 2026-08-28

The written MDS state and specification outrank generated imagery if a conflict appears. References are authoritative only for what they clearly show.

| ID | Reference | Role | Release horizon | Library file ID |
|---|---|---|---|---|
| MDS-REF-000 | Original Home School Haven logo | Canonical identity asset; never generatively redraw | Current | `libfile_1847dbb7f6cc81919312fd15c1988149` |
| MDS-REF-003 | Home School Haven design foundations sheet | Palette, type, spacing, shape, visual language | Current | `libfile_14839fdca0308191a71a55968ebaa430` |
| MDS-REF-004 | Proposed component library visual reference | Component hierarchy, states, trust patterns | Current | `libfile_2c87a62ad97c81919a9500f2b7f09a7e` |
| MDS-REF-005 | Home School Haven Navigation Blueprint | Grid, containers, page shells, role navigation, responsive behavior | Current | `libfile_ba6ac8c0d06c8191b32505fdbf68aec9` |
| MDS-REF-006 | Home School Haven homepage preview | Public hierarchy, brand expression, program discovery | Foundation Release | `libfile_9c95889e9fc081918d465994c3969810` |
| MDS-REF-007 | Home school dashboard with pending payment warning | Family shell, student context, trust states | Foundation Release | `libfile_9ac613ffcb508191bfb9f045b3015fe7` |
| MDS-REF-008 | Home School Haven course builder dashboard | Educator Content Studio visual architecture only | Future platform | `libfile_abbb23022eb88191a4e650b6ba3c9322` |
| MDS-REF-009 | Home School Haven admin dashboard | Administrator operations shell and hierarchy | Foundation Release | `libfile_b2ede9df68988191a47c28de82268ee7` |
| MDS-REF-010 | Home School Haven public calendar | Public calendar shell, month grid, published-detail notes, guidance pathway | Foundation Release | Local asset only |

## Reference protocol

When implementing a page, compare composition, alignment, spacing, hierarchy, typography, color, borders, radius, shadow, proportions, density, states, and content placement against the relevant reference.

Do not infer:

- unseen interactive states;
- mobile behavior not defined in the written responsive specification;
- product permissions or policy;
- data architecture, APIs, providers, security, or deployment;
- literal truth from generated names, values, or microcopy.

Generated people and scenes are art direction, not real records or approved production photography.

## Local package assets

| ID | Local path |
|---|---|
| MDS-REF-000 | `mds/references/assets/home-school-haven-logo.png` |
| MDS-REF-003 | `mds/references/assets/design-foundations.png` |
| MDS-REF-004 | `mds/references/assets/component-library.png` |
| MDS-REF-005 | `mds/references/assets/navigation-blueprint.png` |
| MDS-REF-006 | `mds/references/assets/homepage-reference.png` |
| MDS-REF-007 | `mds/references/assets/family-dashboard-reference.png` |
| MDS-REF-008 | `mds/references/assets/course-builder-future-reference.png` |
| MDS-REF-009 | `mds/references/assets/admin-dashboard-reference.png` |
| MDS-REF-010 | `mds/references/assets/public-calendar-reference.png` |

## MDS-REF-010 implementation notes

Approved by the owner on 2026-08-28, promoted from the proposed set. It was
drawn before the published calendar content was reconciled, so three parts of
the image are layout intent rather than approved content, and the implementation
records each as a deviation in `prompts/public-calendar-page.md`:

- the category chips (All / Classes / Workshops / Community) show a taxonomy no
  approved source assigns to any offering;
- the May 2026 month and its event dot correspond to no published entry;
- the right panel is titled "Upcoming", but most published program ranges carry
  no year and cannot be ordered in time.

The reference is authoritative for the calendar shell, month grid, notes rail,
programs panel, and guidance band. It does not authorize inventing content.
