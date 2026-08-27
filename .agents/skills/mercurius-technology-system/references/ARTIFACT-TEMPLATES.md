# MTS Artifact Guidance v1.0

## `TECHNOLOGY-BLUEPRINT.md`

Include system/version/project/MPS/MDS linkage, goals and constraints, architecture overview, environment boundaries, approved capabilities and services, data flows, identity/authorization model, integration/event model, observability, reliability/recovery, AI architecture, security posture, MPS/MDS feedback, gaps/risks/exceptions, and maintenance rules.

## `CAPABILITY-MATRIX.md`

For each capability include requirement, need/priority, evidence, existing implementation, build/buy/keep strategy, candidates, approved selection, MDS impact, implementation status, validation status, and dependencies.

## `INTEGRATION-MANIFEST.md`

Map approved technology to actual repository paths and environments. Include packages, configuration paths, server/client boundary, environment-variable names and purpose, schemas/migrations, APIs/routes, events/webhooks/jobs, permissions/scopes, tests, dashboards/alerts, external setup still required, and status. Never include secret values or invented paths.

## `SECURITY-ARCHITECTURE.md`

Include actors/roles, assets/data classes, trust boundaries, authentication, authorization/tenancy, secrets, network/API controls, third parties, analytics/privacy, AI controls, logging/audit, backup/recovery, abuse controls, open risks, and verification evidence.

## `IMPLEMENTATION-PLAN.md`

Sequence prerequisites, incremental changes, migrations, feature flags, rollout, rollback, tests, manual verification, external account/configuration steps, MDS work, owners, dependencies, and definition of done.

## `qa/MTS-QA.md`

Define applicable architecture, integration, security/data, reliability/operations, and MDS synchronization checks. Include evidence expected and manual test steps.

## Artifact truth

State what exists now, not the intended future. Mark draft or stale artifacts accurately. Record sources and `verified_at` for unstable external facts.
