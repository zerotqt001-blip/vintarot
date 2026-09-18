import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const expectedEnvironmentBlock = `TAROT_AI_PROVIDER=openai
OPENAI_API_KEY=replace-with-server-secret
OPENAI_TAROT_MODEL=replace-with-supported-model
GEMINI_API_KEY=replace-with-server-secret
GEMINI_TAROT_MODEL=replace-with-supported-model
DEEPSEEK_API_KEY=replace-with-server-secret
DEEPSEEK_TAROT_MODEL=replace-with-supported-model`;

test("README documents the exact placeholder-only Tarot provider environment", () => {
  assert.ok(readme.includes(expectedEnvironmentBlock));

  const keyAssignments = [...readme.matchAll(/^(OPENAI|GEMINI|DEEPSEEK)_API_KEY=(.+)$/gm)];
  assert.equal(keyAssignments.length, 3);
  for (const assignment of keyAssignments) {
    assert.equal(assignment[2], "replace-with-server-secret");
  }

  assert.doesNotMatch(
    readme,
    /(?:sk-(?:proj-)?|AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,})/,
  );
  assert.doesNotMatch(readme, /NEXT_PUBLIC_(?:OPENAI|GEMINI|DEEPSEEK)_API_KEY/);
});

test("README keeps provider secrets server-side and documents both Tarot routes", () => {
  assert.match(readme, /only the selected provider(?:'s|’s) key\/model pair is required/i);
  assert.match(readme, /all provider keys are server-side secrets/i);
  assert.match(readme, /canonical endpoint[^\n]*`POST \/api\/tarot\/reading`/i);
  assert.match(readme, /`POST \/api\/tarot\/interpret`[^\n]*compatibility alias/i);
  assert.doesNotMatch(
    readme,
    /(?:expose|send|store|place|put)[^\n]{0,80}provider keys?[^\n]{0,80}(?:browser|client|NEXT_PUBLIC_)/i,
  );
});

test("README includes credential-free local verification commands", () => {
  assert.match(readme, /npx tsx --test tests\/tarot-ai\.test\.ts/);
  assert.match(readme, /npx tsc --noEmit/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /npm run lint/);
});
