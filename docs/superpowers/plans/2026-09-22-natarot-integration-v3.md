# NaTarot Master Integration V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Integrate the verified backend, Credits/VIP, SePay Sandbox, Affiliate, Auth, Tarot, Share and staging capabilities into one certifiable \`codex/natarot-integration-v3\` line, deploy only to staging, and produce the feature-freeze/UI-handoff evidence.

**Architecture:** Use Backend Completion V1 \`8409c8d\` as the base because it descends from the verified Staging Integration V2 checkpoint and already contains the later backend/Affiliate/RBAC work. Port only the SePay implementation and its verified follow-up fixes from the divergent SePay branch, resolving overlaps in favor of the newer backend and preserving the filename-keyed migration runner's two historical \`0007_*.sql\` entries. Validate with fresh/upgrade SQLite fixtures, the complete tracked suite, local build/type/security checks, then perform guarded staging backup/migration/deploy/E2E/browser certification without touching production.

**Tech Stack:** Next/Vinext, TypeScript, React, SQLite/D1, Drizzle SQL migrations, Node \`node:test\`, systemd/Nginx staging deployment, SSH BatchMode inspection, browser QA.

**Spec:** \`/Users/tranquangthanh/.codex/attachments/8a7aa30b-61d3-4396-a883-9f3b65608cbd/Văn bản đã dán.txt\`

## Global Constraints

- Preserve F-001 trusted identity, Auth/Google/guest semantics, KB V5, \`tarot-reading-v4.2.2\`, L1/L4/L5/L7/L8, Share S1–S6, ledger/VIP invariants, verified-payment boundary, Affiliate verified-fulfillment boundary, append-only Audit and server-side RBAC.
- Deploy, migrate, restart and certify only \`https://staging.natarot.com\`; do not deploy/migrate/restart production, enable production payments, print or commit secrets, or perform real-money transactions.
- Do not redesign UI; fix only functional blockers, data/rendering defects, broken navigation, accessibility blockers or mobile overflow that prevents use.
- Never force-push, delete unknown/active databases, delete required backups, or rewrite historical migrations; use the existing migration runner semantics and record exact ancestry/conflicts.

---

### Task 1: Establish the canonical integration branch and provenance record

**Files:**
- Create: \`docs/superpowers/plans/2026-09-22-natarot-integration-v3.md\`
- Modify: \`docs/PROJECT_STATE.md\` only after integration facts are verified

**Interfaces:**
- Consumes: remote refs \`origin/codex/natarot-backend-completion-v1\`, \`origin/codex/natarot-sepay-implementation-v1\`, \`origin/codex/natarot-staging-integration-v2\`.
- Produces: branch \`codex/natarot-integration-v3\` based on \`8409c8d\`, with a written base/source/strategy/conflict record.

- [ ] **Step 1: Confirm remote state and clean worktree**

Run:

\`\`\`bash
git fetch origin --prune
git status --short --branch
git show -s --format='%H %P %s' origin/codex/natarot-backend-completion-v1
git show -s --format='%H %P %s' origin/codex/natarot-sepay-implementation-v1
git show -s --format='%H %P %s' origin/codex/natarot-staging-integration-v2
\`\`\`

Expected: no user changes are lost; Backend Completion is \`8409c8d\`; SePay is \`8e6b712\`; Staging V2 is newer than \`fd7d8fe\` only by its documented audit-resume commit \`631027d\`.

- [ ] **Step 2: Keep the current branch rooted at Backend Completion V1**

Run:

\`\`\`bash
git switch -c codex/natarot-integration-v3 origin/codex/natarot-backend-completion-v1
\`\`\`

If the branch already exists locally, verify it points at the intended integration base before continuing; do not reset away changes.

- [ ] **Step 3: Record the integration graph in the final state documents after evidence exists**

The final report must name base \`8409c8d\`, ported SePay commits \`d6c204a\`, \`4443a04\`, \`3924326\`, \`44a9eb6\`, \`594e569\`, excluded historical branch-only docs/merge snapshots, and any conflict resolutions by path.

### Task 2: Port SePay Sandbox implementation without overwriting newer backend semantics

**Files:**
- Modify: \`app/api/commercial/**\`, \`db/schema.ts\`, \`lib/commercial/**\`, \`lib/orders.ts\`, \`lib/runtime.ts\`
- Create: \`drizzle/0007_sepay_commercial.sql\`, \`scripts/seed-staging-commercial.mjs\`, \`tests/sepay-*.test.ts\`, \`tests/staging-commercial-contract.test.ts\`
- Modify: \`tests/node-migrate.test.ts\`

**Interfaces:**
- Consumes: Credits/VIP order and fulfillment services already present on \`codex/natarot-integration-v3\`.
- Produces: SePay Sandbox checkout, signed return, IPN verification, reconciliation, idempotent payment event/fulfillment flow, and safe staging seed contract.

- [ ] **Step 1: Port only the five verified SePay implementation/fix commits**

Run:

\`\`\`bash
git cherry-pick d6c204a 4443a04 3924326 44a9eb6 594e569
\`\`\`

Resolve conflicts by preserving Backend Completion's newer account/Affiliate/RBAC/audit schema and service boundaries, while retaining SePay's payment-attempt/event tables and verified-payment transition. Do not cherry-pick SePay documentation-only gate commits or its historical branch merge commits.

- [ ] **Step 2: Inspect migration naming and schema before changing it**

Run:

\`\`\`bash
git diff --check
git diff -- drizzle/0007_backend_completion.sql drizzle/0007_sepay_commercial.sql scripts/node-migrate.mjs
\`\`\`

Keep both full migration filenames because \`scripts/node-migrate.mjs\` tracks exact names in \`natarot_migrations\`; do not rename the historical Backend Completion migration or silently drop SePay schema.

- [ ] **Step 3: Run the focused SePay and commercial tests**

Run:

\`\`\`bash
npx tsx --test tests/sepay-*.test.ts tests/staging-commercial-contract.test.ts tests/package-order.test.ts tests/credits-*.test.ts tests/tarot-credit-authorization.test.ts
\`\`\`

Expected: all focused tests pass. If an integration defect appears, add a failing regression test first, then make the smallest semantic fix and rerun the focused suite.

- [ ] **Step 4: Commit the coherent SePay integration once the focused suite is green**

Run:

\`\`\`bash
git add app/api/commercial db/schema.ts drizzle/0007_sepay_commercial.sql lib/commercial lib/orders.ts lib/runtime.ts scripts/seed-staging-commercial.mjs tests/node-migrate.test.ts tests/sepay-*.test.ts tests/staging-commercial-contract.test.ts
git diff --cached --check
git commit -m "feat: integrate SePay sandbox payment flow"
\`\`\`

### Task 3: Prove fresh and upgrade migration safety

**Files:**
- Modify: \`tests/node-migrate.test.ts\`
- Modify: \`drizzle/meta/_journal.json\` only if the repository's migration tooling requires it and the resulting diff is verified

**Interfaces:**
- Consumes: migrations \`0000\` through both \`0004\` files, \`0005\`, \`0006_credits_vip.sql\`, \`0007_backend_completion.sql\`, and \`0007_sepay_commercial.sql\`.
- Produces: repeatable fresh bootstrap and realistic pre-V3 upgrade coverage preserving Auth, Tarot, Share, Credits, VIP, Orders, Affiliate, Audit, Account/History and SePay tables.

- [ ] **Step 1: Extend the fresh-database assertions**

Assert that two migration runs apply every full filename exactly once, including both \`0007_*\`, and that payment attempts/events, \`order_fulfillments.payment_event_id\`, Affiliate tables, Audit tables, Credits/VIP tables, 78 cards and 312 meanings exist with clean foreign keys.

- [ ] **Step 2: Extend the upgrade fixture from a realistic pre-V3 state**

Create a database through \`0005\`, insert a member, reading/session, share-compatible data and an order/package fixture, then run the current migration runner twice. Assert legacy rows survive, \`0006_credits_vip.sql\`, both \`0007_*\` entries are recorded exactly once, SePay indexes/columns exist, and economic/account/security tables remain valid.

- [ ] **Step 3: Run migration tests and inspect schema directly**

Run:

\`\`\`bash
npx tsx --test tests/node-migrate.test.ts tests/backend-completion-migration.test.ts tests/tarot-migration.test.ts
\`\`\`

Then verify with SQLite \`PRAGMA foreign_key_check\`, \`PRAGMA table_info\`, and \`PRAGMA index_list\` in the test output or a disposable local fixture. Expected: zero foreign-key violations and no duplicate application on rerun.

- [ ] **Step 4: Commit migration-test changes**

Run:

\`\`\`bash
git add tests/node-migrate.test.ts drizzle/meta/_journal.json
git diff --cached --check
git commit -m "test: certify V3 fresh and upgrade migrations"
\`\`\`

### Task 4: Run local product, security and build certification

**Files:**
- Modify only regression-fix files discovered by failing tests; every behavior fix requires a failing test first.
- Create: \`docs/reports/natarot-integration-v3-local-certification.md\` if a durable local evidence record is needed.

**Interfaces:**
- Consumes: all integrated application/API/domain modules and tracked tests.
- Produces: independently verified local test, type, build, lint, diff, secret and dependency results before any staging mutation.

- [ ] **Step 1: Run the focused cross-domain matrix**

Run the repository's Auth/F-001, Tarot/Spread/Auto Topic/L5/L7/L8, Share, Credits/VIP/Orders, SePay, Affiliate, Audit/RBAC/Admin, Account/History and migration suites using \`npx tsx --test\` with explicit file globs.

- [ ] **Step 2: Run full verification**

Run:

\`\`\`bash
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
npm run lint
git diff --check
npm audit --omit=dev
\`\`\`

Document the inherited \`app/vintarot.tsx\` navigation lint debt if it remains; all V3-created/modified files must pass targeted ESLint. Do not broaden lint refactors.

- [ ] **Step 3: Run repository secret scans**

Scan tracked files, staged diff and build output for secret-like values without printing environment values. Confirm no SePay, DeepSeek, OAuth, SSH or payment secret is present in Git, test output, reports or generated assets.

- [ ] **Step 4: Request a focused code review before staging mutation**

Provide the reviewer the exact base SHA, V3 HEAD SHA, migration rationale, protected semantics and test evidence. Fix Critical/Important findings before deployment; record Minor findings as limitations only when they do not affect certification.

### Task 5: Audit staging state, backup, configuration and migrations

**Files:**
- Modify: \`docs/PROJECT_STATE.md\` and/or \`docs/reports/natarot-integration-v3-staging-audit.md\` with redacted evidence only
- Do not modify production files, databases, services or credentials

**Interfaces:**
- Consumes: authorized SSH alias and staging runbook in \`deploy/\` and \`docs/operations/\`.
- Produces: current staging release/commit/service/DB/migration/config snapshot, verified staging-only backup, and applied missing migrations.

- [ ] **Step 1: Perform read-only concurrency and production-isolation audit**

Inspect \`natarot-staging.service\`, active release path/commit, staging DB identity and migration table, process activity, and SePay configuration. Separately record production service/path/DB/health without changing it. If an active competing staging deployment makes safe coordination impossible, stop at the explicit HUMAN_GATE.

- [ ] **Step 2: Create and verify a staging-only backup**

Back up only \`/var/lib/natarot-staging/natarot.sqlite\` to the approved staging backup location, verify file size/mode/ownership and SQLite integrity/foreign keys, and record the redacted path and result. Do not delete required backups.

- [ ] **Step 3: Audit staging-safe configuration without printing values**

Classify DeepSeek, Google OAuth, email provider, SePay Sandbox and encryption abstraction as \`CONFIGURED\`, \`NOT_CONFIGURED\`, \`UNSAFE_TO_REUSE\` or \`HUMAN_GATE\`. Reuse only already-authorized staging-safe configuration; never copy production credentials.

- [ ] **Step 4: Apply missing migrations idempotently and seed only synthetic staging data**

Deploy the V3 migration runner/artifact to staging, run it once, rerun it to prove no duplicate application, and use \`scripts/seed-staging-commercial.mjs\` only for deterministic non-production test members/orders. Verify counts and integrity before service restart.

### Task 6: Deploy to staging and execute customer/commercial/affiliate/RBAC/security E2E

**Files:**
- Modify: staging release files only on the VPS; update local evidence docs with redacted outcomes

**Interfaces:**
- Consumes: verified V3 build, staging backup, migrated staging DB and staging-safe configuration.
- Produces: staging URL certification for customer journey, commercial flow, Affiliate, RBAC/Admin, privacy and adversarial/concurrency behavior.

- [ ] **Step 1: Deploy only to \`https://staging.natarot.com\`**

Upload the verified release, preserve the previous staging release for rollback, restart only \`natarot-staging.service\`, and verify service status plus \`/api/health\`/home/catalog responses.

- [ ] **Step 2: Run the full customer journey**

Register/login or use the approved synthetic member, verify identity as required, open Account and Room, select/auto-select a spread, draw, run one controlled live DeepSeek reading only if staging config is safely present, consume Credits, verify History, follow-up, clarification draw, Share/public opaque link/image/QR/events, revoke/ownership and Account History. If no provider is configured, report live AI as not configured and do not claim a mocked certification.

- [ ] **Step 3: Run commercial and replay/concurrency checks**

Create a package order, perform only SePay Sandbox checkout/payment/IPN/verification, verify exactly one payment event, fulfillment, Credits grant and VIP entitlement. Replay and concurrently submit callbacks/IPNs, reconciliation and fulfillment; assert at-most-once economic effects.

- [ ] **Step 4: Run Affiliate, reversal and RBAC/Admin checks**

Verify referral attribution, self-referral block, post-verified-fulfillment conversion, commission/tier/package snapshots, duplicate protection and supported reversal behavior. Exercise USER, SUPPORT, FINANCE, CONTENT_ADMIN, ADMIN and SUPER_ADMIN permissions, role spoofing, foreign-user access, ledger adjustments, VIP domain service, reason/audit and session revoke.

- [ ] **Step 5: Run privacy/security adversarial checks**

Test F-001 spoofed headers, IDOR, CSRF/origin, SQL injection/mass assignment/XSS surfaces, foreign share/order/account access, private-reading defaults, PII/secret/log leakage, duplicate IPN/conversion/fulfillment/credits/VIP/commission and concurrent economic races. Record only redacted identifiers and outcomes.

### Task 7: Restart/recovery and desktop/mobile browser QA

**Files:**
- Create: \`docs/reports/natarot-integration-v3-browser-qa.md\`
- Modify: functional UI files only if a browser-certified blocker is found and reproduced with a failing test

**Interfaces:**
- Consumes: live staging V3 release and synthetic state from Task 6.
- Produces: restart persistence proof and P0–P3 UI findings for the Final UI owner.

- [ ] **Step 1: Restart staging and recheck persisted state**

Restart only \`natarot-staging.service\`; verify health and persistence of orders, payments, fulfillment, Credits, VIP, Affiliate attribution/commission, Audit, History and Share state. Rerun selected customer/commercial health checks.

- [ ] **Step 2: Exercise functional browser paths on desktop and mobile**

Check Home/Auth/Room/Reading/Follow-up/Share/Account/History/Packages/Checkout/Admin for navigation, usable controls, loading/error/empty states, permission/data rendering and mobile overflow. Do not redesign; classify findings P0 blocker, P1 serious, P2 inconsistency or P3 polish.

- [ ] **Step 3: Fix only certified functional blockers**

For each fix, write and run a failing regression test, implement the smallest change, rerun targeted tests and repeat browser verification. Leave aesthetic findings in the handoff document.

### Task 8: Produce freeze/handoff/state documents and final regression

**Files:**
- Create: \`docs/FEATURE_FREEZE_V3.md\`
- Create: \`docs/design/NATAROT_FINAL_UI_HANDOFF.md\`
- Modify: \`docs/PROJECT_STATE.md\`

**Interfaces:**
- Consumes: local/staging/security/browser evidence and final Git SHA.
- Produces: protected functional zones, UI-owner handoff, truthful project state and final certification report.

- [ ] **Step 1: Write \`docs/FEATURE_FREEZE_V3.md\`**

For AUTH, F-001, Tarot Engine, AI contract, Spread Engine, Share, Credits, VIP, Orders, SePay payment contract, Affiliate, Audit, RBAC and Account/History state what is frozen, what UI-only changes are allowed, what requires semantic review, and the required regression tests.

- [ ] **Step 2: Write \`docs/design/NATAROT_FINAL_UI_HANDOFF.md\`**

Document current routes/component boundaries, data/API contracts, loading/error/empty states, permissions, mobile/SpreadBoard constraints, Reading-result requirements, Share/QR, Credits/VIP, checkout, Affiliate, Account and Admin state. Include all P0–P3 browser findings without redesigning them.

- [ ] **Step 3: Update \`docs/PROJECT_STATE.md\` truthfully**

Separate IMPLEMENTED, INTEGRATED, TESTED, STAGING DEPLOYED and STAGING E2E VERIFIED from PRODUCTION DEPLOYED. Record migration chain, staging release, backup, restart, known limitations and any unresolved UI polish.

- [ ] **Step 4: Run final regression and inspect the release diff**

Run the focused matrix, \`npx tsx --test tests/*.test.ts\`, \`npx tsc --noEmit\`, \`npm run build\`, targeted/full lint, \`git diff --check\`, secret scan and dependency audit. Inspect \`git diff --stat\`, staged diff and Git status for unrelated files or secrets.

### Task 9: Commit, push, verify remote parity and report

**Files:**
- Modify only coherent V3 implementation, tests, reports, freeze/handoff and state documents

**Interfaces:**
- Consumes: final verified worktree and evidence documents.
- Produces: normal commit on \`codex/natarot-integration-v3\`, matching remote ref, and the mandated final report.

- [ ] **Step 1: Commit the final coherent V3 state**

Run:

\`\`\`bash
git status --short
git diff --check
git diff --cached --check
git add <only V3 implementation/tests/docs>
git diff --cached --stat
git diff --cached --check
git commit -m "feat: complete NaTarot master integration v3"
\`\`\`

Before committing, inspect the staged diff for credentials, private data, production paths, build output, \`.env\` files, runtime databases and unrelated UI redesign.

- [ ] **Step 2: Push without force and verify exact parity**

Run:

\`\`\`bash
git push -u origin codex/natarot-integration-v3
git fetch origin codex/natarot-integration-v3
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/codex/natarot-integration-v3)"
git status --short --branch
\`\`\`

Expected: normal push succeeds, local HEAD equals \`origin/codex/natarot-integration-v3\`, and the worktree is clean.

- [ ] **Step 3: Return the mandated final report and stop**

Use the exact report sections from the authoritative brief. Mark \`PASS\` only where fresh evidence supports it; otherwise mark \`HUMAN_GATE\` or \`BLOCKED\`, list the exact gate, and keep production assertions \`NO\`. Do not start Final UI redesign, merge main, activate real SePay or perform payout/real-money actions after the report.
