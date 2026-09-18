# V5 money guidance P3 fix report

**Date:** 2026-09-18
**Scope:** `lib/ai/knowledge-v5.ts` and `tests/tarot-reading-context.test.ts`

## Finding and root cause

`inferTarotDomain` recognizes neutral-category questions containing money, finance, income, or debt terms as the `money` domain. `v5Guidance` previously had no `money` branch, so those questions reached the final self-reflection fallback. This left the prompt without domain-specific financial reflection and non-advisory safeguards.

## Strict TDD evidence

### RED

Command:

```text
npx tsx --test tests/tarot-reading-context.test.ts
```

Result: exit 1; 10 passed, 1 failed. The new `uses non-advisory financial guidance for money and debt questions` regression failed because the domain guidance was `For self-reflection...` and did not match the required financial wording.

### GREEN

The smallest production change added one `domain === "money"` branch. It frames the result as financial reflection, names uncertainty, options and trade-offs, requires verification of assumptions and figures, recommends qualified professional advice when appropriate, and prohibits prescribed transactions, debt actions, and guaranteed outcomes. The existing shared safety wording remains unchanged.

Command:

```text
npx tsx --test tests/tarot-reading-context.test.ts
```

Result: exit 0; 11 passed, 0 failed.

## Verification

- `npx tsc --noEmit` — exit 0.
- `git diff --check -- lib/ai/knowledge-v5.ts tests/tarot-reading-context.test.ts` — exit 0.
- Final `npx tsx --test tests/tarot-reading-context.test.ts` rerun — exit 0; 11 passed, 0 failed.
- Final staged `git diff --check` and credential-pattern scan are run immediately before commit.
- No retrieval, provider, migration, Room, README, project-state, homepage, or progress-ledger logic was changed.

## Residual caveat

Category keys with explicit priority (`relationships`, `business`, and `planning`) still override question-text domain inference. This fix intentionally changes only guidance after `inferTarotDomain` returns `money`; it does not alter the unrelated retrieval or domain-priority rules.
