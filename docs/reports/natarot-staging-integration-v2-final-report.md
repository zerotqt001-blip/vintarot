# NATAROT — STAGING FULL INTEGRATION + VPS HYGIENE V2 — FINAL REPORT

## Status

HUMAN_GATE

## Resume addendum — 2026-09-21

The original SSH gate was resolved through the authenticated BKNS VPS console
and a dedicated local Ed25519 key. The local key is stored at
`/Users/tranquangthanh/.ssh/natarot_ops` with a `600` private-key mode, and the
local SSH alias `natarot-vps` uses port `26266`, `root`, and that identity.
Two independent `BatchMode` connections succeeded with the new key and
returned `root` / `Quangthanh`. No private key, password, OTP, or environment
value was printed or committed.

The resumed read-only VPS audit established:

- Root filesystem: `29G` total, `12G` used, `17G` free, `42%`; inode use `14%`.
- Production `natarot.service` is active on `127.0.0.1:8787` from `/opt/natarot`.
- Staging `natarot-staging.service` is active on `127.0.0.1:8788` from
  `/opt/natarot-staging`; Nginx has separate production and staging upstreams.
- Staging DB is `/var/lib/natarot-staging/natarot.sqlite`, owned by
  `natarot-staging:natarot-staging` with mode `600`; production DB remains at
  `/var/lib/natarot/natarot.sqlite`.
- Read-only HTTPS checks returned `200` for staging home/health and production
  apex/www. No service restart or production mutation was performed.

The mission remains at HUMAN_GATE before staging cleanup, backup, migration,
or deployment. The active `/opt/natarot-staging` release contains five
SePay-related source files, including `lib/commercial/sepay-adapter.ts`,
`lib/commercial/payment-service.ts`, and `scripts/seed-staging-commercial.mjs`.
The VPS also contains recent `natarot-staging.before-sepay-*` release trees and
`natarot-sepay-*.tar.gz` archives (latest observed at `16:28:58 UTC`). This is
positive evidence that another SePay staging workflow changed the active
staging target; no active SePay process was observed, but ownership and the
intended handoff are unresolved. Per the mission safety gate, this run did not
overwrite that release, remove its archives, touch either database, restart
either service, or deploy the Credits/VIP integration.

The sections below retain the pre-resume gate snapshot where they say
`NOT AUDITED`; this addendum is the authoritative resumed-audit evidence.

The local product integration is verified, but the mission stopped before any VPS audit, cleanup, staging DB backup/migration, deployment, restart, or live browser QA because no authorized SSH access was available.

Exact gate evidence:

- SSH host: `42.96.5.114:26266`.
- Read-only probe: `ssh -p 26266 -o BatchMode=yes -o ConnectTimeout=8 42.96.5.114 'id -un && hostname'`.
- Result: `tranquangthanh@42.96.5.114: Permission denied (publickey,password)`.
- Local `~/.ssh/config`: absent.
- SSH agent: no identities.
- No password, OTP, private key, or credential was requested or printed.

## Git

Base: `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` (`codex/natarot-integration-v1`)

Integrated commits:

- Credits/VIP V1: `121e184a617f43df049407ff5981e17ba6613616`, cherry-picked as `34a2654`.
- Staging V1 design/plan/runtime: `b8f1691`, `ea556be`, `b15c417`, `672bac3`, applied as `5b2baf6`, `5cefb57`, `f4aa090`, `d5b7fb8`.
- Mission plan: `a1a2031`.

Branch: `codex/natarot-staging-integration-v2`

Final commit: reported from the verified local/remote HEAD in the handoff after this report is finalized.

Remote verified: YES after the final local/remote parity check. No force push and no main merge.

## VPS Disk Before

Filesystem, used/free/usage, and inode baseline: NOT CAPTURED. The read-only VPS audit could not begin because the authorized SSH access gate failed.

## Major Storage Consumers

NOT AUDITED. No remote filesystem, release, log, cache, backup, or temporary artifact was inspected.

## Runtime Map

Production active release: NOT independently revalidated.

Staging previous release: NOT independently revalidated.

Staging new release: NOT created or deployed.

Production DB: NOT accessed.

Staging DB: NOT accessed.

Repository-declared staging paths remain `/opt/natarot-staging`, `/var/lib/natarot-staging/natarot.sqlite`, and `/etc/natarot-staging.env`; these are source contracts, not fresh VPS observations.

## Release Inventory

ACTIVE: NOT AUDITED.

ROLLBACK_KEEP: NOT AUDITED.

HISTORICAL_KEEP: NOT AUDITED.

DELETED: NONE.

UNKNOWN: ALL REMOTE ARTIFACTS, retained because no remote access was available.

## Cleanup

Files/directories deleted: NONE.

Reason: cleanup was prohibited by the failed authorized-access gate.

Space reclaimed: NOT MEASURED.

## Database Safety

Production DB touched: NO.

Staging backup: NOT CREATED.

Backup verified: NOT APPLICABLE; remote access unavailable.

Migration 0006: local migration implementation and migration tests passed; staging DB migration was NOT applied.

Unknown DBs retained: YES; no remote DB was inspected or deleted.

## Backup / DR

Retention intact: NOT INDEPENDENTLY AUDITED.

Latest backup status: NOT INDEPENDENTLY AUDITED.

Off-site marker: NOT INDEPENDENTLY AUDITED.

Backup system changed: NO.

## Staging Deployment

URL: `https://staging.natarot.com` — live deployment not changed by this mission.

Release: NOT DEPLOYED.

Service: `natarot-staging.service` — not restarted or modified.

Health: NOT FRESHLY VERIFIED by this mission.

Database: NOT CHANGED.

Migration 0006: NOT APPLIED to staging.

## Feature Inventory

AUTH: local source/tests verified; live staging not tested.

TAROT: local source/tests verified, including spread, reading, follow-up and clarification contracts; live staging not tested.

SHARE: local source/tests verified; live staging not tested.

PROFILE: local Credits/VIP surface covered by tests; live staging not tested.

CREDITS: integrated from verified V1 commit and covered by local tests.

VIP: integrated from verified V1 commit and covered by local tests.

ORDERS: integrated package/order foundation and covered by local tests.

SEPAY: NOT IMPLEMENTED in this branch, as required.

## AI Provider

Configured: NOT AUDITED on staging.

Live reading verified: NO; live staging QA was blocked.

## Browser QA

Desktop: NOT RUN against live staging.

Mobile: NOT RUN against live staging.

## UI Reality Audit

P0: NOT ASSESSED because live staging browser access was not reached.

P1: NOT ASSESSED.

P2: NOT ASSESSED.

P3: NOT ASSESSED.

No UI redesign or UI source change was made.

## Tests

Focused integration matrix: PASS, `291/291`.

Full tracked suite: PASS, `474/474`.

TypeScript: PASS, `npx tsc --noEmit`.

Build: PASS, `npm run build`.

Targeted lint: PASS for changed/new TypeScript files excluding the inherited `app/pages.tsx` baseline; the full changed-file invocation reports the existing `app/pages.tsx` baseline (`30 errors, 3 warnings`).

Migration: PASS locally, including fresh/upgrade tests and the 0006 migration contract; NOT applied to staging.

Staging contract: PASS locally.

Secret scan: PASS for tracked secret-like values; no values were printed.

diff-check: PASS.

## Disk After

Used/free/usage/inodes: NOT CAPTURED; no remote deployment occurred.

TOTAL SPACE RECLAIMED: `0` known; no cleanup ran.

NET DISK CHANGE AFTER NEW RELEASE: `0` known; no new release was created.

## Production Isolation

PRODUCTION DEPLOYED: NO.

PRODUCTION DB CHANGED: NO.

PRODUCTION SERVICE CHANGED: NO.

Production health: not probed by this mission after the gate; no remote command ran.

## Security Findings

No tracked secret-like values were found in the local integrated branch. Remote stale-release secret presence was not audited because SSH access was unavailable. No credentials, database contents, or customer data were printed or committed.

## Automatic Storage Prevention

Release retention: NOT AUDITED.

Logs: NOT AUDITED.

Caches: NOT AUDITED.

Temp artifacts: NOT AUDITED.

Backup retention: NOT AUDITED; existing backup/DR design was not changed.

## Protected Areas

Auth, F-001, Google OAuth semantics, guest identity, KB V5, Tarot engine/JSON contract, L1/L4/L5/L7/L8, Share S1–S6, Credits accounting, VIP entitlement, fulfillment idempotency, Backup/DR, production runtime, and production DB were not semantically changed. No SePay implementation, credential, payment, production operation, or UI redesign was performed.

## Known Limitations

- An authorized SSH username/key or approved console path is required to continue the VPS audit.
- Staging DB backup, migration 0006, deployment, service restart, live API regression, provider/email/OAuth audit, desktop/mobile browser QA, and UI reality audit remain pending.
- The known inherited `app/pages.tsx` lint baseline remains untouched.

## Recommended UI/UX Redesign Scope

Deferred. No concrete live-staging issue inventory can be responsibly authored until live staging browser QA is completed.

## Safe Base For UI Redesign

NO — not operationally certified by this mission; the source integration is locally verified, but live staging audit is pending.

## Safe To Archive

NO — archive only after authorized remote audit, staging deployment, regression, browser QA, and final production-isolation verification.

## Required Next Action

Provide an authorized non-root SSH account/key or approved VPS console access for `42.96.5.114:26266`. Do not provide private-key contents or passwords in chat; configure access locally and rerun the mission from this branch.
