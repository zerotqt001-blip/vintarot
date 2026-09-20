# Personal AI Memory 3141562 Design

**Date:** 2026-09-20
**Status:** Approved design; implementation pending written-spec review
**Scope:** A standalone private GitHub repository named `ai-memory-3141562`

## Goal

Create a small, durable, source-grounded memory repository that lets a new ChatGPT or Codex session restore the owner's high-signal project context across accounts, computers, and projects. The bootstrap code `3141562` is a human convention documented by the repository; GitHub does not globally register or execute the command `chạy 3141562`.

## Boundary and non-goals

The memory repository is a read-first context layer, not an automation service and not a replacement for any project's source repository, `AGENTS.md`, or project-memory documentation. Running the bootstrap must not modify code, create commits, deploy, change a database or production system, send messages, or delete files. The setup will not place secrets, credentials, tokens, cookies, private keys, identity documents, payment data, or database passwords in the repository.

The VinTarot application and production systems are outside the implementation scope. The setup may create only the planning artifact for this mission in the current repository and a separate memory repository; it must not modify application code, runtime configuration, databases, deployments, or production state.

## Repository architecture

The memory repository will be initialized as a sibling checkout at `/Users/tranquangthanh/Documents/ChatGPT/ai-memory-3141562`, then created and pushed as a private GitHub repository only if the authenticated GitHub operation succeeds. The top-level files are the human and AI entry points:

- `README.md` explains the purpose, setup, maintenance, and human recovery flow.
- `AI_START_HERE.md` defines the bootstrap contract and read-only startup procedure.
- `MASTER_CONTEXT.md` holds a deliberately short workspace-level context.
- `PROJECTS.md` is the dashboard of registered projects and aliases.
- `MEMORY_RULES.md` defines signal/noise boundaries, update protocol, confidence labels, and source precedence.
- `SECURITY.md` defines prohibited data and secret-handling rules.

Project context is isolated below `projects/`. NaTarot receives `SUMMARY.md`, `CURRENT_STATE.md`, `DECISIONS.md`, `ROADMAP.md`, and `HANDOFF.md`. Recruitment and Company Intelligence receive lightweight `SUMMARY.md` placeholders only. `ideas/INBOX.md`, `decisions/GLOBAL_DECISIONS.md`, and `archive/README.md` provide the minimal future extension points without creating a log database.

## Bootstrap behavior

`AI_START_HERE.md` documents these conventions:

| Human command | Context to restore |
| --- | --- |
| `chạy 3141562` | Workspace-level context and project dashboard |
| `chạy 3141562 natarot` | Workspace context plus NaTarot memory files |
| `chạy 3141562 jobs` | Workspace context plus Recruitment memory |
| `chạy 3141562 company` | Workspace context plus Company Intelligence memory |

The startup sequence is: read `AI_START_HERE.md`, `MASTER_CONTEXT.md`, and `PROJECTS.md`; identify the relevant project; read only that project's memory; inspect the actual source repository before making technical claims or coding changes; and treat the source repository as technical truth. A recovery response is concise and names active projects and major priorities without dumping all memory content.

## Evidence and NaTarot import

NaTarot memory will record identity, repository, production domain, the supplied Level 4 baseline, provider and knowledge-base context, deck/orientation/language context, reading philosophy, protected areas, external research references, and the under-review roadmap. Each fact is labeled `VERIFIED`, `REPORTED`, `PLANNED`, `IDEA`, `HISTORICAL`, `UNVERIFIED`, or `STALE` as appropriate. In particular, planned roadmap items and external research repositories are never described as implemented dependencies; a pushed commit is never described as deployed without deployment evidence.

The current VinTarot repository has source evidence for the NaTarot brand, 78-card Tarot catalog, bilingual orientation meanings, DeepSeek provider support, Knowledge Base V5 references, saved-reading behavior, and the protected authentication/persistence/prompt/deployment areas. The exact Level 4 branch/commit/parent values supplied in the request will be preserved with confidence labels and cross-checked against available Git refs during implementation. Any mismatch between memory and the source repository will be reported and corrected only after verification.

## Source precedence and concurrency

The documented precedence is:

1. Current explicit human instruction.
2. Verified project repository or runtime state.
3. Project-specific canonical memory.
4. Personal AI Memory.
5. Verified reports.
6. Historical chat context.

Memory updates are milestone-based. A substantive session classifies a durable change as `PROJECT`, `TYPE`, `STATUS`, and `EVIDENCE`, then edits only the relevant file. The repository records project, workstream, branch, baseline, and status where needed so concurrent Codex sessions do not silently overwrite one another.

## Security and publishing gates

The initial commit is focused and named `memory: initialize workspace 3141562`. Before committing, the setup checks `git status`, `git diff --check`, tracked content for secret-like literals, and the staged diff. GitHub creation must explicitly request private visibility. If repository creation cannot be completed in the current environment, implementation stops at that operation and reports the exact human action required; no public repository is created as a substitute. Push status is reported separately from local commit status.

## Validation

Validation covers required file paths, required headings and bootstrap statements, forbidden secret patterns and credential-like values, Markdown link/path consistency, Git whitespace checks, clean staging of only mission files, and private remote visibility when the GitHub API/CLI exposes it. The final report explicitly states whether the remote was created, whether push succeeded, and that no application code, production state, deployment, or credentials were changed.
