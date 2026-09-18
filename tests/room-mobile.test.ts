import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile Room keeps its main composition centered and the deck summary flexible", () => {
  assert.doesNotMatch(source, /room-bottom|room-deck-summary/);
  assert.match(css, /\.room-page \.table-layout\{[^}]*left:50%;[^}]*transform-origin:center/);
  assert.match(css, /\.room-page \.tabletop\{inset:calc\(64px \+ env\(safe-area-inset-top\)\) 0 0/);
  assert.match(css, /\.room-page \.card-fan\{[^}]*bottom:max\(10px,env\(safe-area-inset-bottom\)\)/);
});

test("mobile fan selection keeps swipe-to-draw interaction without a release animation", () => {
  assert.match(source, /fanSwipeProgress\(/);
  assert.match(source, /is-swipe-source/);
  assert.match(source, /onPointerCancel=\{cancelFan\}/);
  assert.match(css, /\.room-page \.fan-card\.is-swipe-source/);
  assert.doesNotMatch(source, /fanReleaseOrigin|setDeal|dealTimer/);
  assert.doesNotMatch(css, /\.deal-wrap\.fan-release|@keyframes fan-release|@keyframes room-fan-release/);
  assert.doesNotMatch(css, /\.deal-wrap\{[^}]*animation:deal-in/);
});
