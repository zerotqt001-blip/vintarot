import assert from "node:assert/strict";
import test from "node:test";
import { clampPan, spreadCardPose } from "../lib/room-motion";

test("focused spread cards lift with a symmetric 3D tilt", () => {
  const left = spreadCardPose(0, 3, false);
  const middle = spreadCardPose(1, 3, true);
  const right = spreadCardPose(2, 3, false);

  assert.equal(left.tilt, -6);
  assert.equal(middle.tilt, 0);
  assert.equal(right.tilt, 6);
  assert.equal(left.lift, 0);
  assert.ok(middle.lift < 0);
  assert.ok(middle.scale > 1);
  assert.equal(left.tilt, -right.tilt);
});

test("room camera panning stays inside the bounded table", () => {
  assert.deepEqual(clampPan({ x: 480, y: -330 }), { x: 260, y: -260 });
  assert.deepEqual(clampPan({ x: 22, y: -18 }), { x: 22, y: -18 });
});
