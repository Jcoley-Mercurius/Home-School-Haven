# MPS Dependency & Propagation Map v1.0

## Dependency classes

- **STATE** — canonical MPS state
- **BLUEPRINT** — product definition
- **SCOPE** — MVP/release plan
- **WORKFLOW** — user/operational flows and state model
- **REQUIREMENT** — requirements/rules/acceptance
- **METRIC** — outcomes and measurement
- **MDS** — experience design state/artifacts
- **MTS** — technology state/artifacts
- **AGENT** — project `AGENTS.md`
- **CODE** — implementation
- **TEST** — automated/manual acceptance evidence
- **GOVERNANCE** — decisions, changes, versions, gaps, risks

## Master map

| Product change | Likely propagation |
|---|---|
| Purpose/outcome | STATE, BLUEPRINT, SCOPE, REQUIREMENT, METRIC, MDS, MTS, GOVERNANCE |
| User/actor | STATE, BLUEPRINT, WORKFLOW, REQUIREMENT, MDS, MTS, AGENT, TEST |
| Scope/release | STATE, SCOPE, REQUIREMENT, MDS, MTS, AGENT, CODE, TEST |
| Workflow/state | STATE, WORKFLOW, REQUIREMENT, MDS, MTS, AGENT, CODE, TEST |
| Business rule/policy | STATE, WORKFLOW, REQUIREMENT, MDS, MTS, AGENT, CODE, TEST, GOVERNANCE |
| Acceptance criterion | REQUIREMENT, MDS when experiential, MTS when technical, AGENT, TEST |
| Metric | STATE, METRIC, MTS instrumentation, MDS consent/feedback, TEST |
| MDS finding | STATE when it exposes a product gap; affected product artifacts |
| MTS finding | STATE when it exposes a product gap; affected product artifacts |

## Change workflow

Use:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

Do not propagate proposed decisions as authoritative. Mark downstream artifacts stale before claiming synchronization. Do not update unaffected artifacts. Preserve history and communicate breaking product changes.
