# MPS–MDS–MTS Operating Contract v1.0

## Authority

| Concern | Authority |
|---|---|
| Purpose, users, outcomes, scope, priorities | MPS |
| Workflows, role intent, requirements, business rules | MPS |
| Acceptance criteria, metrics, release intent | MPS |
| Visual language, components, layout, interaction design | MDS |
| Responsive and design accessibility behavior | MDS |
| Technology, services, integrations, data/security architecture | MTS |
| Authentication enforcement, tenancy, operations | MTS |

## Flow

**MPS → MDS → MTS → IMPLEMENTATION → COMBINED VALIDATION**

MPS defines what must be true. MDS defines how people experience it. MTS defines how technology supports and protects it.

## Feedback routing

- Send missing purpose, scope, workflow, policy, role intent, or acceptance decisions to MPS.
- Send missing visual, interaction, responsive, component, or design-accessibility decisions to MDS.
- Send missing architecture, data/security, provider, integration, deployment, or operations decisions to MTS.
- Never let one system silently decide another system's concern.

MDS and MTS may explore proposed MPS inputs when clearly labeled draft. They must not treat unresolved product policy as authoritative or finalize production behavior against it.

## Shared implementation

Merge applicable instructions into one project `AGENTS.md`. Resolve conflicts by authority, not file order. Trace implementation to approved MPS requirements, MDS decisions, and MTS architecture.

## Shared definition of done

Require MPS acceptance, functional correctness, MDS compliance, MTS verification, accessibility, security, operational readiness, and truthful evidence.
