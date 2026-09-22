# NaTarot Tarot AI recurring failure incident

Date: 2026-09-22 (Asia/Ho_Chi_Minh)

## Current diagnosis

`CURRENT_ROOT_CAUSE`: authenticated member readings reserve one Credit before
calling the selected provider. Production had two member Credit accounts, zero
Credit grants, zero ledger units, zero active package versions and zero held
reservations. The member request therefore correctly returned HTTP `402` with
`credits_insufficient` before any DeepSeek call.

`CONTRIBUTING_FACTOR`: the Room client previously rendered the same generic
provider-unavailable message for every reading error, so a Credit authorization
boundary looked like an AI outage.

`RECURRENCE_REASON`: earlier readiness checks proved web health, provider
configuration and guest readings, but did not distinguish the member Credit
gate from provider failures or make the 402 actionable.

`LATEST_DEPLOY_RELATIONSHIP`: the 2026-09-22 UI discoverability release
`d0c7e761` did not change provider, Credit, payment, auth, schema or Tarot
semantics. It made the existing Account/Packages surfaces easier to find and
exposed the readiness/UX gap.

## Evidence

- `natarot.service` is active and loads `/etc/natarot.env`; the running process
  has the configured DeepSeek provider/model/key names without exposing values.
- An authenticated direct DeepSeek `/models` probe returned `200`.
- A fresh production guest flow returned `draw=201`, `reading=200`, provider
  `deepseek:deepseek-flash`, prompt `tarot-reading-v4.2.2`, three card-evidence
  items and a persisted payload.
- The member-side production log records HTTP `402` and
  `credits_insufficient`; the provider was not called for that request.
- The read-only production Credit/package aggregate remains
  `activePackages=0`, `activePackageVersions=0`, `creditAccounts=2`,
  `grants=0`, `ledger=0`, `heldReservations=0`.

Historical episodes are separate causes, not one outage:

1. The initial 2026-09-18 VPS release had no provider key/model and correctly
   returned the safe no-provider contract.
2. The 2026-09-18 DeepSeek configuration pass found default thinking/transport
   latency above the old 10-second window; the selected JSON path now disables
   thinking and allows the bounded 20-second timeout.
3. The first live DeepSeek reading reached the provider but returned a
   one-paragraph `direct_answer`; commit `4e6e3e6` tightened the prompt and
   regression contract.
4. A later valid response exceeded `reflection_prompts` cardinality; commit
   `7cd410d` tightened the exact cardinalities in the prompt and schema.
5. The current 2026-09-22 incident is Credit authorization state, not a
   DeepSeek transport, authentication, schema or persistence outage.

## Prevention shipped

- Upstream HTTP status is preserved internally and mapped to safe structured
  `TAROT_AI_*` categories.
- Every handled Tarot reading response carries `X-Request-Id`; logs correlate
  request IDs without session IDs, questions, prompts, cookies, provider
  bodies, keys or PII.
- Room now gives HTTP 402 a bilingual Credit-required message and Account
  action. Provider/network failures retain retry behavior; 402 does not retry
  or redraw automatically.
- `scripts/production-ai-health-gate.mjs` checks service configuration,
  persistent env-file topology, direct DeepSeek health, public web health and
  a fresh guest draw → reading flow. It prints safe identifiers only.
- The gate intentionally uses guests and never grants Credits, creates package
  versions, bypasses reservations or changes payment state.

## Production release evidence

- Source: `codex/natarot-ai-reliability-laya`
- Commit: `6993b52ba65e7c112f6f57b6acb3d1c26258baa5`
- Backup: `natarot-production-20260922-ai-reliability`
- Backup archive SHA-256: `058336ad13546ae02b2a00418d1949b4500a4c1a1b83d4538ae43ec842275385`
- Release archive SHA-256: `46f695d760ae09642cbf2fef6bd43f5ad1772b558f7c251d855354fb4fca63d4`
- Deployment marker: `2026-09-22T15:34:52Z`
- Rollback tree: `/opt/natarot.rollback-ai-reliability-6993b52-20260922-153452`
- Backup checksum and restore test: `PASS`; SQLite integrity `ok`, FK
  violations `0`, migration rows `10`, restored application `pass`.
- Backup-copy migration dry run: `10 → 10` migration rows, integrity `ok`,
  FK violations `0`.
- Final service switch: `natarot.service active`, local health `200`.
  An earlier candidate attempt failed closed because dev dependencies were
  omitted and Vinext was absent; the bounded readiness check restored the old
  release before the final full-dependency candidate was switched.
- Operator gate: one reading `PASS`; sequential soak `5/5 PASS`; normal
  service restart followed by one post-restart reading `PASS`.
- Post-soak production database: `71/71` readings have payloads; latest safe
  metadata is provider `deepseek:deepseek-flash`, prompt
  `tarot-reading-v4.2.2`.

## Laya boundary

The audited upstream Laya repository is pinned at
`573e5b62696ba441230cd6be71d593331b5d23af` (v0.3.5, Apache-2.0). Its optional
Torch/Transformers/Hugging Face runtime is not part of NaTarot. The local
adapter is stdlib-only and shadow-only. The curated 12-fixture bilingual/mixed
baseline matched 60/60 decision slots, with no model checkpoint or LLM network
call. Any future Laya model experiment must use a disposable Python
environment and remain outside the Node service.

## Required member behavior and remaining work

Do not bypass the Credit gate or manufacture a grant/package/price to make a
member test pass. The correct member outcome remains HTTP 402 until an owner
provisions an approved real Credit grant. If provider-dependent or authenticated
member testing is required, use an approved fixture and record the external
gate separately.
