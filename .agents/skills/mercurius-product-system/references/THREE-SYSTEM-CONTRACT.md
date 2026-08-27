# MPS–MDS–MTS Operating Contract v1.0

## Authority

| Concern | Authority |
|---|---|
| Purpose, users, outcomes, scope, priorities | MPS |
| Workflows, role intent, requirements, business rules | MPS |
| Acceptance criteria, success metrics, release intent | MPS |
| Visual language, components, layout, interaction design | MDS |
| Responsive and design accessibility behavior | MDS |
| Technology, services, integrations, data architecture | MTS |
| Authentication enforcement, security, tenancy, operations | MTS |
| Implemented product | Codex/coding agents consume all three |

## Primary flow

**MPS → MDS → MTS → IMPLEMENTATION → COMBINED VALIDATION**

MPS defines what must be true. MDS defines how people experience it. MTS defines how technology supports and protects it.

## Handoffs

MPS supplies MDS with approved users, workflows, states, scope, rules, accessibility-relevant user context, and acceptance intent.

MPS supplies MTS with approved capabilities, roles, policies, data-lifecycle intent, scale/business constraints, metrics, and failure/recovery expectations.

MDS returns experience decisions and product gaps. MTS returns technical constraints, technology-created states, risks, and product-policy gaps.

MDS and MTS may explore proposed MPS inputs when clearly labeled draft. They must not treat unresolved product policy as authoritative or finalize production behavior against it.

## Feedback routing

- Send missing purpose, scope, workflow, policy, role intent, or acceptance decisions to MPS.
- Send missing visual, interaction, responsive, component, or design-accessibility decisions to MDS.
- Send missing architecture, provider, data/security, integration, deployment, or operations decisions to MTS.
- Never let one system silently decide another system's concern.

## Shared implementation

Merge applicable instructions into one project `AGENTS.md`. Resolve conflicts by authority, not file order. Trace implementation work to approved MPS requirements, MDS decisions, and MTS architecture.

## Shared definition of done

Require product acceptance, functional correctness, MDS compliance, MTS verification, accessibility, security, operational readiness, and truthful evidence. One system passing does not imply the complete product passes.
