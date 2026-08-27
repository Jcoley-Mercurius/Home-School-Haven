# MTS Security Standard v1.0

Apply this standard proportionally to risk. It is an engineering control framework, not a certification.

## Required analysis

- assets, actors, roles, and administrative powers
- data classification, ownership, residency, retention, deletion, and export
- trust boundaries and server/client separation
- authentication, authorization, tenant/workspace scope, and object ownership
- secrets, keys, tokens, rotation, and environment separation
- input validation, output encoding, file handling, and dependency risk
- network/API exposure, rate limits, abuse controls, and denial-of-service posture
- logs, analytics, audit records, and personal-data minimization
- backup, restore, rollback, migrations, and incident recovery
- third-party subprocessors, permissions, outage behavior, and exit path

## Mandatory implementation principles

- Keep private credentials server-side and out of source control.
- Treat browser-visible values as public even when named "secret".
- Derive authorization from authenticated server context; do not trust client-supplied role or tenant identifiers.
- Enforce least privilege and deny by default.
- Isolate tenant/workspace data at every relevant layer.
- Validate all untrusted input and external responses.
- Verify webhook authenticity; handle replay, idempotency, ordering, and retries.
- Avoid private data in URLs, analytics, logs, prompts, error messages, and client payloads.
- Restrict administrative and service-role operations.
- Pin or manage dependencies using repository conventions and review supply-chain impact.
- Test failure paths and controls.

## AI-specific controls

- Define what data may reach models and retrieval systems.
- Treat retrieved content and model output as untrusted.
- Restrict tools by identity, scope, and action.
- Defend against prompt injection crossing trust boundaries.
- Require human confirmation for consequential actions where appropriate.
- Prevent secrets and hidden instructions from entering prompts or outputs.
- Evaluate quality and safety on representative cases.

## Evidence rule

Record what was inspected and tested. Use `unverified`, `partially_verified`, or `verified` precisely. Never translate absence of a finding into proof of security.
