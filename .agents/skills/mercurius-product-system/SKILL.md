---
name: mercurius-product-system
description: Create, continue, define, prioritize, hand off, audit, validate, and evolve a Mercurius Product System (MPS) for software products. Use when the user says "Mercurius Product System", "MPS", wants to turn an idea into a build-ready product definition, define users/problems/outcomes/MVP/features/workflows/roles/business rules/acceptance criteria/success metrics/releases, prepare product requirements for MDS and MTS, resolve product gaps before coding, or validate whether an implemented app fulfills approved product requirements. Preserve approved product decisions and coordinate with the Mercurius Design System and Mercurius Technology System without replacing their authority.
---

# Mercurius Product System

Operate MPS as a state-driven product definition system, not as a one-time PRD.

Core principle:

> **Define the right product. Store decisions once. Build only what is approved. Prove what works.**

Use this lifecycle:

**DISCOVER → DEFINE → MODEL → PRIORITIZE → SPECIFY → APPROVE → HAND OFF → VALIDATE → EVOLVE**

Maintain traceability:

**OUTCOME → USER PROBLEM → REQUIREMENT → WORKFLOW/RULE → ACCEPTANCE → MDS/MTS DEPENDENCY → IMPLEMENTATION EVIDENCE**

## 1. Select the operating mode

Infer the mode naturally; do not require command syntax.

- Use **CREATE** to turn an idea or brief into a new MPS.
- Use **CONTINUE** to resume existing MPS state.
- Use **UPDATE** when an approved product decision changes.
- Use **ADD** to add a user, outcome, feature, workflow, rule, criterion, metric, or release.
- Use **PRIORITIZE** to define MVP, release boundaries, or Now/Next/Later.
- Use **HANDOFF** to prepare approved product truth for MDS, MTS, and coding agents.
- Use **AUDIT** to compare an existing product or specification with MPS.
- Use **VALIDATE** to test an implementation against approved requirements.
- Use **STATUS** to report what is complete, missing, stale, blocked, or next.
- Use **HEALTH** to assess product-definition clarity, traceability, scope drift, and evidence.

## 2. Inspect before asking

Before asking project questions:

1. Search the project, repository, supplied files, and conversation for MPS state and product artifacts.
2. Read applicable MDS and MTS state when present.
3. Inspect existing specifications, tickets, workflows, schemas, UI, code, tests, analytics definitions, and release plans.
4. Determine lifecycle, active version, current gate, approved decisions, proposed decisions, gaps, exceptions, deviations, risks, and artifact status.
5. Resume the highest-priority unresolved item.

Do not ask for information already present. Do not treat code, mockups, tickets, or a founder's idea as approved product truth merely because they exist.

If MPS state does not exist, initialize `mps/MPS-PROJECT-STATE.yaml` from `assets/MPS-PROJECT-STATE.yaml` or run `scripts/init_mps_state.py`.

## 3. Preserve the three-system boundary

Read `references/THREE-SYSTEM-CONTRACT.md` whenever MDS, MTS, or implementation is involved.

- Treat **MPS** as authority for product purpose, users, desired outcomes, scope, priorities, workflows, role intent, feature requirements, business rules, acceptance criteria, success metrics, and release intent.
- Treat **MDS** as authority for visual language, components, layouts, interaction design, responsive behavior, and design accessibility.
- Treat **MTS** as authority for technology architecture, services, integrations, data/security boundaries, operational tooling, and technical implementation.
- Let coding agents implement the combined approved systems; do not let implementation silently become product policy.

MPS defines what must be true. MDS defines how people experience it. MTS defines how technology supports and protects it.

## 4. Ask only decision-worthy questions

Before asking:

1. Use approved MPS state if it answers the question.
2. Apply an approved rule if it determines the answer.
3. Inspect supplied evidence and the repository.
4. Make the smallest local clarification when it does not establish reusable product behavior.
5. Ask when the answer establishes or changes product scope, policy, workflow, authority, risk, or success.

Never silently invent high-impact policy. Require explicit approval for decisions involving:

- eligibility, identity, roles, or permissions
- payments, pricing, commissions, payouts, refunds, cancellations, or disputes
- minors, safety, moderation, regulated activity, or legal obligations
- privacy, consent, data retention, deletion, or public visibility
- irreversible actions, ownership transfers, or administrative power
- AI autonomy, consequential recommendations, or human confirmation

Ask focused groups of questions. Avoid turning discovery into an endless interview.

## 5. Use disciplined decision states

Classify significant information as:

- **observed** — evidenced but not yet authoritative
- **inferred** — reasonable interpretation that still needs confirmation
- **proposed** — recommended for approval
- **approved** — authoritative MPS state
- **deprecated** — retained historical decision no longer current

Only approved product decisions propagate authoritatively.

Use these governance terms:

- **Gap:** a required product decision is missing.
- **Exception:** an approved release or case may intentionally differ from a rule.
- **Deviation:** implementation or documentation differs without approval.
- **Risk:** a condition may harm users, outcomes, trust, delivery, economics, or compliance.
- **Assumption:** an unverified belief that materially affects a decision.

## 6. Move through the MPS gates

Treat gates as evidence thresholds. Do not claim a later gate is active or complete until prior applicable gates have enough evidence and blocking items are recorded. Do not jump from an idea to a feature list and call the product defined.

When the user asks for early direction, provide a clearly labeled product hypothesis, provisional scope, or decision brief. Do not call it an approved blueprint, MVP, release definition, or handoff package.

### Gate 1 — Discovery

Establish project/product name, product type, context, business stage, geography, platforms, supplied evidence, decision owners, constraints, known assumptions, and initial scope.

Use the user's product name when provided. Do not invent a brand or product name unless asked. Do not invent numeric segment boundaries, targets, pilot sizes, or market assumptions; label such ideas as hypotheses and state the evidence required.

### Gate 2 — Outcomes

Define the product purpose, problem statement, business outcomes, user outcomes, value proposition, strategic constraints, guardrails, and success signals.

Read `references/DISCOVERY-OUTCOMES-STANDARD.md`.

Do not confuse outputs such as shipping a dashboard with outcomes such as reducing time to complete a task.

### Gate 3 — Users

Define primary, secondary, administrative, operational, and affected non-user actors. Record their jobs, problems, context, eligibility, responsibilities, and intended authority.

Separate product role intent from technical authorization. MPS says what a role may do; MTS determines how it is enforced securely.

### Gate 4 — Scope & Priority

Define capabilities, features, MVP, Now/Next/Later, dependencies, release boundaries, and explicit out-of-scope items.

Read `references/SCOPE-PRIORITIZATION-STANDARD.md`.

Do not use prioritization frameworks to manufacture certainty. Show evidence, assumptions, tradeoffs, and decision ownership.

An early feature list is a provisional capability hypothesis, not approved MVP scope. Promote it into a release only after relevant outcomes, users, constraints, dependencies, and high-impact policy are sufficiently defined.

### Gate 5 — Workflows & States

Model end-to-end workflows, triggers, preconditions, actors, main path, alternate paths, failure paths, state transitions, notifications, ownership, completion, and recovery.

Do not let a collection of screens substitute for a workflow.

### Gate 6 — Requirements, Rules & Acceptance

Read `references/WORKFLOW-REQUIREMENTS-STANDARD.md` and `references/ACCEPTANCE-METRICS-STANDARD.md`.

Define:

- testable feature requirements
- reusable business rules and policies
- role/action expectations
- data concepts and lifecycle intent
- edge cases and failure behavior
- acceptance criteria
- applicable nonfunctional product constraints
- measurement readiness and success metrics

Keep the requirement solution-neutral unless a solution is itself approved product scope. MDS and MTS decide their respective implementation details.

### Gate 7 — Approval & Handoff

Resolve blocking gaps and high-impact assumptions. Establish the approved MPS release and normally activate initial `v1.0`.

Unresolved money, eligibility, authority, safety, privacy, legal, retention, irreversible-action, or AI-policy decisions block authoritative handoff. MDS and MTS may conduct clearly labeled exploration or risk spikes against proposed inputs, but must not treat them as approved product truth or finalize production behavior.

Produce or reconcile:

- `mps/PRODUCT-BLUEPRINT.md`
- `mps/OUTCOMES-METRICS.md`
- `mps/USER-ROLE-MODEL.md`
- `mps/SCOPE-RELEASE-PLAN.md`
- `mps/WORKFLOW-CATALOG.md`
- `mps/REQUIREMENTS-RULES.md`
- `mps/ACCEPTANCE-CRITERIA.md`
- `mps/implementation/PRODUCT-IMPLEMENTATION.md`
- `mps/qa/MPS-QA.md`
- project `AGENTS.md` MPS sections
- canonical MPS state

Use `references/ARTIFACT-TEMPLATES.md` and `references/AGENTS-TEMPLATE.md`. Create only applicable artifacts; do not generate empty paperwork.

### Gate 8 — Product Validation

Use `references/QA-GOVERNANCE.md`.

Validate the real implementation against approved scope, workflows, rules, roles, acceptance criteria, and measurement requirements. Record evidence.

Do not claim market validation, product-market fit, or achieved outcomes from implementation QA alone.

## 7. Build requirements with traceability

Use stable IDs for outcomes, users/actors, features, workflows, rules, acceptance criteria, metrics, gaps, and decisions.

Each buildable feature should trace to:

- at least one approved user problem or outcome
- relevant actors and workflows
- applicable business rules
- testable acceptance criteria
- MDS patterns/states required
- MTS capabilities/security implications
- release placement
- implementation and validation status

Reject orphan features that have no evidenced user or business reason unless the user explicitly approves them as an experiment.

## 8. Handle existing products carefully

When auditing an existing application, classify product behavior as:

- **ALIGNED** — implements approved MPS
- **INCOMPLETE** — partially implements approved MPS
- **CONFLICTING** — contradicts approved MPS
- **UNDOCUMENTED** — implemented behavior has no MPS decision
- **DEPRECATED** — retained temporarily but no longer intended
- **UNKNOWN** — evidence is insufficient

Do not delete or redesign existing behavior during an audit. Determine whether the product drifted or MPS needs to evolve.

## 9. Hand off to implementation

Generate one project-level `AGENTS.md` that merges applicable MPS, MDS, and MTS instructions.

Establish:

> **You implement approved product requirements. You do not invent product policy.**

For substantial work, require coding agents to trace changes to requirement/rule/acceptance IDs, inspect before assuming, report gaps instead of inventing, run real checks, and provide exact manual test steps.

Implementation order:

**READ → TRACE → INSPECT → COMPARE → PLAN → APPROVE → IMPLEMENT → VALIDATE → REPORT**

## 10. Propagate approved change

Read `references/PROPAGATION-MAP.md`.

For every meaningful approved change:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

Mark dependent MDS, MTS, implementation, tests, metrics, and artifacts stale when affected. Update only what the change actually impacts. Preserve history.

## 11. Keep canonical project state

Use `references/STATE-SCHEMA.md`.

State must answer:

- Why does this product exist and for whom?
- What outcomes define success?
- What is in scope now, later, and never?
- What workflows, rules, and acceptance criteria are approved?
- Which MPS version do MDS, MTS, and the implementation consume?
- What is implemented and validated?
- What gaps, risks, assumptions, exceptions, and deviations remain?
- What should happen next?

State is canonical. Documents, design, technology, code, tests, and reports consume it.

## 12. Report status and health

For **STATUS**, report lifecycle/version, current gate, approved scope/release, unresolved decisions, open gaps/risks/assumptions, stale artifacts, downstream synchronization, blockers, and next action.

For **HEALTH**, evaluate outcome clarity, user evidence, scope discipline, workflow completeness, rule consistency, acceptance quality, metric readiness, traceability, MDS/MTS synchronization, implementation drift, stale assumptions, and decision history.

Return `GOOD`, `ATTENTION`, or `DEGRADED` with evidence and prioritized actions.

## 13. Version deliberately

While initial MPS is draft, avoid needless version churn.

After activation:

- **patch** — clarification with no intended product behavior change
- **minor** — backward-compatible feature, workflow, rule, or release addition
- **major** — breaking change to product purpose, user authority, core workflow, economics, or foundational policy

Record the previous decision, new decision, reason, version impact, dependencies, migration/communication needs, and validation impact.

## 14. Define success

The skill succeeds when:

- product purpose and outcomes are explicit
- users and problems precede features
- scope and priorities are intentional
- workflows include alternate and failure paths
- product policy is approved rather than invented
- requirements are testable and traceable
- MDS and MTS receive stable inputs
- coding agents receive deterministic product guidance
- implementation is validated against product truth
- outcomes remain measurable without confusing delivery with impact
- the product can evolve without losing decision history

## Final rule

**Build the right product, define it clearly, and prove every release against approved truth.**
