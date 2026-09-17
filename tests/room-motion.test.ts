import assert from "node:assert/strict";
import test from "node:test";
import { clampPan, clampZoom, fanReleaseOrigin, fanSwipeProgress, pointerCenter, pointerDistance, spreadCardPosition, spreadCardPose, zoomFromPinch } from "../lib/room-motion";

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

test("fan swipe progress distinguishes a touch drag from a tap", () => {
  assert.deepEqual(fanSwipeProgress({ x: 120, y: 700 }, { x: 124, y: 706 }), {
    dx: 4,
    dy: 6,
    distance: 7.21,
    active: false,
    progress: 0.4,
  });
  assert.deepEqual(fanSwipeProgress({ x: 120, y: 700 }, { x: 180, y: 640 }), {
    dx: 60,
    dy: -60,
    distance: 84.85,
    active: true,
    progress: 1,
  });
});

test("fan release origin is measured from the selected card to its fixed spread slot", () => {
  assert.deepEqual(
    fanReleaseOrigin(
      { left: 100, top: 600, width: 80, height: 130 },
      { left: 0, top: 100, width: 900, height: 600 },
      { x: -250, y: 0 },
      1,
    ),
    { x: -60, y: 488, scale: 0.364 },
  );

  assert.deepEqual(
    fanReleaseOrigin(
      { left: 100, top: 600, width: 80, height: 130 },
      { left: 0, top: 100, width: 900, height: 600 },
      { x: 0, y: 0 },
      1,
      { x: 160, y: 500 },
    ),
    { x: -290, y: 323, scale: 0.364 },
  );
});
