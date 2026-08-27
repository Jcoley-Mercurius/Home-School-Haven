# Master AGENTS.md Template Guidance

Generate project-specific `AGENTS.md` using the following section architecture. Keep permanent MDS rules stable and populate project-specific areas from canonical state and repository inspection.

1. What you are building and active MPS/MDS/MTS versions
2. How to work
3. Mercurius Product System authority and product requirements
4. Mercurius Design System authority, files, and implementation manifest
5. UI implementation rules
6. Reference image protocol
7. Design tokens
8. Components and patterns
9. Responsive implementation
10. Accessibility
11. Skills to lean on
12. Application architecture
13. Tech stack
14. Decisions already made for you
15. Things that will trip you up
16. MPS/MDS/MTS Gap Protocol
17. Engineering checks
18. MDS Visual QA Protocol
19. MDS Compliance Report
20. Definition of done
21. When in doubt

## Required permanent concepts

Opening role: principal-level implementation agent for the named project.

Include:

> **You implement the design. You do not invent the design.**

When MPS is present, also include:

> **You implement approved product requirements. You do not invent product policy.**

Mandatory workflow:

**READ → INSPECT → COMPARE → PLAN → APPROVE → IMPLEMENT → VALIDATE → REPORT**

For significant work, the implementation plan/prompt should cover goal, MDS version/references, skills/docs consulted, code inspected, files expected to change, decisions/assumptions, requirements, responsive/accessibility/security concerns, acceptance criteria, checks, and exact manual test steps.

Completion report should include:
- What I did
- Test
- Needs your attention
- MDS gaps

## Visual authority

Use this order:
1. Explicit approved project requirement
2. Current approved MDS state/spec
3. Tokens
4. Component specifications
5. Layout/pattern specifications
6. Canonical references
7. Existing implementation

## UI rules

Do not redesign, restyle, modernize, embellish, simplify, or “improve” approved MDS unless explicitly requested.

Use approved typography, colors, spacing, radius, borders, shadows, icons, hierarchy, density, whitespace, states, and responsive behavior.

## Components

Use:
**REUSE → COMPOSE → EXTEND → CREATE**

A new reusable visual convention not already defined is an MDS gap.

## Reference protocol

Inspect composition, alignment, spacing, typography, hierarchy, color, borders, radius, shadows, proportions, density, states, and content placement.

Do not infer unseen states or responsive behavior from a static reference.

## Engineering truthfulness

Never claim a check passed without running it.

## Definition of done

Functional + engineering + MDS + responsive + accessibility + reference comparison + no hidden deviations/gaps.
