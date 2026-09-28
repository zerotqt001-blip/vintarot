# Implementation Plan: Marketing Campaign Manager

## 1. Schema and core rules

- Add campaign and claim tables plus seeded Welcome Bonus and paused Daily Rewards configuration.
- Add migration fixtures and first-write tests before implementing campaign services.
- Implement campaign validation, IANA-time-zone claim periods, aggregate reads, admin auditing, and the conditional atomic-claim write using canonical Credit grant statements.
- Keep purchased-credit allocation and Affiliate conversion code unchanged; test source separation and existing FIFO allocation.

## 2. Authorization and Admin API

- Add `admin.marketing.manage` to the permission model for `SUPER_ADMIN` only.
- Add guarded APIs for campaign listing/details, create/edit/status changes, history, and aggregate analytics.
- Add tests for denied roles, disabled actors, stale sessions, invalid configurations, audit replay, and budget monotonicity.

## 3. Daily Rewards API and member UI

- Add signed-in reward listing, state, and claim endpoints; derive member, local claim period, and grant request entirely on the server.
- Add collision, budget-exhaustion, concurrent-claim, custom-frequency, and replay tests before wiring the claim page.
- Build `/daily-rewards` with scoped responsive styles in the Moonlight/VinTarot system, including signed-out, eligible, claimed, paused, expired, and error states.

## 4. Welcome Bonus parity migration (implemented and locally verified)

- The parity tests characterize password signup, Google completion, transaction failure, duplicate signup, and the exact existing grant/ledger tuple.
- The signup workflow now reads the seeded campaign configuration after those tests pass. Its default retains `TRIAL`, `signup-trial:v1`, one unit, no expiry, and `SIGNUP_TRIAL`. A Super Admin may explicitly change future Welcome settings through the audited manager; no existing grant is rewritten.
- Verify campaign statistics include legacy signup lots through aggregate source-based queries.

## 5. Expiration and Business Control Center

- Add an idempotent scheduled sweep that calls existing `expireGrant`; invoke it before optional Google/Sheets work in the installed 15-minute reporting job and surface failures separately.
- Add aggregate campaign report types and a Campaigns worksheet without user-level identifiers.
- Test expiry counts against ledger rows, purchased-credit preservation, scheduler ordering, BCC retry/idempotency, and commission isolation.

## 6. Admin UI and audit history

- Read Impeccable before frontend work and follow the current Moonlight reference.
- Add the `/admin/marketing/campaigns` page and role-specific navigation without changing Tarot Room.
- Support campaign editing, schedule, state, budget, expiry, reward, history, and performance summary.

## 7. Full verification and source completion

- Run targeted tests during TDD, then the complete regression suite requested by the Owner.
- Run type-check, production build, changed-file lint, and `git diff --check`; fix regressions before completion.
- Update `docs/PROJECT_STATE.md`, inspect staged files for secrets, commit related verified changes, and push the `codex/` branch.

## 8. Production release gate

- Wait for the active Technical Audit task to finish and explicitly report no conflict with the campaign candidate.
- If a conflict or live-data risk is found, stop before migration or deployment and report evidence.
- Otherwise follow the existing single-release manager workflow: fresh backup and exact restore verification, one atomic production promotion, production smoke tests, Daily Rewards still `PAUSED`, and retain current plus two rollback releases.
