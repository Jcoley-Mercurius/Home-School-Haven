# Home School Haven — Foundation Release Acceptance Criteria

**System:** Mercurius Product System  
**Release:** REL-BETA-001 — Foundation Release Beta  
**Status:** Approved acceptance baseline — policy-blocked  
**Prepared:** August 26, 2026  
**Decision owner:** Samantha Dodson

## Acceptance boundary

Acceptance proves that implemented product behavior satisfies approved requirements. It does not, by itself, prove usability, technical security, achieved outcomes, market demand, or readiness for real-family activation.

MPS-ACC-001 through MPS-ACC-032 are approved.

## Approved child-data and policy criteria

| ID | Requirement | Observable criterion | Method |
|---|---|---|---|
| MPS-ACC-001 | MPS-REQ-001 | A beta student-profile experience requests only approved minimum fields by default. | Manual + automated |
| MPS-ACC-002 | MPS-REQ-002 | Missing authority affirmation or required consent blocks enrollment before payment starts and identifies the unresolved action. | Manual + automated |
| MPS-ACC-003 | MPS-REQ-003 | An authorized administrator can see the accepted policy version and acceptance time. | Manual + automated |
| MPS-ACC-004 | MPS-REQ-005 | All beta student records are demonstrably sample or sanitized while owner policy is incomplete. | Manual review |
| MPS-ACC-005 | MPS-REQ-004 | Public visitors and unassigned educators receive no private student or family information. | Security + manual |
| MPS-ACC-006 | MPS-REQ-006 | Unapproved policy language is not presented and policy-dependent live action is not enabled. | Policy review |

## Approved Must-feature criteria

### Public website and program discovery

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-007 | MPS-REQ-007 | Given verified public content exists, when a visitor opens the beta website, then Home School Haven's purpose, values, service area, contact paths, programs, and educator information are reachable without authentication. | Manual + automated |
| MPS-ACC-008 | MPS-REQ-007 | Given public content is missing or unverified, when publication is attempted, then it remains non-authoritative and is not silently presented as verified. | Manual |
| MPS-ACC-009 | MPS-REQ-008 | Given a published program, when its detail is viewed, then every applicable approved program field and current next action is shown. | Manual + automated |
| MPS-ACC-010 | MPS-REQ-008 | Given no published program matches a visitor's criteria, when results are shown, then an empty result provides a guidance or contact path rather than a dead end. | Manual |

### Flexible conversion and private inquiries

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-011 | MPS-REQ-009 | Given a program permits registration, when a family views it, then direct registration and relevant guided-help paths are distinguishable and available. | Manual |
| MPS-ACC-012 | MPS-REQ-010 | Given a valid inquiry is submitted, when submission completes, then the family receives confirmation and an authorized administrative record is created once. | Manual + automated |
| MPS-ACC-013 | MPS-REQ-010 | Given a discounted-class assistance request, when an educator or unauthorized user seeks access, then the request and its contents are not disclosed. | Security + manual |
| MPS-ACC-014 | MPS-REQ-010 | Given submission fails or times out, when the family remains on the experience, then success is not claimed and a retry or alternate contact path is offered. | Manual + integration |

### Family account and onboarding

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-015 | MPS-REQ-011 | Given a new parent uses a unique valid identity, when verification completes, then one family account is created and the parent can continue family setup. | Manual + automated |
| MPS-ACC-016 | MPS-REQ-011 | Given the identity already exists, when account creation is attempted, then a duplicate family account is not created and an appropriate recovery path is offered. | Automated + manual |
| MPS-ACC-017 | MPS-REQ-011 | Given verification expires or setup is incomplete, when the parent returns, then verification can be safely renewed and approved progress can be resumed. | Automated + manual |

### Enrollment and payment

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-018 | MPS-REQ-012 | Given family readiness, student, consent, capacity, or registration state is invalid, when enrollment is attempted, then payment is not initiated and the blocking state is identified. | Automated + manual |
| MPS-ACC-019 | MPS-REQ-012 | Given a program requires approval, when a valid registration is submitted, then it becomes approval-pending rather than confirmed or paid. | Manual + automated |
| MPS-ACC-020 | MPS-REQ-012 | Given a program is full with waitlist enabled, when a family joins, then the enrollment becomes waitlisted and no payment is collected. | Manual + automated |
| MPS-ACC-021 | MPS-REQ-013 | Given an eligible registration, when payment begins, then the approved existing-provider or test path receives the registration and the product records payment as pending until a trustworthy result is available. | Integration + manual |
| MPS-ACC-022 | MPS-REQ-014 | Given payment succeeds, fails, remains pending, or is canceled, when the family and administrator review the enrollment, then both see one consistent authoritative state and next action. | Integration + automated |
| MPS-ACC-023 | MPS-REQ-014 | Given a parent retries after a timeout or stale response, when the same registration is processed again, then the product does not create a duplicate confirmed enrollment or initiate an unintended duplicate charge. | Integration + automated |

### Family dashboard

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-024 | MPS-REQ-015 | Given a parent has multiple students or enrollment states, when the dashboard is viewed, then each student's relevant program, schedule, status, announcements, resources, and required action are distinguishable. | Manual + automated |
| MPS-ACC-025 | MPS-REQ-015 | Given a program is rescheduled, canceled, waitlisted, payment-pending, or completed, when the dashboard is viewed, then the current state replaces stale action guidance without erasing history. | Manual + automated |

### Administrative operations

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-026 | MPS-REQ-016 | Given an authorized administrator, when a program moves through an allowed lifecycle transition, then the new state appears consistently and the prior material state remains attributable. | Manual + automated |
| MPS-ACC-027 | MPS-REQ-016 | Given an educator attempts to publish a price, open registration, or cancel a program, when the action is submitted, then it is blocked unless administrator authority has been granted. | Security + manual |
| MPS-ACC-028 | MPS-REQ-017 | Given a confirmed enrollment, when the roster is viewed, then the student appears exactly once in the correct program and only approved fields are visible to the assigned educator. | Automated + security |

### Educator delivery and program content

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-029 | MPS-REQ-018 | Given an educator is assigned to one program but not another, when both resources are requested, then assigned content is available and unassigned private content is denied. | Security + automated |
| MPS-ACC-030 | MPS-REQ-019 | Given a permitted announcement or resource is published, replaced, or removed, when an enrolled family views the program, then the current approved content state is reflected and unauthorized families cannot access it. | Manual + security |

### Consistency, recovery, accessibility, audit, and beta review

| ID | Requirement | Given / When / Then | Method |
|---|---|---|---|
| MPS-ACC-031 | MPS-REQ-020, 021 | Given a material program or enrollment state changes, when relevant public and authenticated views are checked, then they show consistent current information, an observable state, and an appropriate recovery or next action. | End-to-end |
| MPS-ACC-032 | MPS-REQ-022, 023, 024 | Given the beta is ready for Samantha's review, when the approved walkthrough is performed across supported device contexts, then every beta success signal has evidence, applicable accessibility checks are recorded, material administrative changes are attributable, and feedback can be classified without silently changing scope. | Manual walkthrough + audit review |

## Required evidence

For every implemented criterion, record:

- Result: pass, fail, blocked, or not tested
- Environment and build identifier
- Test method and actor
- Exact evidence: test output, screenshot, recording, audit entry, or reproducible manual steps
- Applicable MDS and MTS verification
- Defect or product-gap reference when not passed

## Approval record

MPS-ACC-007 through MPS-ACC-032 were approved on August 26, 2026. Acceptance is authoritative product truth; validation evidence does not yet exist.
