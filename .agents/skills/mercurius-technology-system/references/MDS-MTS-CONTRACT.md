# MPS–MDS–MTS Operating Contract v1.0

## Authority

| Concern | Authority |
|---|---|
| Purpose, users, outcomes, scope, priorities | MPS |
| Workflows, role intent, requirements, business rules | MPS |
| Acceptance criteria, metrics, release intent | MPS |
| Brand, visual language, tokens, components, layout | MDS |
| Interaction and responsive design rules | MDS |
| Design accessibility behavior | MDS |
| Framework, services, integrations, data architecture | MTS |
| Authentication, authorization, secrets, tenancy | MTS |
| Observability, analytics, reliability, deployment | MTS |
| Rendered product quality | Shared |

## Flow

**MPS → MDS → MTS → IMPLEMENTATION → COMBINED VALIDATION**

MPS defines what must be true. MDS defines how people experience it. MTS defines how technology supports and protects it.

## Handoff

Normally start MTS during MDS implementation readiness, after the product experience and required states are sufficiently defined and before major stack commitments.

MPS supplies approved capabilities, roles, policies, data-lifecycle intent, constraints, metrics, and failure/recovery expectations.

MDS supplies:

- approved state and active version
- product/platform scope
- component, pattern, interaction, and responsive requirements
- accessibility target
- canonical UI references
- implementation constraints already approved

MTS returns:

- approved technology blueprint
- capability and integration manifests
- technical constraints and data flows
- new user-facing states required by technology
- implementation order and technical QA

## Feedback protocol

Send missing purpose, scope, workflow, policy, role intent, or acceptance decisions to MPS.

Do not let MTS silently change MDS. When technology introduces a reusable experience need, create a proposed MDS requirement or gap. Examples include authentication, consent, publishing, payment, offline, rate-limit, degraded-service, and recovery states.

Do not let MDS imagery decide server/client boundaries, database design, security architecture, APIs, or deployment topology.

MDS and MTS may explore proposed MPS inputs when clearly labeled draft. They must not treat unresolved product policy as authoritative or finalize production behavior against it.

## Shared implementation

Merge MPS, MDS, and MTS instructions into one project `AGENTS.md` without duplicating or weakening authority. Resolve conflicts by concern, not by whichever artifact was edited last.

## Shared definition of done

Require MPS acceptance, functional correctness, engineering checks, MDS compliance, MTS verification, responsive behavior, accessibility, security controls, and truthful reporting.
