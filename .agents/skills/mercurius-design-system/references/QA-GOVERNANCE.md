# MDS Part Three — QA & Governance Standard

Formal MDS QA uses three gates.

## Gate 1 — Foundation Compliance

Evaluate:
- colors and token usage
- typography and font loading
- spacing
- shape, borders, shadows, elevation
- iconography
- component variants/sizes/states
- reuse and component architecture
- unauthorized hardcoded design values where approved tokens exist

## Gate 2 — Visual Fidelity

Compare rendered product with applicable canonical references and MDS visual language.

Evaluate:
- page structure
- content width
- grid and gutters
- alignment
- section spacing
- hierarchy
- whitespace and density
- typography relationships
- surface treatment
- component proportions
- color emphasis
- visual rhythm
- Do / Don't compliance

Do not compare arbitrary sample text literally; compare system and composition.

Do not say pixel-perfect/exact/identical unless meaningful comparison was actually performed.

## Gate 3 — Product Quality

Evaluate:
- desktop/tablet/mobile behavior
- default/hover/focus/active/selected/disabled/loading/success/warning/error/empty states
- content stress (short, long, zero, many, missing optional content, long labels, image failure)
- accessibility
- functional integrity
- console/runtime/network/font/asset issues
- obvious layout shift or regressions

## Compliance vocabulary

**COMPLIANT** — follows active MDS.

**GAP** — reusable decision is not defined.

**EXCEPTION** — approved implementation is intentionally allowed to differ.

**DEVIATION** — implementation differs without approval.

## Overall status

- `PASS`
- `PASS WITH APPROVED EXCEPTIONS`
- `REVIEW REQUIRED`
- `FAIL`

## Severity

- critical
- major
- minor
- observation

## Governance loop

**DISCOVER → CLASSIFY → DECIDE → UPDATE → IMPLEMENT → VALIDATE**

When repeated deviations appear, determine whether implementation drifted or MDS legitimately needs to evolve. Fix the source, not just individual screens.

## Versioning

Patch: documentation/non-behavior clarification.

Minor: backward-compatible token/component/pattern/state addition.

Major: breaking/foundational system change.

## Compliance report

Record:
- project / feature / release
- MDS version
- references reviewed
- Gate 1/2/3 status and finding counts
- open gaps
- approved exceptions
- open deviations
- blocking issues
- known deviations
- recommended MDS updates
- required next action
- overall status
