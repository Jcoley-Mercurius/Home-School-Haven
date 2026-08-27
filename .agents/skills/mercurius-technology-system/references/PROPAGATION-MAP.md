# MTS Dependency & Propagation Map v1.0

## Dependency classes

- **STATE** — canonical MTS state
- **BLUEPRINT** — technology architecture
- **CAPABILITY** — capability matrix
- **INTEGRATION** — repository and service mapping
- **SECURITY** — security/data architecture
- **AGENT** — `AGENTS.md` behavior
- **PLAN** — implementation and migration plan
- **QA** — verification expectations and evidence
- **CODE** — product implementation/infrastructure
- **MDS** — proposed experience requirements or gaps
- **MPS** — approved product requirements and product-gap feedback
- **GOVERNANCE** — decisions, research, changes, versions, risks, exceptions

## Master map

| Change | Likely propagation |
|---|---|
| Product requirement | STATE, CAPABILITY, BLUEPRINT, PLAN, QA, MDS |
| MPS Requirement/Version | STATE, CAPABILITY, BLUEPRINT, INTEGRATION, SECURITY, AGENT, PLAN, QA, GOVERNANCE |
| Provider/technology selection | STATE, BLUEPRINT, INTEGRATION, SECURITY, AGENT, PLAN, QA, CODE, GOVERNANCE |
| Data classification or flow | STATE, BLUEPRINT, INTEGRATION, SECURITY, QA, CODE, MDS |
| Authentication/authorization | BLUEPRINT, INTEGRATION, SECURITY, AGENT, PLAN, QA, CODE, MDS |
| Deployment/runtime | BLUEPRINT, INTEGRATION, SECURITY, AGENT, PLAN, QA, CODE |
| API/event/webhook contract | INTEGRATION, SECURITY, PLAN, QA, CODE |
| Analytics/consent | CAPABILITY, INTEGRATION, SECURITY, QA, CODE, MDS |
| AI capability | CAPABILITY, BLUEPRINT, INTEGRATION, SECURITY, AGENT, PLAN, QA, CODE, MDS |
| Security rule | SECURITY, AGENT, PLAN, QA, CODE, GOVERNANCE |
| MDS version/requirement | STATE, CAPABILITY, BLUEPRINT, PLAN, QA |

## Change workflow

Use:

**DETECT → CLASSIFY → MAP → ASSESS → APPROVE → UPDATE → PROPAGATE → RECONCILE → VALIDATE**

Never propagate observed, inferred, or proposed selections as authoritative. Never overwrite a conflicting approved decision silently. Update only affected artifacts, preserve history, and mark stale outputs before claiming readiness.
