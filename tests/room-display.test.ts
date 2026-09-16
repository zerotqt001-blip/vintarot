import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cardMeaning, cards } from "../lib/tarot";

test("Vietnamese room guidance uses localized tarot meaning copy", () => {
  const queenOfCups = cards.find((card) => card.name === "Queen of Cups");
  assert.ok(queenOfCups);
  const meaning = cardMeaning(queenOfCups, "vi");

  assert.match(meaning.keywords, /trắc ẩn|cảm xúc/);
  assert.match(meaning.upright, /Lá bài|chủ đề|bước tiếp theo/);
  assert.doesNotMatch(meaning.upright, /This card brings attention/);
  assert.doesNotMatch(meaning.reversed, /Look inward/);
});

test("Room face-up cards preserve the Moonlight frame without an extra border", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const roomImageRule = css.match(/\.room-front img\{([^}]*)\}/)?.[1] ?? "";

  assert.match(roomImageRule, /border:0/);
  assert.match(css, /\.drawn-card\{width:220px;height:356px/);
});
