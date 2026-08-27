# MPS Acceptance & Metrics Standard v1.0

## Acceptance criteria

Each criterion must be observable and testable. Link it to a requirement, workflow, rule, actor, and release.

Use Given/When/Then when it improves clarity, but do not force the format. Cover:

- successful path
- role/eligibility boundaries
- alternate and failure paths
- empty, duplicate, stale, expired, and retry conditions
- rule precedence and exceptions
- recovery and user-visible outcome
- applicable MDS experience states
- applicable MTS security/integration behavior

Do not prescribe visual or technical implementation unless that detail is approved product scope.

## Definition distinctions

- **Acceptance:** implementation satisfies approved product behavior.
- **Usability validation:** intended users can use the experience effectively.
- **Technical verification:** architecture and controls work as approved.
- **Outcome validation:** real-world results move in the intended direction.
- **Market validation:** sufficient evidence supports demand/value.

One does not prove another.

## Metric record

Track stable ID, linked outcome, metric definition, event/data source, unit, population, segmentation, baseline, target/direction, timeframe, guardrails, owner, instrumentation status, and interpretation limits.

Prevent metric ambiguity by defining numerator, denominator, time window, exclusions, and identity rules when applicable.

## Instrumentation handoff

MPS defines what must be measured and why. MTS selects and validates measurement technology and data handling. MDS defines consent or user-facing measurement experiences when required.
