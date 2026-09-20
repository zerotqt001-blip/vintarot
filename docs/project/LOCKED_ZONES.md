# NaTarot Locked Zones

Protection is scoped by blast radius. This document does not lock the whole repository. `HARD LOCK` requires an explicit mission unlock; `SOFT LOCK` requires impact analysis and regression evidence; `ACTIVE` identifies work already changing and therefore requiring tighter coordination; `UNKNOWN` means the source is not strong enough to choose a stronger status.

## Default rule

If a zone is not explicitly unlocked by the mission, preserve it. A dependency that reaches a locked zone is part of the mission's impact analysis even if the dependency itself appears small.

## Zone register

### Zone: Member identity and ownership boundary

- **STATUS:** HARD LOCK
- **WHY PROTECTED:** This boundary controls local member authentication, Google OAuth completion, email verification, password reset, guest identity, cookie ownership, API authorization, saved-reading ownership, and room access.
- **FILES / MODULES:** `lib/member-auth.ts`, `lib/auth-handlers.ts`, `lib/google-oauth.ts`, `lib/auth-email.ts`, `lib/member-page.ts`, `lib/request-identity.ts`, `lib/tarot-guest.ts`, `lib/server.ts`, `app/api/auth/`, `app/api/records/route.ts`, `app/api/rooms/route.ts`, `app/api/tarot/session/route.ts`, `app/api/tarot/saved-readings/route.ts`, `deploy/nginx/natarot-http.conf`.
- **DEPENDENCIES:** Every user/guest API, profile, journal, room, Tarot session, saved reading, and follow-up operation.
- **ALLOWED CHANGES:** Only explicit authentication, ownership, CSRF/origin, or security missions with a written threat model and compatibility plan.
- **REQUIRED TESTS:** `tests/auth-*.test.ts`, `tests/google-oauth.test.ts`, `tests/member-auth.test.ts`, `tests/profile-logout.test.ts`, `tests/f001-identity-boundary.test.ts`, `tests/request-identity.test.ts`, `tests/server-origin.test.ts`, affected API ownership tests, and the full suite.
- **UNLOCK CONDITION:** Mission explicitly names this zone, identifies affected owner types, adds/updates regression tests, and proves no cross-owner access regression.

### Zone: Tarot AI semantics and output contract

- **STATUS:** HARD LOCK
- **WHY PROTECTED:** Prompt versioning, knowledge selection, provider envelopes, parser rules, card evidence, cardinality, and persisted output are shared by reading generation and follow-up behavior.
- **FILES / MODULES:** `lib/ai/`, `lib/ai/prompts/`, `lib/ai/diagnostics.ts`, `lib/ai/knowledge-v5.ts`, `natarot-knowledge/v5/`, `lib/tarot-reading-context.ts`, `lib/tarot-interpretation.ts`, `lib/tarot-reading-service.ts`, `lib/tarot-reading-route.ts`, `lib/tarot-follow-up-service.ts`, reading API routes, `components/reading/`.
- **DEPENDENCIES:** Room draw/session state, AI providers, reading persistence, saved-reading reopen, follow-up prompts, reading result UI, tests and production environment variables.
- **ALLOWED CHANGES:** Explicit Tarot AI/prompt/provider/contract mission only; UI missions may consume existing fields but may not change meaning or prompt semantics.
- **REQUIRED TESTS:** `tests/tarot-ai.test.ts`, `tests/tarot-interpretation.test.ts`, `tests/tarot-reading-context.test.ts`, `tests/tarot-reading-service.test.ts`, `tests/tarot-reading-route.test.ts`, `tests/tarot-api-contract.test.ts`, `tests/tarot-follow-up*.test.ts`, saved-reading compatibility tests, typecheck, build.
- **UNLOCK CONDITION:** Exact contract change, prompt-version decision, provider impact analysis, legacy-read compatibility decision, and representative provider/parser regression evidence.

### Zone: Database schema, migrations, and persistence ownership

- **STATUS:** HARD LOCK
- **WHY PROTECTED:** Schema and migration changes affect existing rooms, users, cards, sessions, readings, rollback, and production data.
- **FILES / MODULES:** `db/schema.ts`, `db/index.ts`, `drizzle/*.sql` including `0004_member_auth.sql`, `drizzle/meta/`, `scripts/node-migrate.mjs`, `lib/runtime.ts`, `lib/sqlite-d1.ts`, `lib/member-auth.ts`, `lib/tarot-repository.ts`, persistence API routes.
- **DEPENDENCIES:** D1/SQLite runtime, production systemd startup, room state, Tarot catalog, reading history, saved readings, backups and rollback.
- **ALLOWED CHANGES:** Explicit data/schema mission with migration design, forward/backward compatibility, isolated fixture tests, and authorized target-database plan.
- **REQUIRED TESTS:** `tests/tarot-migration.test.ts`, `tests/node-migrate.test.ts`, `tests/sqlite-d1.test.ts`, `tests/tarot-repository.test.ts`, affected ownership/service tests, and migration review without executing production migrations.
- **UNLOCK CONDITION:** Migration is reviewed, destructive operations are explicitly authorized, rollback/backup is described, and data-preservation tests exist.

### Zone: Deployment and runtime topology

- **STATUS:** HARD LOCK
- **WHY PROTECTED:** Build profiles, forwarded headers, systemd startup, Nginx routing, environment files, provider configuration, and database paths determine what actually runs.
- **FILES / MODULES:** `.openai/hosting.json`, `vite.config.ts`, `build/sites-vite-plugin.ts`, `scripts/run-framework.mjs`, `scripts/build-verified.sh`, `scripts/sites-env.*`, `deploy/nginx/`, `deploy/systemd/`, production environment files outside the repository.
- **DEPENDENCIES:** Cloudflare Sites/D1, local Wrangler state, standalone Node SQLite, auth header behavior, AI provider availability, HTTPS and migration startup.
- **ALLOWED CHANGES:** Explicit deployment/operations mission only; no deployment, restart, environment write, or production access in ordinary feature missions.
- **REQUIRED TESTS:** `tests/deployment-contract.test.ts`, build, topology-specific smoke checks, secret scan, and rollback/release inventory checks.
- **UNLOCK CONDITION:** Target topology, release artifact, secrets handling, rollback plan, and permission to deploy are explicit.

### Zone: Shared shell, layout, CSS, and localization

- **STATUS:** SOFT LOCK
- **WHY PROTECTED:** `app/vintarot.tsx`, `app/layout.tsx`, `app/globals.css`, and `components/language.tsx` reach nearly every route and can alter navigation, focus, responsive layout, motion, and translations.
- **FILES / MODULES:** `app/vintarot.tsx`, `app/layout.tsx`, `app/globals.css`, `components/language.tsx`, `lib/i18n.ts`, shared `components/ui/`, `components/brand/`.
- **DEPENDENCIES:** Home, Create, Guidebook, Room, Practice, Daily, Journal, Profile, route navigation, English/Vietnamese behavior, viewport and reduced-motion behavior.
- **ALLOWED CHANGES:** Scoped UI mission with explicit route list and no unrelated AI/data/auth changes.
- **REQUIRED TESTS:** Affected page contract tests, `tests/i18n.test.ts`, `tests/language-default.test.ts`, `tests/mobile-navigation.test.ts`, focused responsive/browser QA, full suite for global changes.
- **UNLOCK CONDITION:** Impact map includes every affected shell consumer and documents desktop/mobile/i18n/accessibility checks.

### Zone: Tarot Room interaction and state

- **STATUS:** ACTIVE
- **WHY PROTECTED:** The Room is the main stateful feature and connects UI gestures to room persistence, Tarot draw sessions, reading generation, saved readings, and follow-up.
- **FILES / MODULES:** `app/room/room.tsx`, `app/room/page.tsx`, `lib/room-motion.ts`, `lib/shuffle*.ts`, `lib/tarot-room.ts`, Room API routes, reading UI.
- **DEPENDENCIES:** Shared shell/i18n, room optimistic revisions, catalog/draw/session APIs, AI reading, journal/saved readings, responsive pointer/touch behavior.
- **ALLOWED CHANGES:** Current Room UI work is allowed only within an explicitly scoped mission; cross-subsystem changes must escalate to the relevant hard lock.
- **REQUIRED TESTS:** Room content/default/mobile/gesture/motion/guest-persistence/UI-cleanup tests, Tarot draw/session/route tests, and exact viewport QA when layout changes.
- **UNLOCK CONDITION:** Mission names the Room surface and includes a regression matrix for state, persistence, gesture, responsive, and reading behavior.

### Zone: Home/mobile polish outside the canonical integration worktree

- **STATUS:** ACTIVE
- **WHY PROTECTED:** The pre-existing user work remains uncommitted in sibling worktrees and the original checkout. It must not be overwritten or folded into this clean governance integration.
- **FILES / MODULES:** The modified and untracked paths reported by the Phase 0 baseline, especially `app/vintarot.tsx`, `app/globals.css`, `tests/celestial-surfaces.test.ts`, `tests/home-mobile-polish.test.ts`, `tests/homepage-celestial.test.ts`, and the existing project-state diff.
- **DEPENDENCIES:** Shared shell, global styles, Home contract tests, responsive navigation, current screenshot-review state.
- **ALLOWED CHANGES:** Preserve exactly outside this integration. Future changes require the user's explicit scope and a fresh baseline; this integration does not unlock or import them.
- **REQUIRED TESTS:** Do not reclassify the existing work as part of governance; run validation without staging or altering it.
- **UNLOCK CONDITION:** A later mission explicitly adopts the Home changes and identifies each path; this bootstrap does not unlock them.

## Unknown and not-implemented areas

Payment, video, general email integrations, public access, R2 storage, public reading share links, export/QR, Google Drive, subscription entitlements, affiliate, and admin capabilities are not protected as implemented features because the inspected source does not provide those systems. Local member authentication and its verification/reset email boundary are separate implemented surfaces. Future work must first create a discovery record and decide whether each capability is planned, experimental, or out of scope.
