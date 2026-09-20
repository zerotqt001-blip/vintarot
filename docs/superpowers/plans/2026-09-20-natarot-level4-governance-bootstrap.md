# NaTarot Level 4 Governance Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a source-grounded NaTarot Level 4 governance system without changing product behavior.

**Architecture:** Add a focused `docs/project/` governance layer containing the constitution, architecture map, protected-zone model, feature registry, test matrix, mission protocol, and reusable mission template. Update `docs/PROJECT_STATE.md` only with the bootstrap decision and validation record; do not modify application, database, deployment, secret, or production files.

**Tech Stack:** Markdown, Mermaid diagrams, Git read-only audits, existing Node/TypeScript test and build commands.

**Spec:** User-supplied `NATAROT LEVEL 4 — PROJECT GOVERNANCE BOOTSTRAP` request; the durable protocol is created at `docs/project/MISSION_PROTOCOL.md`.

## Global Constraints

- Preserve all pre-existing staged, modified, untracked, and ignored user work.
- Source code, tests, schema/migrations, deployment files, and current Git state outrank the request and older documentation.
- Do not change product behavior, application code, authentication, AI prompts, schema, migrations, deployment configuration, secrets, or production state.
- Document findings and security observations; do not fix unrelated defects during bootstrap.
- Classify feature state from evidence; do not infer user acceptance from code existence.
- Run the existing test suite, typecheck, build, and final Git/documentation audits where the environment permits.

### Task 1: Capture baseline and repository evidence

**Files:**
- Read: `AGENTS.md`, `docs/PROJECT_STATE.md`, current Git state, application, data, deployment, and test sources.
- Preserve: all pre-existing working-tree files.

**Interfaces:**
- Produces: evidence for the architecture map, feature registry, lock zones, and test matrix.

- [x] **Step 1: Record repository root, branch, HEAD, status, tracked/untracked/ignored paths, and remote tracking state.**
- [x] **Step 2: Trace application routes, auth/guest identity, Tarot domain, AI provider pipeline, persistence, deployment, and tests from source.**
- [x] **Step 3: Record source/documentation discrepancies without changing product files.**

### Task 2: Create the constitution and architecture map

**Files:**
- Create: `docs/project/PROJECT_CONSTITUTION.md`
- Create: `docs/project/ARCHITECTURE_MAP.md`

**Interfaces:**
- Produces: project-wide rules and a source-grounded map future missions must use before planning changes.

- [x] **Step 1: Write the constitution with source-of-truth hierarchy, preservation/default-scope rules, security/data/UI/AI boundaries, compatibility, testing, four DoD levels, production readiness, and stop conditions.**
- [x] **Step 2: Write the architecture map with route, auth, Tarot, AI, persistence, deployment, and test flows plus Mermaid diagrams.**
- [x] **Step 3: Mark unimplemented integrations and unverified production claims explicitly.**

### Task 3: Create protection and feature inventory

**Files:**
- Create: `docs/project/LOCKED_ZONES.md`
- Create: `docs/project/FEATURE_REGISTRY.md`

**Interfaces:**
- Consumes: architecture evidence from Task 2.
- Produces: explicit hard/soft/active/unknown protection boundaries and status-qualified feature inventory.

- [x] **Step 1: Define hard locks for identity/security, AI contracts, schema/migrations, and deployment/runtime boundaries.**
- [x] **Step 2: Define soft locks and active development zones only where source evidence supports them.**
- [x] **Step 3: Register implemented, active, experimental, planned, deprecated, and unknown features with exact entry points, dependencies, tests, and notes.**

### Task 4: Create test matrix and mission protocol

**Files:**
- Create: `docs/project/TEST_MATRIX.md`
- Create: `docs/project/MISSION_PROTOCOL.md`

**Interfaces:**
- Consumes: route/dependency and test evidence from Tasks 1–3.
- Produces: required verification groups and phase gates from baseline through production readiness.

- [x] **Step 1: Map smoke, critical-flow, regression, security, responsive, data, AI-contract, and deployment checks to affected features.**
- [x] **Step 2: State existing commands/tests and missing coverage without inventing coverage.**
- [x] **Step 3: Define PHASE 0–9 entry criteria, evidence, exit gates, change budget, stop conditions, and final report rules.**

### Task 5: Create the reusable mission template

**Files:**
- Create: `docs/project/MISSION_TEMPLATE.md`

**Interfaces:**
- Produces: a concise mission intake and final-report template that references locked zones and the test matrix.

- [x] **Step 1: Add fields for mission ID, objective, scope, baseline, locks, requirements, acceptance, tests, regression, production requirements, and stop conditions.**
- [x] **Step 2: Add an explicit final status and DoD level field so “done” is never ambiguous.**

### Task 6: Validate and record the bootstrap

**Files:**
- Modify: `docs/PROJECT_STATE.md` by appending a governance-bootstrap entry only.
- Verify: all new `docs/project/*.md` files, existing tests, typecheck, build, diff, and Git status.

**Interfaces:**
- Consumes: all governance documents.
- Produces: evidence-backed final report and preserved unrelated work.

- [x] **Step 1: Re-read every governance document against current source; correct stale paths, unsupported assumptions, contradictory locks, and nonexistent tests.**
- [x] **Step 2: Run `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`; record actual results, including baseline failures.**
- [x] **Step 3: Scan new docs for secrets, stale implementation claims, accidental application/config changes, and missing required sections.**
- [x] **Step 4: Append the validation result to `docs/PROJECT_STATE.md`, then run the final status/diff audit and report the exact files changed.**
