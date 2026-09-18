# Tarot catalog migration review fix

**Date:** 2026-09-18
**Scope:** `scripts/generate-tarot-seed.ts`, `drizzle/0003_moonlight_spread_catalog.sql`, and migration contract tests

## Finding and root cause

The fresh `0001 -> 0002 -> 0003` chain failed on the relationship spread because `0002_tarot_seed.sql` already had the canonical position IDs while the checked-in catalog migration attempted to insert the same key/order under legacy IDs (`you`, `connection`, and `them`). The unique `(spread_template_id, position_order)` index rejected that second representation. Replacing those IDs outright would also break existing `reading_cards.spread_position_id` foreign keys.

## Fix

The generator now treats the three historical relationship IDs as aliases. It updates the canonical row when the legacy row is absent, updates the legacy row when that is the stored row, and only inserts a canonical row when neither identity nor natural key/order exists. The checked-in `0003` SQL was regenerated from that function. No catalog rows are deleted or rebuilt.

## Verification

- `npx tsx --test tests/tarot-migration.test.ts` — 3 passed.
- `npx tsx --test tests/tarot-api-contract.test.ts tests/tarot-migration.test.ts` — 9 passed.
- Fresh chain and repeated migration preserve canonical IDs and pass `PRAGMA foreign_key_check`.
- A legacy-ID fixture with stored reading cards remains resolvable through the repository and reading-input builder after repeated migration.
- The checked-in SQL is asserted to equal `buildSpreadCatalogMigrationSql(buildTarotSeed(), timestamp)`.

## Residual caveat

If a database contains both canonical and legacy aliases for one relationship position in an already-conflicted state, the migration leaves that state untouched rather than risking a destructive merge. The normal fresh and historical states are covered by the tests above.
