# NaTarot Tarot AI Reliability and Laya Shadow Design

**Status:** approved for autonomous execution from the owner-supplied incident brief

**Scope:** production Tarot AI incident reliability first; isolated development-only Laya evaluation second.

## Verified incident

The latest member failure is not a DeepSeek outage. Production evidence shows:

- `natarot.service` is active and explicitly loads `/etc/natarot.env`.
- The running process receives `TAROT_AI_PROVIDER=deepseek`, `DEEPSEEK_TAROT_MODEL=deepseek-flash`, and a configured `DEEPSEEK_API_KEY` without exposing its value.
- An authenticated-free DeepSeek `/models` probe returns HTTP 200.
- A real production guest flow returns `draw=201`, `reading=200`, provider `deepseek:deepseek-flash`, prompt `tarot-reading-v4.2.2`, three card-evidence items, and a persisted payload.
- The failing member request is logged as HTTP 402 `credits_insufficient` in 39ms. `generateMemberTarotReading` reserves one Credit before invoking the provider, so this request never reaches DeepSeek.
- The production database has two member credit accounts, zero credit grants, zero active packages, and no active reservations.

The current root cause is therefore an empty production Credit state for member readings. The contributing product defect is that the Room client catches every failure and renders the provider-neutral unavailable message, hiding the actionable 402. The recurrence reason is that previous production checks proved web/provider/guest readiness but did not prove a member Credit path or distinguish Credit authorization from provider failure. The latest discoverability deployment `d0c7e761` is unrelated to the failure; it exposed an existing Credit/UX readiness gap rather than changing provider behavior.

## Design decisions

1. Preserve the Credit gate. Do not bypass authorization, silently fall back to a local reading, invent a package, or create a production ledger mutation. A member reading still requires an available Credit.
2. Make HTTP 402 actionable in Room in English and Vietnamese, with a safe account/packages destination. Keep provider failures friendly but distinguish them in server-side diagnostics.
3. Add safe provider diagnostics: preserve upstream HTTP status, classify auth/rate-limit/timeout/network/invalid-response/persistence failures, and correlate logs with a generated request ID. Session IDs, question text, raw provider bodies, keys, cookies and PII are not logged.
4. Add an operator-side AI readiness gate that checks the actual service process environment, persistent environment-file topology, direct provider reachability, web health, and a synthetic guest reading. It must fail closed when any required check fails and must not expose secrets.
5. Keep `/etc/natarot.env` as the single persistent provider configuration source. Release replacement and service restart must not copy or regenerate credentials.
6. Keep customer-facing Tarot semantics, KB V5, prompt v4.2.2, L5/L7/L8 behavior, card draw, persistence, auth, Credits/VIP, Affiliate, Share/QR and security boundaries unchanged except for error clarity and operational diagnostics.
7. Evaluate Laya only after live Tarot, five-reading soak, restart survival and post-restart reading pass. Laya lives under `tools/system1/laya-adapter`, has isolated Python/model requirements, starts in shadow mode, and cannot authorize production deploys, DB/payment/secret/auth changes or prompt semantics.

## Data flow after the fix

```text
Room POST /api/tarot/reading
  -> request ID created and returned as X-Request-Id
  -> owner/session validation
  -> member: reserve one Credit; insufficient -> 402 + explicit UI message
  -> guest/member with authorization: selected provider
  -> HTTP client preserves status/timeout diagnostics
  -> DeepSeek JSON parser and normalized reading validation
  -> saveReading()
  -> success log with request ID/provider/model/card count
```

The deployment gate uses the same production flow:

```text
service process env -> config status
service process env -> authenticated DeepSeek /models probe
public origin -> /api/health
public origin -> guest draw -> guest /api/tarot/reading
```

## Laya boundary

Laya is an evaluated development-time System-1 classifier, not a runtime provider and not a customer-facing Tarot feature. The adapter exposes small typed decisions for task type, risk, next action, test scope, failure class and model route. It first applies authoritative deterministic rules, then optionally asks a pinned Laya checkpoint, then falls back to the Codex/LLM decision. Every shadow record is sanitized and excludes production Tarot content, credentials, cookies, session IDs and PII. Laya disappearing must leave `natarot.com` operational.

## Acceptance evidence

The production incident phase is complete only when the root cause is documented, the client distinguishes 402, the readiness gate exists, the current persistent env topology is verified, a fresh backup is readable, the tested descendant is deployed, one live reading passes, five sequential guest readings pass, a normal service restart preserves readiness, and a post-restart live reading passes. The member path remains correctly blocked until a real Credit grant exists; no test grant is created automatically.

The Laya phase is complete only when the repository commit/license/dependencies/checkpoint are audited, the isolated adapter is pinned or explicitly documented as not worthwhile, deterministic routing is measured against Laya and the Codex/LLM baseline, English/Vietnamese/mixed technical inputs are evaluated, confidence is calibrated from the fixture set, and no production dependency is introduced.
