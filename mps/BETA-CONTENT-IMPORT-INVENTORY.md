# Home School Haven — Beta Content Import Inventory

**System:** Mercurius Product System  
**Release:** REL-BETA-001 — Foundation Release Beta  
**Source:** https://homeschoolhaven.org/  
**Captured:** August 26, 2026  
**Status:** Approved beta import source with content-QA flags  
**Updated:** September 16, 2026 — owner evidence of September 14, 2026 (see "Owner evidence of 2026-09-14"), which supersedes the website capture for the offerings, prices, schedules, and address it covers
**Updated:** September 19, 2026 — checkout source mapping from the approved classes page (see "Checkout source mapping (verified 2026-09-19)")

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

## Owner evidence of 2026-09-14

**Source:** Samantha Dodson's flyer and email of September 14, 2026, as transcribed in the Closeout Slice 1 instruction of September 16, 2026. The original documents are not stored in this repository.
**Decision:** DEC-024. **Implementation:** `supabase/migrations/20260916000000_public_offering_model.sql`, `prompts/public-offering-model.md`.

### Offering taxonomy

| Offering type | Published offerings |
|---|---|
| Haven Days | Haven Days |
| Ready Set programs | Ready Set Prep, Ready Set Learn, Ready Set Sensory |
| Individual classes (rotating) | Sewing, Crochet, Gardening |
| Tutoring | Tutoring |
| Monthly clubs | Monthly Clubs (first club: Lego) |

Haven Days is a multi-day program and is never presented as one of the individual classes.

### Verified offerings

| Offering | Ages / grades | Schedule | Dates | Duration | Price | Other published detail |
|---|---|---|---|---|---|---|
| Haven Days | — | Tuesday, Wednesday, and Thursday, 9:00 AM–1:30 PM | September–June | — | One day $280/month; two days $550/month; three days $795/month | — |
| Ready Set Prep | Ages 3–4 | Tuesday and Thursday, 9:15–11:30 AM | August–May | — | $80/week | Prep + Learn combined: $140/week |
| Ready Set Learn | Ages 4–5 | Tuesday and Thursday, 11:45 AM–2:00 PM | August–May | — | $80/week | Prep + Learn combined: $140/week |
| Ready Set Sensory | Ages 3–5 | Wednesday, 9:30–11:30 AM | — | — | $45/week | — |
| Sewing | — | Wednesday, 4:45–6:15 PM | — | Eight weeks | $45/week | $20 non-refundable deposit when paying weekly; no deposit when paying in full |
| Crochet | — | Mondays in November, 2:00–4:00 PM | November | Four weeks | $250, including materials | Beginner class; no experience required; weekly take-home project |
| Gardening | Ages 5 and up | Thursday, 2:15–3:15 PM | October–June; no class during the final week of October | — | **Not published (QA-007)** | — |
| Tutoring | Kindergarten and up | Tuesday, Wednesday, and Thursday | — | — | $65/hour or $40/half-hour | Academic skill building, homework help, and test preparation |
| Monthly Clubs | — | Thursday, 4:30–6:30 PM | — | — | $100/month or $30 drop-in | The first club is Lego |

### Deliberately unknown

No year for any offering; Sewing's start date; Crochet's exact dates, age, capacity, and registration deadline; the first club's month and year; Ready Set Sensory's month range; every capacity, educator, location, and enrollment window. Checkout URLs were unknown here and are now recorded under "Checkout source mapping (verified 2026-09-19)".

### Archived offerings

Ready Set Prep & Learn (replaced by Ready Set Prep and Ready Set Learn), Etiquette Series, Art Lab, Harvest Explorers, and History Explorers are not supported by this evidence. They are archived (`publication_state = 'archived'`) with their history intact. They are not deleted and not shown publicly. The website-capture rows below are kept for traceability.

### Organization address

**1329 Hibiscus Drive, Cape Coral, FL 33909**, replacing the website-captured address everywhere.

## Checkout source mapping (verified 2026-09-19)

**Source:** https://homeschoolhaven.org/classes. On 2026-09-19 Samantha Dodson confirmed, through the user, that the checkout actions on this page are correct and approved for the Foundation Release.
**Method:** each action was inspected in a real browser (headless Chromium through the repository's Playwright). Every "Register & Pay" or "Pay Now" button is a GoDaddy pay button with `href="#"`. On click it opens `https://poynt.godaddy.com/checkout/<business-id>/<short-name>?sourceApp=wam.paybutton` in an in-page frame. No HTTP redirect occurs, and the page URL does not change. Each bare URL, without GoDaddy's constant `sourceApp` tag, loads top-level with HTTP 200 and shows the same item and prices, and it is what is stored.
**Business ID:** `2bf1b322-d362-4d5d-a4a7-5e5791473f14` (Homeschool Haven of SWFL), present on every button.
**Implementation:** `supabase/migrations/20260919200000_external_checkout_activation.sql`, `src/content/checkout-sources.ts`, `prompts/external-checkout-payment-truth.md` §4.

| Source section | Offering, as published | Button | GoDaddy checkout id | Stored destination | Program id and slug | Confidence |
|---|---|---|---|---|---|---|
| Class cards (no heading) | Stay & Play Sensory Day | Register & Pay | `2f095262-28a4-4714-a180-d4753fd67175` | not stored (the page opens https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/2f095262-28a4-4714-a180-d47) | none | missing: not in the approved offering inventory; owner decision |
| Class cards | Haven Days Enrichment | Register & Pay | `0342bb2d-f9c2-4573-a196-943133241098` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/0342bb2d-f9c2-4573-a196-943 | `…0002` `haven-days-enrichment` | exact |
| Class cards | Ready Set Prep & Learn | Pay Now | `1232e79c-3492-461d-a305-eb1bafc694c2` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/1232e79c-3492-461d-a305-eb1 | `…0009` `ready-set-prep` and `…000a` `ready-set-learn` | exact, shared: the checkout names both classes |
| Class cards | Ready Set Sensory | PAY NOW | `f5bbc6ae-3bb3-424e-a014-24aa92a26e98` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/f5bbc6ae-3bb3-424e-a014-24a | `…000b` `ready-set-sensory` | exact |
| Class cards | Beginners Crocheting Class | Pay Now | `a8c851d1-9461-426f-924d-7c51374a1a9a` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/a8c851d1-9461-426f-924d-7c5 | `…000e` `crochet` | exact |
| Class cards | Sewing ( EVENING CLASS) | Pay Now | `568b1ef2-952a-499b-878a-5992850c3133` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/568b1ef2-952a-499b-878a-599 | `…0005` `sewing` | exact |
| Check out our Clubs | Gardening Club | PAY NOW | `cd911575-37c3-4e2e-ad66-1b222c943122` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/cd911575-37c3-4e2e-ad66-1b2 | `…0006` `gardening` | exact |
| Check out our Clubs | MONTHLY THEMED CLUBS | PAY NOW | `7fa2bfc8-430f-48e3-8ea7-c0111da5a66f` | https://poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/7fa2bfc8-430f-48e3-8ea7-c01 | `…000d` `monthly-clubs` | exact |
| Class cards | Beginners Drumming Class ("COMING SOON") | none | — | — | none | inactive |
| — | Tutoring | none on the page | — | NULL | `…000c` `tutoring` | missing: `checkout_url` stays NULL |

**Hostnames.** Every approved destination is on `poynt.godaddy.com` under Home School Haven's business path. `pay.homeschoolhaven.org` resolves to GoDaddy's paylinks service and remains an allowed Home School Haven-controlled form, but no approved button uses it.

**Observed on the checkout pages but not adopted.** These facts were seen on 2026-09-19. They are evidence for Samantha, not published facts, and none is written to a program:

- No checkout page has a coupon, promo, discount, or voucher field. This is the STEP UP question (GAP-015).
- Each page offers optional tipping.
- Haven Days offers one-, two-, and three-day monthly options, plus a separate $100 registration-fee option.
- Ready Set Prep & Learn: $80 weekly, or $320 "pay in 4".
- Ready Set Sensory: $50 registration fee, $45 weekly installment, or $180 "pay in 4".
- Sewing: $20 weekly-installment registration fee, $45 weekly, or $360 in full for 8 weeks.
- Crochet: $250.
- Gardening: "Weekly fee $35". This is new evidence for QA-007, which stays open.
- Monthly Clubs: $100.
- Stay & Play Sensory Day: $40, "Fall festival addition".

**Content-QA flags raised by this capture:**

- QA-008 (open): the classes page lists Crochet as "November 6th – November 27th, Fridays 2pm-4pm". The owner evidence of 2026-09-14 says "Mondays in November, 2:00–4:00 PM". Nothing is changed until Samantha confirms.
- QA-009 (open): Stay & Play Sensory Day has a live checkout but no approved program record.

## Published program inventory (website capture, 2026-08-26; superseded where the section above applies)

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
| Location | **1329 Hibiscus Drive, Cape Coral, FL 33909** — owner evidence of 2026-09-14. Supersedes the captured 2930 Del Prado Boulevard South, Suite D address, which must not be reintroduced. |
| General phone | **239-347-9356** — canonical, per QA-003 resolved 2026-08-27. Appears on the Contact page. |
| Assistance | The contact experience invites requests for support or help with discounted classes. Keep these requests private and manually reviewed. |
| Privacy | The public policy describes collection of registration/event information, contact details, child name and age, and third-party payment processing; it states child information is collected with parental consent for operational purposes. |
| Checkout | Continue each program's own "Register & Pay" or "Pay Now" GoDaddy checkout for the private beta, exactly as recorded under "Checkout source mapping (verified 2026-09-19)". The original capture named `pay.homeschoolhaven.org`, but the approved buttons actually open `poynt.godaddy.com/checkout/2bf1b322-d362-4d5d-a4a7-5e5791473f14/…`. |

## Content-QA normalization flags

These items do not block private beta design or content import, but they should be reconciled before a public launch or before the affected detail is treated as corrected authoritative content.

Resolved flags record the approved decision in the Required handling column and stay listed for traceability.

| Flag | Observation | Required handling |
|---|---|---|
| QA-001 | The Classes page repeats headings and labels, and some descriptions, dates, prices, and titles have ambiguous structural associations. | Normalize the content model manually; do not guess associations. |
| QA-002 | The Calendar page publishes “August 2026–May 2026” for Ready Set Prep. | **Superseded 2026-09-16.** The owner evidence gives Ready Set as “August–May” with no year. The anomalous text is no longer shown and no year is supplied in its place. |
| QA-003 | **Resolved 2026-08-27 (owner authorization).** The Privacy Policy footer showed 239-347-93556, while the Contact page showed 239-347-9356. | Canonical published phone number is **239-347-9356**. Use it everywhere; the 239-347-93556 variant is superseded and must not be reintroduced. |
| QA-004 | The collaborator section did not expose partner names in retrieved text. | Leave partner records empty until verified. |
| QA-005 | Some offerings do not publish every desired catalog field, including age/grade, price, capacity, educator, location, or enrollment window. | Leave missing fields unset or use a truthful contact-for-details action. |
| QA-006 | Seasonal content may remain published after its active window. | Store explicit seasonal and publication states rather than deleting source history. Applied 2026-09-16: unsupported offerings are archived, not deleted. |
| QA-007 | Gardening: the flyer states $35/week and the email states $35 drop-in. | **Open.** Publish no Gardening price until Samantha confirms which is correct. The conflict is kept as an unrendered review detail. |

## Beta readiness effect

- DEP-BETA-001 is resolved: current website program and course content is approved as the beta import source.
- DEP-BETA-002 is resolved: the current external checkout procedure is sufficient for private beta review.
- GAP-005 remains open for real-family data, consent language, retention, deletion, and operational policy.
- GAP-010 remains open for authoritative financial-policy behavior, but it does not prevent a private beta from displaying published prices or handing off to the current checkout under existing policy.
- The MDS may use this inventory as product truth in its separate chat, while this MPS remains the authority for scope, rules, requirements, and approvals.

