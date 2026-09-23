# NaTarot Shared UI Architecture LOC Ledger

## Baseline

Measured before implementation on branch `codex/natarot-shared-ui-architecture`, commit `b6eabf2`.

| Scope | Baseline lines |
| --- | ---: |
| Production app/components TS/TSX, excluding API routes | 12,512 |
| `app/globals.css` | 1,965 |
| Tracked test files | 13,680 |
| Tracked Markdown docs | 17,907 |

## After migration

Measured after the verified implementation on the same worktree. Markdown is counted from tracked `docs/**/*.md` paths; production TypeScript excludes `app/api/**`, and tests are tracked `tests/*.test.ts` files.

| Scope | After lines | Delta |
| --- | ---: | ---: |
| Production app/components TS/TSX, excluding API routes | 12,548 | +36 |
| `app/globals.css` | 1,977 | +12 |
| Tracked test files | 13,816 | +136 |
| Tracked Markdown docs | 17,956 | +49 |

The shared shell is now concentrated in `components/shell/` (header, sidebar, footer, celestial background, shell composition, and shared types), totaling 401 lines across the new shell files. `app/vintarot.tsx` is a thin `LanguageProvider` + `NaTarotShell` composition wrapper; route owners remain in their existing pages and backend boundaries remain server-side.

The cleanup removed 101 lines of the proven-dead Affiliate commerce fallback from `app/commerce/commerce-pages.tsx`; the active Affiliate owner remains `components/affiliate/affiliate-dashboard.tsx`. The Account dashboard now renders owner-scoped summary/history data instead of screenshot literals, and its existing unauthenticated gate is preserved. Internal shared-shell destinations use `next/link` so the migration does not add new internal-anchor lint findings.

Verification evidence:

- `npx tsx --test tests/*.test.ts`: 622/622 passing.
- `npx tsc --noEmit`, `npm run build`, and `git diff --check`: passing.
- Targeted ESLint for all changed shared-shell and Account files: passing.
- Local browser checks for Home, Packages, Affiliate, and Account at CSS widths 375, 390, and 412: no horizontal overflow and no console errors/warnings.
- Repository-wide `npm run lint` remains red at the inherited baseline of 76 errors and 126 warnings, concentrated outside the changed shell/Account surface; no lint exception was added.

This ledger measures source/document growth and the specific removed UI, not a claim that every legacy CSS rule or unrelated repository implementation is dead. Further broad CSS pruning remains a separate, browser-measured cleanup task.
