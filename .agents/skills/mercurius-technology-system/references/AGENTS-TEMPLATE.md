# MTS `AGENTS.md` Template Guidance v1.0

Merge these sections into the project-level `AGENTS.md`; do not create competing agent instruction files.

1. Product and approved MPS/MDS/MTS versions
2. How to work: read, inspect, compare, plan, approve, implement, validate, report
3. MPS authority, requirements, and paths
4. MDS authority and paths
5. MTS authority and paths
6. Approved application architecture and tech stack
7. Repository and environment boundaries
8. Data, authentication, authorization, and tenancy rules
9. Secrets and configuration rules
10. API, integration, event, webhook, and background-job rules
11. Analytics, observability, reliability, and recovery
12. AI architecture and tool-safety rules when applicable
13. Existing skills, plugins, or connectors to use
14. Decisions already approved
15. MPS/MDS/MTS gap protocols
16. Engineering, security, visual, and manual checks
17. Completion report and definition of done

Include:

> **You implement approved architecture. You do not invent the stack.**

When MPS is present, also include:

> **You implement approved product requirements. You do not invent product policy.**

Preferred technology order:

**KEEP → CONFIGURE → EXTEND → INTEGRATE → BUILD → REPLACE**

Require agents to inspect official current documentation before implementing external integrations, protect secrets, preserve server/client and tenant boundaries, avoid unnecessary dependencies, run real checks, and report actual results.

For substantial work, require the plan to name the goal, approved decisions, repository evidence, files expected to change, data/security concerns, migration/rollback, acceptance criteria, tests, and exact manual steps.

Require completion reports to include:

- What changed
- What was tested and the actual result
- External setup still required
- Risks or blockers
- MTS gaps/deviations
- MPS product gaps created or exposed by technology
- MDS gaps created by technology
