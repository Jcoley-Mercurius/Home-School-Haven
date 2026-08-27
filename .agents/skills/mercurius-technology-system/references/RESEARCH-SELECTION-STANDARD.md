# MTS Research & Selection Standard v1.0

## Research protocol

For external technology recommendations:

1. Define the requirement and disqualifying constraints.
2. Inspect the existing stack and determine whether it can satisfy the need.
3. Decide whether to keep, build, buy, extend, or replace.
4. Research current first-party documentation and authoritative security/privacy material.
5. Verify framework support, maintenance status, deployment model, data handling, limits, pricing posture, and migration/exit path relevant to the decision.
6. Record direct source URLs, evidence summaries, unknowns, and `verified_at`.
7. Compare only viable candidates.
8. Recommend one option, a conditional option, or no new technology.

Use technical primary sources. Treat marketing claims as claims. Mark inference clearly. Re-verify unstable details rather than relying on a static provider catalog.

Do not skip from a feature list to a mature provider recommendation. When geography, regulation, payment liability, users' ages, scale, budget, deployment restrictions, or team capability could disqualify candidates, resolve or explicitly preserve those unknowns first. Early candidate lists must remain provisional.

## Selection criteria

Evaluate what matters for the product:

- functional fit
- compatibility with the approved stack and deployment
- developer and agent implementation quality
- security, privacy, permissions, and data residency
- reliability, support, observability, backup, and recovery
- implementation and migration effort
- current and scaling cost posture
- operational burden and team fit
- portability, lock-in, and exit cost
- ecosystem maturity and maintenance
- effect on user experience and MDS requirements

Do not manufacture numeric certainty. If weighting or scoring is used, expose weights, evidence, and uncertainty.

## Recommendation format

State:

- capability/problem
- recommendation and confidence
- why it fits
- why existing technology is insufficient, if adding something
- alternatives and when they become preferable
- security/data impact
- cost and operations impact
- implementation outline
- MDS feedback
- unknowns and approval required

## Agent ecosystem rule

Search for maintained existing skills, plugins, apps, or MCP connectors before proposing a new agent capability. A runtime integration does not automatically require a custom skill, and a plugin does not automatically belong in production code.
