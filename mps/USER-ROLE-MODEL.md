# Home School Haven User and Role Model

| ID | Actor | Approved authority | Key restrictions |
|---|---|---|---|
| ACT-001 | Primary parent/guardian | Controls family account, student profiles, enrollments, and family-visible information | No access to other families; no policy/program authority |
| ACT-002 | Student | Parent-mediated participant profile | No independent beta login; no default sensitive-data collection |
| ACT-003 | Educator | Assigned programs, schedules, appropriate roster fields, resources, and scoped announcements | No unassigned access, pricing, availability, or organization policy |
| ACT-004 | Administrator | Delegated program, enrollment, roster, communication, and linked-content operations | Does not replace owner authority; access individually assigned |
| ACT-005 | Public visitor | Public information and conversion paths | No private records or operations |
| ACT-006 | Samantha Dodson, owner | Final product and organizational authority | Owner credentials are not shared |
| ACT-007 | Invited secondary guardian | Optional invited family access | Explicit invitation and approved permissions required |
| ACT-008 | Payment processor | Processes payment through the existing path | No product-policy authority; minimum data disclosure |

MPS defines role intent. MTS and the implementation must enforce it with authenticated server context, least privilege, and deny-by-default data controls.
