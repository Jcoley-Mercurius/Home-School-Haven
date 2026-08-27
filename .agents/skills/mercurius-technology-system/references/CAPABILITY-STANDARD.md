# MTS Capability Standard v1.0

Map needs before providers. Mark each capability `required`, `optional`, `deferred`, `not_applicable`, or `unknown`.

## Capability families

- application runtime and hosting
- data storage, database, cache, and files
- identity, authentication, authorization, and tenancy
- content management and editorial workflow
- APIs, integrations, queues, jobs, and webhooks
- product analytics, consent, experimentation, and feature flags
- logs, errors, metrics, tracing, alerting, and status
- search, indexing, recommendations, and geospatial needs
- payments, billing, tax, invoicing, and entitlements
- email, SMS, push, chat, and notifications
- AI models, orchestration, retrieval, evaluation, and safety
- security scanning, secrets, audit, backup, recovery, and compliance evidence
- testing, CI/CD, preview, deployment, and release controls
- internal administration, support, moderation, and data operations

The inventory is a prompt, not a requirement to add every category.

## Capability record

Record:

- stable ID and name
- product requirement and affected users
- source/evidence
- need status and priority
- existing implementation
- data classes and trust boundaries
- scale/reliability assumptions
- MDS states or patterns affected
- build/buy/keep decision
- candidates and selection status
- approved technology and rationale
- implementation and validation status
- dependencies, risks, and owner

## Technology layers

Classify each item accurately:

- **Production service:** participates in the running product.
- **SDK/package:** code dependency used to access a capability.
- **Agent skill:** procedural knowledge for an AI agent.
- **Plugin/app connector:** controlled access to an external account or service.
- **MCP server:** tool/context protocol exposed to an agent.
- **Custom implementation:** capability owned in the product codebase.

One vendor may occupy several layers. Approve each layer separately when its permissions, cost, or risk differs.
