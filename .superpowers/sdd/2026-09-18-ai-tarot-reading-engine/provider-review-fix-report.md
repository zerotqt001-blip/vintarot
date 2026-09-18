# Provider transport review fixes

Date: 2026-09-18

## Scope

- Gemini now sends the strict Tarot JSON Schema through `generationConfig.responseJsonSchema`, preserves `responseMimeType: "application/json"`, and omits legacy `responseSchema`.
- DeepSeek now receives a static exact JSON output contract, including every required top-level and card key, before the serialized trusted reading context. Existing strict parsing and exact card coverage validation remain unchanged.
- The provider factory trims the selected provider's accepted API key and model before constructing its adapter. Provider selection remains explicit and does not inspect or fall back to another provider.

## TDD evidence

- RED: `npx tsx --test tests/tarot-ai.test.ts` exited 1 with 24 passing and the 3 intended failures: Gemini request field, DeepSeek exact contract, and factory trimming.
- GREEN: the same command exited 0 with 27/27 passing after the minimal production changes.

## Verification

- Provider tests: `npx tsx --test tests/tarot-ai.test.ts`
- Typecheck: `npx tsc --noEmit`
- Whitespace/error check: `git diff --check`
- Secret scan: staged diff scanned for private-key blocks and common live provider-token prefixes; no matches.

All HTTP behavior was exercised through the existing injected fake `fetch`; no live credentials or network calls were used.

## Residual caveat

The tests verify the documented outbound contracts and local normalization only. They do not make live Gemini or DeepSeek calls, so provider-side model availability, account permissions, and future API contract changes remain deployment-time dependencies.
