# NaTarot Reading Experience V1.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Tarot reader's customer-facing voice to natural Vietnamese/English and present the existing ReadingPanel as a quiet private editorial reading without changing reasoning, schema, persistence, or frozen Room/follow-up behavior.

**Architecture:** Keep the existing v4.1 input/context, provider transport, JSON shape, parser, normalized payload, Saved Reading routes, and follow-up prompt untouched except for the approved reader prompt version bump to v4.2. Add voice instructions only inside the main reading prompt, then make the existing ReadingPanel/i18n/CSS hierarchy quieter through small presentation changes: customer-first labels, one supporting-material group, restrained rules, and the existing 65–72ch / 760–840px editorial grid.

**Tech Stack:** TypeScript/React, the existing prompt/schema modules, i18n strings, scoped CSS in `app/globals.css`, Node test runner through `tsx`, TypeScript, Vinext production build, and one optional local DeepSeek smoke test.

**Spec:** `/Users/tranquangthanh/.codex/attachments/42559bbe-b7f8-47d9-98a5-149a74542921/Văn bản đã dán.txt`

## Global Constraints

- Start from clean V1.2 commit `4432911c0bf31531c9e641c6a14ceb2354c5f712` in a new isolated worktree.
- Bump the main reading prompt to exactly `tarot-reading-v4.2` if prompt text changes.
- Do not change the JSON schema, field names, cardinalities, parser contracts, Knowledge Base V5, provider/model/temperature/timeout configuration, cards, spreads, database/migrations, authentication/F-001, Saved Reading V1, or `tarot-follow-up-v1`.
- Preserve historical v2/v3/v4.1 stored-reading hydration and zero-provider reopen behavior.
- Keep the left Tarot stage, follow-up interaction/design, save/close footer actions, and Room API architecture unchanged.
- Do not hardcode generated Vietnamese prose into UI or tests.
- Do not stage, modify, reset, stash, or integrate the unrelated dirty Home work in the root worktree.
- Perform at most one intentional Vietnamese DeepSeek provider smoke test after deterministic validation, without printing secrets or repeatedly tuning.
- Create one bounded local commit only; do not push, deploy, merge, or modify the root worktree.

---

### Task 1: Add failing V1.3 voice contract coverage

**Files:**
- Create: `tests/tarot-reading-voice-v1-3.test.ts`
- Modify: `tests/tarot-ai.test.ts` only where the current prompt-version assertion must follow the approved v4.2 bump.
- Read: `lib/ai/prompts/tarot-reading.ts`, `lib/tarot-interpretation.ts`, `tests/tarot-saved-reading.test.ts`, `tests/tarot-repository.test.ts`.

**Interfaces:**
- Consumes: exported `TAROT_PROMPT_VERSION`, `TAROT_SYSTEM_PROMPT`, `TAROT_JSON_OUTPUT_CONTRACT`, and `TAROT_RESPONSE_SCHEMA`.
- Produces: deterministic source-contract coverage for voice guidance while proving the schema and frozen safety guidance remain present.

- [ ] **Step 1: Write the failing tests**

  Assert that the prompt version is `tarot-reading-v4.2`, the prompt contains customer-first/situation-first guidance, natural-language and anti-AI-speak guidance, concrete next-step guidance, concise direct-answer guidance, non-repetition guidance, third-party calibration, and anti-redraw guidance. Assert that the required JSON keys, existing cardinality wording, exact card-evidence coverage, and follow-up anti-dependency wording remain present.

- [ ] **Step 2: Run the focused voice test and verify the expected failure**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-voice-v1-3.test.ts
  ```

  Expected: FAIL because the current version is v4.1 and the new voice instructions are absent.

### Task 2: Implement the v4.2 customer-facing voice instructions

**Files:**
- Modify: `lib/ai/prompts/tarot-reading.ts`
- Modify: `tests/tarot-ai.test.ts` current-version assertions only.
- Modify: current-reading tests that assert newly generated metadata version, such as `tests/tarot-reading-service.test.ts`, `tests/tarot-reading-route.test.ts`, and `tests/tarot-repository.test.ts`.
- Do not modify: `lib/tarot-interpretation.ts`, `lib/ai/types.ts`, `lib/ai/provider.ts`, `lib/tarot-reading-service.ts`, `lib/tarot-saved-reading.ts`, `lib/ai/prompts/tarot-follow-up.ts` (if present), or historical v2/v3/v4.1 fixtures.

**Interfaces:**
- Consumes: the existing bounded `TarotReadingInput` context and V4.1 JSON contract.
- Produces: the same `TarotProviderOutput` shape under `TAROT_PROMPT_VERSION = "tarot-reading-v4.2"`.

- [ ] **Step 1: Change only the main prompt version and instruction list**

  Add concise instructions that make the customer situation the subject before card mechanics, prefer contemporary concrete Vietnamese and equivalent natural English, avoid translated-English syntax and unnecessary abstract wording, keep direct answers to 2–3 concise paragraphs, require genuinely new insight/action sections, make actions observable and proportional, keep deeper reading nullable unless it adds synthesis, and keep card names primarily in `card_evidence`. Retain every existing safety, third-party calibration, anti-redraw, cardinality, and schema instruction.

- [ ] **Step 2: Run the voice contract and existing AI contract tests**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-voice-v1-3.test.ts tests/tarot-ai.test.ts
  ```

  Expected: PASS with v4.2 assertions and unchanged schema/provider transport tests.

### Task 3: Add failing ReadingPanel presentation contracts

**Files:**
- Create: `tests/tarot-reading-presentation-v1-3.test.ts`
- Read: `components/reading/reading-panel.tsx`, `components/reading/direct-answer.tsx`, `components/reading/reading-header.tsx`, `components/reading/reflection-prompts.tsx`, `components/reading/tarot-evidence.tsx`, `components/reading/follow-up-reading.tsx`, `app/room/room.tsx`, and the V1.2 presentation test.

**Interfaces:**
- Consumes: existing ReadingPanel composition and translation keys.
- Produces: deterministic presentation-boundary assertions without testing provider prose.

- [ ] **Step 1: Write the failing tests**

  Assert that the panel exposes one supporting-material group containing the optional reflection and evidence sections, uses the existing follow-up component and Room callback boundary, keeps the save/close actions, keeps the explicit `01`/`02` ordinal spans with no CSS counters or list markers, separates positions/deck metadata, uses non-uppercase takeaway/major-section labels, and contains no new per-idea card wrapper classes.

- [ ] **Step 2: Run the presentation test and verify the expected failure**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-presentation-v1-3.test.ts
  ```

  Expected: FAIL because the current panel has separate disclosure sections, uppercase Vietnamese labels, and V1.2's remaining separator/card-like treatment.

### Task 4: Implement the private editorial presentation

**Files:**
- Modify: `components/reading/reading-panel.tsx`
- Modify: `components/reading/direct-answer.tsx`
- Modify: `components/reading/reading-header.tsx` only if a minimal secondary-question presentation hook is required.
- Modify: `components/reading/reflection-prompts.tsx` and `components/reading/tarot-evidence.tsx` only for the existing supporting-group hooks/labels; preserve behavior and data.
- Modify: `lib/i18n.ts` for equivalent Vietnamese and English customer-facing labels.
- Modify: `app/globals.css` using only `.room-reading-panel-shell`-scoped V1.3 rules and preserving unrelated root Home hunks.

**Interfaces:**
- Consumes: existing normalized `ReadingPanelProps`, `ReadingPayload`, artwork map, translator, follow-up callback, and saved-reading detail payload.
- Produces: the same DOM behavior and callbacks with a quieter hierarchy: a normal-case takeaway, 760–840px content region, 65–72ch prose, subdued metadata/supporting material, fewer rules, and unchanged follow-up/footer controls.

- [ ] **Step 1: Update i18n labels without hardcoding reading content**

  Use title-case editorial labels such as Vietnamese `Điều quan trọng nhất`, `Điều đáng chú ý`, `Bạn có thể làm gì lúc này?`, `Nhìn sâu hơn`, and `Các lá bài nói gì?`, with natural English equivalents. Leave follow-up copy and behavior unchanged.

- [ ] **Step 2: Add the minimal supporting-content wrapper**

  Wrap only reflection prompts and Tarot evidence in a semantic `reading-supporting` region with a quiet heading. Do not move follow-up, do not change optional rendering conditions, and do not add containers around individual insights, actions, or cards.

- [ ] **Step 3: Remove dashboard/report presentation cues**

  Remove the direct-answer tinted background and uppercase takeaway treatment within the Room reading scope. Reduce question scale to a clear secondary role, retain quiet positions/deck metadata hooks, set the inner editorial grid to approximately 800–840px, preserve 65–72ch prose, remove competing disclosure borders, and retain only meaningful list/support rules.

- [ ] **Step 4: Run focused UI/Room/Saved Reading tests**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-presentation-v1-3.test.ts tests/tarot-reading-presentation-v1-2.test.ts tests/tarot-reading-ui.test.ts tests/tarot-room.test.ts tests/saved-reading-journal.test.ts tests/saved-reading-room.test.ts tests/tarot-saved-reading*.test.ts
  ```

  Expected: PASS with frozen follow-up, Room, Saved Reading, and no-duplicate-numbering contracts intact.

### Task 5: Compatibility and security regression validation

**Files:**
- Modify tests only if a current-new-reading expectation legitimately needs `tarot-reading-v4.2`; never rewrite historical fixtures.
- Read: `lib/tarot-saved-reading.ts`, repository hydration tests, `tests/request-identity.test.ts`, `tests/f001-identity-boundary.test.ts`.

**Interfaces:**
- Consumes: v4.2 current payload metadata and existing v2/v3/v4.1 stored payload fixtures.
- Produces: evidence that new readings persist, historical readings reopen, and saved-reading reopen remains provider-free and owner-scoped.

- [ ] **Step 1: Run compatibility/security tests**

  Run:

  ```bash
  npx tsx --test tests/saved-reading-*.test.ts tests/tarot-saved-reading*.test.ts tests/tarot-repository.test.ts tests/tarot-migration.test.ts tests/request-identity.test.ts tests/f001-identity-boundary.test.ts
  ```

- [ ] **Step 2: Verify source-level frozen boundaries**

  Confirm the staged diff contains no provider configuration, schema, KB, migration, follow-up prompt, Room stage, auth, or persistence implementation changes beyond current-version test expectations.

### Task 6: One optional provider smoke test and final validation

**Files:**
- Create only a temporary ignored/local smoke-test artifact if the existing repository path requires one; do not commit raw provider output or secrets.
- Do not modify source based on a single smoke result.

**Interfaces:**
- Consumes: configured local DeepSeek runtime and one representative Vietnamese Tarot input using existing valid session/card context.
- Produces: one sanitized actual parsed v4.2 payload review, latency/token metadata when available, and a qualitative voice assessment with no chain-of-thought.

- [ ] **Step 1: Check provider configuration without printing values**

  Record only PRESENT/MISSING for selected provider, model, and key. If unavailable, skip the smoke call and report why.

- [ ] **Step 2: Make at most one provider-backed Vietnamese reading request**

  Use a realistic self-direction or relationship question and the existing safe direct non-persisting path. Do not generate a second reading and do not persist production data.

- [ ] **Step 3: Evaluate the actual result**

  Review customer-first ordering, natural Vietnamese, abstraction, card-name frequency, repetition, title clarity, action specificity, deeper-reading novelty, third-party calibration, and anti-redraw language. Preserve exact generated excerpts for the final report only if the provider call occurred.

- [ ] **Step 4: Run the complete deterministic validation**

  Run:

  ```bash
  npx tsx --test tests/tarot-reading-voice-v1-3.test.ts tests/tarot-reading-presentation-v1-3.test.ts tests/tarot-reading-ui.test.ts tests/tarot-room.test.ts tests/saved-reading-*.test.ts tests/tarot-saved-reading*.test.ts tests/request-identity.test.ts tests/f001-identity-boundary.test.ts
  npx tsx --test tests/tarot*.test.ts
  git ls-files -z 'tests/*.test.ts' | xargs -0 npx tsx --test
  npx tsc --noEmit
  npm run build
  git diff --check
  ```

- [ ] **Step 5: Perform visual QA at 1440×900, 1280×720, 390×844, and 375×812**

  Use the built local runtime and a safe existing reading fixture or the one smoke result only. Capture header/main answer, insights, actions, supporting material, follow-up/footer, mobile top, and mobile lower content. Verify only one visible ordinal, quiet metadata/deck, normal-case headings, no dashboard takeaway, reduced separators, unchanged left stage/follow-up, comfortable touch targets, no horizontal overflow, and no host-overlay compensation.

- [ ] **Step 6: Inspect and commit exactly one bounded change**

  Stage only the V1.3 plan, prompt/version/test updates, ReadingPanel/i18n/CSS presentation files, and focused tests. Inspect the staged diff for secrets and frozen-file changes, then commit:

  ```bash
  git diff --cached --check
  git commit -m "feat: refine tarot reading voice and presentation"
  ```
