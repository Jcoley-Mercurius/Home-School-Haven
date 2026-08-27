# MDS Dependency & Propagation Map v1.0

## Dependency classes

- **SPEC** — written design specifications
- **TOKEN** — machine-readable implementation tokens
- **VISUAL** — generated design-system/UI references
- **AGENT** — AGENTS.md behavior
- **MANIFEST** — implementation mapping
- **QA** — validation expectations
- **CODE** — existing product implementation
- **MPS** — product requirements and product-gap feedback
- **GOVERNANCE** — decisions, changes, versions, gaps, exceptions

## Master map

| Area | Propagates to |
|---|---|
| Identity | SPEC, VISUAL, AGENT, QA |
| Principles | SPEC, VISUAL, AGENT, QA, GOVERNANCE |
| Color | SPEC, TOKEN, VISUAL, AGENT, MANIFEST, QA, CODE |
| Typography | SPEC, TOKEN, VISUAL, AGENT, MANIFEST, QA, CODE |
| Spacing | SPEC, TOKEN, VISUAL, AGENT, MANIFEST, QA, CODE |
| Shape & Elevation | SPEC, TOKEN, VISUAL, AGENT, MANIFEST, QA, CODE |
| Iconography | SPEC, VISUAL, AGENT, MANIFEST, QA, CODE |
| Components | SPEC, TOKEN when applicable, VISUAL, AGENT, MANIFEST, QA, CODE |
| Layout | SPEC, TOKEN when applicable, VISUAL, AGENT, MANIFEST, QA, CODE |
| Responsive | SPEC, TOKEN, VISUAL, AGENT, MANIFEST, QA, CODE |
| Patterns | SPEC, VISUAL, AGENT, MANIFEST, QA, CODE |
| Visual Language | SPEC, VISUAL, AGENT, QA |
| Do / Don't | SPEC, VISUAL, AGENT, QA |
| Accessibility | SPEC, TOKEN when applicable, AGENT, MANIFEST, QA, CODE |
| References | SPEC when approved rules result, VISUAL, AGENT, MANIFEST, QA |
| Technical Implementation | AGENT, MANIFEST, QA |
| MPS Requirement/Version | SPEC, VISUAL when applicable, AGENT, MANIFEST, QA, GOVERNANCE |

## Change workflow

Every approved change follows:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

1. Detect the changed decision.
2. Classify area and potential version impact.
3. Map dependency classes.
4. Assess affected artifacts, implementation, and conflicts.
5. Obtain approval when reusable MDS behavior changes.
6. Update canonical state.
7. Update or mark affected artifacts stale.
8. Reconcile generated artifacts against state.
9. Validate affected areas.

## Safety rules

- Never propagate observed, inferred, or proposed decisions as authoritative.
- Never silently overwrite a conflicting approved decision.
- Never regenerate unaffected artifacts unnecessarily.
- Never mark an artifact current before reconciliation.
- Never let generated imagery overwrite canonical state.
- Never erase governance history.
- Never hide high-impact implementation consequences from the user.

## Common examples

### Primary color
Potential impacts: color spec, semantic aliases, tokens, buttons, links, focus, navigation emphasis, generated references, AGENTS.md, manifest, visual QA, existing code.

### Display font
Potential impacts: typography spec, tokens, type roles, font loading, heading components, hero patterns, reference images, AGENTS.md, manifest, QA, existing UI.

### Base spacing
Potential impacts: entire spacing scale, components, gutters, section rhythm, layout, references, tokens, QA, implementation. Treat as high impact.

### New component
Potential impacts: component inventory/spec, relevant tokens, component reference, page patterns, AGENTS.md, manifest, QA checklist, MDS version.

### Breakpoint
Potential impacts: responsive spec/tokens, layouts, components, references, AGENTS.md, manifest, QA viewport requirements, implementation.

### Do / Don't rule
Potential impacts: specification, image-generation instructions, AGENTS.md, Visual Language QA.
