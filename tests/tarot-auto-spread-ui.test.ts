import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { messages as copy } from "../lib/i18n";

const root = process.cwd();
const create = readFileSync(`${root}/app/create/ritual.tsx`, "utf8");
const room = readFileSync(`${root}/app/room/room.tsx`, "utf8");
const styles = readFileSync(`${root}/app/globals.css`, "utf8");

test("Create shows an advisory Auto recommendation and hands off exact spread identity", () => {
  assert.match(create, /recommendTarotSpread/);
  assert.match(create, /findCanonicalSpread/);
  assert.match(create, /data-auto-recommendation/);
  assert.match(create, /detectedTopic/);
  assert.match(create, /recommendedSpreadId/);
  assert.match(create, /categoryId/);
  assert.match(create, /spreadTemplateId/);
  assert.match(create, /spreadMode:\s*["']auto["']/);
  assert.match(styles, /\.create-auto-recommendation/);
});

test("Room makes Auto and manual spread selection explicit without changing draw payload authority", () => {
  assert.match(room, /spreadMode/);
  assert.match(room, /recommendTarotSpread/);
  assert.match(room, /chooseAutoSpread/);
  assert.match(room, /spreadMode:\s*["']manual["']/);
  assert.match(room, /spreadMode:\s*["']auto["']/);
  assert.match(room, /category_id:\s*draft\.categoryId/);
  assert.match(room, /spread_template_id:\s*draft\.spreadTemplateId/);
  assert.match(room, /data-spread-mode/);
  assert.match(styles, /\.room-auto-spread-option/);
});

test("Room preserves exact draft selections and makes legacy/manual precedence explicit", () => {
  assert.match(room, /storedSelection/);
  assert.match(room, /storedCanonical/);
  assert.match(room, /templateForTopic\(question,topic\)/);
  assert.match(room, /spreadMode:raw\.spreadMode==='manual'\|\|raw\.spreadMode==='auto'\?raw\.spreadMode:'auto'/);
  assert.match(room, /spreadMode:draft\.spreadMode==='manual'\?'manual':'auto'/);
  assert.match(room, /spreadMode:'manual'/);
  assert.match(room, /spreadMode:'auto'/);
  assert.match(room, /findCanonicalSpread\(recommendation\.categoryId,recommendation\.recommendedSpreadId\)/);
});

test("Auto and recommendation copy exists in both supported locales", () => {
  for (const key of [
    "autoLabel",
    "autoRecommendation",
    "autoDetectedTopic",
    "autoRecommendedSpread",
    "autoReason",
    "autoManual",
  ]) {
    assert.ok(key in copy.en.create, `${key} should exist in English Create copy`);
    assert.ok(key in copy.vi.create, `${key} should exist in Vietnamese Create copy`);
  }
  for (const key of ["autoLabel", "autoReturn", "autoModeHint", "autoManual"]) {
    assert.ok(key in copy.en.room, `${key} should exist in English Room copy`);
    assert.ok(key in copy.vi.room, `${key} should exist in Vietnamese Room copy`);
  }
});
