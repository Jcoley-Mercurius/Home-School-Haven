# Home School Haven — Foundation Release Requirements & Rules

**System:** Mercurius Product System  
**Release:** REL-BETA-001 — Foundation Release Beta  
**Status:** Approved functional baseline — policy-blocked  
**Prepared:** August 26, 2026  
**Decision owner:** Samantha Dodson

## Specification boundary

This document defines the approved product behavior required for the Must-priority Foundation Release beta. Requirements MPS-REQ-001 through MPS-REQ-024 are approved. Implementation remains unverified and absent.

The beta is private, uses sample or sanitized student data, preserves the existing payment provider, and does not automate scholarship, refund, cancellation, credit, or transfer decisions. The current website's program and course listings are the approved beta content source, and the current program-specific `pay.homeschoolhaven.org` checkout links are the approved beta checkout path. Unresolved owner policy remains governed by the [Samantha Policy Confirmation Checklist](SAMANTHA-POLICY-CONFIRMATION-CHECKLIST.md).

Content may be normalized for structure, layout, capitalization, spacing, and deduplication without changing published facts. Missing or structurally ambiguous program details must remain unset or flagged for review; they must not be invented. The source inventory and content-QA flags are recorded in [Beta Content Import Inventory](BETA-CONTENT-IMPORT-INVENTORY.md).

## Traceable requirements

| ID | Requirement | Actors | Workflow | Feature | Outcomes | Status |
|---|---|---|---|---|---|---|
| MPS-REQ-001 | Support a parent-controlled student profile using only owner-approved minimum fields. | Parent, student | MPS-WFL-002 | MPS-FEA-005 | OUT-FAM-002 | Approved |
| MPS-REQ-002 | Require parent or guardian authority affirmation and applicable approved consent before student enrollment. | Parent | MPS-WFL-002, 003 | MPS-FEA-005, 010 | OUT-FAM-002 | Approved |
| MPS-REQ-003 | Retain the version and acceptance time for every required consent record. | Parent, admin | MPS-WFL-002, 003 | MPS-FEA-010 | OUT-FAM-002, OUT-BIZ-001 | Approved |
| MPS-REQ-004 | Prevent public visitors and unassigned educators from accessing private student or family information. | Public, educator | MPS-WFL-002, 006 | MPS-FEA-008, 010 | OUT-BIZ-001 | Approved |
| MPS-REQ-005 | Use sample or sanitized student data until Samantha confirms required data and policy. | Admin, owner | MPS-WFL-008 | MPS-FEA-010 | OUT-BIZ-001 | Approved |
| MPS-REQ-006 | Present only Samantha-approved legal, consent, waiver, scholarship, refund, cancellation, transfer, credit, and related policy language. | Admin, owner | MPS-WFL-002, 003, 004 | MPS-FEA-003, 004, 010 | OUT-BIZ-001 | Approved |
| MPS-REQ-007 | Present verified public pages explaining Home School Haven, its values, location, contact paths, programs, and educators. | Public visitor, admin | MPS-WFL-001, 005 | MPS-FEA-001 | OUT-FAM-001, OUT-BIZ-002 | Approved |
| MPS-REQ-008 | Present published program information including title, description, intended age or grade, format, schedule, location, educator, price or approved price presentation, capacity state, enrollment period, and available next actions. | Public visitor, admin | MPS-WFL-001, 005 | MPS-FEA-002 | OUT-FAM-001, OUT-ADM-001 | Approved |
| MPS-REQ-009 | Let a family choose direct registration, general guidance, a visit request, or discounted-class assistance from the relevant public experience. | Public visitor, parent | MPS-WFL-001, 004 | MPS-FEA-003, 004 | OUT-FAM-001, OUT-BIZ-002 | Approved |
| MPS-REQ-010 | Record each submitted inquiry with its type, contact information, time, current state, and authorized administrative owner while keeping assistance requests private. | Public visitor, admin, owner | MPS-WFL-001, 004 | MPS-FEA-003 | OUT-ADM-001, OUT-BIZ-002 | Approved |
| MPS-REQ-011 | Let a parent create and verify one family account, recover from expired verification, and safely resume an incomplete family profile. | Parent | MPS-WFL-002 | MPS-FEA-005 | OUT-FAM-002 | Approved |
| MPS-REQ-012 | Before payment, evaluate current program publication, registration, capacity, waitlist, confirmation mode, duplicate enrollment, family readiness, student selection, and required consent states. | Parent, admin | MPS-WFL-003 | MPS-FEA-004, 005, 010 | OUT-FAM-001, OUT-ADM-002 | Approved |
| MPS-REQ-013 | Hand off eligible registration through the current program-specific external checkout URL or an approved beta test path without treating initiation as successful payment. | Parent, payment processor | MPS-WFL-003 | MPS-FEA-004 | OUT-FAM-001, OUT-BIZ-002 | Approved |
| MPS-REQ-014 | Maintain one authoritative enrollment state across family, roster, and administrative views and prevent duplicate enrollment or double-charge behavior during retries. | Parent, admin | MPS-WFL-003, 007 | MPS-FEA-004, 006, 007 | OUT-FAM-003, OUT-ADM-001 | Approved |
| MPS-REQ-015 | Give a parent a family dashboard showing each student's current enrollments, waitlists, schedules, program changes, announcements, learning resources, and any required next action. | Parent | MPS-WFL-007 | MPS-FEA-006 | OUT-FAM-003 | Approved |
| MPS-REQ-016 | Let authorized administrators create, review, publish, open, close, reschedule, cancel, complete, and archive programs while preserving state history. | Admin, owner | MPS-WFL-005 | MPS-FEA-007 | OUT-ADM-001, OUT-ADM-002 | Approved |
| MPS-REQ-017 | Let authorized administrators manage educator assignments, family enrollments, enrollment states, and accurate rosters without granting educators organization-level control. | Admin, educator | MPS-WFL-003, 005, 006 | MPS-FEA-007, 008 | OUT-EDU-001, OUT-ADM-001 | Approved |
| MPS-REQ-018 | Restrict an educator's workspace to assigned programs, schedules, rosters, approved student fields, resources, and program-scoped communications. | Educator | MPS-WFL-006 | MPS-FEA-008, 010 | OUT-EDU-001, OUT-EDU-002 | Approved |
| MPS-REQ-019 | Let permitted educators and administrators create, publish, replace, and remove program announcements and learning resources with a visible content state. | Educator, admin | MPS-WFL-006, 007 | MPS-FEA-009 | OUT-FAM-003, OUT-EDU-002 | Approved |
| MPS-REQ-020 | Keep authoritative published program identity, schedule, educator, price presentation, availability, and status consistent across public, family, educator, and administrative experiences. | All roles | MPS-WFL-001, 005, 006, 007 | MPS-FEA-001, 002, 006, 007, 008 | OUT-FAM-003, OUT-ADM-001 | Approved |
| MPS-REQ-021 | Provide an observable confirmation, current state, and recovery action for submitted, pending, failed, expired, waitlisted, blocked, canceled, and completed user actions. | All roles | MPS-WFL-001 through 008 | All Must features | OUT-FAM-001, OUT-FAM-003, OUT-ADM-002 | Approved |
| MPS-REQ-022 | Preserve enough beta-review evidence to demonstrate each approved beta success signal and classify Samantha's feedback without silently changing scope. | Owner, admin | MPS-WFL-008 | MPS-FEA-007 | OUT-BIZ-001 | Approved |
| MPS-REQ-023 | Make all Must-priority public and authenticated workflows usable across supported phone, tablet, and desktop contexts and meet the approved accessibility standard delegated to MDS. | All human actors | MPS-WFL-001 through 008 | All Must features | OUT-FAM-001, OUT-FAM-003, OUT-EDU-002 | Approved |
| MPS-REQ-024 | Preserve an attributable history of material administrative changes to program state, pricing presentation, schedule, capacity, enrollment state, educator assignment, consent version, and published content. | Admin, owner | MPS-WFL-003, 005, 006, 008 | MPS-FEA-007, 009, 010 | OUT-ADM-001, OUT-BIZ-001 | Approved |

## Approved business rules

| ID | Rule |
|---|---|
| MPS-RUL-001 | Each program uses either instant confirmation or administrator approval as configured. |
| MPS-RUL-002 | Capacity behavior is program-specific; waitlisting does not collect payment unless Samantha later approves it. |
| MPS-RUL-003 | Program communications remain authorized and scoped; sensitive family matters remain private. |
| MPS-RUL-004 | Financial exceptions are handled manually under existing policy; the beta records status but does not decide or issue outcomes. |
| MPS-RUL-005 | Only administrators or Samantha publish program, price, availability, registration, or cancellation changes. |
| MPS-RUL-006 | Beta student profiles collect only approved minimum fields. |
| MPS-RUL-007 | Sample or sanitized student data is required while owner policy remains incomplete. |
| MPS-RUL-008 | Parent authority and applicable consent are required before profile creation or enrollment. |
| MPS-RUL-009 | Accepted consent retains policy version and acceptance time; renewed consent is supported. |
| MPS-RUL-010 | Agents may use only Samantha-approved policy language. |

## Cross-system responsibilities

### MDS must define

- Responsive information architecture and role-specific experience patterns
- Accessible interaction, form, error, empty, loading, pending, blocked, and confirmation states
- Clear differentiation of enrollment, waitlist, payment, program, consent, and content states
- Privacy-aware presentation of student and family information
- Accessibility standard and visual verification method

### MTS must define

- Authentication, authorization, role and assignment enforcement
- Student and family data boundaries, encryption, retention support, and auditability
- Existing-payment-provider integration and trustworthy payment-state reconciliation
- Notification, file/resource, consent-record, and audit-history architecture
- Monitoring, recovery, test environments, and protection against duplicate or replayed actions

## Open blocking policy

GAP-005 and GAP-010 remain unresolved until Samantha completes the applicable checklist sections. Under EXC-001, private beta design, content import, and owner walkthrough may proceed with sample or sanitized family data, published website content, and the current external checkout handoff. This does not authorize real-family activation, invented policy, automated financial exceptions, or an unverified claim of successful payment.

## Approval record

MPS-REQ-007 through MPS-REQ-024 were approved on August 26, 2026. Authoritative handoff remains blocked by GAP-005 and GAP-010.
