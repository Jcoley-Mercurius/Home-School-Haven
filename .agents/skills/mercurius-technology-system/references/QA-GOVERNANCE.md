# MTS QA & Governance Standard v1.0

## Gate 1 — Architecture Compliance

Verify approved technologies, deployment/environment boundaries, repository mapping, package/configuration consistency, data stores, service responsibilities, and absence of unapproved overlapping capability.

## Gate 2 — Integration & Data Integrity

Verify API/SDK usage, input/output validation, schemas/migrations, events/webhooks/jobs, idempotency/retries/timeouts, error handling, data ownership, environment configuration, and failure/degraded-service behavior.

## Gate 3 — Security & Privacy

Verify secret handling, authentication, server-side authorization, tenant/workspace isolation, least privilege, administrative access, logging/analytics privacy, personal-data minimization, AI trust boundaries, dependency risk, and relevant abuse controls.

## Gate 4 — Reliability & Operations

Verify observability, alerting, quotas/rate limits, backup/restore, rollback, incident/recovery behavior, cost controls, external-service outage behavior, and operational ownership.

## Gate 5 — MPS/MDS Synchronization

Verify that technology traces to approved MPS requirements, unresolved product policy is recorded as MPS gaps, technology-created user states are represented in approved MDS or recorded as MDS gaps, and implementation remains visually/accessibly compliant.

## Results

- `PASS`
- `PASS WITH APPROVED EXCEPTIONS`
- `REVIEW REQUIRED`
- `FAIL`

Use severity `critical`, `major`, `minor`, or `observation`. Record evidence and distinguish `unverified`, `partially_verified`, `verified`, and `failed`.

Never claim a check passed without running it. Never call absence of a detected issue proof of security.

## Governance loop

Use:

**DISCOVER → CLASSIFY → DECIDE → UPDATE → IMPLEMENT → VALIDATE**

Determine whether repeated deviations indicate implementation drift, a stale integration manifest, or a legitimate need to evolve MTS.

## Versioning

- Patch: clarification with no intended architecture/behavior change.
- Minor: backward-compatible capability, integration, or control addition.
- Major: breaking provider, data, security, deployment, or foundational architecture change.
