# NaTarot Tarot AI reliability runbook

## Incident finding — 2026-09-22

The recurring member-side Tarot failure was not a DeepSeek outage. The active
production process had `TAROT_AI_PROVIDER=deepseek`, a configured model and a
present key. An authenticated DeepSeek `/models` probe returned HTTP 200, and a
fresh guest draw → reading reached DeepSeek, parsed the canonical payload and
persisted it.

The member request is credit-gated before the provider call. Production had no
active package versions, no credit grants and zero available grant units. The
member path therefore correctly returned HTTP 402 (`credits_insufficient`) and
never called DeepSeek. The Room previously collapsed that response into the
generic provider-unavailable message, which made a ledger/catalog readiness gap
look like an AI outage.

No credit, package, trial, provider fallback or payment state is created by the
health gate. The Credit gate remains authoritative for member readings.

## Release contract

- Keep provider credentials in the VPS-only `/etc/natarot.env` systemd boundary.
- Use `X-Request-Id` and structured `TAROT_AI_*` failure categories for support
  correlation; never log session IDs, cookies, questions, prompts or provider
  response bodies.
- Show a dedicated 402 Credit message with an Account link. Provider retry is
  not offered as the primary action for an authorization failure.
- Use the guest flow for provider smoke tests because it does not mutate the
  member Credit ledger.

## Operator health gate

Run from the deployed application tree on the production host:

```sh
node scripts/production-ai-health-gate.mjs \
  --origin https://natarot.com \
  --service natarot.service \
  --readings 5
```

The gate checks the active systemd process environment, the persistent
environment-file topology, authenticated DeepSeek `/models`, public
`/api/health`, and one to five fresh synthetic guest reading flows. It prints
only safe provider/model identifiers, prompt versions, card counts and HTTP
statuses. It exits nonzero on any failed check.

The gate must not be run with `set -x`, unrestricted `env`, cookie debugging,
or response-body logging. Do not paste its environment, cookies, session IDs or
provider credentials into tickets or chat.

## Triage order

1. Capture the customer-visible HTTP status and `X-Request-Id`.
2. Search service logs by request ID and `TAROT_AI_*` category.
3. If the category is `TAROT_AI_CREDITS_INSUFFICIENT`, inspect the read-only
   Credit/package readiness state and Account/package UX. Do not bypass the
   reservation gate.
4. If the category is provider unavailable/auth/timeout/invalid response, run
   the operator gate and inspect only safe status lines.
5. If a release is unhealthy, use the retained rollback tree and the existing
   bounded readiness procedure. Never use a restart-only workaround as the
   fix.
