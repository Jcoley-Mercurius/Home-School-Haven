# MTS State Schema v1.1

Use YAML, JSON, or equivalent structured state while preserving these semantics.

## Contents

- Root and lifecycle
- Standard decisions
- Capabilities and candidates
- Architecture and governance
- Artifacts and gates
- Integrity rules

## Root

```yaml
mts:
  system: Mercurius Technology System
  schema_version: "1.1"
  project_id:
  project_name:
  lifecycle: draft
  mts_version:
  current_gate: discovery
  mps_project_id:
  mps_version:
  mds_project_id:
  mds_version:
  created_at:
  updated_at:
```

Lifecycle: `draft | approved | active | evolving | major_evolution | archived`

Gate: `discovery | inspection | capability_mapping | research | recommendation | approval | implementation_readiness | verification`

## Standard decision

```yaml
id: MTS-DEC-###
area:
key:
value:
status: observed
source:
rationale:
approved_at:
introduced_version:
deprecated_version:
dependencies: []
```

Status: `observed | inferred | proposed | approved | deprecated`

## Capability

```yaml
id: MTS-CAP-###
name:
family:
requirement:
need_status: unknown
priority:
source:
existing_implementation: []
data_classes: []
trust_boundaries: []
constraints: []
mds_impacts: []
strategy:
candidates: []
approved_selection:
implementation_status: absent
validation_status: unverified
dependencies: []
risks: []
```

Need: `unknown | required | optional | deferred | not_applicable`

Implementation: `absent | existing | partial | planned | implemented | validated | deprecated`

Validation: `unverified | partially_verified | verified | failed`

## Candidate

Track provider/product, technology layer, current sources, `verified_at`, fit, constraints, security/privacy, cost posture, operational burden, portability, MDS impacts, confidence, and selection status.

Selection: `unassessed | researching | proposed | approved | rejected | superseded`

## Architecture

Track runtime/deployment, data stores, identity/authorization, services/integrations, APIs/events/jobs, observability, analytics/consent, AI, security controls, recovery, and environment boundaries.

## Governance

Track decisions, gaps, risks, exceptions, deviations, changes, versions, and research records with stable IDs.

Risk severity: `critical | high | medium | low | observation`

## Artifacts

Track path, status, source decisions, and last update for state, technology blueprint, capability matrix, integration manifest, security architecture, implementation plan, AGENTS.md, QA protocol, and verification report.

Artifact status: `missing | draft | current | outdated | regeneration_required | not_applicable`

## Gate state

Track `not_started | in_progress | blocked | complete`, requirements, blockers, and completion time.

## Integrity rules

- Maintain one canonical MTS state per product.
- Link the consumed MPS project/version when present.
- Link MDS project/version when present.
- Unknown is not not-applicable.
- Installed is not approved.
- Proposed is not approved.
- Gap, risk, exception, and deviation are distinct.
- Retain historical decisions and research dates.
- Trace authoritative outputs to approved state.
