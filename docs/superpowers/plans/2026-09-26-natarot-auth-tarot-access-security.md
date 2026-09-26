# NaTarot Authentication and Tarot Access Security Implementation Plan

> **For agentic workers:** Execute this plan in the isolated worktree on `codex/natarot-auth-access-security`. The user requested autonomous audit, fix, regression, and production deployment; that authorization applies to this plan.

**Goal:** Require trusted member identity and the existing Credits ledger for every new paid Tarot AI result while preserving guest card drawing, saved-reading access, public sharing, and the member's current reading experience.

**Architecture:** Treat the database-validated `natarot_session` cookie as the only member identity. A new reading goes through the existing one-credit reservation, provider, persistence, and consume flow; a guest may only hydrate a result already stored for that same guest owner. Follow-up and clarification calls require a member-owned reading with a consumed reservation whose result ID matches that reading. The Room stores a bounded, expiring draft in same-tab session storage and recreates the selected draw under the authenticated member after sign-in; it never transfers a guest owner or session ID.

**Tech Stack:** Next.js/Vinext Route Handlers, TypeScript, D1-shaped SQLite, existing Credits repository, React Room, Node test runner with `tsx`, ESLint.

**Spec:** User-provided request: `/Users/tranquangthanh/.codex/attachments/087e6e39-8663-45b3-a46a-95e0397be0c0/Văn bản đã dán.txt`.

## Global Constraints

- Derive member identity only from a valid server-side session cookie and the auth-session database row; ignore client IDs, frontend state, local storage, and user identity headers.
- Guests may use public pages, catalog, public content, and non-AI card draw; they may not start a new AI provider request.
- Authenticated members need the existing one-credit reservation for a new reading. No official free Tarot AI entitlement is configured on this release; generic VIP or Owner QA status is not an authorization bypass.
- Follow-up and clarification remain within the existing charged reading; require its consumed reservation and matching persisted reading ID, and do not add a new credit or ledger system.
- Preserve member-owned saved readings, same-owner guest result hydration, existing public-share reads, private owner checks, reservation idempotency, concurrency protection, and provider/persistence release behavior.
- Do not add a schema migration, call DeepSeek from automated tests, change payment/Affiliate behavior, or delete database backups.
- Keep the Moonlight reference and NaTarot copy, layout, and styling. Retain `current`, `previous-1`, and `previous-2`; use only the installed production release manager for promotion and cleanup.

---

### Task 1: Specify the trusted AI entitlement boundary in tests

**Files:**
- Modify: `tests/tarot-credit-authorization.test.ts`
- Modify: `tests/tarot-api-contract.test.ts`
- Modify: `tests/tarot-follow-up-route.test.ts`
- Modify: `tests/tarot-clarification-route.test.ts`

**Interfaces:**
- A guest passed to member-generation authorization must fail as unauthenticated before the provider is invoked.
- A follow-up or clarification entitlement is valid only when the authenticated owner's `tarot:<sessionId>` reservation is `CONSUMED`, has `resultType === "tarot_reading"`, and its `resultId` equals the owner's latest stored reading ID for that session.
- Route contract tests cover cookie-derived identity and require authentication/entitlement checks before provider construction.

- [x] **Step 1: Add the failing guest authorization regression.** In `tests/tarot-credit-authorization.test.ts`, reuse the existing SQLite fixture and provider counter. Call `generateMemberTarotReading` with `{ kind: "guest", guestId: "guest-without-credit" }`; assert an `unauthenticated` authorization error and `providerCalls === 0`.

- [x] **Step 2: Run the focused test and confirm the expected failure.**

Run: `npx tsx --test tests/tarot-credit-authorization.test.ts`

Expected: the new assertion fails because the service currently reports a generic credit-service error for non-member identity.

- [x] **Step 3: Add consumed-reservation access tests.** Generate and persist one member reading through the existing `generateMemberTarotReading` fixture, then assert the reservation authorizes that exact stored reading. Add negative cases for no reservation, a released reservation, and a reservation result ID that does not match the stored reading.

- [x] **Step 4: Add route-boundary contract assertions.** In `tests/tarot-api-contract.test.ts`, assert the reading route does not select `generateTarotReading` for an unauthenticated owner; assert follow-up and clarification routes reject guests and verify the existing charged session before constructing an AI provider. Assert no route derives owner identity from body fields or identity headers.

- [x] **Step 5: Confirm all new boundary tests fail for the missing authorization behavior, not fixture or TypeScript errors.**

Run: `npx tsx --test tests/tarot-credit-authorization.test.ts tests/tarot-api-contract.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-clarification-route.test.ts`

Expected: only the new authorization assertions fail; existing route and ledger assertions continue to pass.

### Task 2: Enforce member-only new reading generation and preserve stored results

**Files:**
- Modify: `lib/tarot-credit-authorization.ts`
- Modify: `lib/tarot-reading-service.ts`
- Modify: `lib/tarot-reading-route.ts`
- Modify: `app/api/tarot/reading/route.ts`
- Modify: `tests/tarot-credit-authorization.test.ts`
- Modify: `tests/tarot-api-contract.test.ts`

**Interfaces:**
- `generateMemberTarotReading` reports unauthenticated owners as HTTP 401 through the existing route mapper.
- A same-owner stored reading can be hydrated without constructing or calling an AI provider; a guest without a stored reading receives 401 before provider creation.
- An authenticated member's new reading continues through `reserveCredits` → provider → `saveReading` → `consumeReservation`; existing failures release the reservation through the current ledger.

- [x] **Step 1: Add the failing stored-result hydration test.** In the existing Tarot service/credit fixtures, persist a guest-owned reading with a fake provider, then call the exported stored-result loader. Assert it returns the same reading ID and payload while its provider call counter remains unchanged. Assert a different guest owner cannot hydrate it.

- [x] **Step 2: Run the focused test and verify it fails because no provider-free guest loader exists.**

Run: `npx tsx --test tests/tarot-reading-service.test.ts tests/tarot-credit-authorization.test.ts`

- [x] **Step 3: Implement stored-result hydration and unauthenticated mapping.** Derive the stored provider from the persisted `modelName` allowlist, return the hydrated payload without a provider request, add the `unauthenticated` authorization code, and map it to a no-store 401 response. Keep the stored lookup owner-scoped.

- [x] **Step 4: Gate the real Route Handler before provider construction.** Resolve `owner` and `member` from `readOptionalOwner(req, database)`. For guests, return only an existing same-owner stored result or a 401. For members, call the existing `generateMemberTarotReading` and canonical credit store. Do not alter the `interpret` alias, session owner, or saved-reading endpoint.

- [x] **Step 5: Run focused reading, auth-boundary, and ledger regressions.**

Run: `npx tsx --test tests/tarot-credit-authorization.test.ts tests/tarot-reading-service.test.ts tests/tarot-reading-route.test.ts tests/tarot-api-contract.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts tests/credits-repository.test.ts`

Expected: guest new-generation requests fail before provider invocation; stored readings hydrate only for the exact owner; zero-credit members receive 402; sufficient-credit members reserve and consume once; duplicate/concurrent generation remains idempotent; provider and persistence failures release the reservation.

### Task 3: Protect follow-up and clarification AI calls with the existing paid reading

**Files:**
- Modify: `lib/tarot-credit-authorization.ts`
- Modify: `app/api/tarot/follow-up/route.ts`
- Modify: `app/api/tarot/clarification/route.ts`
- Modify: `tests/tarot-credit-authorization.test.ts`
- Modify: `tests/tarot-api-contract.test.ts`
- Modify: `tests/tarot-follow-up-route.test.ts`
- Modify: `tests/tarot-clarification-route.test.ts`

**Interfaces:**
- Both routes derive a member owner from the validated session cookie and run `assertPaidMemberTarotSession` before constructing the provider.
- Guests receive no-store 401; members without a matching consumed reading entitlement receive no-store 402; an unavailable ledger fails closed with 503.
- Existing follow-up coalescing, clarification request idempotency, owner-scoped persistence, and public share routes remain unchanged.

- [x] **Step 1: Add route tests for guest 401 and missing-paid-reading 402.** Inject a rejected trusted-identity/entitlement result and assert the handler never executes its provider callback. Keep the body schema and public response allowlist assertions.

- [x] **Step 2: Run the focused follow-up, clarification, and access tests to verify the new cases fail before implementation.**

Run: `npx tsx --test tests/tarot-credit-authorization.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-clarification-route.test.ts`

- [x] **Step 3: Add the read-only consumed-reservation check to the existing credit authorization module.** Compare owner, session reservation key, status, result type, and persisted reading ID. Do not reserve or consume another Credit for a follow-up belonging to an already charged reading.

- [x] **Step 4: Call the guard before provider construction in both routes.** Map unauthenticated requests to 401, unentitled sessions to 402, and ledger/read failures to 503; keep logging limited to request metadata.

- [x] **Step 5: Run all Tarot follow-up, clarification, share, and credit regressions.**

Run: `npx tsx --test tests/tarot-credit-authorization.test.ts tests/tarot-follow-up-route.test.ts tests/tarot-follow-up.test.ts tests/tarot-clarification-route.test.ts tests/tarot-clarification.test.ts tests/tarot-share-routes.test.ts tests/tarot-share-routes-s6.test.ts tests/tarot-saved-reading-route.test.ts`

Expected: guest AI requests fail before provider work; member reads with matching consumed Credits can use their existing reading's follow-up/clarification flow; wrong-owner private reads and public-share behavior remain unchanged.

### Task 4: Restore the Room draft after sign-in without transferring guest ownership

**Files:**
- Create: `lib/tarot-room-resume.ts`
- Modify: `app/room/room.tsx`
- Modify: `app/auth/auth.tsx`
- Modify: `lib/i18n.ts`
- Create: `tests/tarot-room-resume.test.ts`
- Modify: `tests/tarot-credit-ui.test.ts`

**Interfaces:**
- The resume draft contains only version, timestamp, question, optional context, topic, canonical category/spread IDs, reversal setting, and selected card number/orientation pairs; it expires after one hour and never contains identity, session cookies, room invites, or reading IDs.
- A valid authenticated resume calls the existing draw API with those selected cards, creating a new session from the trusted member cookie; it does not automatically request AI.
- Guest interpretation opens the NaTarot login/register dialog before the network request; a server 401 opens the same dialog, and a 402 offers `/packages`.
- Auth return paths stay same-origin and are preserved through the existing email verification flow in the same browser tab.

- [x] **Step 1: Write pure draft-validation tests.** Test valid draft round-trip, one-hour expiry, invalid/duplicate card numbers, invalid orientation, incomplete spread identity, oversized question/context, and unknown version.

- [x] **Step 2: Run the new tests and confirm they fail because the validator does not exist.**

Run: `npx tsx --test tests/tarot-room-resume.test.ts`

- [x] **Step 3: Implement the bounded draft validator and storage key.** Validate against the existing catalog and selected-card bounds; use `sessionStorage` only and discard expired or malformed drafts.

- [x] **Step 4: Add the Room login/register prompt and resume path.** Preserve the current drawn cards and question, save the validated draft on the auth link, redirect to `/auth` with a safe `/room?resumeTarot=1` return path, then recreate the draw only after `user` is present. Clear the draft only after successful member-owned draw creation. Handle both proactive guest gating and an API 401; do not retry/redirect indefinitely.

- [x] **Step 5: Preserve the auth return target for registration verification and update EN/VI copy.** Store only a validated same-origin return route with a one-hour expiry in the current tab; route the no-credit CTA to `/packages`. Keep password/session values out of browser storage.

- [x] **Step 6: Run Room, auth, and resume regressions.**

Run: `npx tsx --test tests/tarot-room-resume.test.ts tests/tarot-credit-ui.test.ts tests/tarot-reading-ui.test.ts tests/tarot-room.test.ts tests/auth-redesign.test.ts tests/auth-handlers.test.ts tests/request-identity.test.ts`

Expected: desktop/mobile Room preserves its NaTarot composition; guests can draw and see the sign-in prompt without a reading request; sign-in return recreates the same question/topic/spread/card choices under the member owner; zero-Credit copy links to Packages.

### Task 5: Close the audit matrix and prepare the production release

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: this plan, marking only evidence-backed steps complete.
- No database migration or production data file changes.

**Interfaces:**
- Local evidence covers the source trace and automated security matrix without a real DeepSeek call.
- Release candidate is built from this branch, excludes credentials/data/build output, and is promoted only with the installed release manager after a fresh backup verifies.
- Cleanup runs only after clean-profile browser checks and retains three distinct releases; database backup storage and unknown paths remain untouched.

- [x] **Step 1: Run focused security and migration/auth checks.** Include direct guest API, forged `x-user-id`/OAI identity headers, expired/invalid cookie, member zero Credit, sufficient Credit, duplicate/concurrency, provider failure, persistence failure, private owner isolation, public share, and Owner QA's normal Credit/VIP provisioning contract. Automated tests must use fake providers only.

- [x] **Step 2: Run required repository gates.** Run `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, changed-file ESLint, and `git diff --check`. All 693 tracked tests pass after refreshing the 11 migration/UI test expectations to current source contracts and merging the active production branch. The 11 stale assertions had also failed on the clean production baseline (`647/658`). ESLint comparison adds no findings relative to the active production branch: `app/room/room.tsx` remains at the baseline 23 errors and improved from 6 to 5 warnings; other security-changed files have zero errors and one existing auth navigation warning. Do not misstate those inherited Room findings as clean.

- [x] **Step 3: Inspect the full release diff and secret scan.** Confirm no `.env*`, token, database, log, credential, or generated build file is staged. Confirm no migration, Credit schema, payment, Affiliate, public-share, or production environment change.

- [x] **Step 4a: Push the verified source branch after commit.** Security commit `aadcfe6`, test-contract commit `6ffec7c`, and merge commit `69a1675` (including active production branch `codex/affiliate-auto-enrollment` at `70f0a07`) are pushed to `origin/codex/natarot-auth-access-security`; the remote commit ID matched locally.

- [x] **Step 4b: Prepare a secret-free release archive only after all required gates pass.** Used the existing verified build and installed `/usr/local/sbin/natarot-release-manager`. Candidate `tarot-ai-auth-security-69a1675-20260926T1234Z` has SHA-256 `acd175dba858ce308c37799bb7c0be04746334a092d8705c0143f20747d208a6`; local and VPS archive hashes matched. Inventory contained no environment files, database, keys, or generated build output outside `dist`; shared dependencies resolved to `/opt/natarot-deps/node_modules`. Preflight reported 20 GB free; current and both rollback references were distinct; no migration was added.

- [x] **Step 5: Create a fresh production backup and verify checksum, readability, integrity, and restore-test status.** The release manager started the production backup service and verified fresh archive `natarot-production-20260926-123640`, SHA-256 `e910d42df0fe163ab8b3712d1b94c3afc7bde4c496a7162c5fb3bff5eb1df677`. The successful restore test reports SQLite integrity `ok`, migration `pass`, application `pass`; no backup was removed.

- [x] **Step 6: Promote atomically with the release manager.** Release `tarot-ai-auth-security-69a1675-20260926T1234Z` is active; only `natarot.service` was restarted. The service is active, local health/catalog and public Home, Room, health, catalog return 200. `current`, `previous-1`, and `previous-2` resolve to three distinct successful releases. Browser validation remains deferred by the manager.

- [ ] **Step 7: Verify with a fresh, signed-out Chrome profile.** In Chrome Incognito, Home, Guidebook and Practice loaded, a guest drew three cards, the AI action opened the login/register gate, and Login kept the safe `/room?resumeTarot=1` return. Valid-shaped direct POSTs to reading, follow-up and clarification returned 401 for unsigned requests; reading also rejected forged identity headers, and follow-up/clarification rejected forged headers combined with an invalid session cookie. Authentication rejected those requests before provider creation, and no production provider request or Credit spend was made. An existing active public-share URL is still needed to finish the anonymous share-read check; expired-session behavior is covered by automated auth/session tests. Do not click a billable provider action.

- [ ] **Step 8: Verify Owner QA without changing account entitlements.** The separate clean Owner QA Incognito window is waiting at `/auth?mode=login&return_to=%2Faccount`; the user must sign in there. Then confirm authenticated identity and current Credits/VIP state. Do not provision/reset the account, perform payment, or spend a production Credit. If a safe authenticated provider-free AI check is unavailable, report that limitation instead of claiming production AI generation was exercised.

- [ ] **Step 9: Run manager cleanup only after browser verification.** Use `/usr/local/sbin/natarot-release-manager cleanup` with `NATAROT_BROWSER_VERIFIED=1`; confirm exactly three distinct successful application releases remain and backup hashes/inventory are unchanged.

- [ ] **Step 10: Record the exact final status in `docs/PROJECT_STATE.md`, commit only related files, push and verify remote equality, and report each requested PASS/FAIL plus any inherited gate.** Complete after production verification and cleanup.

### Gate outcome (2026-09-26)

The focused auth, trusted-identity, Credits, Tarot API, Room-resume and UI suite passes `82/82`; the merged security and active production branch passes `693/693` tests; TypeScript, production build, and `git diff --check` pass. The earlier 11 failing test assertions were stale contracts also failing on the clean production baseline (`647/658`); the assertions now reflect current source and retain their migration/UI coverage. Changed-file ESLint comparison adds no findings relative to the active production branch: the Room file retains its 23 baseline errors and has 5 warnings versus 6 at baseline; other security-changed files have zero errors and one existing `window.location.assign` warning. No automated test calls an AI provider.

The full regression and build gates are green; the active production branch was merged before candidate creation. The security release is promoted and health-checked. Production reading, follow-up and clarification endpoints reject unsigned requests with 401, including forged identity headers plus an invalid session cookie on follow-up and clarification; clean Incognito verifies guest drawing, login gating, and the safe auth return path without invoking AI. The positive public-share read and Owner QA account-state checks are pending user-provided access. Cleanup remains deferred until those browser checks finish. Existing database backups and incoming artifacts remain untouched. If email verification opens in a separate tab, the user must return to the original tab before signing in to resume the one-hour draft.
