# MDS State Schema v1.1

This file defines the canonical logical structure for MDS project state. The runtime may store it as YAML, JSON, or an equivalent structured project resource, but field meaning and status semantics should remain stable.

## Root

```yaml
mds:
  system: "Mercurius Design System"
  schema_version: "1.1"
  project_id:
  project_name:
  lifecycle: draft
  mds_version:
  current_gate: discovery
  mps_project_id:
  mps_version:
  created_at:
  updated_at:
```

Lifecycle: `draft | approved | active | evolving | major_evolution | archived`

Gate: `discovery | foundations | components | composition | references | approval | implementation_readiness | compliance`

## Standard decision object

```yaml
id: MDS-DEC-###
area:
key:
value:
status: observed
source:
confidence:
rationale:
approved_at:
introduced_version:
deprecated_version:
dependencies: []
```

Decision status: `observed | inferred | proposed | approved | deprecated`

Only `approved` decisions propagate authoritatively.

## Project

```yaml
project:
  name:
  description:
  product_type:
  audience: []
  platforms: []
  primary_experience:
  scope: []
  out_of_scope: []
  status:
```

## Identity

```yaml
identity:
  logo:
  personality: []
  brand_adjectives: []
  emotional_response: []
  visual_direction:
  principles: []
  references: []
```

## Color

```yaml
color:
  primary: {}
  secondary: {}
  accent: {}
  neutrals: {}
  semantic:
    success: {}
    warning: {}
    error: {}
    info: {}
  surfaces: {}
  text: {}
  borders: {}
  usage_rules: []
```

Color token:

```yaml
name:
value:
role:
status:
```

## Typography

```yaml
typography:
  display_family:
  ui_family:
  mono_family:
  weights: {}
  scale: {}
  line_heights: {}
  letter_spacing: {}
  roles: {}
  usage_rules: []
```

Type role:

```yaml
token:
family:
size:
weight:
line_height:
letter_spacing:
usage:
```

## Spacing

```yaml
spacing:
  base_unit:
  scale: {}
  page_rules: {}
  section_rules: {}
  component_rules: {}
```

## Shape and elevation

```yaml
shape:
  radius: {}
  borders: {}
  dividers: {}
  shadows: {}
  elevation: {}
```

## Iconography

```yaml
icons:
  family:
  implementation:
  stroke_style:
  fill_style:
  sizes: {}
  custom_icon_rules: []
  usage_rules: []
```

## Components

Each component:

```yaml
applicability: required
status: undefined
variants: []
sizes: []
states: []
specification:
implementation:
reference:
```

Applicability: `required | optional | not_applicable`

Status: `undefined | draft | approved | implemented | validated | deprecated`

Suggested inventory: button, input, textarea, select, checkbox, radio, switch, search, badge, tag, status, progress, card, tabs, dropdown, tooltip, alert, dialog, table, pagination, navigation, plus project-specific components.

## Layout

```yaml
layout:
  max_content_width:
  grid:
    columns:
    gap:
  gutters:
    desktop:
    tablet:
    mobile:
  header:
  sidebar:
  footer:
  section_spacing:
  page_shells: {}
```

## Responsive

```yaml
responsive:
  breakpoints:
    mobile:
    tablet:
    desktop:
    wide:
  rules:
    stacking: []
    navigation: []
    sidebar: []
    grid: []
    typography: []
    spacing: []
    visibility: []
    media: []
    touch: []
```

## Patterns

```yaml
patterns:
  landing:
  dashboard:
  search_results:
  detail:
  forms:
  authentication:
  empty:
  error:
  loading:
  custom: {}
```

Each pattern tracks applicability, status, composition, components used, responsive behavior, and canonical reference.

## Visual language

```yaml
visual_language:
  personality:
  density:
  contrast:
  surface_philosophy:
  border_philosophy:
  shadow_philosophy:
  color_philosophy:
  typography_character:
  icon_character:
  whitespace_philosophy:
```

## Guidance

```yaml
guidance:
  do: []
  dont: []
```

Rule:

```yaml
id:
area:
statement:
rationale:
status:
```

## Accessibility

```yaml
accessibility:
  target:
  contrast:
  focus:
  keyboard:
  touch_targets:
  motion:
  semantic_markup:
  screen_reader:
  image_alternatives:
  additional_rules: []
```

## References

```yaml
id: MDS-REF-###
name:
type:
source:
canonical: false
applies_to: []
observations: []
inferences: []
proposed_rules: []
approved_rules: []
```

Reference type: `brand | design_system | homepage | dashboard | detail | search | component | layout | mobile | other`

## Technical implementation

```yaml
technical:
  framework:
  framework_version:
  language:
  styling_system:
  component_system:
  icon_implementation:
  font_implementation:
  repository_structure:
  token_location:
  component_location:
  global_style_location:
  layout_location:
  deployment_target:
  accessibility_tools: []
  test_tools: []
```

## Governance

```yaml
governance:
  decisions: []
  gaps: []
  exceptions: []
  deviations: []
  changes: []
  versions: []
```

Gap status: `open | approved | implementing | resolved | rejected`

Deviation severity: `critical | major | minor | observation`

## Artifacts

Each artifact:

```yaml
path:
status: missing
generated_from_state: []
last_updated:
```

Artifact status: `missing | draft | current | outdated | regeneration_required | not_applicable`

Track at minimum: design specification, principles, do/don't, tokens, core reference, layout reference, component reference, UI references, AGENTS.md, implementation manifest, QA protocol, compliance report.

## Gate state

```yaml
name:
status:
requirements: []
blocking_items: []
completed_at:
```

Gate status: `not_started | in_progress | blocked | complete`

## Compliance

```yaml
compliance:
  gate_1:
  gate_2:
  gate_3:
  overall_status:
  open_gaps:
  approved_exceptions:
  open_deviations:
  reviewed_at:
```

Overall: `pass | pass_with_approved_exceptions | review_required | fail`

## Integrity rules

- One canonical project state.
- Link the consumed MPS project/version when present.
- Stable IDs for decisions, references, gaps, exceptions, deviations, and changes.
- Unknown is not N/A.
- Draft is not approved.
- Gap is not deviation.
- Exception is not compliance.
- Historical decisions are retained.
- Important generated outputs should be traceable to the state decisions that produced them.
