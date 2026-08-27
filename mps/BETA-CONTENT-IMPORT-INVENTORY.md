# Home School Haven — Beta Content Import Inventory

**System:** Mercurius Product System  
**Release:** REL-BETA-001 — Foundation Release Beta  
**Source:** https://homeschoolhaven.org/  
**Captured:** August 26, 2026  
**Status:** Approved beta import source with content-QA flags

## Approved import authority

The product-definition collaborator confirmed that the courses, programs, and other information currently published on the Home School Haven website are up to date and may be used as the authoritative content source for the private Foundation Release beta.

The existing external checkout procedure and current program-specific checkout URLs are the approved beta payment path. The beta does not need to rebuild or integrate an internal payment processor.

## Import rules

1. Preserve published names, descriptions, dates, times, prices, audiences, educator associations, and checkout destinations as source facts.
2. Normalize layout, capitalization, spacing, and duplicated presentation only when the underlying meaning is unchanged.
3. Do not infer or invent missing ages, grades, prices, capacity, eligibility, location, educator, scholarship policy, refund policy, or other business rules.
4. Retain the existing program-specific checkout URL for each applicable registration action.
5. Treat checkout initiation as an external handoff, not proof of successful payment or confirmed enrollment.
6. Use sample or sanitized family and student data while consent, retention, deletion, and real-data policy remain unresolved.
7. Preserve uncertain source associations as review items rather than assigning a detail to the wrong program.

## Brand and public-purpose content

| Content area | Published source content to preserve |
|---|---|
| Positioning | Boutique homeschool community in Cape Coral offering enrichment classes, hands-on workshops, small-group learning, and family support. |
| Learning character | Calm, creative, curiosity-led, relationship-centered learning. |
| Values | Creativity over conformity; Curiosity over perfection; Character over performance; Community over competition. |
| Faith identity | Christ-centered values expressed through kindness, integrity, patience, humility, and grace. |
| Primary public conversion paths | Explore programs, register and pay, request guidance or support, contact Home School Haven. |

## Published program inventory

The following program names and details were observed on the current Classes page. The source page repeats some headings and does not always expose a clear machine-readable relationship between a heading and the dates, price, or description beneath it. Those associations must be normalized during import without guessing.

| Program or series | Published details observed | Import status |
|---|---|---|
| Ready Set Prep & Learn | Tuesdays and Thursdays; fall registration offers 1-, 2-, or 3-day options across Enrichment or Ready Set Prep. | Import; preserve published details and leave unavailable fields unset. |
| Haven Days Enrichment | September 2026–June 2027; fall registration offers 1-, 2-, or 3-day options. | Import. |
| Etiquette Series | Listed as a current offering; a September 11–October 2 date range appears in the page content, but the retrieved hierarchy does not prove the association. | Import title; review date association. |
| Art Lab | August 22–September 26, 2026. | Import. |
| Sewing | September 15–October 5; two hours per session. | Import. |
| Gardening | September 3–September 24; two hours per session appears near the gardening/Harvest Explorers content. | Import title; review detail association. |
| Harvest Explorers | August 20–September 24; six weeks; $180 for all six weeks. | Import. |
| History Explorers | September 3–October 15; 2.5 hours per session. | Import. |

### Additional published offerings

| Offering | Published details observed | Import status |
|---|---|---|
| Summer Series | Ages 4–11; Science/STEM July 6–9; Art Studio July 13–16; Sewing + Design July 20–23; Garden + Grow July 27–30; Monday–Thursday, 9:00 a.m.–2:00 p.m.; Friday Summer Parties July 10, 17, 24, and 31. | Import if included in the beta catalog; retain seasonal state. |
| Seasonal School Photos | Homeschool photo offering; two professional photos emailed per child. | Import as a special event/service if in beta scope. |

## Calendar inventory

| Event or term | Published detail | Import status |
|---|---|---|
| Summer Break | June 26, 2026–September 7, 2026; Enrichment only. | Import. |
| Fall Preview Day / Open House | August 3, 2026; Enrichment and Ready Set Prep. | Import. |
| Ready Set Prep begins | August 4, 2026. | Import. |
| Ready Set Prep operating range | Published as “August 2026–May 2026.” | Preserve for review; chronology appears inconsistent and must not be silently corrected. |
| Haven Days Enrichment begins | September 1, 2026. | Import. |
| Haven Days Enrichment range | September 2026–June 2027. | Import. |

## People and educator content

| Person | Published role and experience |
|---|---|
| Samantha Dodson | Founder and Home School Haven owner; final product decision owner. Preserve the published founder story and Christ-centered mission. |
| Heidi Endress | Elementary education, art, and therapeutic art background; Pre-K–5 focus. |
| Falecia Civil | Middle-school education, grades 5–9, English language arts, and teacher-coach background. |
| Celina Carlin | Arts and crafts, science, gardening, and sewing; younger-student focus. |

The About Us page contains a “Who we Collaborate with” section, but partner names were not exposed in the retrieved page text. Do not create partner records without a verified source.

## Contact, assistance, privacy, and checkout

| Area | Published content or approved behavior |
|---|---|
| Location | 2930 Del Prado Boulevard South, Suite D, Cape Coral, Florida. Preserve source formatting only after contact QA. |
| General phone | 239-347-9356 appears on the Contact page. |
| Assistance | The contact experience invites requests for support or help with discounted classes. Keep these requests private and manually reviewed. |
| Privacy | The public policy describes collection of registration/event information, contact details, child name and age, and third-party payment processing; it states child information is collected with parental consent for operational purposes. |
| Checkout | Continue program-specific “Register & Pay” or “Pay Now” links to `pay.homeschoolhaven.org` for the private beta. |

## Content-QA normalization flags

These items do not block private beta design or content import, but they should be reconciled before a public launch or before the affected detail is treated as corrected authoritative content.

| Flag | Observation | Required handling |
|---|---|---|
| QA-001 | The Classes page repeats headings and labels, and some descriptions, dates, prices, and titles have ambiguous structural associations. | Normalize the content model manually; do not guess associations. |
| QA-002 | The Calendar page publishes “August 2026–May 2026” for Ready Set Prep. | Ask Samantha whether the end year should be 2027 before correcting it. |
| QA-003 | The Privacy Policy footer shows 239-347-93556, while the Contact page shows 239-347-9356. | Use the Contact-page number provisionally and request confirmation before public launch. |
| QA-004 | The collaborator section did not expose partner names in retrieved text. | Leave partner records empty until verified. |
| QA-005 | Some offerings do not publish every desired catalog field, including age/grade, price, capacity, educator, location, or enrollment window. | Leave missing fields unset or use a truthful contact-for-details action. |
| QA-006 | Seasonal content may remain published after its active window. | Store explicit seasonal and publication states rather than deleting source history. |

## Beta readiness effect

- DEP-BETA-001 is resolved: current website program and course content is approved as the beta import source.
- DEP-BETA-002 is resolved: the current external checkout procedure is sufficient for private beta review.
- GAP-005 remains open for real-family data, consent language, retention, deletion, and operational policy.
- GAP-010 remains open for authoritative financial-policy behavior, but it does not prevent a private beta from displaying published prices or handing off to the current checkout under existing policy.
- The MDS may use this inventory as product truth in its separate chat, while this MPS remains the authority for scope, rules, requirements, and approvals.

