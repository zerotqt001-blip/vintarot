# NaTarot UI/UX + Liquid Glass Research Plan

> **For agentic workers:** This document is the execution plan for a documentation-only design-system research pass. Complete each checkpoint in order and verify the repository boundary before committing.

**Goal:** Produce a source-grounded UI/UX audit and V1 Liquid Glass design system for NaTarot, preserving the Moonlight reference, current Tarot behavior, bilingual content model, and future product boundaries without implementing runtime UI changes.

**Architecture:** Treat the current app as an evidence base. Separate semantic primitives and presentation surfaces from route/business state, preserve the Room's L1 geometry and reading contracts, and define Liquid Glass as a tiered functional-layer material rather than a global card treatment.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Tailwind CSS 4, current `radix-ui`/shadcn-style primitives, `lucide-react`, Work Sans, Instrument Serif, CSS backdrop effects, and optional future Motion only where a measured interaction needs it.

## Global Constraints

- Research and specification only; do not change runtime files, dependencies, schemas, business logic, or deployment configuration.
- Work only in `codex/natarot-design-system-research`.
- Keep user-provided Moonlight references and NaTarot naming intact.
- Use the actual source tree, the local running app, and cited primary sources as evidence.
- Do not include personal profile data, credentials, tokens, or copied private chat content in deliverables.

## Checkpoints

- [x] Inspect repository state, routes, tokens, typography, i18n, responsive CSS, and current interaction boundaries.
- [x] Verify representative Home, Create, Guidebook, Room, and Profile states in the local app.
- [x] Research the named accessibility, component, animation, and Liquid Glass references; classify each as adopt, adapt, reference-only, or reject.
- [x] Write `NATAROT_UI_RESEARCH.md` with evidence, current-to-future inventory, and audit findings.
- [x] Write `NATAROT_LIQUID_GLASS_RESEARCH.md` with material definitions, performance model, fallbacks, and five glass levels.
- [x] Write `NATAROT_DESIGN_SYSTEM_V1.md` with tokens, type, icon, motion, responsive, accessibility, and component rules.
- [x] Write `NATAROT_COMPONENT_ARCHITECTURE.md` with surface contracts and business/presentation boundaries.
- [x] Write `NATAROT_UI_ROADMAP.md` with page blueprints, phased migration, regression strategy, and future commercial surfaces.
- [x] Self-review for unresolved critical or important architecture issues; verify documentation-only scope.
- [x] Run the repository's documented tests, typecheck, build, diff checks, and secret scan; record exact outcomes.
- [ ] Update `docs/PROJECT_STATE.md`, commit related documentation, push the research branch, and verify remote parity.

## Verification Evidence

The final handoff must include the exact commit, remote parity check, modified-file list, and command results. Any pre-existing test or build failure must be reported as a failure rather than presented as a clean pass.
