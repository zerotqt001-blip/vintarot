import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveNormalizedSpreadGeometry } from "../lib/tarot-spread-geometry";
import {
  RESPONSIVE_SPREAD_BOARD_BOUNDS,
  resolveSpreadBoardProjection,
  spreadBoardItemStyle,
} from "../lib/spread-board";

const roomSource = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const boardSource = readFileSync(new URL("../app/room/spread-board.tsx", import.meta.url), "utf8");

function geometryFor(layoutKey: string, count: number) {
  return resolveNormalizedSpreadGeometry(
    layoutKey,
    Array.from({ length: count }, (_, index) => ({
      key: `position-${index + 1}`,
      order: index + 1,
    })),
  );
}

test("responsive projection preserves L1B order, identity, and board bounds", () => {
  const geometry = geometryFor("celtic-cross", 10);
  const projection = resolveSpreadBoardProjection(geometry, { width: 1180, height: 760 });

  assert.equal(projection.positions.length, 10);
  assert.deepEqual(
    projection.positions.map((position) => position.key),
    geometry.map((position) => position.key),
  );
  assert.deepEqual(
    projection.positions.map((position) => position.order),
    geometry.map((position) => position.order),
  );
  assert.equal(new Set(projection.positions.map((position) => position.key)).size, 10);
  for (const position of projection.positions) {
    assert.ok(position.x >= 0 && position.x <= RESPONSIVE_SPREAD_BOARD_BOUNDS.width);
    assert.ok(position.y >= 0 && position.y <= RESPONSIVE_SPREAD_BOARD_BOUNDS.height);
  }
});

test("ten-card and twelve-card spreads keep a readable mobile floor without changing geometry", () => {
  const tenCard = geometryFor("celtic-cross", 10);
  const twelveCard = geometryFor("generic", 12);
  const mobile390 = resolveSpreadBoardProjection(tenCard, { width: 390, height: 720 });
  const mobile375 = resolveSpreadBoardProjection(twelveCard, { width: 375, height: 720 });

  assert.ok(mobile390.scale > 390 / RESPONSIVE_SPREAD_BOARD_BOUNDS.width);
  assert.ok(mobile375.scale > 375 / RESPONSIVE_SPREAD_BOARD_BOUNDS.width);
  assert.ok(mobile390.minimumCardWidth >= 76);
  assert.ok(mobile375.minimumCardWidth >= 76);
  assert.equal(mobile390.positions[0].key, tenCard[0].key);
  assert.equal(mobile375.positions[11].key, twelveCard[11].key);
});

test("bottom fan occlusion produces a bounded board scale and upward offset", () => {
  const projection = resolveSpreadBoardProjection(geometryFor("celtic-cross", 10), {
    width: 1180,
    height: 651,
    topInset: 16,
    bottomInset: 101,
  });

  assert.ok(projection.scale < 1);
  assert.ok(projection.offsetY < 0);
  assert.ok(projection.minimumCardWidth >= 100);
});

test("desktop, tablet, and mobile projection remain deterministic for 1 through 12 cards", () => {
  for (let count = 1; count <= 12; count += 1) {
    const geometry = geometryFor(count === 10 ? "celtic-cross" : "generic", count);
    const desktop = resolveSpreadBoardProjection(geometry, { width: 1440, height: 820 });
    const tablet = resolveSpreadBoardProjection(geometry, { width: 820, height: 720 });
    const mobile = resolveSpreadBoardProjection(geometry, { width: 375, height: 720 });

    assert.equal(desktop.positions.length, count);
    assert.equal(tablet.positions.length, count);
    assert.equal(mobile.positions.length, count);
    assert.ok(desktop.scale >= tablet.scale);
    assert.ok(tablet.scale >= mobile.scale || count >= 10);
    assert.deepEqual(
      mobile.positions.map((position) => position.key),
      geometry.map((position) => position.key),
    );
  }
});

test("slots and drawn cards receive the same projected item geometry", () => {
  const geometry = geometryFor("celtic-cross", 10);
  const projection = resolveSpreadBoardProjection(geometry, { width: 390, height: 720 });

  for (const position of projection.positions) {
    const slotStyle = spreadBoardItemStyle(position);
    const cardStyle = spreadBoardItemStyle(position);
    assert.deepEqual(cardStyle, slotStyle);
  }
});

test("Room delegates every visible spread layer to the normalized SpreadBoard projection", () => {
  assert.match(roomSource, /const spreadGeometry=resolveNormalizedSpreadGeometry\(/);
  assert.match(roomSource, /<SpreadBoard geometry=\{spreadGeometry\}/);
  assert.match(roomSource, /renderSlot=\{renderSpreadSlot\}/);
  assert.match(roomSource, /renderCard=\{renderSpreadCard\}/);
  assert.match(boardSource, /resolveSpreadBoardProjection\(geometry, viewport\)/);
  assert.match(boardSource, /spreadBoardItemStyle\(position\)/);
  assert.match(boardSource, /positionIndex/);
});
