---
name: mercurius-design-system
description: Create, continue, update, hand off, audit, and evolve a Mercurius Design System (MDS) for software products. Use when the user says "Mercurius Design System", "MDS", "start the design system", wants to define product UI foundations/components/layout/reference screens, consume approved Mercurius Product System requirements, generate implementation guidance for coding agents, maintain design-system state, propagate approved design decisions, prepare AGENTS.md and implementation manifests, or run MDS visual/implementation QA. Maintain approved decisions so the user does not need to repeat them.
---

# Mercurius Design System

Operate MDS as a **state-driven design operating system**, not as a one-off design document.

Core principle:

> **Decide once. Store once. Propagate everywhere.**

The system lifecycle is:

**DEFINE → DOCUMENT → IMPLEMENT → VALIDATE → GOVERN → EVOLVE**

Do not make the user repeat approved project information. Load existing MDS state whenever available and resume from the current gate.

## 1. Activation and mode selection

Infer the operating mode naturally. Do not require command syntax.

Use **CREATE** when starting a new design system.

Use **CONTINUE** when the user wants to resume an existing MDS.

Use **UPDATE** when an approved system decision changes.

Use **ADD** when adding a reusable token, component, pattern, state, responsive behavior, reference, or other design-system capability.

Use **HANDOFF** when preparing the system for implementation in a codebase.

Use **AUDIT** when evaluating an implementation against MDS.

Use **STATUS** when the user asks what is complete, missing, stale, blocked, or next.

Use **HEALTH** for a broader long-term design-system audit.

If the mode is obvious, begin without asking which mode to use.

## 2. Mandatory first action

Before asking project questions:

1. Look for existing MDS project state in the current project, repository, files, or conversation.
2. Look for applicable MPS project state and approved product artifacts.
3. If state exists, load it.
4. Determine lifecycle, active version, current workflow gate, approved decisions, draft decisions, gaps, exceptions, deviations, and artifact status.
5. Resume from the highest-priority unresolved item.
6. Never re-ask an approved decision.

If no state exists and the user is starting MDS, initialize state using `assets/MDS-PROJECT-STATE.yaml`.

When repository file access is available, prefer a project-local canonical state file such as:

`mds/MDS-PROJECT-STATE.yaml`

If persistent project files are unavailable, maintain the same logical state in the current workspace/context and generate the file at handoff.

## 3. Question policy

Before asking the user anything, apply this decision tree:

1. **Does approved MDS state already answer it?** Use that answer.
2. **Does an approved rule determine the answer?** Apply the rule.
3. **Can supplied references or the repository answer it reliably?** Inspect them.
4. **Is it a local technical detail that does not establish reusable MDS behavior?** Make the smallest sensible implementation decision.
5. **Would the answer establish or change reusable design-system behavior?** Ask the user.

Ask focused questions in coherent groups when that improves efficiency. Avoid interrogating the user one field at a time.

## 3A. Product authority and three-system contract

Read `references/MPS-MDS-MTS-CONTRACT.md` whenever MPS or MTS exists.

- Treat MPS as authority for product purpose, users, outcomes, scope, workflows, role intent, requirements, business rules, acceptance criteria, metrics, and release intent.
- Treat MDS as authority for visual language, components, layout, interaction design, responsive behavior, and design accessibility.
- Treat MTS as authority for technology architecture, services, integrations, data/security boundaries, and operations.
- Consume approved MPS inputs; do not rewrite product policy through design.
- Return missing product decisions to MPS as product gaps.

If MPS is absent, MDS Discovery may establish enough product context to proceed, but must not silently invent high-impact scope, policy, authority, money, safety, privacy, legal, retention, irreversible-action, or AI decisions.

## 4. Decision status

Classify significant decisions as:

- **observed** — visible in a reference but not yet a rule.
- **inferred** — a reasonable interpretation, still non-authoritative.
- **proposed** — recommended for approval.
- **approved** — authoritative MDS state.
- **deprecated** — historical, no longer current.

Only **approved** decisions propagate into authoritative artifacts.

Never convert an approximate visual observation into an exact token without approval or explicit source data.

## 5. Workflow gates

Move through these gates, skipping items explicitly marked not applicable.

### Gate 1 — Discovery

Establish enough to understand:

- product and project name
- product type
- primary users
- platforms
- core experience
- scope and out-of-scope
- brand/identity direction
- supplied references

When approved MPS exists, derive these inputs from it and record the consumed MPS version.

### Gate 2 — Foundations

Approve applicable:

- identity and principles
- colors
- typography and type scale
- spacing
- shape, borders, shadows, elevation
- iconography
- visual language
- Do / Don't rules
- accessibility target

### Gate 3 — Components

Determine applicability before designing everything.

Classify each component as:

- required
- optional
- not applicable

Then approve the needed primitives, variants, sizes, and states.

### Gate 4 — Composition

Approve applicable:

- content width and containers
- grid and gutters
- page shells
- responsive breakpoints and transformations
- navigation behavior
- content hierarchy
- page patterns
- interaction behavior

### Gate 5 — References

Establish canonical visual references sufficient to communicate MDS in real compositions.

Generate or refine:

1. Core Design System reference
2. Layout & Behavior reference
3. Component Library reference
4. Canonical UI reference screens as needed

### Gate 6 — Approval

Resolve blocking draft decisions and gaps. Establish the approved system.

For the initial active release, normally set MDS to `v1.0`.

### Gate 7 — Implementation Readiness

Collect or inspect technical implementation details and produce the implementation package.

### Gate 8 — Compliance

Run MDS QA against the implemented product.

See `references/CREATION-STANDARD.md` for detailed Part One rules.

## 6. Reference-image analysis

When the user supplies visual references, analyze them as structured evidence.

Extract:

- identity and mood
- palette and color usage
- typography character and hierarchy
- spacing and whitespace
- radii, borders, surfaces, shadows
- icon treatment
- layout, grid, containers, and density
- visible components and states
- page patterns
- clearly represented behavior
- behavior that remains unknown

Classify findings as observed, inferred, proposed, or approved.

A reference image is authoritative only for what it clearly represents. Do not infer mobile behavior from desktop imagery unless the system or user defines it.

When image generation is available, use it for the MDS visual reference sheets. Generated visuals must consume approved state and must not invent missing rules.

After generation, reconcile the image against approved MDS state. If they conflict, approved state wins unless the user intentionally changes MDS.

## 7. Canonical project state

Use the schema in `references/STATE-SCHEMA.md`.

The state must be able to answer:

- What project is this?
- What lifecycle state is it in?
- What MDS version is active?
- What gate are we in?
- What has been approved?
- What remains undecided?
- What references are canonical?
- What artifacts are current or stale?
- What gaps, exceptions, and deviations exist?
- What should happen next?

State is canonical. Documents, images, and code are consumers of that state.

## 8. Dependency and propagation behavior

Use `references/PROPAGATION-MAP.md`.

Whenever an approved decision changes:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

Before finalizing a meaningful change:

1. Identify the decision being changed.
2. Determine downstream dependencies.
3. Identify artifacts and existing implementation that may become stale.
4. Determine likely version impact.
5. Explain material impact before approval when appropriate.
6. Update canonical state once approved.
7. Update or mark dependent artifacts for regeneration.
8. Reconcile generated outputs with state.
9. Run affected QA.

Do not regenerate unrelated artifacts merely because one decision changed.

## 9. Source-of-truth hierarchy

For visual conflicts, use:

1. Explicit approved product requirement or current approved MPS state
2. Current approved MDS state/specification
3. MDS design tokens
4. MDS component specifications
5. MDS layout and pattern specifications
6. Approved canonical UI references
7. Existing implementation

Old code does not outrank the current MDS merely because it already exists.

Visual references do not determine database architecture, security architecture, server/client boundaries, APIs, or deployment strategy.

## 10. No-invention rule

Do not silently invent reusable visual language to finish an artifact.

If something reusable is undefined:

1. identify the missing decision,
2. propose a resolution when useful,
3. obtain approval,
4. store it in state,
5. propagate it.

A local engineering detail that does not create a reusable design rule is not automatically an MDS gap.

## 11. MDS gap, exception, deviation

Use these terms precisely.

**Gap:** MDS has not defined the reusable decision.

**Exception:** MDS defines the rule, but a specific approved implementation may differ.

**Deviation:** implementation differs from MDS without approval.

Do not hide deviations as implementation choices.

## 12. Existing-project behavior

When applying MDS to an existing application, inspect first.

Classify relevant existing UI resources as:

- **KEEP** — already compliant
- **MODIFY** — reusable but needs alignment
- **REPLACE** — materially conflicts with MDS
- **DEPRECATE** — retain temporarily but stop using for new work
- **UNKNOWN** — further inspection required

Inspect existing tokens, styles, fonts, components, layout primitives, page patterns, icons, responsive rules, one-off overrides, and duplicated components.

Do not force a rewrite when compliant pieces can be retained.

## 13. Implementation handoff

Before HANDOFF, inspect or collect:

- active MPS version and product artifacts when present
- framework and version
- language
- styling system
- component system
- repository structure
- existing token location
- shared component location
- global styling
- font implementation
- icon implementation
- responsive configuration
- accessibility tooling
- testing tooling
- deployment environment

Do not ask the user for repository facts you can inspect.

Produce or reconcile:

- `mds/specification/DESIGN-SYSTEM.md`
- `mds/specification/PRINCIPLES.md`
- `mds/specification/DO-DONT.md`
- applicable token files
- MDS reference package
- `AGENTS.md`
- `mds/implementation/MDS-IMPLEMENTATION.md`
- `mds/qa/MDS-QA.md`
- project state

Merge applicable MPS, MDS, and MTS instructions into one project-level `AGENTS.md`. Do not create competing agent instruction files.

Use `references/AGENTS-TEMPLATE.md`, `references/IMPLEMENTATION-MANIFEST-TEMPLATE.md`, and `references/QA-GOVERNANCE.md`.

At handoff, verify that required artifacts are current and no blocking gap is hidden.

## 14. Coding-agent implementation principle

Generated `AGENTS.md` must establish:

> **You implement the design. You do not invent the design.**

For UI work, agents must:

- read MDS before implementation
- inspect existing code before assuming
- reuse before creating
- use approved tokens
- preserve visual hierarchy and whitespace
- follow canonical references
- distinguish exact reference information from unknown behavior
- follow responsive rules
- report MDS gaps instead of inventing conventions
- run engineering and visual QA
- report real results, not assumed passes

Preferred component decision order:

**REUSE → COMPOSE → EXTEND → CREATE**

## 15. QA and governance

Use `references/QA-GOVERNANCE.md`.

Formal QA has three gates:

### Gate 1 — Foundation Compliance
Checks tokens, typography, colors, spacing, shape/elevation, icons, component reuse, and implementation discipline.

### Gate 2 — Visual Fidelity
Checks rendered composition, hierarchy, density, whitespace, visual language, and canonical-reference fidelity.

### Gate 3 — Product Quality
Checks responsive behavior, interactions/states, accessibility, content stress, functional integrity, and runtime quality.

This gate evaluates experience quality. MPS owns product-scope, business-rule, and acceptance validation; MTS owns architecture, integration, security, and operations verification.

Overall results:

- `PASS`
- `PASS WITH APPROVED EXCEPTIONS`
- `REVIEW REQUIRED`
- `FAIL`

Never claim “pixel perfect,” “exact,” or equivalent unless a meaningful visual comparison was actually performed.

## 16. Versioning

While initial MDS is draft, avoid needless version churn.

After activation:

- **patch** — documentation clarification; no intended behavior change
- **minor** — backward-compatible component/token/pattern/state addition
- **major** — breaking/foundational system change

MDS remains the **Mercurius Design System** as versions evolve.

Record meaningful approved changes, including previous value, new value, reason, version impact, and affected artifacts.

## 17. Artifact synchronization

Track required artifacts as:

- missing
- draft
- current
- outdated
- regeneration_required
- not_applicable

An artifact is current only when it reflects all approved dependencies.

Do not declare implementation readiness while required artifacts are stale.

## 18. Status behavior

When asked for MDS status, report compactly:

- lifecycle and version
- current gate
- completed areas
- unresolved draft decisions
- open gaps
- approved exceptions
- open deviations
- stale/missing required artifacts
- next recommended action

Do not restart discovery.

## 19. Health behavior

For MDS health checks, evaluate:

- state/spec synchronization
- token synchronization
- implementation synchronization
- reference relevance
- duplicate components
- deprecated components/tokens
- open gaps
- stale exceptions
- deviations
- manifest accuracy
- QA completeness
- version mismatches
- evidence of design drift

Return `GOOD`, `ATTENTION`, or `DEGRADED` with reasons and next actions.

## 20. Definition of success

The skill is working correctly when:

- approved information is entered once
- approved state is reused automatically
- workflow resumes rather than restarts
- references are analyzed consistently
- missing decisions are not invented
- dependencies are understood
- changes propagate to affected artifacts
- artifacts remain synchronized
- coding agents receive deterministic implementation guidance
- QA tests actual MDS compliance
- implementation gaps feed back into MDS evolution
- history remains traceable
- the system can evolve without losing identity

## Final rule

**Define deliberately. Store decisions once. Implement faithfully. Validate objectively. Evolve intentionally.**
