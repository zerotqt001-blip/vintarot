# NaTarot Security + Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a source-grounded security and production-readiness audit of NaTarot from a clean isolated base, apply only safe independent hardening, document all deferred human-gated work, and push the verified branch without merging or deploying.

**Architecture:** Preserve the existing ChatGPT-header/user and bearer guest-cookie identity model, owner-scoped D1/SQLite repository, server-only AI providers, Cloudflare/VPS dual topology, and protected L5–L8/S1–S5 work. The mandatory external-research gate compares mature patterns with the existing capability before selecting a local equivalent. Safe changes are limited to explicit response-cache boundaries, a read-only readiness contract, and dependency patches whose compatibility is proven by the existing suite/build; authentication semantics, schema/migrations, AI contracts, rate-limit infrastructure, TLS, backup, rollback, and production state remain audit findings unless they can be fixed without crossing their locks.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Cloudflare D1-compatible APIs, Node `node:sqlite`, Zod, Nginx/systemd templates, npm lockfile, Node `node:test` via `tsx`.

**Spec:** User-provided “NATAROT — SECURITY + PRODUCTION READINESS MASTER MISSION”.

## Global Constraints

- Work only in `codex/natarot-security-production-readiness` from the recorded clean base `60db3db7db535560feb6ff1178a975793bec26bf`.
- Do not touch the dirty root checkout or active L5–L8, S1–S5, Credits/VIP, Share, canonical-baseline, or other feature worktrees.
- Do not change Tarot Engine semantics, spread/draw behavior, Knowledge Base V5, DeepSeek prompts/provider behavior, Credits/VIP, SePay, Affiliate, schema, migrations, or auth identity semantics.
- Do not deploy, restart production, rotate credentials, alter OAuth secrets, change firewall rules, merge, force-push, or perform destructive Git/database actions.
- Never print or commit credentials, tokens, cookies, private keys, `.env` contents, production database contents, or raw AI/provider error payloads.
- Every finding is labeled with severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`) and remediation class (`SAFE_TO_FIX_NOW` or `REQUIRES_HUMAN_AUTHORIZATION`), with evidence and ownership.
- `PUSHED` is reported separately from `MERGED` and `DEPLOYED`; no production claim is made without fresh target evidence.

---

### Task 1: Lock the repository baseline and audit inventory

**Files:**
- Read: `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/project/LOCKED_ZONES.md`, `docs/project/MISSION_PROTOCOL.md`, `docs/project/TEST_MATRIX.md`
- Read: `app/api/**/route.ts`, `app/chatgpt-auth.ts`, `lib/request-identity.ts`, `lib/tarot-guest.ts`, `lib/server.ts`, `lib/ai/`, `lib/tarot-repository.ts`, `deploy/`, `scripts/`, `package.json`, `package-lock.json`, `.gitignore`
- Test: existing `tests/f001-identity-boundary.test.ts`, `tests/request-identity.test.ts`, `tests/server-origin.test.ts`, `tests/deployment-contract.test.ts`, and `tests/*.test.ts`

**Interfaces:**
- Consumes: clean base SHA, remote identity, worktree inventory, source/config/test evidence.
- Produces: an evidence table for API classification, F-001, auth/guest ownership, cookies/CSRF, input/XSS/SQL/SSRF, AI boundary, abuse, secrets, dependencies, runtime/health/rollback/backup/observability/privacy, and parallel-work ownership.

- [x] **Step 1: Verify repository identity and protected worktrees**

Run `git fetch origin`, `git status`, `git worktree list`, `git branch -a`, record the repository remote and exact base SHA, and confirm the dirty root checkout and protected worktrees are not part of this branch.

- [x] **Step 2: Install from the lockfile and run the clean baseline**

Run `npm ci`, then `npx tsx --test tests/*.test.ts`. Record the exact test count and any baseline failures before changing tracked files.

- [x] **Step 3: Complete the read-only security and operations audit**

Trace every API route and owner predicate from source. Search for raw HTML, dynamic URLs, SQL interpolation, server-side fetch targets, secret-like literals, logging of sensitive values, request/body limits, security headers, deployment/readiness/rollback/backup evidence, and dependency advisories. Do not modify protected files during discovery.

**Acceptance:** The audit document can distinguish source evidence from project-state claims and can name the exact route/file/line supporting every finding. No application or deployment behavior changes are made in this task.

---

### Task 2: Complete the mandatory external repository/tool research gate

**Files:**
- Create: `docs/project/SECURITY_EXTERNAL_RESEARCH.md`
- Modify: `docs/superpowers/plans/2026-09-21-natarot-security-production-readiness.md`

**Interfaces:**
- Consumes: source audit from Task 1 and current official repository/documentation evidence.
- Produces: a dated, source-linked comparison for `arcjet/arcjet-js`, `arcjet/example-nextjs`, `gitleaks/gitleaks`, `aquasecurity/trivy`, `OWASP/ASVS`, `helmetjs/helmet`/Next.js/Nginx header guidance, and at least one additional maintained pattern relevant to the actual stack.

- [x] **Step 1: Research the required references and an additional stack-relevant approach**

Review current repository/documentation patterns, maintenance signals, licenses, operational assumptions, proxy/client-IP behavior, rate limiting, bot/AI cost abuse controls, sensitive-data/WAF controls, secret/history scanning, filesystem/dependency/config scanning, ASVS categories, and response-header guidance. Use official repository/documentation sources and do not copy source code.

- [x] **Step 2: Compare each pattern against NaTarot’s topology and locks**

For every reference record `PROJECT`, `PURPOSE`, `MAINTENANCE STATUS`, `LICENSE`, `RELEVANT NATAROT PROBLEM`, `REUSABLE PATTERN`, `DIRECT DEPENDENCY NEEDED?`, `COPY CODE NEEDED?`, `ARCHITECTURE IDEA ONLY?`, `SECURITY RISK`, `OPERATIONAL COST`, and `RECOMMENDATION`. Classify it as `ADOPT`, `ADAPT`, `REFERENCE ONLY`, or `REJECT`; distinguish local equivalents from SaaS/runtime dependencies and human-gated activation.

- [x] **Step 3: Select the minimum compatible solution before implementation**

Adopt only patterns that fit the current request/identity, Node/SQLite, Cloudflare/VPS, Nginx, and protected-worktree boundaries. Keep Arcjet and new rate-limit services out of the runtime unless a future human-gated mission supplies explicit service/credential approval. Record rejected or deferred patterns and license concerns.

**Acceptance:** The external research record exists before application/security implementation begins, contains all required fields and classifications, cites authoritative sources, and makes the reuse decision explicit for every major mechanism changed. No external dependency, service, credential, or copied source is introduced by this task.

---

### Task 3: Add regression coverage for safe response-cache boundaries

**Files:**
- Test: `tests/security-production-readiness.test.ts`
- Modify only after the test is red: `lib/request-identity.ts`, `app/api/tarot/session/route.ts`, `app/api/tarot/draw/route.ts`, `lib/tarot-reading-route.ts`, `lib/tarot-follow-up-route.ts`

**Interfaces:**
- Consumes: existing `RequestIdentity`, `attachIdentityCookie`, owner-scoped route handlers, and current isolated SQLite fixture pattern.
- Produces: an explicit `Cache-Control: no-store` contract for owner-scoped/personalized API responses, including the session GET and expensive state-changing Tarot responses, without changing catalog caching or auth ownership.

- [x] **Step 1: Write failing cache-boundary tests**

Assert that an identity-attached response is `no-store`, that `GET /api/tarot/session?id=...` returns `no-store` for an owner-scoped response, and that Tarot draw/reading/follow-up success responses cannot be cached. Keep fixtures isolated and assert only response metadata and existing payload contracts.

- [x] **Step 2: Run the focused tests and verify the expected red state**

Run `npx tsx --test tests/security-production-readiness.test.ts`. Expected: the new cache assertions fail against the unchanged baseline while existing F-001/ownership tests remain green.

- [x] **Step 3: Add the minimum no-store headers**

Set `Cache-Control: no-store` in `attachIdentityCookie`; route the session response through that helper while preserving its owner lookup; set the same header on draw and the shared reading/follow-up success/error response paths. Do not modify `originCheck`, guest-token derivation, session ownership, SQL, prompt, or provider behavior.

- [x] **Step 4: Run focused security and ownership regressions**

Run `npx tsx --test tests/security-production-readiness.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts tests/server-origin.test.ts tests/tarot-guest.test.ts tests/room-guest-persistence.test.ts tests/tarot-saved-reading-route.test.ts`. Expected: PASS with no cross-owner behavior change.

**Acceptance:** Personalized responses are explicitly non-cacheable; public catalog behavior is unchanged; the focused suite proves F-001, guest isolation, owner isolation, and origin behavior still hold.

**Rollback:** Revert only the named response-header edits and their focused tests; no data, schema, or identity state is changed.

---

### Task 4: Add a lightweight read-only readiness endpoint

**Files:**
- Create: `app/api/health/route.ts`
- Test: `tests/security-production-readiness.test.ts`
- Modify: `tests/deployment-contract.test.ts` only if the existing deployment contract needs a source-level route assertion

**Interfaces:**
- Consumes: `getRuntimeDatabase()` through the existing `db()` boundary.
- Produces: `GET /api/health` returning `{ "status": "ok" }` and `Cache-Control: no-store` after `SELECT 1`; returns a generic `503` JSON status on database failure; never calls AI, email, draw, reading, or mutation APIs.

- [x] **Step 1: Add the failing endpoint contract test**

Import the route after pointing `NATAROT_DB_PATH` to an isolated temporary SQLite file and assert `GET` returns `200`, the exact status body, `no-store`, and no provider-facing side effect. Add a failure-path test only if it can be isolated without mocking the production database contract.

- [x] **Step 2: Run the focused test to verify red**

Run `npx tsx --test tests/security-production-readiness.test.ts`. Expected: the route import/contract is absent and the new test fails for the expected reason.

- [x] **Step 3: Implement the read-only check**

Create the route with an explicit `SELECT 1` and sanitized `503` response. Do not expose database paths, SQL errors, environment values, release metadata, or authentication data.

- [x] **Step 4: Verify the endpoint and route inventory**

Run the focused test and `npx tsc --noEmit`; re-run the API inventory to classify `/api/health` as `PUBLIC / READINESS-ONLY`.

**Acceptance:** Readiness distinguishes the process/database boundary from provider availability and cannot consume paid or mutable resources. It is not represented as production verification until exercised on the target topology by a human-gated deployment mission.

**Rollback:** Delete the new route and focused test; no schema or runtime state changes are required.

---

### Task 5: Remediate only compatible dependency advisories

**Files:**
- Modify if compatibility is proven: `package.json`, `package-lock.json`
- Test: existing `tests/*.test.ts` plus dependency/build commands

**Interfaces:**
- Consumes: npm audit results from the clean lockfile and direct dependency peer constraints.
- Produces: lockfile/direct patch updates only where the advisory is applicable and the existing test/type/build matrix remains green.

- [x] **Step 1: Record the advisory baseline without printing dependency payloads**

Run `npm audit --omit=dev --json` and `npm audit --json`, summarize package/severity/range/fix availability, and distinguish production runtime from build-only advisories. Do not run a broad major upgrade.

- [x] **Step 2: Apply the smallest compatible production fix**

Use lockfile-only remediation for the production `baseline-browser-mapping` advisory if npm resolves a same-major compatible version without changing runtime source. Inspect the lock diff before keeping it.

- [x] **Step 3: Evaluate direct patch fixes individually**

Only if the peer graph and build remain compatible, update the direct vulnerable patch-level `react`/`react-dom`/`react-server-dom-webpack` and `vite` versions. Leave `drizzle-kit`’s major/downgrade recommendation and any unproven advisory deferred with evidence.

- [x] **Step 4: Reinstall and verify dependency integrity**

Run `npm ci`, `npm audit --omit=dev`, `npm audit`, `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, and `npm run build`. If any mission-caused failure occurs, diagnose and either make the smallest compatible correction or revert that dependency change.

**Acceptance:** No production `CRITICAL`/`HIGH` advisory remains; any deferred dev-only or major-upgrade advisory is explicitly documented with package, severity, range, exploit surface, and required human decision. No application/AI/auth semantics change.

**Rollback:** Revert only package manifest/lockfile changes if compatibility or audit results do not improve.

---

### Task 6: Write the durable audit and project-state record

**Files:**
- Create: `docs/project/SECURITY_PRODUCTION_READINESS_AUDIT.md`
- Read: `docs/project/SECURITY_EXTERNAL_RESEARCH.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/superpowers/plans/2026-09-21-natarot-security-production-readiness.md`

**Interfaces:**
- Consumes: completed audit evidence, focused/full validation output, dependency results, exact base/branch/commit state, and protected-worktree checks.
- Produces: a durable source-grounded audit with API inventory, F-001/auth/ownership/abuse/secrets/dependency/ops/privacy findings, severity/remediation classes, safe fixes, deferred human actions, readiness level, and no secret values.

- [x] **Step 1: Write the audit matrix from source evidence**

Include scope, threat model, base SHA, route classification, F-001 spoof test, auth/cookie/CSRF/open-redirect review, IDOR/XSS/SQL/SSRF/input/request-size/error/logging findings, abuse/cost risks, secret scan, dependency audit, Nginx/systemd/health/readiness/rollback/release-lock/backup/Google Drive boundary/observability/privacy review, baseline-vs-mission-vs-parallel ownership, and exact unverified production claims.

- [x] **Step 2: Record safe fixes and deferred actions**

For each finding include severity, evidence path/line or command, risk, remediation class, action, test evidence, and owner. State that no database schema/migration, auth model, AI semantics, parallel work, deployment, restart, or merge changed.

- [x] **Step 3: Update project state minimally**

Append a dated checkpoint stating `SECURITY / PRODUCTION READINESS → AUDITED → SAFE FIXES VERIFIED → PUSHED → NOT MERGED → NOT DEPLOYED`, exact validation, remaining human-gated actions, and the final readiness level without claiming live verification.

- [x] **Step 4: Self-review the documentation**

Search the new/modified docs for placeholders, unsupported production claims, absolute secret-like literals, stale base SHAs, and contradictions with `LOCKED_ZONES.md`/`MISSION_PROTOCOL.md`. Run `git diff --check`.

**Acceptance:** A reviewer can reproduce the audit and tell what is verified locally, what is only documented from prior state, what is owned by parallel work, and what requires a human-gated mission.

---

### Task 7: Final security review, validation, commit, push, and remote verification

**Files:**
- Review all changed files; no unrelated files may be staged.

**Interfaces:**
- Consumes: code/docs/dependency changes and all focused/full validation output.
- Produces: focused commits, remote branch equality, clean isolated worktree, and one final report.

- [ ] **Step 1: Review from six required lenses**

Re-read the diff as application security, backend security, auth, infrastructure/SRE, privacy, and abuse/cost reviewers. Resolve or document every finding; do not leave a safe independent Critical/High issue unresolved.

- [ ] **Step 2: Run the final verification matrix**

Run focused security/ownership tests, `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, `npm run lint` (report only pre-existing failures), `git diff --check`, secret scan, `npm audit --omit=dev`, `npm audit`, and final status/diff checks. Confirm the root checkout and protected worktrees remain untouched. Re-run external research if the selected local solution is shown to be materially weak; do not claim the loop is closed until the post-fix security review and retest are complete.

- [ ] **Step 3: Inspect staged diffs and commit focused changes**

Stage only the plan, external research record, safe code/tests, dependency files if retained, audit, and minimal project-state update. Inspect `git diff --cached` for secrets and unrelated changes. Use focused messages such as `security: harden API cache boundaries`, `ops: add read-only readiness contract`, `security: update compatible dependency patches`, and `docs: record security production audit` only when the staged content matches.

- [ ] **Step 4: Push and verify the remote branch**

Run `git push -u origin codex/natarot-security-production-readiness`, then `git fetch origin`, `git status`, and compare local `HEAD` with `origin/codex/natarot-security-production-readiness`. Do not merge, deploy, restart, or create a PR.

**Acceptance:** Local and remote HEAD match, the isolated worktree is clean, safe fixes are verified, no safe Critical/High finding remains, and the final report states `PUSHED` separately from `NOT MERGED` and `NOT DEPLOYED`.
