import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");

test("Room saves the exact persisted AI reading through the saved-reading endpoint", () => {
  assert.match(roomSource, /api\(['"]tarot\/saved-readings['"]/);
  assert.match(roomSource, /reading_id/);
  assert.doesNotMatch(roomSource, /api\(['"]records['"]/);
  assert.match(roomSource, /savingJournal/);
});
test("guest Room Save uses the existing sign-in flow with a safe room return path", () => {
  assert.match(roomSource, /!user/);
  assert.match(roomSource, /signin-with-chatgpt\?return_to/);
  assert.match(roomSource, /encodeURIComponent/);
});
