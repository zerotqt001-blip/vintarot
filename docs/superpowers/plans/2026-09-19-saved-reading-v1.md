# NaTarot Saved Reading V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users bookmark an already-persisted Tarot reading and reopen its stored payload from Journal without another provider call, while guests receive a safe sign-in prompt and never receive a persistent guest journal.

**Architecture:** Reuse the existing `records` table as an owner-scoped saved-reading marker, keyed deterministically by the persisted `readings.id`; do not add a migration. A dedicated Tarot saved-reading service validates the authenticated owner against the existing trusted `reading_sessions` ownership boundary, parses the stored v2/v3/v4 payload through `parseStoredReading`, and returns trusted session/card metadata to the existing `ReadingPanel`. The room receives the persisted `reading_id` from the existing interpretation response; guest-to-user claiming is intentionally unsupported and is documented rather than guessed.

**Tech Stack:** TypeScript, Next.js route handlers, Cloudflare D1/SQLite-shaped repository, Zod, React client components, Node test runner, existing `ReadingPanel` and i18n system.

**Spec:** `/Users/tranquangthanh/.codex/attachments/cddbe3dc-47d2-4660-b391-7ce8c3dc16a8/Văn bản đã dán.txt`

## Global Constraints

- Keep Reader Engine `tarot-reading-v4.1`, Reading Experience V1/V1.1, Knowledge Base V5, orientations, provider/model/temperature/timeout, follow-up architecture, schema, card logic, and existing reading UI unchanged except for the saved-reading integration seam.
- Preserve v2/v3 stored-reading compatibility through `parseStoredReading`; do not replace legacy payloads or regenerate them.
- Authenticated ownership comes only from `readRequestIdentity`/framework authentication and server-side owner-scoped session and reading queries; never trust request owner IDs or arbitrary identity headers.
- Guests may draw and read as today, but Save is rejected before persistence and directs them to sign in; no guest journal and no insecure claim flow.
- Use the existing `records` table; if implementation proves a schema change is required, stop before adding or applying a migration.
- Do not touch root-worktree Home files, deploy, push, merge, or create a second commit.

---

### Task 1: Lock the saved-reading contract with failing tests

**Files:**
- Create: `tests/tarot-saved-reading.test.ts`
- Modify: `tests/tarot-reading-service.test.ts`
- Modify: `tests/tarot-reading-route.test.ts`
- Modify: `tests/tarot-repository.test.ts` only if the existing repository fixture needs an exact reading-id assertion

**Interfaces:**
- `GeneratedTarotReading` will expose `readingId` in addition to its existing metadata.
- `handleTarotReadingRoute` will serialize `reading_id` while preserving every existing response key.
- `saveTarotReading`, `listTarotSavedReadings`, and `loadTarotSavedReading` will be tested as owner-scoped service functions using the existing SQLite/D1 test adapter.

- [ ] **Step 1: Add the exact interpretation response regression assertion**

Extend the canonical route result with `readingId: "reading-runtime"` and assert that the JSON response contains `reading_id: "reading-runtime"`. Update the route test's expected result-key assertion only for this additive field.

- [ ] **Step 2: Add the authenticated save/idempotency test**

Create the existing `records`, `readings`, `reading_sessions`, `reading_cards`, catalog, and card tables through the current migration helper, insert one owned drawn session and one stored normalized reading, call `saveTarotReading` twice with `{ kind: "user", userId: "owner-1" }`, and assert that both results use the same deterministic marker ID and that `SELECT COUNT(*) FROM records WHERE kind='tarot-reading'` is `1`.

- [ ] **Step 3: Add ownership and guest rejection tests**

Assert that a guest owner gets a typed authentication error without a `records` row, that another authenticated owner cannot save the reading, and that changing the client-supplied session ID cannot associate a valid reading with the wrong session. Assert the route without framework identity returns HTTP 401 and never creates a marker.

- [ ] **Step 4: Add the stored-read reopen test**

Insert a v4.1 `reading_payload` plus trusted session/card/catalog rows, call `loadTarotSavedReading`, and assert the response returns the exact direct answer, one evidence item per stored card, original card IDs, position IDs/keys/orders, and orientations. Set a provider-call counter in the test harness and assert it remains `0`; the saved-reading module must not import the AI factory or reading-generation service.

- [ ] **Step 5: Add the legacy compatibility test**

Insert a v2/v3-style reading with `reading_payload = NULL` and valid legacy `card_readings`, load it through the same saved-reading path, and assert that `parseStoredReading` returns the normalized payload without changing the original database row.

- [ ] **Step 6: Run the focused tests and verify they fail for the missing contract**

Run:

```bash
npx tsx --test tests/tarot-saved-reading.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts
```

Expected: failure for the missing `reading_id` response and missing saved-reading service functions, with no production implementation added before this red run.

### Task 2: Preserve the exact persisted reading identity

**Files:**
- Modify: `lib/tarot-reading-service.ts`
- Modify: `lib/tarot-reading-route.ts`
- Modify: `tests/tarot-reading-service.test.ts`
- Modify: `tests/tarot-reading-route.test.ts`

**Interfaces:**
- `generateTarotReading` creates one `readingId`, passes it to `repository.saveReading`, and returns that same ID.
- `handleTarotReadingRoute` maps it to `reading_id`; no prompt, provider, parsing, or persistence semantics change.

- [ ] **Step 1: Generate and retain one reading ID**

Replace the inline random ID with `const readingId = globalThis.crypto.randomUUID()`, pass it to `saveReading`, and return `readingId` in `GeneratedTarotReading`.

- [ ] **Step 2: Serialize the additive response field**

Add `reading_id: result.readingId` beside the existing `session_id` response field.

- [ ] **Step 3: Run the focused service and route tests**

Run the same focused command from Task 1 and require all existing service orchestration and route metadata assertions to pass.

### Task 3: Implement owner-scoped saved-reading persistence and read service

**Files:**
- Create: `lib/tarot-saved-reading.ts`
- Modify: `lib/tarot-reading-compat.ts` and `lib/tarot-interpretation.ts` only to share a narrow stored-card identity type if needed by the legacy reopen path
- Modify: `tests/tarot-saved-reading.test.ts`

**Interfaces:**
- `saveTarotReading(args: { database: D1Database; repository: TarotRepository; owner: ReadingOwner; sessionId: string; readingId: string }): Promise<SavedReadingRecord>`
- `listTarotSavedReadings(args: { database: D1Database; repository: TarotRepository; owner: ReadingOwner }): Promise<SavedReadingSummary[]>`
- `loadTarotSavedReading(args: { database: D1Database; repository: TarotRepository; owner: ReadingOwner; savedId: string }): Promise<SavedReadingDetail>`
- `SavedReadingError.code` is one of `unauthenticated`, `not_found`, `invalid_stored_reading`, or `storage` and never includes secrets or payload text in logs.

- [ ] **Step 1: Define and validate the deterministic marker**

Use `kind = "tarot-reading"`, marker ID `saved-reading:${readingId}`, and strict data `{ reading_id, session_id }`. Reject guest owners before any write. Verify the exact `(readingId, sessionId, authenticated userId)` join against `readings` and `reading_sessions`; on conflict with another owner or record kind return not-found semantics. Upsert only the same owner/kind marker so repeated saves remain one record and preserve the original `created` timestamp.

- [ ] **Step 2: Build trusted historical card identity from owner-scoped D1 rows**

Load the session with `repository.getSessionForOwner`, load the stored template with `getReadingTemplate` using the original session locale, sort the repository cards by stored `positionOrder`, verify card count/position ID/key/order/orientation, and construct only the `readingCardId`, trusted position, trusted card identity, and orientation needed by `parseStoredReading`. Do not use request-body card data and do not call any AI provider.

- [ ] **Step 3: Load and normalize the stored payload**

Fetch the exact reading row by the validated marker/session association, call `parseStoredReading(row, expectedCards, session.locale)`, and return `reading`, original session metadata, trusted card artwork metadata, model/prompt metadata, and the saved marker. This path must accept both nullable `reading_payload` legacy rows and normalized v4.1 rows.

- [ ] **Step 4: List saved summaries newest-first**

Read only `records` rows owned by the authenticated user and `kind='tarot-reading'`, validate each marker, resolve its owner-scoped session and card summaries, and return at most 100 entries ordered by `updated DESC, id DESC`. Skip stale/corrupt markers without leaking another owner's data.

- [ ] **Step 5: Run the focused saved-reading tests green**

Run:

```bash
npx tsx --test tests/tarot-saved-reading.test.ts
```

Require save idempotency, guest rejection, cross-owner rejection, v4.1 reopen, v2/v3 reopen, exact card identity, and zero-provider-call assertions to pass.

### Task 4: Add the authenticated-only API boundary

**Files:**
- Create: `app/api/tarot/saved-readings/route.ts`
- Create: `tests/tarot-saved-reading-route.test.ts` if the route boundary needs separate coverage

**Interfaces:**
- `POST /api/tarot/saved-readings` accepts only `{ reading_id, session_id }` and returns the idempotent marker/detail summary.
- `GET /api/tarot/saved-readings` returns `{ items }` for the authenticated owner.
- `GET /api/tarot/saved-readings?id=<saved-marker-id>` returns the parsed stored detail and never invokes `createTarotAIProvider` or `generateTarotReading`.

- [ ] **Step 1: Reject guests with the existing identity boundary**

Use `identity(req)`/`readRequestIdentity` and `attachIdentityCookie`; return 401 for a guest before reading or writing the marker. Do not inspect arbitrary identity headers and do not accept an owner ID in the body.

- [ ] **Step 2: Apply origin and Zod input validation**

Use `originCheck(req)` for POST, parse JSON through the existing helper, and validate bounded non-empty IDs. Return 400 for malformed input, 404 for owner/association mismatch, and 503 only for safe storage failures through `boundary`.

- [ ] **Step 3: Wire D1 and the repository without provider imports**

Use `db()` and `getTarotRepository(db())` only. Keep the route’s import graph limited to identity, repository, compatibility, and saved-reading service code.

- [ ] **Step 4: Run route and API contract tests**

Run:

```bash
npx tsx --test tests/tarot-saved-reading-route.test.ts tests/f001-identity-boundary.test.ts tests/tarot-api-contract.test.ts
```

### Task 5: Connect Room Save to the existing persisted reading and safe guest flow

**Files:**
- Modify: `app/room/room.tsx`
- Modify: `components/reading/reading-panel.tsx` only for an additive saving/disabled label prop if required
- Modify: `lib/i18n.ts`
- Modify: `tests/room-features.test.ts` and/or create `tests/saved-reading-room.test.ts`

**Interfaces:**
- `RoomInterpretation` includes `reading_id`.
- `saveJournal` sends the exact existing `session_id` and returned `reading_id` to the saved-reading endpoint; it never posts the generic journal record for an AI reading.
- Guest Save opens the existing sign-in dialog and uses a safe `/room?id=...` return path when a persisted room ID is available; no guest save request is sent.

- [ ] **Step 1: Add the reading ID to client state**

Extend `RoomInterpretation` with `reading_id: string` and preserve the server response as-is.

- [ ] **Step 2: Implement saving/saved UI states without changing the frozen panel design**

Track a small `savingJournal` state, require a completed interpretation with a `reading_id`, call `api('tarot/saved-readings', { reading_id, session_id })`, set `savedJournal` only after HTTP success, and prevent duplicate clicks while saving. Keep existing room controls and ReadingPanel structure.

- [ ] **Step 3: Implement the guest policy**

If `user` is absent, set the existing sign-in status/modal immediately. Use the current room URL as a relative encoded return path; do not persist a guest marker and do not attempt a post-login claim. Document that current architecture has no trusted guest-to-account association, so returning guests must not regenerate or silently transfer the reading.

- [ ] **Step 4: Add Vietnamese and English status copy**

Add only the strings needed for saving, saved, sign-in, and unavailable/error states. Keep existing wording and visual design otherwise.

- [ ] **Step 5: Run Room-focused tests and typecheck**

Run:

```bash
npx tsx --test tests/room-features.test.ts tests/saved-reading-room.test.ts
npx tsc --noEmit
```

### Task 6: Render saved readings in Journal with the existing ReadingPanel

**Files:**
- Create: `components/reading/saved-reading-journal.tsx`
- Modify: `app/pages.tsx`
- Modify: `lib/i18n.ts`
- Modify: `tests/saved-reading-journal.test.ts` or the existing Journal/UI focused test file

**Interfaces:**
- `SavedReadingJournal` receives the existing translator and locale, loads the authenticated user’s saved summaries, and opens one detail response in an existing `Dialog` containing `ReadingPanel`.
- Saved detail uses the original locale, question, spread metadata, exact normalized/legacy payload, and card artwork keyed by `readingCardId`.

- [ ] **Step 1: Add the authenticated Journal section**

Render saved-reading summaries newest-first above or beside the existing manual journal entries. Keep manual `kind='journal'` entries separate and retain the current sign-in gate/empty state.

- [ ] **Step 2: Load detail and reuse `ReadingPanel`**

On summary activation call only `GET /api/tarot/saved-readings?id=...`; pass the returned `reading` and trusted metadata to `ReadingPanel` without `onSave`, `onFollowUpSubmit`, or any interpretation POST. Build artwork from the returned card number/image metadata while preserving all evidence IDs, positions, and orientations.

- [ ] **Step 3: Add responsive-safe dialog composition**

Use existing dialog primitives and bounded scroll behavior; do not redesign ReadingPanel or add share/export/billing controls.

- [ ] **Step 4: Run Journal-focused tests**

Run:

```bash
npx tsx --test tests/saved-reading-journal.test.ts
```

### Task 7: Documentation, full validation, and one bounded commit

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- All files listed in Tasks 1–6

- [ ] **Step 1: Add the Saved Reading V1 decision and known guest gap to project state**

Record that saved markers use the existing `records` table, authenticated ownership is server-validated, historical v2/v3 payloads reopen through `parseStoredReading`, provider calls are not made on reopen, and secure guest-to-account claiming remains unsupported and intentionally unimplemented.

- [ ] **Step 2: Run focused Tarot tests**

Run the Saved Reading, reading service/route, repository compatibility, identity-boundary, and Room/Journal focused test files; record exact counts and failures.

- [ ] **Step 3: Run all Tarot tests and the full tracked suite**

Run:

```bash
git ls-files 'tests/*.test.ts' | xargs npx tsx --test
```

Do not include or modify the root worktree’s existing untracked Home tests in the commit.

- [ ] **Step 4: Run static and production validation**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Also verify no prompt, Knowledge Base, provider configuration, migration, unrelated Home file, or frozen ReadingPanel visual implementation was changed.

- [ ] **Step 5: Review staged diff for secrets and scope**

Stage only the Saved Reading V1 implementation, tests, related plan, and project-state documentation; inspect `git diff --cached --stat` and `git diff --cached` for secrets, prompt/config changes, migrations, or unrelated files.

- [ ] **Step 6: Create the only commit**

Create exactly one commit:

```bash
git commit -m "feat: add authenticated saved readings"
```

After committing, verify `git status --short --branch`, `git rev-parse HEAD`, the commit file list, and that the root worktree’s dirty Home files remain untouched. Do not push or deploy.
