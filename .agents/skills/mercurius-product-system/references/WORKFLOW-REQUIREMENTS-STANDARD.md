# MPS Workflow & Requirements Standard v1.0

## Workflow record

Track:

- stable ID, goal, actors, trigger, and preconditions
- initial state and main path
- alternate, failure, timeout, cancellation, and recovery paths
- state transitions and ownership
- notifications and external dependencies
- applicable business rules
- completion/postconditions
- related MDS patterns and MTS capabilities
- acceptance IDs

Screens are evidence of presentation, not a complete workflow.

## Requirement record

Write requirements that are necessary, unambiguous, testable, and solution-neutral where possible.

Track stable ID, statement, rationale, source, actors, priority/release, linked outcome/problem/workflow/rules, MDS dependency, MTS dependency, acceptance IDs, status, and implementation evidence.

Avoid vague terms such as easy, fast, intuitive, robust, secure, or seamless unless defined by measurable criteria or delegated to the appropriate system.

## Business rule record

Track stable ID, condition, resulting behavior, scope, precedence, examples, exceptions, owner, rationale, effective version, and linked requirements/workflows.

Never infer high-impact policy from UI, code, or common industry practice. Ask for approval.

## Roles

MPS defines actor intent and permitted product actions. MTS defines authentication, authorization, tenant isolation, and technical enforcement. MDS defines how role-specific capabilities and states are experienced.

## State modeling

Name meaningful domain states and allowed transitions. Include pending, failed, expired, cancelled, reversed, disputed, blocked, and recovery states when applicable. Do not let an implementation boolean replace a product state model.
