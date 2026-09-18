import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const roomsRouteSource = readFileSync(new URL("../app/api/rooms/route.ts", import.meta.url), "utf8");

test("Room persistence is available without a ChatGPT user prop", () => {
  assert.doesNotMatch(roomSource, /if\(!user\|\|!ready\.current/);
  assert.doesNotMatch(roomSource, /if\(\(id\|\|token\)&&!user\)/);
  assert.doesNotMatch(roomSource, /async function openInvite\(\)\{if\(!user\)/);
  assert.doesNotMatch(roomSource, /!user\?t\(['"]room\.noSignInStatus/);
  assert.doesNotMatch(roomSource, /if\(pending\.current&&user\)/);
});

test("room members use the resolved member display label", () => {
  assert.match(roomsRouteSource, /\.bind\(crypto\.randomUUID\(\), room\.id, user\.userId, user\.displayName\)/);
  assert.doesNotMatch(roomsRouteSource, /user\.fullName \|\| user\.email\.split/);
});
