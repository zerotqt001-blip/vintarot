import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");

test("room exposes direct tabletop gestures alongside card gestures", () => {
  assert.match(source, /function handleTablePointerDown\(/);
  assert.match(source, /function handleTablePointerMove\(/);
  assert.match(source, /function handleTablePointerUp\(/);
  assert.match(source, /function handleTableWheel\(/);
  assert.match(source, /onPointerDown=\{handleTablePointerDown\}/);
  assert.match(source, /onPointerMove=\{handleTablePointerMove\}/);
  assert.match(source, /onPointerUp=\{handleTablePointerUp\}/);
  assert.match(source, /onWheel=\{handleTableWheel\}/);
  assert.match(source, /pointerDistance\(/);
  assert.match(source, /zoomFromPinch\(/);
});

test("fan drops use the deterministic spread slot helper", () => {
  assert.match(source, /spreadCardPosition\(i,current\.spread\.length\)/);
  assert.match(source, /const i=current\.cards\.length,target=spreadCardPosition/);
});
