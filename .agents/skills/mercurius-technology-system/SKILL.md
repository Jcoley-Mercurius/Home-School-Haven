---
name: mercurius-technology-system
description: Create, continue, audit, recommend, implement, validate, and evolve a Mercurius Technology System (MTS) for software products. Use when the user says "Mercurius Technology System", "MTS", wants to choose or audit an application stack, asks what services or integrations should power approved MPS product requirements and an MDS experience architecture, compares tools such as analytics/CMS/auth/database/AI/security providers, needs a technology blueprint or integration manifest, wants secure implementation guidance for coding agents, or needs technical architecture and integration QA. Preserve approved decisions and coordinate with the Mercurius Product System and Mercurius Design System without replacing their authority.
---

# Mercurius Technology System

Operate MTS as a state-driven technology architecture system, not as a vendor list.

Core principle:

> **Choose deliberately. Store decisions once. Integrate securely. Validate continuously.**

Use this lifecycle:

**DISCOVER → INSPECT → MAP → RESEARCH → RECOMMEND → APPROVE → IMPLEMENT → VERIFY → GOVERN**

Recommend technology only when it solves an evidenced product need. Prefer the smallest coherent architecture that satisfies approved requirements.

## 1. Select the operating mode

Infer the mode naturally; do not require command syntax.

- Use **CREATE** to start MTS for a product.
- Use **CONTINUE** to resume existing MTS state.
- Use **AUDIT** to assess an existing codebase, stack, or integration.
- Use **RECOMMEND** to research and compare technologies for a capability.
- Use **UPDATE** to change an approved technology decision.
- Use **HANDOFF** to prepare the approved technology blueprint for coding agents.
- Use **IMPLEMENT** only when the user asks to modify the codebase.
- Use **VERIFY** to test implemented architecture, integrations, and security controls.
- Use **STATUS** to report progress, gaps, stale artifacts, and next action.
- Use **HEALTH** for a broader architecture, dependency, security, cost, and drift review.

## 2. Inspect before asking

Before asking project questions:

1. Search the project, repository, supplied files, and conversation for MTS state.
2. Read applicable MPS and MDS state and implementation artifacts when present.
3. Inspect the codebase, package manifests, configuration, infrastructure, environment-variable names, schemas, tests, and deployment files.
4. Inventory existing services, SDKs, libraries, agent skills, plugins, and MCP connectors.
5. Determine the current lifecycle, gate, approved decisions, proposed decisions, gaps, risks, exceptions, deviations, and artifact status.
6. Resume the highest-priority unresolved item.

Do not ask the user for facts available through inspection. Never expose secret values while inspecting. Record environment-variable names and purpose, not credentials.

If MTS state does not exist, initialize `mts/MTS-PROJECT-STATE.yaml` from `assets/MTS-PROJECT-STATE.yaml` or run `scripts/init_mts_state.py`.

## 3. Preserve the three-system boundary

Read `references/MDS-MTS-CONTRACT.md` whenever MPS or MDS exists or the request connects product/design architecture to technical implementation. The retained filename is the compatibility path for the current MPS–MDS–MTS contract.

- Treat MPS as authority for product purpose, users, outcomes, scope, workflows, role intent, requirements, business rules, acceptance criteria, metrics, and release intent.
- Treat MDS as authority for visual language, components, layout, interaction patterns, responsive behavior, and design accessibility rules.
- Treat MTS as authority for application architecture, services, integrations, data/security boundaries, operational tooling, and technical implementation decisions.
- Consume approved MPS requirements; do not convert technology constraints into product policy.
- Consume approved MDS requirements; do not rewrite MDS decisions.
- Return missing purpose, scope, workflow, policy, authority, or acceptance decisions to MPS as product gaps.
- Return technology-created experience requirements—such as authentication, consent, publishing, payment, failure, loading, and offline states—to MDS as proposed requirements or gaps.
- Begin MTS normally at MDS implementation readiness, before major technical implementation decisions. Also support later audits of existing products.

If MPS is absent, MTS may establish enough requirements context to assess technology, but must not invent high-impact product policy.

## 4. Use disciplined decision states

Classify significant information as:

- **observed** — evidenced in requirements, documentation, code, or configuration
- **inferred** — likely but not authoritative
- **proposed** — recommended for approval
- **approved** — authoritative MTS state
- **deprecated** — retained history that is no longer current

Only approved selections propagate into authoritative implementation artifacts. Do not treat an installed package as an approved architecture decision merely because it exists.

Use these governance terms precisely:

- **Gap:** a required reusable technical decision is missing.
- **Exception:** an approved implementation intentionally differs from the MTS rule.
- **Deviation:** implementation differs from MTS without approval.
- **Risk:** a condition could harm security, privacy, reliability, cost, portability, or delivery.

## 5. Move through the MTS gates

Treat gates as evidence thresholds, not section headings. Do not claim a later gate is active or complete until prior applicable gates have enough evidence and blocking unknowns are recorded. A product summary may support an initial capability hypothesis, but it does not by itself establish an approved stack.

### Gate 1 — Discovery

Establish product, users, platforms, business stage, delivery constraints, regulatory context, scale assumptions, budget posture, team capability, and approved MPS/MDS inputs.

Identify missing constraints that could disqualify a technology before researching providers. Ask a focused group of blocking questions when geography, regulated data, minors, payment responsibility, scale, deployment restrictions, budget, or team capability would materially change the architecture.

### Gate 2 — Inspection

Inspect the actual codebase and deployment environment. Classify existing technology as:

- **KEEP** — suitable and aligned
- **EXTEND** — suitable but incomplete
- **REPLACE** — materially conflicts with approved needs
- **DEPRECATE** — retain temporarily; stop expanding
- **REMOVE** — unnecessary or unsafe, subject to explicit approval
- **UNKNOWN** — more evidence required

Avoid rewrites when existing technology can satisfy the need safely.

### Gate 3 — Capability Mapping

Map required, optional, deferred, and not-applicable capabilities. Read `references/CAPABILITY-STANDARD.md`.

Start with the product need, not a provider. Separate:

- production service
- SDK or code package
- agent skill
- plugin/app connector
- MCP server
- internal custom implementation

Trace capabilities to approved MPS requirements/outcomes when MPS exists. Report an unapproved product need to MPS instead of allowing a provider recommendation to create scope.

### Gate 4 — Research

Read `references/RESEARCH-SELECTION-STANDARD.md`.

For any external product recommendation, research current first-party documentation. Verify relevant availability, supported frameworks, security model, pricing posture, limits, data handling, deployment model, and maintenance status. Record sources and `verified_at` dates.

Research only after the requirement and disqualifying constraints are defined. If the user requests early direction, provide a clearly labeled provisional shortlist and state what evidence is still required before recommendation.

Search for existing applicable skills, plugins, and connectors before proposing a new agent capability. Do not recreate a vendor-specific skill when an appropriate maintained skill already exists.

### Gate 5 — Recommendation

Compare viable candidates against explicit requirements and constraints. Include:

- the problem and why action is needed
- keep/build/buy/replace decision
- recommended option and material alternatives
- evidence, assumptions, and unknowns
- integration fit and implementation effort
- security/privacy posture
- current and scaling cost posture
- reliability and operational burden
- portability and exit considerations
- user-facing states MDS must define
- recommendation confidence

Avoid false precision. A score without evidence is not a decision.

Do not label a provider stack as recommended until applicable discovery, inspection, capability mapping, and current research are complete. Before then, label options `provisional`, `conditional`, or `research candidate`.

### Gate 6 — Approval

Ask for approval when selecting a provider, introducing a persistent dependency, changing data flow, adding recurring cost, creating vendor lock-in, or changing a reusable security/architecture rule.

Do not silently install, subscribe to, connect, or configure an external service. Do not propagate proposed technology as approved.

Technology approval does not approve unresolved product policy. Route money, eligibility, authority, safety, privacy, legal, retention, irreversible-action, and AI-policy decisions to MPS.

### Gate 7 — Implementation Readiness

Produce or reconcile:

- `mts/TECHNOLOGY-BLUEPRINT.md`
- `mts/CAPABILITY-MATRIX.md`
- `mts/INTEGRATION-MANIFEST.md`
- `mts/SECURITY-ARCHITECTURE.md`
- `mts/IMPLEMENTATION-PLAN.md`
- `mts/qa/MTS-QA.md`
- `AGENTS.md` MTS sections
- canonical MTS state

Record the consumed MPS and MDS versions. Merge applicable MPS, MDS, and MTS instructions into one project-level `AGENTS.md`.

Use `references/ARTIFACT-TEMPLATES.md` and `references/AGENTS-TEMPLATE.md`. Never invent repository paths.

### Gate 8 — Verification

Use `references/QA-GOVERNANCE.md`. Verify the real implementation, not the intended architecture.

## 6. Apply the security gate to every integration

Read `references/SECURITY-STANDARD.md` before recommending or implementing authentication, authorization, databases, storage, analytics, AI, payments, messaging, webhooks, personal data, multi-tenancy, administrative access, or secrets.

At minimum:

- classify data and trust boundaries
- keep secrets out of clients, source, logs, analytics, URLs, and artifacts
- distinguish public client identifiers from private credentials
- enforce authorization and tenant/workspace scope server-side
- apply least privilege
- validate untrusted input and external responses
- verify webhook signatures and design for replay/idempotency
- minimize personal data and define retention/deletion behavior
- protect AI prompts, tool access, retrieval sources, and model outputs
- define failure, rollback, migration, and recovery behavior
- test controls instead of claiming them

Never claim an application is secure, compliant, or production-ready without evidence appropriate to that claim.

## 7. Implement approved architecture faithfully

When the user asks to implement:

1. Confirm the selection is approved or obtain approval.
2. Inspect repository conventions and official current implementation documentation.
3. Plan incremental, reversible changes.
4. Preserve working architecture and unrelated user changes.
5. Add the minimum required dependencies and permissions.
6. Keep secret values in the approved secret manager or deployment environment.
7. Add schemas, migrations, validation, authorization, retries, observability, and tests appropriate to the risk.
8. Update state and affected artifacts.
9. Run deterministic checks and relevant manual/runtime tests.
10. Report actual results, remaining setup, risks, MPS product gaps, and MDS experience gaps.

For agent implementation, establish:

> **You implement approved architecture. You do not invent the stack.**

Prefer:

**KEEP → CONFIGURE → EXTEND → INTEGRATE → BUILD → REPLACE**

## 8. Propagate approved changes

Read `references/PROPAGATION-MAP.md`.

For every meaningful approved change:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

Update only affected artifacts. Mark stale artifacts accurately. Preserve decision history and migration/rollback requirements.

## 9. Keep canonical project state

Use `references/STATE-SCHEMA.md`.

State must answer:

- What product and MPS/MDS versions does this architecture support?
- What capabilities are required and why?
- What technology exists now?
- What has been researched, proposed, approved, implemented, and validated?
- What data and trust boundaries exist?
- Which artifacts are current or stale?
- What gaps, risks, exceptions, and deviations remain?
- What should happen next?

State is canonical. Blueprints, manifests, code, and reports consume it.

## 10. Report status and health

For **STATUS**, report lifecycle/version, current gate, approved stack, unresolved selections, open gaps/risks, exceptions/deviations, stale artifacts, blockers, and next action.

For **HEALTH**, evaluate architecture fit, dependency health, security controls, data flows, cost drift, service overlap, unused integrations, version drift, vendor concentration, observability, recovery readiness, MDS synchronization, and QA evidence.

Return `GOOD`, `ATTENTION`, or `DEGRADED` with evidence and prioritized actions.

## 11. Define success

The skill succeeds when:

- every technology maps to an evidenced capability
- MDS and MTS remain synchronized without overlapping authority
- MPS requirements trace into MTS capabilities without technology creating product policy
- existing suitable technology is reused
- current primary sources support external recommendations
- approved decisions are remembered and traceable
- security and data boundaries are explicit
- coding agents receive deterministic implementation guidance
- implementations are verified honestly
- architecture can evolve without uncontrolled drift or vendor sprawl

## Final rule

**Solve the requirement, protect the system, minimize complexity, and prove the result.**
