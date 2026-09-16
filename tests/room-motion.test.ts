import assert from "node:assert/strict";
import test from "node:test";
import { clampPan, clampZoom, pointerCenter, pointerDistance, spreadCardPosition, spreadCardPose, zoomFromPinch } from "../lib/room-motion";

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

test("drawn cards use aligned rows when the reading has more cards than slots", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6].map((index) => spreadCardPosition(index, 3)),
    [
      { x: -250, y: 0 },
      { x: 0, y: 0 },
      { x: 250, y: 0 },
      { x: -250, y: 355 },
      { x: 0, y: 355 },
      { x: 250, y: 355 },
      { x: -250, y: 710 },
    ],
  );
  assert.deepEqual(spreadCardPosition(0, 1), { x: 0, y: 0 });
  assert.deepEqual(spreadCardPosition(3, 1), { x: 0, y: 1065 });
  assert.deepEqual(spreadCardPosition(0, 10), { x: -250, y: 0 });
  assert.deepEqual(spreadCardPosition(3, 10), { x: -250, y: 355 });
});

test("pinch zoom follows the two-finger distance and stays bounded", () => {
  assert.equal(clampZoom(2), 1.5);
  assert.equal(clampZoom(Number.NaN), 1);
  assert.equal(zoomFromPinch(1, 100, 150), 1.5);
  assert.equal(zoomFromPinch(1, 100, 60), 0.6);
  assert.equal(zoomFromPinch(1.2, 0, 150), 1.2);
  assert.deepEqual(pointerCenter({ x: 10, y: 20 }, { x: 30, y: 60 }), { x: 20, y: 40 });
  assert.equal(pointerDistance({ x: 10, y: 20 }, { x: 13, y: 24 }), 5);
});
