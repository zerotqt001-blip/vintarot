import assert from "node:assert/strict";
import test from "node:test";
import { resolveReadingSpreadCardWidth } from "../lib/reading-spread-layout";
import { currentSpreadCatalog } from "../lib/tarot-catalog";
import { projectSpreadGeometry, resolveSpreadGeometry, type SpreadPositionInput } from "../lib/spread-geometry";

function positions(...keys: string[]): SpreadPositionInput[] {
  return keys.map((key, order) => ({ key, order }));
}

function catalogPositions(slug: string): SpreadPositionInput[] {
  const template = currentSpreadCatalog.templates.find((item) => item.slug === slug);
  assert.ok(template, `missing template ${slug}`);
  return currentSpreadCatalog.positions
    .filter((position) => position.templateId === template.id)
    .sort((left, right) => left.order - right.order)
    .map((position) => ({ key: position.key, order: position.order }));
}

test("preserves the canonical four-card row order and spacing", () => {
  const geometry = resolveSpreadGeometry("row-4", positions("gift", "magic", "yearning", "beacon"));
  assert.equal(geometry.canonical, true);
  assert.deepEqual(geometry.points.map((point) => point.key), ["gift", "magic", "yearning", "beacon"]);
  assert.ok(geometry.points[0].normalizedX < geometry.points[1].normalizedX);
  assert.ok(geometry.points[1].normalizedX < geometry.points[2].normalizedX);
  assert.ok(geometry.points[2].normalizedX < geometry.points[3].normalizedX);
});

test("keeps every Celtic Cross point unique, including the crossing card rotation", () => {
  const geometry = resolveSpreadGeometry("celtic-cross", positions(...Array.from({ length: 10 }, (_, index) => `position-${index}`)));
  assert.equal(geometry.points.length, 10);
  assert.equal(new Set(geometry.points.map((point) => `${point.normalizedX}:${point.normalizedY}`)).size, 10);
  assert.equal(geometry.points[1].rotation, 90);
});

test("covers every canonical production spread type without losing position order", () => {
  const expectedTypes = ["celtic-cross", "cross-4", "row-2", "row-3", "row-4", "row-5", "single", "top-1-bottom-3", "triangle", "yes-no"];
  const types = new Set(currentSpreadCatalog.templates.map((template) => template.spreadType));
  assert.deepEqual([...types].sort(), [...expectedTypes].sort());

  for (const template of currentSpreadCatalog.templates) {
    const geometry = resolveSpreadGeometry(template.spreadType, catalogPositions(template.slug));
    assert.equal(geometry.points.length, template.cardCount, template.slug);
    assert.deepEqual(geometry.points.map((point) => point.order), Array.from({ length: template.cardCount }, (_, index) => index), template.slug);
  }
});

test("falls back deterministically for an unknown seven-card geometry", () => {
  const positions7 = positions("one", "two", "three", "four", "five", "six", "seven");
  const first = resolveSpreadGeometry("future-layout", positions7);
  const second = resolveSpreadGeometry("future-layout", positions7);
  assert.equal(first.canonical, false);
  assert.deepEqual(first.points, second.points);
  assert.equal(first.points.length, 7);
});

test("projects readable four-card geometry inside a desktop canvas", () => {
  const geometry = resolveSpreadGeometry("row-4", positions("one", "two", "three", "four"));
  const projection = projectSpreadGeometry(geometry, {
    width: 1100,
    height: 600,
    cardAspectRatio: 400 / 647,
    minCardWidth: 118,
    maxCardWidth: 220,
    mobile: false,
  });

  assert.equal(projection.mode, "geometry");
  assert.equal(projection.cards.length, 4);
  for (const card of projection.cards) {
    assert.ok(card.left >= 0);
    assert.ok(card.top >= 0);
    assert.ok(card.left + card.width <= projection.width + 0.01);
    assert.ok(card.top + card.height <= projection.height + 0.01);
    assert.equal(Number((card.width / card.height).toFixed(3)), Number((400 / 647).toFixed(3)));
  }
});

test("recomposes a ten-card desktop geometry to a readable ordered mobile sequence", () => {
  const geometry = resolveSpreadGeometry("celtic-cross", positions(...Array.from({ length: 10 }, (_, index) => `position-${index}`)));
  const projection = projectSpreadGeometry(geometry, {
    width: 390,
    height: 680,
    cardAspectRatio: 400 / 647,
    minCardWidth: 108,
    maxCardWidth: 174,
    mobile: true,
  });

  assert.equal(projection.mode, "ordered");
  assert.deepEqual(projection.cards.map((card) => card.order), Array.from({ length: 10 }, (_, index) => index));
  for (const card of projection.cards) {
    assert.ok(card.left >= 0);
    assert.ok(card.left + card.width <= projection.width + 0.01);
  }
});

test("recomposes a scaled four-card geometry when mobile cards would become too small", () => {
  const geometry = resolveSpreadGeometry("cross-4", positions("one", "two", "three", "four"));
  const projection = projectSpreadGeometry(geometry, {
    width: 390,
    height: 680,
    cardAspectRatio: 400 / 647,
    minCardWidth: 108,
    maxCardWidth: 174,
    mobile: true,
  });

  assert.equal(projection.mode, "ordered");
  assert.deepEqual(projection.cards.map((card) => card.order), [0, 1, 2, 3]);
});

test("keeps one-, three-, four-, five-, and ten-card readings legible without losing their positions", () => {
  const cases = [
    { type: "single", count: 1 },
    { type: "row-3", count: 3 },
    { type: "row-4", count: 4 },
    { type: "row-5", count: 5 },
    { type: "celtic-cross", count: 10 },
  ];

  for (const { type, count } of cases) {
    const evidence = positions(...Array.from({ length: count }, (_, index) => `position-${index}`));
    const geometry = resolveSpreadGeometry(type, evidence);
    const cardWidth = resolveReadingSpreadCardWidth(count, true);
    const projection = projectSpreadGeometry(geometry, {
      width: 342,
      height: 480,
      cardAspectRatio: 400 / 647,
      ...cardWidth,
      mobile: true,
    });

    assert.deepEqual(projection.cards.map((card) => card.order), Array.from({ length: count }, (_, index) => index), type);
    assert.ok(projection.cards.every((card) => card.width >= cardWidth.minCardWidth), type);
    assert.ok(projection.cards.every((card) => card.left >= 0 && card.left + card.width <= projection.width + 0.01), type);
    if (count > 2) assert.equal(projection.mode, "ordered", type);
  }
});

test("scales display card width to the number of visible positions", () => {
  assert.ok(resolveReadingSpreadCardWidth(1, false).maxCardWidth > resolveReadingSpreadCardWidth(4, false).maxCardWidth);
  assert.ok(resolveReadingSpreadCardWidth(4, false).maxCardWidth > resolveReadingSpreadCardWidth(10, false).maxCardWidth);
  assert.equal(resolveReadingSpreadCardWidth(1, true).maxCardWidth, 140);
  assert.equal(resolveReadingSpreadCardWidth(10, true).maxCardWidth, 140);
});
