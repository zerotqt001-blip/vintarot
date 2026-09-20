# NaTarot Mission Template

Use this template for substantial missions. Replace bracketed values; do not leave placeholders in a final mission record.

## MISSION ID

`[date-or-tracking-id]`

## OBJECTIVE

[One sentence describing the technical objective.]

## USER OUTCOME

[What the user can do or rely on after the mission.]

## IN SCOPE

- [Exact routes, modules, or documents included.]

## OUT OF SCOPE

- [Features and behaviors that must remain unchanged.]

## REFERENCE MATERIAL

- Source files: [paths]
- Existing tests: [paths]
- Design/reference: [path or URL]
- Relevant project state: [section]

## BASELINE

- Repository: `[...]`
- Branch: `[...]`
- Starting `HEAD`: `[...]`
- Working-tree state: `[...]`
- User-owned changes to preserve: `[...]`

## LOCKED ZONES

- Hard locks: [zones from `LOCKED_ZONES.md`]
- Soft locks: [zones]
- Active zones: [zones]

## UNLOCKED ZONES

- [Exact zone and reason it is explicitly unlocked.]

## FUNCTIONAL REQUIREMENTS

- [Observable behavior and contract requirements.]

## UI REQUIREMENTS

- [Layout, interaction, accessibility, responsive, motion, and i18n requirements; write “none” only after checking shared shell consumers.]

## DATA REQUIREMENTS

- [Entities, ownership, compatibility, migration, backup, and rollback requirements.]

## SECURITY REQUIREMENTS

- [Trust boundaries, authorization, origin/cookie, input limits, secret handling, and threat-model requirements.]

## ACCEPTANCE CRITERIA

- [ ] [Criterion with observable evidence.]

## REQUIRED TESTS

- Focused: [commands/files]
- Critical-flow: [groups]
- Security: [groups]
- Data: [groups]
- Responsive/browser: [viewports and interactions]
- AI contract: [groups]
- Deployment/release: [checks, if authorized]

## REGRESSION MATRIX

| Changed area | Downstream consumers | Required regression evidence | Result |
| --- | --- | --- | --- |
| [area] | [features/modules] | [tests/checks] | [pending/pass/fail/baseline] |

## PRODUCTION REQUIREMENTS

- Source revision/artifact: [exact value]
- Environment/provider configuration: [presence and validation without secret values]
- Migration/data plan: [details or “none”]
- Rollback/backup: [details]
- Smoke/monitoring: [details]
- Explicit deployment authorization: [yes/no]

## STOP CONDITIONS

- [Missing credential/access, destructive action, unresolved business ambiguity, hard-lock conflict, possible user-work loss, or unisolated verification failure.]

## FINAL REPORT FORMAT

- Baseline and preserved work
- Architecture and dependency impact
- Scope/lock decisions
- Files changed
- Validation evidence and baseline failures
- Security observations and technical risks
- Highest DoD level (A/B/C/D)
- Final status (PASS/PARTIAL/BLOCKED)
- Recommended next mission and unfinished work
