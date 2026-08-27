# MDS-IMPLEMENTATION.md Template Guidance

Purpose: map the active MDS into the actual repository. `AGENTS.md` tells the agent how to behave; this manifest tells it where authoritative resources live.

Include:

- System name, version, project, status, date
- Core specification path
- Principles and Do / Don't paths
- Responsive/accessibility paths
- Core reference sheets
- Canonical UI reference paths and what each establishes
- Canonical token source and runtime implementation
- Typography families and loading paths
- Approved icon system and implementation
- Global styles/theme/CSS variables/styling config
- Shared component directory and component map
- Layout primitives, containers, grids, header/sidebar/footer/page shells
- Responsive breakpoints and notable behaviors
- Pattern spec/implementation map
- Accessibility implementation/tools
- QA resources and visual comparison method
- Approved MDS exceptions
- Known MDS gaps
- High-level implementation status
- Maintenance rules
- Agent quick reference

## Governance distinction

**Gap:** MDS has not decided.
**Exception:** approved implementation intentionally differs.
**Deviation:** implementation differs without approval.

An undocumented deviation is not an exception.

## Maintenance

Update the manifest when MDS version, canonical paths, tokens, shared components, references, gaps, exceptions, or QA tooling change.

The manifest must describe the repository as it actually exists; never invent paths.
