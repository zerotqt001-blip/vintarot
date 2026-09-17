import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile Room keeps its main composition centered and the deck summary flexible", () => {
  assert.match(source, /className="room-deck-summary"/);
  assert.match(css, /\.room-page \.table-layout\{[^}]*left:50%;[^}]*transform-origin:center/);
  assert.match(css, /\.room-page \.room-deck-summary\{[^}]*min-width:0/);
  assert.match(css, /\.room-page \.room-bottom[^}]*padding[^}]*env\(safe-area-inset/);
});

test("mobile fan selection keeps a visible swipe release path", () => {
  assert.match(source, /fanSwipeProgress\(/);
  assert.match(source, /is-swipe-source/);
  assert.match(source, /onPointerCancel=\{cancelFan\}/);
  assert.match(css, /\.room-page \.fan-card\.is-swipe-source/);
  assert.match(css, /@keyframes fan-release/);
});
