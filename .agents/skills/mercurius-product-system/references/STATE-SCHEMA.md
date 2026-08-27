# MPS State Schema v1.0

Use YAML, JSON, or equivalent structured state while preserving these semantics.

## Contents

- Root and lifecycle
- Decisions, outcomes, users, and scope
- Workflows, requirements, rules, acceptance, and metrics
- Releases, downstream systems, governance, artifacts, and gates
- Integrity rules

## Root

```yaml
mps:
  system: Mercurius Product System
  schema_version: "1.0"
  project_id:
  project_name:
  lifecycle: draft
  mps_version:
  current_gate: discovery
  created_at:
  updated_at:
```

Lifecycle: `draft | approved | active | evolving | major_evolution | archived`

Gate: `discovery | outcomes | users | scope_priority | workflows_states | requirements_acceptance | approval_handoff | product_validation`

## Standard decision

```yaml
id: MPS-DEC-###
area:
key:
value:
status: observed
source:
rationale:
owner:
approved_at:
introduced_version:
deprecated_version:
dependencies: []
```

Status: `observed | inferred | proposed | approved | deprecated`

## Core records

Track stable objects:

- outcomes: `MPS-OUT-###`
- actors/users: `MPS-ACT-###`
- capabilities: `MPS-CAP-###`
- features: `MPS-FEA-###`
- workflows: `MPS-WFL-###`
- business rules: `MPS-RUL-###`
- requirements: `MPS-REQ-###`
- acceptance criteria: `MPS-ACC-###`
- metrics: `MPS-MET-###`
- releases: `MPS-REL-###`

Each record tracks status, source/rationale, dependencies, release, downstream impacts, and applicable links in the traceability chain.

## Requirement

```yaml
id: MPS-REQ-###
statement:
rationale:
status: proposed
priority:
release:
actors: []
outcomes: []
workflows: []
rules: []
acceptance: []
mds_dependencies: []
mts_dependencies: []
implementation_status: absent
validation_status: unverified
evidence: []
```

Implementation: `absent | planned | partial | implemented | validated | deprecated`

Validation: `unverified | partially_verified | verified | failed`

## Scope

Track MVP/release scope, Now/Next/Later, out-of-scope, dependencies, assumptions, constraints, and experiments.

Priority: `must | should | could | wont_this_release`

## Downstream synchronization

```yaml
downstream:
  mds:
    project_id:
    version:
    status:
    last_synchronized:
    open_product_gaps: []
  mts:
    project_id:
    version:
    status:
    last_synchronized:
    open_product_gaps: []
  implementation:
    status:
    manifest:
    last_validated:
```

## Governance

Track decisions, assumptions, gaps, risks, exceptions, deviations, changes, versions, and validation findings with stable IDs.

Severity: `critical | major | minor | observation`

## Artifacts

Track path, status, generated-from IDs, and last update for state, blueprint, outcomes/metrics, user/role model, scope/release plan, workflows, requirements/rules, acceptance, implementation manifest, AGENTS.md, QA protocol, and validation report.

Artifact status: `missing | draft | current | outdated | regeneration_required | not_applicable`

## Gate state

Track `not_started | in_progress | blocked | complete`, requirements, blocking items, and completion time.

## Integrity rules

- Maintain one canonical MPS state per product.
- Approved product truth outranks downstream interpretation.
- Unknown is not not-applicable.
- Proposed is not approved.
- Implemented is not validated.
- Delivery is not outcome validation.
- Gap, risk, assumption, exception, and deviation are distinct.
- Retain historical decisions and release context.
- Trace authoritative outputs to approved state.
