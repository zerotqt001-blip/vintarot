# NaTarot Security + Production Readiness Audit

Date: 2026-09-21
Branch: `codex/natarot-security-production-readiness`
Base: `60db3db7db535560feb6ff1178a975793bec26bf`
Scope: source and local build/test evidence only; no production access, deployment, restart, merge, schema change, migration change, credential rotation, or protected-worktree change.

## Executive result

The audit reached Level C — Regression safe. Level D — Production ready is not claimed because the target runtime, TLS termination, credentials, backup/restore process, monitoring, rollback procedure, and release lock were not exercised in a production or release environment.

Safe isolated changes completed:

- Personalized and owner-scoped API responses now use `Cache-Control: no-store` through `lib/request-identity.ts:59-67`, the Tarot session/draw routes, and the shared reading/follow-up route helpers.
- `GET /api/health` performs only `SELECT 1 AS ok` and returns a generic non-cacheable `503` on database failure (`app/api/health/route.ts:4-10`).
- Compatible dependency patches were applied: React/React DOM/React Server Components `19.2.8`, Vite `8.0.16`, and compatible transitive lockfile updates. No runtime security dependency, external service, production key, or copied external source was introduced.

Finding counts at the end of the local audit:

| Severity | Count | Status |
| --- | ---: | --- |
| Critical | 0 | None found |
| High | 3 | Human-gated architecture/operations work remains |
| Medium | 4 | Human-gated identity, tooling, observability, and dev-toolchain work remains |
| Low | 1 | Existing conditional-origin behavior remains documented |
| Informational | 2 | Scope/verification limitations, not defects requiring this branch |

No safe independent Critical or High finding remains unresolved. The three High findings require production topology, policy, credentials, or business authorization and were not changed under this mission’s locks.

## Evidence boundary and protected work

The clean isolated worktree was created from the recorded base above. The dirty root checkout and the active `codex/natarot-l5-l8-engine` and `codex/natarot-share-s1-s5` worktrees were not modified. No L5–L8 Tarot Engine, S1–S5 Share System, Credits/VIP, SePay, Affiliate, AI prompt/provider, authentication model, database schema, or migration file was changed.

The source audit distinguishes evidence from project-state claims:

- Local source, tests, typecheck, build, lockfile install, dependency audit, and diff checks are directly verified here.
- Production domain behavior, TLS certificates, environment values, D1/VPS state, Cloudflare configuration, backup retention, restore success, monitoring, alert delivery, and rollback success remain unverified.
- Existing product claims in `docs/PROJECT_STATE.md` are not treated as live production evidence.

## API inventory and trust boundaries

| Surface | Classification | Security boundary/evidence |
| --- | --- | --- |
| `/api/health` | Public, read-only readiness | Database-only `SELECT 1`; no AI, mutation, or provider work (`app/api/health/route.ts:4-10`). |
| `/api/integrations` | Public capability/status response | Uses the existing identity boundary and no-store identity-cookie helper. |
| `/api/tarot/catalog` | Public reference data | Locale is schema-validated; no owner data or provider call. |
| `/api/records` | Owner-scoped persistence | Identity helper plus owner predicates in the route; writes use origin checking, bounded JSON, schema validation, and prepared statements. |
| `/api/rooms` | Owner/member-scoped persistence | Owner/member predicates and revision check are enforced in the route; writes use origin checking, bounded JSON, schema validation, and prepared statements. |
| `/api/tarot/draw` | Guest/user-owned state creation; costly follow-on surface | Request schema, request-size limit, origin check, owner assignment, active deck/template checks, and no-store success/handled validation paths (`app/api/tarot/draw/route.ts:7-113`). No rate limit is present. |
| `/api/tarot/session` | Guest/user owner read | The repository query requires the session ID and the request owner (`app/api/tarot/session/route.ts:6-13`). |
| `/api/tarot/reading` and `/api/tarot/interpret` | Owner-scoped expensive AI reading | Shared service verifies ownership before provider work; provider URLs are fixed in server-only provider modules; no-store responses were added in the shared route helper. |
| `/api/tarot/follow-up` | Owner-scoped expensive AI follow-up | Shared service verifies the stored owner before provider work; no-store responses were added in the shared route helper. No rate limit is present. |
| `/api/tarot/saved-readings` | Authenticated owner-scoped persistence | Guest save/history requests are rejected by existing tests; repository queries use the authenticated owner. |

## F-001 identity boundary

F-001 remains protected and passes. `readRequestIdentity` obtains an authenticated identity only through `getChatGPTUser()` and explicitly refuses to promote arbitrary request headers (`lib/request-identity.ts:26-34`). The VPS Nginx template clears the discovered ChatGPT identity headers before proxying (`deploy/nginx/natarot-http.conf:19-22`). The regression suite covers spoofed identity headers and cross-owner records, rooms, and Tarot sessions (`tests/f001-identity-boundary.test.ts`).

No application code in this branch trusts user-supplied ChatGPT identity headers, changes the platform authentication boundary, or changes owner semantics.

## Findings and decisions

### SR-001 — HIGH — AI/cost abuse controls are not implemented

- Evidence: public/guest-capable draw and owner-scoped reading/follow-up routes; no local rate-limiter, bot challenge, token bucket, durable quota, or AI budget enforcement was found in the current stack.
- Risk: automated calls can create database state and consume paid AI/provider resources; IP-only controls also require a trusted proxy/client-IP policy.
- Class: `REQUIRES_HUMAN_AUTHORIZATION`.
- Decision: do not add an in-memory limiter, Redis/KV/Durable Object, new quota schema, Arcjet key, or external service in this branch. The external research record compares Arcjet, express-rate-limit, and Cloudflare edge limits. A future mission should choose authenticated/user and anonymous/IP policies, trusted proxy behavior, provider budget policy, and operations ownership before implementation.
- ASVS mapping: `v5.0.0-V2.4.1`, `v5.0.0-V6.1.1`, `v5.0.0-V15.1.3`, `v5.0.0-V15.2.2`.

### SR-002 — HIGH — Production TLS and browser-header policy are not verified

- Evidence: the tracked Nginx template listens on HTTP and includes `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` but no tracked TLS server, HSTS, or CSP policy (`deploy/nginx/natarot-http.conf:1-10`). CSP must be designed against actual assets, providers, and nonce/hash behavior; HSTS must only be enabled after HTTPS is verified.
- Risk: a release could lack transport enforcement or a complete browser execution policy if the external edge configuration is incomplete.
- Class: `REQUIRES_HUMAN_AUTHORIZATION`.
- Decision: retain the existing safe headers and do not guess CSP/HSTS or alter the deployment topology. Human release work must verify certificate coverage, HTTP-to-HTTPS behavior, HSTS preload policy, CSP compatibility, frame policy, and all response paths.
- ASVS mapping: `v5.0.0-V3.1.1`, `v5.0.0-V3.4.1`–`V3.4.6`, `v5.0.0-V4.1.2`.

### SR-003 — HIGH — Backup, restore, rollback, and release-lock evidence is incomplete

- Evidence: `deploy/systemd/natarot.service:8-15` provides a least-privilege service user, restrictive `UMask`, migration pre-start, and automatic restart, but the repository contains no verified backup/restore job, restore drill, release lock, artifact pin, or rollback command with target evidence.
- Risk: a failed migration, data corruption, or partial release could be difficult to recover without data loss or silent version replacement.
- Class: `REQUIRES_HUMAN_AUTHORIZATION`.
- Decision: no migration, database, deployment, restart, or release orchestration change was made. A human release mission must define backup ownership/retention, restore testing, immutable artifact identity, migration rollback strategy, and concurrency/release locking.
- ASVS mapping: `v5.0.0-V13.1.2`–`V13.1.3`, `v5.0.0-V15.2.3`, `v5.0.0-V15.4`.

### SR-004 — MEDIUM — Guest identity is an unsigned bearer cookie

- Evidence: `vintarot_guest` is a 30-day `HttpOnly; SameSite=Lax` cookie generated from `crypto.randomUUID()` (`lib/tarot-guest.ts:3-20`), and ownership is equality against the presented guest ID (`lib/tarot-guest.ts:50-58`). The cookie is not signed or server-bound.
- Risk: theft or replay of the bearer cookie grants access to that guest’s persisted readings until expiry; guest identity is not proof of a human or device.
- Class: `REQUIRES_HUMAN_AUTHORIZATION` because binding/signing changes identity semantics and may affect guest continuity and the protected auth model.
- Decision: preserve the existing identity model, document the threat, and require a separate threat-model-approved design before changing it. The cookie’s current Secure behavior is derived from the effective HTTPS request (`lib/tarot-guest.ts:35-54`).
- ASVS mapping: `v5.0.0-V3.3.1`, `V3.3.2`, `V3.3.4`, `v5.0.0-V7`, `v5.0.0-V9.1.1`, `v5.0.0-V8.2.2`.

### SR-005 — MEDIUM — Mature repository scanners are unavailable in this environment

- Evidence: `gitleaks` and `trivy` binaries were not available; no scanner was installed and no new credential or service was introduced. A redacted worktree/history pattern scan found only variable names, test placeholders, and documentation regex examples; no actual secret value was found.
- Risk: the repository lacks a reproducible local/CI secret, dependency, filesystem, and configuration scanning gate.
- Class: `REQUIRES_HUMAN_AUTHORIZATION` for CI ownership and tool installation policy; no secret rotation is required from this audit because no real secret was detected.
- Decision: keep secrets in environment/runtime configuration, do not print values, and add Gitleaks/Trivy CI only through a future approved tooling change. If a future scan finds a real value, redact it, identify the file/history, classify severity, and rotate the credential; source deletion alone is not rotation.
- ASVS mapping: `v5.0.0-V13.1.4`, `V13.3.1`–`V13.3.4`, `v5.0.0-V15.1.1`–`V15.1.2`.

### SR-006 — MEDIUM — Production observability and privacy evidence are incomplete

- Evidence: `lib/server.ts:14` logs only a generic route prefix plus an error message and returns a generic response; the repository has no verified external log sink, security-event inventory, alert policy, cost metric, or retention/erasure evidence for the target environment.
- Risk: incident investigation, abuse detection, cost attribution, and privacy controls may be insufficient after deployment.
- Class: `REQUIRES_HUMAN_AUTHORIZATION` because the correct sink, retention, access control, and privacy policy are environment/business decisions.
- Decision: preserve current sanitized error behavior; do not add sensitive payload logging or a new telemetry service. Human operations work should define correlation IDs, authentication/authorization/anti-automation events, provider latency/cost metrics, retention, access, and redaction.
- ASVS mapping: `v5.0.0-V16.1.1`, `V16.2.1`–`V16.2.5`, `V16.3.1`–`V16.5.4`, `v5.0.0-V14.1.2`.

### SR-007 — LOW — Origin checking is conditional on an Origin header

- Evidence: `lib/server.ts:6-14` compares a present `Origin` against the forwarded request origin, but accepts requests when the header is absent. Write routes call `originCheck`; the existing cookie is `SameSite=Lax`.
- Risk: legacy/non-browser or unusual intermediary behavior can bypass this one signal; changing to strict rejection could affect supported platform traffic and auth semantics.
- Class: `REQUIRES_HUMAN_AUTHORIZATION` for a compatibility and threat-model decision.
- Decision: no change in this mission. A future design can combine trusted `Sec-Fetch-*`/Origin policy, CSRF tokens where appropriate, and explicit platform exceptions.
- ASVS mapping: `v5.0.0-V3.5.1`–`V3.5.3`, `v5.0.0-V4.1.3`.

### SR-008 — MEDIUM — Four development-tool advisories remain behind a breaking toolchain decision

- Evidence: after compatible remediation, `npm audit --omit=dev` reports `0` vulnerabilities. Full `npm audit` reports four moderate development-only packages: `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, direct `drizzle-kit@0.31.10`, and `esbuild`. npm’s proposed fix is `drizzle-kit@0.18.1` with `isSemVerMajor: true`; no force downgrade was applied.
- Risk: the migration-generation toolchain remains exposed to development-time advisories; this is not a production dependency finding, but it affects developer/CI environments.
- Class: `REQUIRES_HUMAN_AUTHORIZATION` because changing `drizzle-kit` across the proposed major/downgrade boundary needs migration-generation compatibility review and a separate tooling mission.
- Decision: applied same-line compatible patches for React/RSC/Vite and vulnerable transitive lock entries (`@babel/core`, `brace-expansion`, `browserslist`, `fflate`, `js-yaml`, and related Vite/Rolldown packages). Do not run `npm audit fix --force`.
- ASVS mapping: `v5.0.0-V15.1.1`–`V15.2.4`.

### SR-009 — INFORMATIONAL — No local password/OAuth account surface was found

No local registration, password reset, or OAuth token endpoint was found in the audited application source. The product uses the existing ChatGPT platform identity boundary plus guest continuity; no claim is made about identity-provider controls outside this repository. This is not changed because inventing an auth surface would violate the auth lock.

### SR-010 — INFORMATIONAL — Production behavior remains unverified

No live endpoint, provider call, production database, external monitoring, backup, TLS certificate, or deployment restart was exercised. The local health route proves only the process/database boundary, not provider availability, edge routing, or production readiness.

## Security controls that passed source review

- F-001 header spoofing: protected boundary and regression tests pass.
- Ownership/IDOR: Tarot session and reading queries bind the requested resource to the user or guest owner; the dynamic owner column is selected from a closed `user`/`guest` union and values are parameterized (`lib/tarot-repository.ts:333-343`).
- SQL injection: repository reads/writes use prepared statements and bound values (`lib/tarot-repository.ts:256-264`, `321-343`); no user-controlled SQL identifier was found.
- Input and size limits: shared JSON parsing rejects bodies above 100,000 characters (`lib/server.ts:15`), Nginx bounds request bodies to 2 MB (`deploy/nginx/natarot-http.conf:6`), and route/provider payloads use Zod/bounded field schemas.
- XSS and HTML injection: no application `dangerouslySetInnerHTML` or raw HTML sink was found in the audited app/lib surface; React text rendering remains the default. Dynamic URLs are from controlled card/provider configuration paths, not arbitrary client fetch targets.
- SSRF: AI provider modules use fixed provider URLs and environment-provided keys; there is no user-selected outbound URL. Provider requests have bounded timeouts and at most one retry (`lib/ai/http.ts`).
- Error handling: `boundary` returns a generic 503 and logs only a sanitized error message (`lib/server.ts:14`); provider errors are mapped to provider-neutral responses by existing tests.
- Cache privacy: the new `noStoreResponse` contract covers identity-attached responses, owner-scoped sessions, draw state creation, reading, and follow-up success/error paths. The focused suite proves the metadata without changing public catalog behavior.

## Health/readiness and operational review

`GET /api/health` is intentionally public, small, non-cacheable, and database-only. It does not call AI, email, draw, reading, mutation, or migration code. It is suitable as a process/database readiness signal once wired into a human-controlled release environment, but it is not evidence that the external provider or edge is healthy.

The tracked service template uses `User=natarot`, `UMask=0077`, a migration pre-start, localhost binding, and restart-on-failure. The tracked Nginx template forwards the public host/proto/IP and clears platform identity headers. No Google Drive backup/export boundary is present in the audited application/deployment source. The same templates do not prove TLS, backup, restore, rate limiting, external logs, alerts, release locks, or rollback.

## ASVS 5.0.0 checklist mapping

This is a focused mapping, not a claim that every ASVS control applies to the current product. The identifiers below are taken from the versioned ASVS 5.0.0 requirement JSON:

| NaTarot area | Relevant ASVS 5.0.0 categories | Result |
| --- | --- | --- |
| Input, SQL, XSS, URLs, SSRF | `V1.2.2`, `V1.2.4`, `V1.3.6`; `V2.2.1`–`V2.2.3` | Source controls present; continue regression coverage. |
| Cost/abuse limits | `V2.3.2`, `V2.4.1`; `V15.1.3`, `V15.2.2` | Human-gated gap; no new limiter added. |
| Cookies, sessions, identity | `V3.3.1`–`V3.3.4`; `V7`; `V8.2.2`, `V8.3.1`; `V9.1.1` | Existing boundary passes; unsigned guest bearer remains documented. |
| Headers, proxy trust, CSRF/origin | `V3.4.1`–`V3.4.6`; `V3.5.1`–`V3.5.3`; `V4.1.2`–`V4.1.3`; `V15.3.4` | Partial headers/source proxy contract present; target policy is human-gated. |
| API/error/cache/privacy | `V4.1.1`, `V4.1.3`; `V13.4.5`; `V14.2.2`, `V14.3.2`; `V16.5.1`–`V16.5.4` | No-store and generic errors verified; production monitoring/privacy evidence remains open. |
| Secrets/dependencies | `V13.1.4`, `V13.3.1`–`V13.3.4`; `V15.1.1`–`V15.2.4` | No real secret found; scanner/CI and dev-toolchain work are human-gated. |

Source: [OWASP ASVS 5.0.0 versioned requirements](https://raw.githubusercontent.com/OWASP/ASVS/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json).

## Validation evidence

Executed after the final lockfile install and code changes:

- `npm ci` — pass; 674 packages installed.
- `npx tsx --test tests/*.test.ts` — 263 passed, 0 failed.
- `npx tsx --test tests/security-production-readiness.test.ts tests/f001-identity-boundary.test.ts tests/request-identity.test.ts tests/server-origin.test.ts tests/tarot-guest.test.ts tests/room-guest-persistence.test.ts tests/tarot-saved-reading-route.test.ts` — pass during implementation; the full suite includes the same coverage.
- `npx tsc --noEmit` — pass.
- `npm run build` — pass; build enumerated `/api/health` and all existing routes.
- Targeted ESLint over every changed source/test file — pass.
- `npm run lint` — fails on 93 pre-existing errors and 122 warnings across bundled `.codex` skill artifacts and unrelated existing application/tests; no changed file is implicated by the targeted run. No unrelated lint cleanup was made.
- `npm audit --omit=dev` — `found 0 vulnerabilities`.
- Full `npm audit --json` — 0 critical, 0 high, 4 moderate; all four are development/toolchain-only and require the documented breaking `drizzle-kit` decision.
- `git diff --check` — pass at each verification checkpoint.
- Secret scan — Gitleaks/Trivy binaries unavailable; redacted manual worktree/history scan found no real secret value and printed no secret.

## External research decision

The complete field-by-field research record is [SECURITY_EXTERNAL_RESEARCH.md](SECURITY_EXTERNAL_RESEARCH.md). The loop was: repository audit → official repository/documentation research → topology comparison → pattern selection/rejection → minimum local fixes → tests/build/audit → six-lens review → retest. The post-fix review did not show the selected local cache/readiness solution to be materially weak, so no new runtime security service was activated.

Major mechanism decisions:

- Personalized cache protection: adapted the established HTTP `Cache-Control: no-store` pattern locally; no Helmet/Arcjet dependency.
- Readiness: implemented the smallest existing-database-boundary local equivalent; no health SaaS or external dependency.
- Rate limiting/bot/AI cost control: reference/adapt only; not activated because it requires policy, trusted client-IP topology, shared state, and possibly credentials.
- Secret/dependency/config scanning: reference/adapt only; local binaries were unavailable, and no CI/tooling dependency was introduced.
- Security headers: adapted the existing Nginx/Next header pattern only where already evidenced; CSP/HSTS remain human-gated instead of being guessed.

## Parallel-work ownership and final state

Protected L5–L8 Tarot Engine and S1–S5 Share System work remains owned by its existing branches/worktrees. This branch did not merge or modify that work. Credits/VIP, payments, affiliate, video, and public-share infrastructure remain outside the safe scope.

The branch was pushed to `origin/codex/natarot-security-production-readiness`, and local/remote equality was verified before this final documentation checkpoint. The audit does not claim merge or deployment.
