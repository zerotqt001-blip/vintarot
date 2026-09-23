# Personal AI Memory 3141562 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and publish the private `ai-memory-3141562` GitHub repository as a compact, source-grounded, read-first memory system for cross-account ChatGPT/Codex continuity.

**Architecture:** Use one small Markdown-only Git repository with a read-only bootstrap contract, a short workspace context, a project dashboard, focused per-project memory, and explicit security/source-precedence rules. The repository stores durable orientation and decisions; each project repository remains the technical source of truth. Repository creation, content authoring, validation, commit, push, and remote verification remain separate gates.

**Tech Stack:** Markdown, Git, GitHub CLI (`gh`), standard Git remote operations, shell-based structural and secret-like-literal checks. No application framework, runtime service, database, GitHub Action, or executable bootstrap command is required.

**Spec:** `docs/superpowers/specs/2026-09-20-personal-ai-memory-design.md` (approved and published as commit `ca33ce2c18c09f6ed9dc26ae9b84ff00cb7f661c` on `codex/personal-ai-memory-design-review`)

## Global Constraints

- The future repository name is exactly `ai-memory-3141562`.
- GitHub visibility must be `PRIVATE`; if private visibility cannot be confirmed, stop before pushing memory.
- `chạy 3141562`, `chạy 3141562 natarot`, `chạy 3141562 jobs`, and `chạy 3141562 company` are human/agent conventions, not GitHub commands, credentials, secrets, or authentication.
- Bootstrap is `READ / RESTORE CONTEXT ONLY`; it never edits memory, creates files, commits, pushes, reconciles conflicts, changes project repositories, changes databases, deploys, or deletes anything.
- Memory writes require explicit human intent such as `cập nhật 3141562`, `lưu quyết định này vào 3141562`, or `update NaTarot memory`.
- On drift, verified project source/runtime wins; conflicting memory is reported as `STALE` and is not silently rewritten.
- Use confidence labels only from `VERIFIED`, `REPORTED`, `PLANNED`, `IDEA`, `HISTORICAL`, `UNVERIFIED`, and `STALE`.
- Never describe planned work as implemented, a pushed commit as deployed, or a code fix as production-verified without direct evidence.
- Never store passwords, API-key values, GitHub tokens, OAuth secrets, private keys, database passwords, session cookies, recovery codes, payment credentials, or identity documents. Variable names such as `DEEPSEEK_API_KEY` may appear without values.
- Keep memory high-signal and compact. Do not add full chat/Codex transcripts, full Git history, raw test/deployment logs, database backups, binary assets, or source-code mirrors.
- The current VinTarot worktree is dirty and user-owned. The implementation must use a fresh sibling directory and must not stage, modify, stash, reset, clean, delete, or commit any existing VinTarot changes.
- Local edit, commit, push, and deployment are separate states. Report commit and push status separately.
- Do not create a public fallback, force-push, merge unrelated branches, or deploy any project.

---

### Stage 0: Preconditions and evidence lock

**Goal:** Prove that the implementation can be performed in an isolated sibling repository with authenticated GitHub access and verified NaTarot inputs.

**Files:**
- Read only: `docs/superpowers/specs/2026-09-20-personal-ai-memory-design.md`
- Read only: `docs/PROJECT_STATE.md`
- Read only: current VinTarot Git refs and source files

**Inputs:**
- Approved spec commit `ca33ce2c18c09f6ed9dc26ae9b84ff00cb7f661c`
- GitHub owner `zerotqt001-blip`
- Target repository `ai-memory-3141562`
- NaTarot repository `zerotqt001-blip/vintarot`
- User-supplied Level 4 baseline branch `codex/natarot-level4-baseline`, commit `ed9d60883cae92d2395961199339b06c26b3e6b6`, direct parent `4db459a016f6335fc94a044a76318663c1b40af5`

**Actions:**

- [ ] Confirm the approved spec is present and unchanged with `git show ca33ce2c18c09f6ed9dc26ae9b84ff00cb7f661c:docs/superpowers/specs/2026-09-20-personal-ai-memory-design.md` and `git diff --quiet ca33ce2c18c09f6ed9dc26ae9b84ff00cb7f661c -- docs/superpowers/specs/2026-09-20-personal-ai-memory-design.md`.
- [ ] Record current VinTarot status with `git status --short --branch`, `git rev-parse HEAD`, and `git branch --show-current`; treat every existing modification as protected user work.
- [ ] Confirm GitHub authentication with `gh auth status` without printing credentials.
- [ ] Define `PLANNING_ROOT="$(git rev-parse --show-toplevel)"` and `MEMORY_ROOT="$(dirname "$PLANNING_ROOT")/ai-memory-3141562"`.
- [ ] Check `gh repo view zerotqt001-blip/ai-memory-3141562 --json nameWithOwner,isPrivate,url,defaultBranchRef` and `test ! -e "$MEMORY_ROOT"`; an existing target requires a stop decision.
- [ ] Verify the Level 4 commit ancestry and source-grounded provider, Knowledge Base V5, catalog, language, authentication, saved-reading, and protected-zone facts. Do not infer missing facts from historical chat context.

**Validation:** GitHub authentication works; the target repository/path is absent or explicitly identified; the baseline commit and parent resolve; every imported fact has evidence or an explicit `REPORTED`/`UNVERIFIED` label.

**Stop conditions:** Authentication is unavailable; the target exists with unknown contents or non-private visibility; the sibling path is occupied; or any supplied NaTarot identifier conflicts with evidence and cannot be reported without guessing.

**Expected output:** An execution note with the isolated path, GitHub owner, protected VinTarot status, and an evidence table. No target repository, file, or current project file changes.

---

### Stage 1: Create and verify the private repository boundary

**Goal:** Create the empty private GitHub repository and initialize a separate local Git repository without writing memory content.

**Files:**
- Create: sibling `ai-memory-3141562/.git/`
- Create: local Git remote configuration only

**Inputs:** Stage 0 authentication and `MEMORY_ROOT`.

**Actions:**

- [ ] Create the repository only if Stage 0 proves it is absent: `gh repo create zerotqt001-blip/ai-memory-3141562 --private --description "Private high-signal AI workspace memory for bootstrap 3141562"`.
- [ ] Verify privacy immediately with `gh repo view zerotqt001-blip/ai-memory-3141562 --json nameWithOwner,isPrivate,url,defaultBranchRef`; require `isPrivate=true`.
- [ ] After privacy passes, run `mkdir "$MEMORY_ROOT"`, `git -C "$MEMORY_ROOT" init -b main`, and `git -C "$MEMORY_ROOT" remote add origin https://github.com/zerotqt001-blip/ai-memory-3141562.git`.
- [ ] Confirm `git -C "$MEMORY_ROOT" remote -v`, `git -C "$MEMORY_ROOT" branch --show-current`, and `git -C "$MEMORY_ROOT" status --short --branch`.

**Validation:** The GitHub name is exact and private; local branch is `main`; only the intended `origin` exists; the local working tree has no content.

**Stop conditions:** Visibility is public/unknown; creation fails; the local path is not empty; or any recovery would require force-pushing or changing the VinTarot branch.

**Expected output:** An empty local `main` repository connected to a confirmed-private remote. No memory Markdown is authored or pushed.

---

### Stage 2: Create governance and bootstrap files

**Goal:** Author the top-level contract that makes bootstrap read-only, access-aware, source-grounded, secure, and maintainable.

**Files:**
- Create: `README.md`
- Create: `AI_START_HERE.md`
- Create: `MASTER_CONTEXT.md`
- Create: `PROJECTS.md`
- Create: `MEMORY_RULES.md`
- Create: `SECURITY.md`
- Create the approved `projects/`, `ideas/`, `decisions/`, and `archive/` directory entries through later stages

**Inputs:** Approved design, this plan's global constraints, and Stage 0 evidence.

**Actions:**

- [ ] Write `AI_START_HERE.md` with `3141562` as a human convention, all four aliases, startup read order (`AI_START_HERE.md`, `MASTER_CONTEXT.md`, `PROJECTS.md`, then only relevant project memory), actual-source inspection before technical claims, and the rule that bootstrap never writes, commits, pushes, reconciles, deploys, or deletes.
- [ ] Add missing-access behavior: report unavailability and ask the user to connect/authorize GitHub; never guess or fabricate memory.
- [ ] Add drift behavior: detect mismatch, report it, identify the authoritative source, and wait for explicit update authorization.
- [ ] Write `MASTER_CONTEXT.md` with only short workspace context: multiple accounts/sessions/computers, GitHub as durable external memory, staged/auditable work, and protection from cross-session confusion. Do not create a personal profile or store sensitive personal information.
- [ ] Write `MEMORY_RULES.md` with store/do-not-store categories, confidence labels, source precedence, explicit write intent, compactness/summarization, project-registration minimums, multi-agent conflict handling, and the authorized write workflow.
- [ ] Write `SECURITY.md` with the prohibited-data list, the rule that variable names may appear without values, private-repository enforcement, and stop-before-commit/push behavior for secret-like content.
- [ ] Write `README.md` in simple language explaining purpose, `3141562`, new-account recovery, adding a project, and prohibited data.

**Validation:** All six top-level files exist; `AI_START_HERE.md` contains all aliases and read-only/no-guess rules; `MEMORY_RULES.md` distinguishes `READ`, `WRITE`, `COMMIT`, `PUSH`, and `DEPLOY`; `SECURITY.md` prohibits credential values; `MASTER_CONTEXT.md` is short.

**Stop conditions:** A file implies that bootstrap can write, authenticate, or deploy; invents architecture or credentials; or expands the approved structure without authorization.

**Expected output:** A small governance layer that a fresh agent can follow without hidden chat context and without project implementation code.

---

### Stage 3: Register projects and lightweight placeholders

**Goal:** Make `PROJECTS.md` a truthful dashboard and register early-stage projects without inventing architecture.

**Files:**
- Modify: `PROJECTS.md`
- Create: `projects/recruitment/SUMMARY.md`
- Create: `projects/company-intelligence/SUMMARY.md`
- Create: `ideas/INBOX.md`
- Create: `decisions/GLOBAL_DECISIONS.md`
- Create: `archive/README.md`

**Inputs:** Explicit project names/aliases from the approved spec and Stage 0 evidence.

**Actions:**

- [ ] Add NaTarot with alias `natarot`, status `ACTIVE`, repository `zerotqt001-blip/vintarot`, category `AI Tarot platform`, memory path `projects/natarot/`, and an evidence-backed or explicitly `UNVERIFIED` current focus.
- [ ] Add Recruitment Platform with alias `jobs`, status `PLANNING`, category `Recruitment / jobs`, memory path `projects/recruitment/`, and only the known direction: jobs, recruitment, ATS, aggregation, crawling, search, and matching.
- [ ] Add Company Intelligence Platform with alias `company`, status `IDEA` or `PLANNING` according to evidence, category `Company data / intelligence`, memory path `projects/company-intelligence/`, and only the known direction: company profiles, data collection, crawling, enrichment, deduplication, and search.
- [ ] Ensure each dashboard entry includes name, alias, purpose, status, repository/location if known, source-of-truth location, constraints, current priority, next action, and confidence.
- [ ] State explicitly that Recruitment and Company Intelligence architecture, repository, technology, database, deployment, and implementation status are not yet known.
- [ ] Create `ideas/INBOX.md` with the fields `Idea`, `Date`, `Status`, `Description`, `Potential project`, and `Notes`.
- [ ] Create minimal `decisions/GLOBAL_DECISIONS.md` and `archive/README.md` without adding a log database.

**Validation:** All three dashboard entries use exact aliases and paths; early-stage projects contain no invented architecture or implementation claims; required registration fields and confidence are visible; ideas remain ideas.

**Stop conditions:** An early-stage project receives an unsupported repository, stack, database, deployment, or status; or a missing field is filled by inference instead of being marked unknown/unverified.

**Expected output:** A truthful project dashboard and lightweight future-project placeholders.

---

### Stage 4: Import high-signal NaTarot memory

**Goal:** Populate only durable NaTarot context, with evidence labels and no audit-report or source-code dump.

**Files:**
- Create: `projects/natarot/SUMMARY.md`
- Create: `projects/natarot/CURRENT_STATE.md`
- Create: `projects/natarot/DECISIONS.md`
- Create: `projects/natarot/ROADMAP.md`
- Create: `projects/natarot/HANDOFF.md`
- Modify: `PROJECTS.md` only for evidence-backed current focus/next action updates

**Inputs:** Verified VinTarot repository/project-state documents, supplied Level 4 identifiers, and the approved confidence model.

**Actions:**

- [ ] Write `SUMMARY.md` with project `NaTarot`, former name `VinTarot`, repository `zerotqt001-blip/vintarot`, production `natarot.com`, purpose, alias `natarot`, and confidence/evidence fields.
- [ ] Verify and record in `CURRENT_STATE.md`: branch `codex/natarot-level4-baseline`, commit `ed9d60883cae92d2395961199339b06c26b3e6b6`, direct parent `4db459a016f6335fc94a044a76318663c1b40af5`, and the evidence-backed status of local/remote equality, publication, and deployment. If source evidence differs, mark the supplied claim `REPORTED` or `UNVERIFIED`, report the mismatch, and do not present it as verified.
- [ ] Record high-level technical context in `CURRENT_STATE.md`: DeepSeek provider, Knowledge Base V5, 78-card Tarot catalog, upright/reversed meanings, Vietnamese/English support, user-centered situation-first reading philosophy, saved readings, member authentication/Google OAuth, and F-001 identity boundary. Use a compact fact/evidence/confidence table.
- [ ] Record protected zones in `DECISIONS.md`: authentication, Google OAuth, session/request identity, F-001 security boundary, database migrations, Knowledge Base V5, prompt behavior, DeepSeek credentials, saved-reading flow, and production deployment. State that the project repository remains authoritative for exact files.
- [ ] Record only major durable workflow decisions in `DECISIONS.md`: staged/auditable development, source precedence, no credential storage, separation of pushed from deployed, and external TarotWhisper/anois research as architecture research only and not a dependency.
- [ ] Write `ROADMAP.md` with these items all marked `PLANNED` or `UNDER REVIEW` unless direct evidence proves otherwise: `L1A semantic spread contract`, `L1B normalized geometry`, `L1C SpreadBoard / Room integration`, `L4 Auto Topic / Auto Spread`, `L5 whole-spread metadata`, `L6 streaming hardening`, `L7 intelligent follow-up`, `L8 supplementary draw`, `L9 public share token`, `L10 PNG + QR`, and `L11 spread editor`.
- [ ] Write `HANDOFF.md` with current verified priority, next action, open issue/mismatch list, evidence needed for the next update, and a reminder to inspect `zerotqt001-blip/vintarot` before coding. Do not paste full audits, test output, or transcripts.
- [ ] Tag every imported claim with an allowed confidence label. Never convert `PLANNED` to `VERIFIED`, `PUSHED` to `DEPLOYED`, or a source-only fix to production verification.

**Validation:** Canonical identifiers are preserved exactly or explicitly marked `REPORTED`/`UNVERIFIED`; NaTarot files contain durable context but no source mirror, audit dump, raw log, credential value, or binary asset; roadmap items are visibly planned/under review; `PROJECTS.md` links to all five NaTarot files.

**Stop conditions:** A source conflict cannot be represented without guessing; a protected fact would require a credential/private operational value; or the draft begins duplicating technical truth that belongs in the NaTarot repository.

**Expected output:** Five compact, evidence-labeled NaTarot memory files that guide an agent to the real source repository.

---

### Stage 5: Security, structure, and memory-quality validation

**Goal:** Prove that the repository has exactly the approved shape, contains no credential-like values, and remains compact/high-signal before commit.

**Files:** Read all future repository files; create no validation scripts or runtime files.

**Inputs:** Stages 2–4 output and the following exact required list:

```text
README.md
AI_START_HERE.md
MASTER_CONTEXT.md
PROJECTS.md
MEMORY_RULES.md
SECURITY.md
projects/natarot/SUMMARY.md
projects/natarot/CURRENT_STATE.md
projects/natarot/DECISIONS.md
projects/natarot/ROADMAP.md
projects/natarot/HANDOFF.md
projects/recruitment/SUMMARY.md
projects/company-intelligence/SUMMARY.md
ideas/INBOX.md
decisions/GLOBAL_DECISIONS.md
archive/README.md
```

**Actions:**

- [ ] Compare `find . -type f -not -path './.git/*' | sort` against the exact list; investigate every difference.
- [ ] Search for required bootstrap phrases, aliases, explicit-write examples, source-precedence entries, missing-access behavior, and confidence labels.
- [ ] Scan for actual secret-like literals with `rg -n -i '(sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+ PRIVATE KEY-----|password\s*[:=]\s*[^` ]+|api[_-]?key\s*[:=]\s*[^` ]+)' .`; allow variable names only when no value is present.
- [ ] Check for accidental large/binary artifacts with `find . -type f -not -path './.git/*' -size +200k -print` and `find . -type f -not -path './.git/*' -print0 | xargs -0 file`.
- [ ] Review `git diff --check`, `git status --short`, `git diff --stat`, and the complete Markdown diff.

**Validation:** The exact list matches; all contract phrases exist; secret scan finds no values; no large/generated/binary artifacts exist; whitespace and full-diff review pass.

**Stop conditions:** Any secret-like value, unexpected file, large artifact, malformed path, whitespace error, unsupported claim, or source-conflict guess is found. An empty structural query where content is known to exist is also a stop signal until independently re-probed.

**Expected output:** A validated, compact, secret-free working tree ready for an isolated initial commit.

---

### Stage 6: Create the focused initial commit

**Goal:** Commit only the approved memory files with the milestone message `memory: initialize workspace 3141562`.

**Files:** Stage only the 16 required Markdown files from Stage 5; never stage a wildcard or a VinTarot path.

**Inputs:** Stage 5 validation output.

**Actions:**

- [ ] Run `git status --short --branch` before staging.
- [ ] Stage the exact required file list.
- [ ] Verify `git diff --cached --name-only`, `git diff --cached --check`, `git diff --cached --stat`, the staged full diff, and the staged secret scan.
- [ ] Commit only after the staged list contains the required files and nothing else: `git commit -m "memory: initialize workspace 3141562"`.

**Validation:** The commit changes only the approved Markdown list, has the exact message, and leaves the future memory repository clean.

**Stop conditions:** Any unrelated file is staged, secret scan fails, or the diff contains an unsupported fact. Never include current VinTarot files.

**Expected output:** One local initial memory commit with no application code or credentials.

---

### Stage 7: Push only after authorization and privacy confirmation

**Goal:** Publish the verified initial commit to the confirmed-private remote with a normal push.

**Files:** No file changes; remote ref `origin/main` only.

**Inputs:** Stage 1 privacy verification, Stage 6 commit, and explicit publishing authorization/configuration.

**Actions:**

- [ ] Re-check privacy with `gh repo view zerotqt001-blip/ai-memory-3141562 --json nameWithOwner,isPrivate,url,defaultBranchRef`; require `isPrivate=true`.
- [ ] Confirm `git branch --show-current`, `git remote get-url origin`, and `git rev-parse HEAD` identify the memory repository and `main`.
- [ ] Push normally with `git push -u origin main`; never use `--force`.

**Validation:** Privacy is true before push; the push exits successfully; only `ai-memory-3141562` is updated; no push targets VinTarot.

**Stop conditions:** Privacy is false/unknown, remote URL is wrong, push is rejected, or credentials require an unapproved action. Never force-push or create a public fallback.

**Expected output:** The initial memory commit is published, with commit and push status recorded separately from deployment status.

---

### Stage 8: Verify final remote state

**Goal:** Prove that the exact local memory commit exists on the private remote and contains the approved structure.

**Files:** No file changes.

**Inputs:** Stage 6 commit hash and Stage 7 push result.

**Actions:**

- [ ] Verify repository metadata/privacy with `gh repo view zerotqt001-blip/ai-memory-3141562 --json nameWithOwner,isPrivate,url,defaultBranchRef`.
- [ ] Compare `local_commit="$(git rev-parse HEAD)"` with `remote_commit="$(git ls-remote origin refs/heads/main | awk '{print $1}')"`; require exact equality.
- [ ] Verify `git ls-tree -r --name-only "$remote_commit"` matches the Stage 5 file list.
- [ ] Report that push completion is not deployment and that no production action occurred.

**Validation:** Repository name, URL, privacy, remote hash, and remote file list all match expected values.

**Stop conditions:** Hash differs, privacy changes, required files are missing, or unexpected files appear. Do not amend or force-push; preserve evidence and report the mismatch.

**Expected output:** A remote-verification record with URL, privacy, commit hash, file list, and separate deployment status.

---

### Stage 9: Run the bootstrap acceptance test

**Goal:** Demonstrate that a fresh agent can recover concise context without triggering writes or fabricating inaccessible data.

**Files:** Read-only shallow clone in a scoped temporary directory; no repository content changes.

**Inputs:** Stage 8 verified private remote and the four bootstrap conventions.

**Actions:**

- [ ] Clone `main` to a temporary directory with `git clone --branch main --depth 1 https://github.com/zerotqt001-blip/ai-memory-3141562.git "$ACCEPTANCE_ROOT/memory"`; use a scoped `mktemp -d` path and cleanup trap.
- [ ] Read `AI_START_HERE.md`, `MASTER_CONTEXT.md`, and `PROJECTS.md` in that order and confirm the concise response shape: `Memory 3141562 loaded`, active projects, current priorities, and a request for the project to continue.
- [ ] Verify alias routing: general bootstrap reads top-level context; `natarot` reads the five NaTarot files; `jobs` reads Recruitment `SUMMARY.md`; `company` reads Company Intelligence `SUMMARY.md`.
- [ ] Verify the acceptance text prohibits automatic writes, commits, pushes, project changes, deployments, deletes, conflict reconciliation, and stale-fact updates.
- [ ] Verify missing access reports unavailability and requests authorization rather than reconstructing context.
- [ ] Confirm the acceptance test itself performs no write to the memory repository; it is documentation/static-behavior validation, not an executable bootstrap command.

**Validation:** File order, relevant-project scoping, concise response, alias routing, no-write behavior, source-drift behavior, and missing-access behavior all match the contract.

**Stop conditions:** Any path implies an automatic write, guess, deployment, or authentication bypass; an alias resolves to invented architecture; or the clone contains unapproved files.

**Expected output:** An acceptance result proving that `3141562` restores context only and that implementation remains separate from bootstrap.

## Failure and rollback handling

Use these bounded responses and never improvise destructive recovery:

| Failure | Required response |
| --- | --- |
| GitHub creation fails | Stop before local content creation and report the exact human action required. |
| Repository exists unexpectedly | Stop; inspect ownership/visibility and ask for direction. Do not overwrite/delete it. |
| Visibility is public/unknown | Stop; do not push memory. Correct visibility through explicit authorization before resuming. |
| Local memory path exists | Stop; do not overwrite, clean, or delete it. |
| NaTarot evidence conflicts | Do not guess; label the supplied claim `REPORTED`/`UNVERIFIED` only when clear, otherwise stop and report. |
| Secret-like content appears | Stop before commit/push; remove/review the value, re-scan, and inspect its source. |
| Unexpected staged file appears | Unstage only inside the new memory repository if safely scoped; never touch VinTarot user files. |
| Commit/push fails | Preserve local evidence, report commit/push separately, and do not force-push or rewrite history. |
| Remote verification fails | Stop further work and report the exact hash/privacy/file mismatch. |

## Completion checklist

- [ ] Stages 0–9 execute only after this plan receives explicit approval.
- [ ] The GitHub repository is exactly `zerotqt001-blip/ai-memory-3141562` and private.
- [ ] The approved Markdown structure exists with no unnecessary expansion.
- [ ] Bootstrap and aliases are read-only and never treated as credentials.
- [ ] Explicit write intent, source precedence, drift handling, confidence labels, and compactness rules are documented.
- [ ] NaTarot memory contains only evidence-labeled durable context and the approved planned roadmap.
- [ ] Recruitment and Company Intelligence remain lightweight and non-invented.
- [ ] Secret scan, structure, `git diff --check`, staged diff review, commit, push, remote hash, privacy, and acceptance checks pass.
- [ ] The final report separates local edit, commit, push, and deployment status and confirms NaTarot runtime impact is `NONE`.
