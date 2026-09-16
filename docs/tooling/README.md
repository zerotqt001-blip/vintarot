# Installed tooling

All source revisions are pinned in sources.lock.json. Skills are stored in .codex/skills and available on the next turn/session. Their presence does not guarantee improved output; apply only relevant workflows and validate the result.

- vercel-labs/skills: find-skills installed using Codex skill-installer.
- obra/superpowers: all 14 skills installed. No separate plugin/hooks installed.
- pbakaus/impeccable: Codex-compatible .agents skill bundle installed with references and launcher. CLI binary is not yet bootstrapped or tested.
- rebelytics/one-skill-to-rule-them-all: complete task-observer bundle. Credit: Eoghan Henn / rebelytics.com, CC BY 4.0. AGENTS.md contains project-local activation guidance; activation must be verified in a new session.
- thedotmack/claude-mem: source checkout in ignored .sites-runtime/claude-mem for inspection. No worker, MCP, transcript capture or cloud sync enabled, per user choice. Project memory lives in docs/PROJECT_STATE.md instead.

# Restore / backup
Original: baseline-before-skills-2026-09-16 (64fca6d). Never move this tag. To inspect without modifying current files, use a new worktree:

    git worktree add ../vintarot-baseline baseline-before-skills-2026-09-16

Commit each completed verified feature on a codex/ branch, then push to configured GitHub origin. Git history backs up source, not production database contents or secret settings. Local commits survive edits but do not protect against disk loss until pushed.
