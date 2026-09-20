# NaTarot S6 Share Persistence & Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Replace the S1–S5 migration-gated share runtime with durable, owner-scoped SQLite/D1 persistence; connect create, revoke, public-read, image, analytics, and the minimal Room action; verify the result locally, in focused tests, in browser-sized viewports, and in the full repository gates.

**Architecture:** Keep the existing public share contract and projection unchanged. Add normalized `reading_shares` and `share_events` tables keyed from an existing reading/session join, implement the existing `ShareStore` interface with a D1/SQLite adapter, and construct the production share service from the runtime database and owner-scoped tarot repository. Share tokens remain bearer credentials: only hashes are persisted, and public reads never expose owner fields.

**Tech Stack:** Drizzle schema/types, SQLite/D1-compatible SQL, `node:sqlite` local runtime, `tsx --test`, React/Vinext route handlers, Zod contracts, existing browser fallback, TypeScript, ESLint, and the existing `npm run build` gate.

**Spec:** `docs/superpowers/specs/2026-09-21-natarot-share-s6-persistence-design.md`

## Global constraints

- Work only in `/Users/tranquangthanh/.codex/worktrees/natarot-share-s6-persistence/test astra` on `codex/natarot-share-s6-persistence`.
- Preserve the user’s unrelated edits in the original checkout and do not touch the L5–L8 worktree.
- Do not change Auth semantics, Tarot Engine behavior, AI/KB, Credits/VIP, SePay, Affiliate, production databases, production deployment, or main-branch history.
- Use temporary explicit `NATAROT_DB_PATH` values for all local migration and persistence checks; never point tests at `/var/lib/natarot/natarot.sqlite`.
- Keep migrations additive. Do not rewrite the immutable baseline or existing migration files.
- Keep public responses bounded and allowlist-based; never persist or return a raw share token, owner id, guest id, prompt, or private reading metadata beyond the existing public projection.
- Follow TDD for each behavior: add a focused failing test, implement the smallest change, run the focused test, then run the relevant regression set.

## Task 1: Add the additive S6 persistence migration and schema declarations

**Files:**

- Add `drizzle/0005_natarot_share_persistence.sql`.
- Update `db/schema.ts` with `readingShares` and `shareEvents` tables, foreign keys, indexes, and inferred types.
- Extend migration/schema contract coverage in `tests/node-migrate.test.ts` and `tests/tarot-api-contract.test.ts`.
- Add or extend a focused persistence migration test if existing coverage cannot express the constraints.

**Step 1 — Write the failing contract assertions.**

Add assertions that the next migration is `0005_natarot_share_persistence.sql`, that migration application creates both tables, and that the database exposes:

- one unique token-hash index;
- one partial unique active-reading index;
- a share-events foreign key to shares with cascade behavior;
- a share-reading foreign key to readings with cascade behavior;
- status/event check constraints;
- no owner or raw-token columns in the new tables.

Run the focused tests and confirm they fail because the migration and schema declarations are absent.

**Step 2 — Implement the migration.**

Create `reading_shares` with:

```sql
CREATE TABLE reading_shares (
  id TEXT PRIMARY KEY NOT NULL,
  reading_id TEXT NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  locale TEXT NOT NULL,
  public_contract_version TEXT NOT NULL,
  geometry_version TEXT NOT NULL,
  renderer_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  expires_at TEXT
);

CREATE UNIQUE INDEX reading_shares_active_reading_unique
  ON reading_shares(reading_id) WHERE status = 'active';
CREATE INDEX reading_shares_reading_status_idx
  ON reading_shares(reading_id, status);
CREATE INDEX reading_shares_expires_idx
  ON reading_shares(status, expires_at);

CREATE TABLE share_events (
  id TEXT PRIMARY KEY NOT NULL,
  share_id TEXT NOT NULL REFERENCES reading_shares(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'share_created', 'share_opened', 'share_image_generated',
    'share_image_downloaded', 'share_cta_clicked'
  )),
  locale TEXT NOT NULL,
  source TEXT,
  renderer_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX share_events_share_created_idx
  ON share_events(share_id, created_at);
```

Use the repository’s migration runner conventions and keep the migration self-contained for SQLite and D1.

**Step 3 — Add Drizzle declarations.**

Represent status and event values with the existing project typing style. Preserve the `ShareRecord` contract’s public version fields and map nullable timestamps to nullable fields. Define relations only where the current schema style supports them; do not introduce a new ORM abstraction for this feature.

**Step 4 — Run focused verification.**

Run:

```bash
npx tsx --test tests/node-migrate.test.ts tests/tarot-api-contract.test.ts
npx tsc --noEmit
```

Inspect the schema diff and confirm no existing migration or unrelated table changed. Commit only the migration, schema, and contract tests as:

```text
feat: add tarot share persistence schema
```

## Task 2: Implement the owner-scoped D1/SQLite share store

**Files:**

- Update `lib/tarot-share-store.ts`.
- Add `tests/tarot-share-persistence.test.ts` using an isolated in-memory or temporary SQLite database and the existing D1 wrapper.
- Update `lib/tarot-share-contract.ts` only when the typed store errors or persistence mapping requires it.

**Step 1 — Write failing store tests.**

Cover these exact behaviors:

- an authenticated owner can create a share only for a reading/session it owns;
- a guest owner can create a share only for its guest-owned reading/session;
- a mismatched session, reading, user, or guest is rejected without inserting a row;
- a second active share for the same reading is rejected by the database-backed conflict path;
- a revoked share permits a later active share;
- `findByTokenHash` returns the contract record with the correct owner derived through `reading_sessions`, but never returns the raw token;
- revoke changes only an active share owned by the caller and is a no-op for unknown, expired, revoked, or foreign shares;
- event insertion is idempotent by event id and persists no token hash;
- all child rows cascade when a share is deleted, while deleting a share never deletes its reading.

Run the focused file and confirm it fails because the database adapter does not exist.

**Step 2 — Define precise persistence errors.**

Add typed errors for storage unavailability, active-reading conflict, token-hash collision, and ownership mismatch. Keep conflict classification deterministic from SQLite/D1 error text or result metadata and do not leak SQL text through API responses.

**Step 3 — Implement `DatabaseShareStore`.**

Use the project’s D1-shaped `Database` interface and parameterized statements. The create statement must insert through an owner/session join rather than trusting duplicated owner columns:

```sql
INSERT INTO reading_shares (...)
SELECT ?, r.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
FROM readings r
JOIN reading_sessions s ON s.id = r.session_id
WHERE r.id = ?
  AND s.id = ?
  AND ((s.user_id = ? AND ? IS NULL) OR (s.guest_id = ? AND ? IS NULL))
```

Use the project’s canonical owner keys (`member:<id>` for members and the trusted guest id for guests) and bind only the branch relevant to the owner kind. `findByTokenHash` must join `reading_shares`, `readings`, and `reading_sessions`, derive the owner, and map nullable timestamps. `revoke` must include the owner predicate and active status in the update. `insertEvent` must use `ON CONFLICT(id) DO NOTHING` and ignore the compatibility token-hash argument at the storage boundary.

**Step 4 — Run the store matrix.**

Run:

```bash
npx tsx --test tests/tarot-share-persistence.test.ts tests/tarot-share.test.ts
npx tsc --noEmit
```

Inspect the SQL and test fixtures for raw tokens, owner leakage, and broad deletes. Commit only the store and its focused tests as:

```text
feat: persist tarot shares through d1 store
```

## Task 3: Make the share service durable, bounded, and runtime-backed

**Files:**

- Update `lib/tarot-share-service.ts`.
- Update `lib/tarot-share-runtime.ts`.
- Add focused service/runtime cases to `tests/tarot-share.test.ts` or a new `tests/tarot-share-service.test.ts`.

**Step 1 — Write failing service tests.**

Cover:

- `createShare` persists through the database store and returns the same public contract as S1–S5;
- an active-share conflict becomes a safe `ShareAlreadyExistsError` or equivalent non-enumerating service error;
- token-hash/id collisions retry at most four times and never loop indefinitely;
- a failed `share_created` analytics insert does not roll back an otherwise successful share creation;
- concurrent create attempts for one reading result in at most one active row;
- public resolution applies exactly `status = active` and `(expires_at IS NULL OR expires_at > now)`;
- owner-scoped revoke works by share id and by bearer token without exposing whether an unknown token ever existed;
- the runtime factory uses the runtime database and repository rather than `UnavailableShareStore`.

Run the focused tests and confirm failure at the durable runtime boundary.

**Step 2 — Add bounded creation and revoke-by-token behavior.**

Keep raw-token generation in memory only. Retry only database uniqueness collisions for a fixed small maximum (four attempts); map active-reading conflicts to a safe already-shared result. Insert the creation event best-effort after the share row commits. Add a service method that hashes a token, resolves the owner-scoped record, and revokes it without changing public enumeration behavior.

**Step 3 — Wire the production factory.**

Construct the service with `getRuntimeDatabase()`, `getTarotRepository(database)`, `createDatabaseReadingShareSource(...)`, and `DatabaseShareStore`. Preserve the unavailable-store error mapping when the schema is missing or the runtime cannot open storage; this keeps the pre-migration failure mode safe while allowing a migrated local database to work.

**Step 4 — Run focused service and regression tests.**

Run:

```bash
npx tsx --test tests/tarot-share.test.ts tests/tarot-share-persistence.test.ts tests/tarot-share-routes.test.ts
npx tsc --noEmit
```

Commit the service and runtime changes as:

```text
feat: integrate persisted tarot share service
```

## Task 4: Connect create, revoke, public, image, and event routes

**Files:**

- Update `app/api/tarot/shares/route.ts`.
- Add `app/api/tarot/shares/[token]/route.ts` for owner-scoped `DELETE`.
- Update route tests, including `tests/tarot-share-routes.test.ts` and a migrated local runtime route test.
- Touch public/image routes only where real-store error mapping or event behavior needs a regression assertion.

**Step 1 — Write failing route tests.**

With a temporary migrated database and seeded owner/session/reading:

- POST with a valid origin and owner returns 201 with link/image URL and never returns the token separately;
- POST with a foreign owner, wrong session, invalid origin, or malformed body is safe and non-mutating;
- DELETE by the owner revokes the share and is idempotent for a repeated request;
- DELETE by a foreign owner, unknown token, expired token, or revoked token returns the same non-enumerating success shape;
- public page and image route work after migration and stop working after revoke/expiry;
- event route remains 202 and non-enumerating for unknown or revoked tokens;
- image response retains noindex, no-store, referrer, and nosniff headers.

Run the focused route tests and confirm the new durable path fails before implementation.

**Step 2 — Implement POST error mapping.**

Keep strict input validation and origin checking. Map ownership/source-not-found to 404, storage-unavailable/schema-not-ready to 503, and active-share conflict to a safe conflict response that does not reveal private reading details. Preserve the existing response field names and public origin configuration.

**Step 3 — Implement DELETE.**

Require a valid origin and optional authenticated/guest identity. Validate the token shape before hashing. Call the owner-scoped service revoke method and return the same empty success response for unknown, foreign, revoked, and expired tokens. Never delete a reading, session, or user record.

**Step 4 — Run route and security tests.**

Run:

```bash
npx tsx --test tests/tarot-share-routes.test.ts tests/tarot-share-persistence.test.ts
```

Inspect response bodies and headers for token, owner, prompt, and SQL leakage. Commit as:

```text
feat: connect persisted tarot share routes
```

## Task 5: Add the minimal owner-facing Room share action

**Files:**

- Update `components/reading/reading-types.ts`.
- Update `components/reading/reading-panel.tsx`.
- Update `app/room/room.tsx`.
- Update `lib/i18n.ts` for English and Vietnamese share labels/errors.
- Add or extend `tests/room-reading.test.ts` and/or a focused reading-panel contract test.

**Step 1 — Write the failing UI behavior tests.**

Cover:

- the completed reading panel exposes one Share action alongside existing Save/Close controls;
- activating it posts the existing `reading_id` and `session_id` to the share endpoint;
- the action shows a busy state, then exposes a copyable link without persisting it in the reading payload or local storage;
- a share failure is bounded, translated, and does not remove the existing Save action;
- the action is absent or disabled while loading, without a valid completed reading, or after close;
- English and Vietnamese labels are present and no layout string is unbounded.

Run the focused UI tests and confirm they fail before adding the props and handler.

**Step 2 — Implement the smallest panel API.**

Add optional `onShare`, `isSharing`, `shareUrl`, and `shareError` props. Keep existing callers source-compatible. Render a compact action and result/error text using the existing visual language; do not redesign the reading panel or public share page.

**Step 3 — Implement Room state and request.**

Add transient state for the share request. Use `api('tarot/shares', { reading_id: interpretation.reading_id, session_id: interpretation.session_id })`. Reset URL/error state when the active reading/session changes or the panel closes. Do not write the link to the reading payload, journal, guest cookie, or local storage. Preserve existing save/follow-up behavior.

**Step 4 — Run focused and browser-sized checks.**

Run the focused UI tests and, if available, the project browser harness at desktop, 390px, and 375px widths in both locales. Record any overflow or control-order issue before proceeding.

Commit as:

```text
feat: add owner share link action
```

## Task 6: Run migrated local persistence and E2E verification

**Files:**

- Add only narrowly scoped fixtures or test helpers if the verification matrix needs them.
- Do not commit temporary SQLite databases, build output, auth/session data, or screenshots unless they are an intentional existing test artifact.

**Step 1 — Apply migrations in an explicit temporary database.**

Use a temporary directory outside the repository and run:

```bash
local_db="$(mktemp -u /tmp/natarot-s6-XXXXXX.sqlite)"
NATAROT_DB_PATH="$local_db" node scripts/node-migrate.mjs
NATAROT_DB_PATH="$local_db" node scripts/node-migrate.mjs
```

Query migration rows, tables, indexes, foreign keys, and existing seed counts. Confirm the second run is a no-op and that the database file is not under Git tracking.

**Step 2 — Run a deterministic local E2E loop.**

Against the migrated local database, exercise:

```text
owner fixture -> create share -> resolve public page data -> render image/QR -> record each event -> revoke -> verify public/image are unavailable
```

Include member and guest ownership, foreign-owner rejection, duplicate creation, replayed event id, expiration, and concurrent create attempts. Capture only bounded status/shape assertions, not raw tokens in logs.

**Step 3 — Verify browser behavior.**

Use the existing browser harness or fallback to inspect the Room action and public share page at desktop, 390px, and 375px. Check EN and VI for no horizontal overflow, readable error states, safe copy/save controls, and unchanged existing Save/Close behavior. If a browser-specific failure appears, apply systematic-debugging before changing code.

**Step 4 — Flush the observer checkpoint.**

After Tasks 1–6, append a project-local checkpoint to `skill-observations/checkpoints.log` with counts and any recurring workflow observation. Do not record credentials, tokens, personal chats, or unrelated information.

## Task 7: Final review, documentation, commit, push, and remote verification

**Files:**

- Update `docs/PROJECT_STATE.md` with the S6 branch/commit state, migration status, persistence/runtime decisions, validation results, and unfinished work.
- Update only implementation files and tests already listed above.

**Step 1 — Run the complete gates.**

Run and retain output for:

```bash
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
npx eslint --no-ignore --no-warn-ignored \
  drizzle/0005_natarot_share_persistence.sql db/schema.ts \
  lib/tarot-share-contract.ts lib/tarot-share-store.ts \
  lib/tarot-share-service.ts lib/tarot-share-runtime.ts \
  app/api/tarot/shares/route.ts \
  app/api/tarot/shares/'[token]'/route.ts \
  components/reading/reading-types.ts components/reading/reading-panel.tsx \
  app/room/room.tsx lib/i18n.ts
git diff --check
```

If the project’s ESLint configuration rejects a SQL path, lint the supported TypeScript/TSX subset and record the exact reason; do not weaken configuration to hide warnings.

**Step 2 — Inspect diff and secrets.**

Review:

```bash
git status --short
git diff --stat 02df5069abe6b3510dfcc8cf6b7347b49ff0c5ee..HEAD
git diff --name-only 02df5069abe6b3510dfcc8cf6b7347b49ff0c5ee..HEAD
rg -n --hidden --glob '!node_modules/**' --glob '!*.sqlite*' \
  'sk-[A-Za-z0-9]|Bearer [A-Za-z0-9._-]+|token=|guest_id=|member:' .
```

Confirm that no `.env`, database, auth/session artifact, build output, raw token, or unrelated worktree edit is staged. Run a self-review from security/privacy, persistence/concurrency, API compatibility, UI/accessibility, migration/operations, test quality, and scope-control perspectives.

**Step 3 — Update project state and commit.**

Update `docs/PROJECT_STATE.md` with evidence, then stage only related files, inspect the staged diff for secrets, and commit with a clear S6 integration message such as:

```text
feat: complete natarot share persistence integration
```

**Step 4 — Push and verify the remote.**

Push only:

```bash
git push -u origin codex/natarot-share-s6-persistence
git fetch origin
git rev-parse HEAD
git rev-parse origin/codex/natarot-share-s6-persistence
```

Confirm the hashes match, report any push failure explicitly, and do not merge, force-push, deploy, or touch production. Flush the final observer checkpoint and stop after the remote branch is verified.
