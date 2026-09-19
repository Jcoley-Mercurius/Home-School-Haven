# Home School Haven Product Implementation Manifest

Implement Foundation Release features only when they trace to approved MPS requirement, rule, workflow, and acceptance IDs. Preserve MDS and MTS dependencies.

Order the implementation around complete vertical workflows: public discovery; family onboarding; enrollment/checkout truth; family dashboard; program administration; educator delivery; announcements/resources; Samantha review evidence.

For every increment, record linked IDs, repository evidence, files changed, assumptions, failure and recovery states, MDS references, MTS security/data implications, migrations and rollback, automated checks, and exact manual tests.

Use current website facts and checkout links as import inputs, but flag ambiguity rather than inventing missing facts. Use sanitized beta fixtures. Do not implement independent student access, full Course Builder, or automated unresolved policy.

## Enrollment and checkout truth: implementation record

Slice 4 (2026-09-19, CHG-009, `prompts/external-checkout-payment-truth.md`) activates the approved external checkout.

- **Source.** Each program's link is the exact GoDaddy checkout its "Register & Pay" or "Pay Now" button opens on https://homeschoolhaven.org/classes. The mapping is recorded in the Beta Content Import Inventory. It is never derived from a name or slug.
- **Where checkout appears.** Only on a family's own registration (the enrollment page and the registration result), and only for `started`. The public program page explains that checkout follows registration and renders no link.
- **Truth.** Opening checkout, returning, or reloading records nothing: no payment row, state change, STEP UP row, or analytics. Payment is verified only when an administrator makes the audited transition to `confirmed`. "Payment verified" is not a separate state.
- **Missing links.** A program with no approved checkout (Tutoring) shows "Registration link not published" with the phone path. Administrators see "No checkout link published" in the program list.
- **STEP UP.** No coupon line, control, or data. The approved checkout has no coupon field (GAP-015 open).
