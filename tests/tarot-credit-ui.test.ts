import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { messageFor } from "../lib/i18n";

const room = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");

test("member credit failures have a dedicated bilingual account path", () => {
  for (const locale of ["en", "vi"] as const) {
    const message = messageFor(locale, "room.interpretationCreditsRequired");
    const action = messageFor(locale, "room.interpretationCreditsAction");
    assert.notEqual(message, "room.interpretationCreditsRequired");
    assert.notEqual(action, "room.interpretationCreditsAction");
    assert.match(`${message} ${action}`, /credit|Credit/i);
  }
  assert.match(room, /error\.status===402/);
  assert.match(room, /setInterpretationCreditsRequired\(true\)/);
  assert.match(room, /href="\/account"/);
  assert.match(room, /interpretationCreditsAction/);
});

test("credit exhaustion does not offer a provider retry as the primary action", () => {
  assert.match(room, /interpretationCreditsRequired\s*\?/);
  assert.match(room, /!interpretationCreditsRequired/);
});
