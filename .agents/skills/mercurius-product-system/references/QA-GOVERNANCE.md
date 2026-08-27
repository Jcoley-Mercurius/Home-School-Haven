# MPS QA & Governance Standard v1.0

## Gate 1 — Scope Compliance

Verify implemented capabilities match the approved release; required scope is present; excluded/deferred scope did not enter silently; and changes trace to approved IDs.

## Gate 2 — Workflow & State Compliance

Verify main, alternate, failure, cancellation, timeout, retry, and recovery paths; state transitions; ownership; notifications; and postconditions.

## Gate 3 — Rules, Roles & Acceptance

Verify business-rule precedence/exceptions, actor eligibility and intended authority, edge cases, and every applicable acceptance criterion with evidence.

## Gate 4 — Outcome & Measurement Readiness

Verify approved metrics are defined consistently, instrumentation requirements are implemented or explicitly pending, guardrails are represented, and delivery is not misreported as achieved outcome.

## Gate 5 — MDS/MTS Synchronization

Verify the implementation consumes the approved MPS version, applicable experience requirements are represented in MDS, applicable capability/security requirements are represented in MTS, and downstream gaps are recorded.

## Results

- `PASS`
- `PASS WITH APPROVED EXCEPTIONS`
- `REVIEW REQUIRED`
- `FAIL`

Use severity `critical`, `major`, `minor`, or `observation`. Record evidence and distinguish `unverified`, `partially_verified`, `verified`, and `failed`.

Never claim acceptance passed without testing it. Never call implementation QA market validation or product-market fit.

## Governance loop

Use:

**DISCOVER → CLASSIFY → DECIDE → UPDATE → IMPLEMENT → VALIDATE**

Determine whether repeated deviations indicate product drift, stale MPS, or a legitimate product evolution.

## Versioning

- Patch: clarification with no intended product behavior change.
- Minor: backward-compatible capability, feature, workflow, rule, or release addition.
- Major: breaking purpose, authority, workflow, economics, or policy change.
