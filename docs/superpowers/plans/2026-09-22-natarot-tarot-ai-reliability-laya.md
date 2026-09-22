# NaTarot Tarot AI Reliability and Laya Shadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently distinguish and prevent recurring production Tarot AI failures while providing a measured, isolated, development-only Laya System-1 shadow adapter.

**Architecture:** Keep provider configuration in `/etc/natarot.env` and the production Tarot path unchanged for authorized readings. Add pure diagnostics/readiness contracts, request-correlated server logs, a precise 402 client state, and an operator-side production health-gate script. Audit Laya outside the Node runtime, then expose only sanitized shadow decisions with deterministic routing first and Laya/LLM fallback.

**Tech Stack:** TypeScript, React 19, Vinext/Vite, Node `node:sqlite`, Node test runner via `tsx`, systemd, shell/Node production probes, Python only inside `tools/system1/laya-adapter` if the audited Laya interface justifies it.

**Spec:** `docs/superpowers/specs/2026-09-22-natarot-tarot-ai-reliability-laya-design.md`

## Global Constraints

- Preserve KB V5, prompt `tarot-reading-v4.2.2`, L5/L7/L8, card draw, persistence, auth, Credits/VIP, Affiliate, Share/QR and security boundaries.
- Do not bypass member Credit authorization, create an unapproved production ledger mutation, activate real money, or invent packages/prices.
- Keep `DEEPSEEK_API_KEY` server-only in `/etc/natarot.env`; never print, commit, duplicate or log it.
- Never log raw questions, optional context, provider bodies, cookies, session IDs, member IDs, email, tokens or PII.
- Laya must not be a Node dependency, production runtime dependency, provider fallback or customer-facing feature.
- Use a fresh production backup before any production file/service/database mutation and retain a rollback release.
- Commit incident/deployment reliability separately from Laya tooling; update `docs/PROJECT_STATE.md` before the session ends.

### Task 1: Record the approved incident design and baseline

**Files:**
- Create: `docs/superpowers/specs/2026-09-22-natarot-tarot-ai-reliability-laya-design.md`
- Create: `docs/superpowers/plans/2026-09-22-natarot-tarot-ai-reliability-laya.md`
- Test: none; documentation self-review and clean-worktree check

**Interfaces:**
- Consumes: verified production logs, service environment audit, direct DeepSeek probe, guest reading probe, database aggregate audit.
- Produces: source-grounded design and task plan used by Tasks 2–8.

- [x] **Step 1: Write the design and plan.** Record the exact root cause, contributing factor, recurrence mechanism, deploy relationship, safety boundaries and acceptance evidence. Do not describe a provider outage when the evidence is `credits_insufficient`.
- [x] **Step 2: Verify the clean isolated baseline.** Run `npx tsx --test tests/*.test.ts` after `npm ci`; expected `535/535` pass before source changes.
- [ ] **Step 3: Commit the design checkpoint.** Run `git diff --check`, inspect the staged diff for secret-like values, then commit only the two documentation files with `docs: specify tarot ai incident and laya design`.

### Task 2: Add safe provider diagnostics and request correlation

**Files:**
- Modify: `lib/ai/http.ts`
- Modify: `lib/ai/provider.ts`
- Modify: `lib/tarot-reading-route.ts`
- Modify: `app/api/tarot/reading/route.ts`
- Create: `lib/ai/readiness.ts`
- Test: `tests/tarot-http.test.ts`, `tests/tarot-reading-route.test.ts`, `tests/tarot-ai-readiness.test.ts`

**Interfaces:**
- `classifyTarotProviderFailure(error: TarotAIError): TarotAIFailureCategory` returns one of `TAROT_AI_PROVIDER_UNAVAILABLE`, `TAROT_AI_PROVIDER_AUTH_FAILED`, `TAROT_AI_PROVIDER_TIMEOUT`, `TAROT_AI_RESPONSE_INVALID`, or `TAROT_AI_PERSISTENCE_FAILED` plus safe optional status metadata.
- `classifyTarotAIConfiguration(env)` returns `CONFIGURED` or `UNCONFIGURED` without returning a secret.
- `handleTarotReadingRoute` accepts an optional safe `requestId`, emits it in the event, and returns it as `X-Request-Id` on success and handled failures.

- [ ] **Step 1: Write failing HTTP diagnostics tests.** Add cases proving 401/403 preserve `httpStatus` and classify as auth failure, 429/5xx preserve status as provider unavailable, aborts classify as timeout, malformed JSON classifies as response invalid, and no test output contains an API key or raw body.
- [ ] **Step 2: Run the focused tests and verify RED.** Run `npx tsx --test tests/tarot-http.test.ts tests/tarot-ai-readiness.test.ts`; expected failures must be missing status/category behavior, not import/setup errors.
- [ ] **Step 3: Implement the smallest diagnostic contract.** Set `httpStatus` on `TarotAIError` in the HTTP client, centralize safe category mapping, and keep customer response bodies provider-neutral.
- [ ] **Step 4: Write failing route correlation tests.** Assert a generated/request-supplied ID appears in `X-Request-Id` and safe logs, while `sessionId` and private error text do not appear in serialized diagnostics. Assert provider and persistence categories remain distinguishable.
- [ ] **Step 5: Run route tests RED, then implement.** Run `npx tsx --test tests/tarot-reading-route.test.ts`; add the request ID at the route boundary and replace session-ID logging with the correlation ID while retaining provider/model/card-count metadata.
- [ ] **Step 6: Run the focused green suite.** Run `npx tsx --test tests/tarot-http.test.ts tests/tarot-reading-route.test.ts tests/tarot-ai-readiness.test.ts` and inspect the full output for zero failures.
- [ ] **Step 7: Commit the diagnostics slice.** Stage only the diagnostics files/tests and commit `fix: classify tarot ai failures safely`.

### Task 3: Make the member Credit failure actionable in Room

**Files:**
- Modify: `app/room/room.tsx`
- Modify: `components/reading/reading-panel.tsx` only if the action link needs a typed slot
- Modify: `lib/i18n.ts`
- Test: `tests/tarot-room.test.ts`, `tests/member-affiliate-ui-v1.test.ts` or a focused new `tests/tarot-credit-ui.test.ts`

**Interfaces:**
- The Room error state distinguishes `status === 402` from provider/network failures.
- English and Vietnamese copy states that a Credit is required and provides a safe `/account` or `/packages` action; generic provider failure keeps retry behavior.

- [ ] **Step 1: Write the failing UI source test.** Assert the Room reads `error.status`, has a distinct Credit-required translation in both locales, and exposes an account/packages action without removing the generic fallback.
- [ ] **Step 2: Run the focused UI test and verify RED.** Run `npx tsx --test tests/tarot-credit-ui.test.ts`; expected failure is the missing status-specific branch/copy.
- [ ] **Step 3: Implement the minimal UI state.** Catch the typed API error, set a Credit-specific state for 402, render a bilingual actionable link, and leave retry available for retryable provider errors. Do not redraw cards or call the provider a second time automatically.
- [ ] **Step 4: Run the UI-focused green tests.** Run `npx tsx --test tests/tarot-credit-ui.test.ts tests/tarot-room.test.ts`; verify the existing room reading flow and stale-request guard remain covered.
- [ ] **Step 5: Commit the client clarity slice.** Stage only Room/reading/i18n/tests and commit `fix: explain tarot credit authorization failures`.

### Task 4: Add the production AI deployment health gate

**Files:**
- Create: `scripts/production-ai-health-gate.mjs`
- Modify: `README.md` or create `docs/runbooks/TAROT_AI_OPERATIONS.md` for the exact invocation and output contract
- Test: `tests/production-ai-health-gate.test.ts`

**Interfaces:**
- `node scripts/production-ai-health-gate.mjs --origin https://natarot.com --service natarot.service --readings 1` prints only safe status lines and exits nonzero if any gate fails.
- Checks are `WEB_HEALTH`, `AI_CONFIG`, `PROVIDER_HEALTH`, and `SYNTHETIC_TAROT_READING`; the script can repeat the synthetic flow with `--readings 5`.
- AI config reads the actual systemd process environment and confirms the persistent `EnvironmentFile` path; it never prints values.

- [ ] **Step 1: Write failing script contract tests.** Use injected command/fetch fixtures to assert safe redaction, missing config failure, `/models` 200 pass, 401 auth failure, timeout classification, web health failure, synthetic reading 200 success, 402 member/guest distinction, and nonzero exit behavior.
- [ ] **Step 2: Run the focused test and verify RED.** Run `npx tsx --test tests/production-ai-health-gate.test.ts`; expected failure is the missing script/contract.
- [ ] **Step 3: Implement the operator script.** Use `systemctl show`, `/proc/<MainPID>/environ`, the referenced env-file path, direct DeepSeek `/models`, public `/api/health`, and a cookie-isolated guest draw/reading. Print provider/model only as configured identifiers, never credentials/cookies/session IDs.
- [ ] **Step 4: Run the focused green test.** Run `npx tsx --test tests/production-ai-health-gate.test.ts` and verify every classification branch.
- [ ] **Step 5: Commit the gate slice.** Stage the script, runbook and tests, then commit `feat: add production tarot ai health gate`.

### Task 5: Document the historical incident audit and update project state

**Files:**
- Create: `docs/incidents/TAROT_AI_RECURRING_FAILURE.md`
- Modify: `docs/PROJECT_STATE.md`
- Test: `tests/incident-documentation.test.ts` if the repository has documentation-contract coverage for this area

**Interfaces:**
- The incident report lists only evidence-supported episodes: the initial no-provider VPS state, 2026-09-18 DeepSeek transport timeout/configuration recovery, 2026-09-18 direct-answer cardinality mismatch, 2026-09-18 reflection-prompt cardinality mismatch, and the 2026-09-22 Credit authorization incident. It distinguishes separate causes rather than treating them as one outage.
- The report records the canonical `/etc/natarot.env` topology, the guest/member distinction, the prevention gate, rollback rules and the fact that no Credit grant was created by this mission.

- [ ] **Step 1: Write the incident document and state checkpoint.** Include `CURRENT_ROOT_CAUSE`, `CONTRIBUTING_FACTOR`, `RECURRENCE_REASON`, `LATEST_DEPLOY_RELATIONSHIP`, evidence commands with redacted outputs, and all verification gates.
- [ ] **Step 2: Run documentation/secret checks.** Run `rg` scans for key/token/PII-like values, `git diff --check`, and any documentation contract tests; expected result is no credential-like literal.
- [ ] **Step 3: Commit the incident docs.** Commit `docs: record recurring tarot ai incident and prevention` after staged-diff review.

### Task 6: Production backup, deploy and repeated real verification

**Files:**
- Modify: none unless the deployment runbook requires a source-only change
- Test: local full suite plus production gate output

**Interfaces:**
- Deploy a tested descendant of `d0c7e761` from the reliability branch with `/etc/natarot.env` untouched.
- The production gate must record web health, process config, direct provider health, one reading, five sequential readings, service restart survival and one post-restart reading.

- [ ] **Step 1: Run local quality gates before production.** Run `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, targeted ESLint and a staged secret scan. Record inherited repository lint debt separately.
- [ ] **Step 2: Create and verify a fresh production backup.** Use the existing VPS backup tooling, verify archive checksum, SQLite integrity, foreign keys and restore readability, and record the backup ID without exposing data.
- [ ] **Step 3: Package and deploy atomically.** Include tracked build metadata, exclude `.env`, database, logs, `node_modules` and secrets, retain the prior release, run the no-op migration check, switch `/opt/natarot`, and restart only `natarot.service`.
- [ ] **Step 4: Run the gate with one live reading.** Require all four statuses PASS and inspect the response for provider `deepseek`, prompt `tarot-reading-v4.2.2`, valid evidence and no fallback message.
- [ ] **Step 5: Run the five-reading soak.** Run `--readings 5` sequentially with bounded spacing. Require 5/5 200 responses, valid card evidence, provider success and persisted payload responses.
- [ ] **Step 6: Restart and repeat.** Restart `natarot.service`, rerun config/provider/web checks, then run one post-restart guest reading. Do not call a member reading without an existing authorized Credit.
- [ ] **Step 7: Run protected regressions.** Verify Auto Topic, draw/spread, Membership/Credits/VIP/account, Affiliate, Share/QR, Auth, security headers, responsive critical routes and retry no-double-charge behavior.
- [ ] **Step 8: Commit deployment evidence.** Update `docs/PROJECT_STATE.md` with exact commit/backup/gate/soak/restart evidence and commit `docs: record tarot ai reliability production release`.

### Task 7: Audit Laya and create an isolated shadow adapter

**Files:**
- Create: `tools/system1/laya-adapter/README.md`
- Create: `tools/system1/laya-adapter/pyproject.toml` only if the audited repo has a stable importable interface
- Create: `tools/system1/laya-adapter/laya_adapter.py` only if the audited repo can be isolated without importing it from application code
- Create: `tools/system1/laya-adapter/fixtures/decisions.jsonl`
- Create: `tools/system1/laya-adapter/benchmark.py`
- Create: `docs/LAYA_SYSTEM1_EVALUATION.md`
- Test: `tests/laya-adapter-contract.test.ts` or a tool-local Python test suite

**Interfaces:**
- Adapter functions are `classifyTask(state)`, `classifyFailure(state)`, `selectTestScope(state)`, `recommendNextAction(state)`, and `recommendModelRoute(state)`; each returns `{ decision, confidence, source, fallbackReason? }`.
- Sources are `deterministic`, `laya`, or `llm`; deterministic rules win whenever authoritative evidence exists.
- Shadow records contain sanitized state, prediction, confidence, Codex decision, known outcome and latency only.

- [ ] **Step 1: Audit and pin the Laya repository.** Clone/read `NandhaKishorM/laya` outside the app tree, record exact commit, version, Apache-2.0 evidence, Python/Torch/Transformers requirements, checkpoint behavior, router/preload behavior, hardware and limitations. Do not track `main` implicitly.
- [ ] **Step 2: Build a small bilingual fixture set.** Include English, Vietnamese and mixed technical inputs across the specified seven label spaces; omit production questions, session IDs, secrets, cookies and PII.
- [ ] **Step 3: Write failing adapter contract tests.** Assert deterministic routing for known file/status/error/test signals, Laya/LLM fallback shape, low-confidence escalation, no forbidden action recommendation, and absence of production imports/dependencies.
- [ ] **Step 4: Implement the isolated adapter and benchmark harness.** Keep Python/model dependencies under `tools/system1/laya-adapter`; record cold/preloaded/single/5/10 decision latency, CPU/GPU availability, accuracy/calibration, deterministic baseline, and end-to-end proxy metrics. Laya remains shadow-only.
- [ ] **Step 5: Run the adapter tests and benchmark.** Record actual results; if the dependency cannot run under available hardware, document `NOT_WORTHWHILE` with the evidence rather than inventing speed claims.
- [ ] **Step 6: Commit only Laya tooling/docs.** Commit `feat: add isolated laya system1 shadow evaluation` separately from the production reliability commits.

### Task 8: Final verification and review

**Files:**
- Modify: `docs/PROJECT_STATE.md` if final evidence is missing
- Test: all required local and production checks

- [ ] **Step 1: Re-read the spec and plan.** Check every acceptance item, confirm no Laya import occurs in production application code, and verify the member Credit gate remains intact.
- [ ] **Step 2: Run fresh final verification.** Repeat full tests, TypeScript, build, audit, diff check, targeted lint, secret scan, production health gate, 5/5 soak, restart and post-restart reading.
- [ ] **Step 3: Request a focused code review.** Review the incident commits against the design and inspect the Laya diff independently; fix all Critical/Important findings before push.
- [ ] **Step 4: Push and verify refs.** Push `codex/natarot-ai-reliability-laya`, verify local/remote equality, and report any push failure explicitly.
- [ ] **Step 5: Produce the final report.** Use the owner-specified headings and state the member limitation precisely: production DeepSeek works for authorized guest/member requests, but a member with zero Credit is correctly blocked until a real Credit grant exists.
