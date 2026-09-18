import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const roomApiSource = readFileSync(new URL("../app/api/rooms/route.ts", import.meta.url), "utf8");

test("Room exposes Moonlight-style on-table text and spread topic controls", () => {
  assert.match(source, /textMode/);
  assert.match(source, /room-spread-panel/);
  assert.match(source, /room\.returnCards/);
});

test("Room keeps annotation and spread controls out of the pan gesture", () => {
  assert.match(source, /room-text-editor/);
  assert.match(source, /room-text-note/);
  assert.match(source, /room-spread-panel/);
});

test("Shared room state accepts bounded text annotations", () => {
  assert.match(roomApiSource, /texts:\s*z\.array/);
  assert.match(roomApiSource, /text:\s*z\.string\(\)\.max\(500\)/);
});
