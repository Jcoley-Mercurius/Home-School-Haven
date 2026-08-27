# Home School Haven MTS — Discovery Brief

> Historical discovery snapshot. Superseded by MTS v1.0, `../TECHNOLOGY-BLUEPRINT.md`, and the root `AGENTS.md`. Statements below describe the pre-approval state and must not override later approved decisions.

**System:** Mercurius Technology System  
**Mode:** CREATE  
**Lifecycle:** Historical snapshot  
**Current gate at capture:** Discovery  
**Date:** August 26, 2026  
**Consumed product source:** Home School Haven MPS, Library version 11  
**Consumed design source:** Home School Haven MDS v1.0 locked handoff

## Outcome

The Mercurius Technology System is initialized for the Home School Haven Learning Platform. The MDS archive passed an integrity test and its state, specifications, tokens, references, implementation manifest, QA protocol, and guarded `AGENTS.md` were consumed. Current MPS state and supporting acceptance, requirements, beta-content, and owner-policy artifacts were also consumed.

No runtime provider, framework, database, identity service, CMS, host, analytics platform, email provider, monitoring product, or payment integration has been approved. The current evidence is sufficient to begin capability mapping, but not to recommend a production stack.

## Confirmed delivery evidence

- The target application repository will be supplied later. Repository inspection remains blocked, and MTS will not assume that the eventual codebase is greenfield.
- Josh Coley working with Codex will be the primary implementation team. The architecture should therefore favor manageable services, strong defaults, low operational burden, and precise coding-agent guidance.
- Only the current program-specific checkout links are available. No provider API, webhook, test-mode, account-ownership, or authoritative payment-state capability is currently verified.
- Samantha's private review build is targeted for 2–3 days when possible and no later than 5 days.
- Recurring software cost should remain below $100 per month, with credible free tiers explored first.
- First-year scale is expected to remain below 100 families.

The 2–5 day target is feasible for a sanitized private review build. It is not evidence that real-family security, policy, payment reconciliation, accessibility, recovery, and production verification are complete.

## Preserved authorities and approved boundaries

- MPS remains authoritative for product purpose, users, scope, workflows, roles, business rules, acceptance criteria, metrics, and release intent.
- MDS v1.0 remains authoritative for visual language, tokens, components, interaction behavior, responsive transformations, WCAG 2.2 AA behavior, and canonical references.
- MTS will define runtime architecture, services, integrations, data/security boundaries, deployment, observability, recovery, and technical verification.
- Samantha Dodson remains the final product and organization-level decision owner.
- Foundation Release Beta is a private owner-review release using current authorized website content.
- Parents control student profiles; students receive no independent beta login.
- Educators are limited to assigned programs, rosters, announcements, and learning resources.
- Administrators receive delegated operational authority; they do not replace Samantha's final authority.
- Existing program-specific external checkout remains the beta payment path.
- Checkout handoff is not successful payment, and payment activity is not confirmed enrollment without an authoritative outcome.
- Full educator Course Builder functionality remains future-platform scope.
- Sample or sanitized family/student data is required until child-data and consent policy is approved.
- Automated scholarship, discount, refund, cancellation, credit, transfer, and related financial decisions remain out of scope.

## Initial capability map

| Capability | Need | Release posture | Selection state |
|---|---|---|---|
| Responsive web runtime and hosting | Required | Foundation Beta | Unselected |
| Parent, educator, admin, and owner identity | Required | Foundation Beta | Unselected |
| Server-side ownership, role, and program-assignment authorization | Required | Foundation Beta | Unselected |
| Application database and attributable audit history | Required | Foundation Beta | Unselected |
| Public content and program publishing | Required | Foundation Beta | Unselected |
| External checkout handoff and payment-state reconciliation | Required | Foundation Beta | Existing handoff observed; technical integration unverified |
| Inquiry, tour, guidance, and private assistance intake | Required | Foundation Beta | Unselected |
| Program-scoped learning-resource storage and delivery | Required | Foundation Beta | Unselected |
| Announcements and notification delivery | Required | Foundation Beta; email is Should priority | Unselected |
| Consent evidence and policy versioning | Required | Architecture required; live use policy-blocked | Unselected |
| Observability and operational alerting | Required | Foundation Beta | Unselected |
| Testing, preview, deployment, backup, and recovery | Required | Foundation Beta | Unselected |
| Privacy-controlled product analytics and beta evidence | Required/Should | Foundation Beta | Unselected |
| Calendar export | Optional/Should | Foundation Beta | Unselected |
| Attendance tracking | Optional/Should | Foundation Beta | Unselected |
| Capacity and waitlist management | Optional/Should | Foundation Beta | Unselected |
| Invited secondary guardian | Optional/Should | Complexity review required | Unselected |
| Full Course Builder | Deferred | Future platform | No beta selection permitted |

## Security posture established at discovery

The system will treat minor/family data, consent evidence, private assistance requests, and payment/enrollment status as high-sensitivity data. Private credentials and service secrets are critical assets. Authorization must be derived from authenticated server context, deny by default, and enforce family ownership, educator assignment, and privileged operations at the data boundary.

Real-family activation remains blocked until Samantha approves the applicable parental authority, student-field, consent, media, staff-access, communication, retention, export, and deletion policy. This is a product-policy blocker, not a technology-selection problem.

## Open evidence and blockers

1. The target application repository will be supplied later. Existing technology cannot yet be classified KEEP, EXTEND, REPLACE, DEPRECATE, REMOVE, or UNKNOWN at the package level.
2. Implementation ownership, budget ceiling, review timeline, and first-year family scale are confirmed. Detailed storage volume will be validated during implementation planning.
3. Expected beta and near-term scale are unconfirmed.
4. Only current checkout links are available; the external checkout provider, account ownership, test mode, API/webhook capability, and authoritative payment-status signal are unverified.
5. MPS child-data/consent policy and financial-policy gaps remain open.

## Next gate action

Collect the blocking delivery, repository, scale, and checkout facts. Then inspect any existing codebase and current provider implementation before researching candidates. Provider research and recommendations must use current first-party documentation and remain proposed until explicitly approved.

The next approval will concern technology architecture only. It will not approve unresolved child-data or financial policy.
