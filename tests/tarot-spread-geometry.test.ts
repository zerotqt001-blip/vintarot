import assert from "node:assert/strict";
import test from "node:test";
import { currentSpreadCatalog, type TarotCatalogCategory, type TarotCatalogTemplate } from "../lib/tarot-catalog";
import { resolveCardPosition, resolveSpreadLayout } from "../lib/room-motion";
import { resolveTarotSpread, type ResolvedTarotSpread } from "../lib/tarot-spread";
import { consumeDrawPlan } from "../lib/tarot-room";
import {
  projectNormalizedSpreadGeometry,
  resolveTarotSpreadGeometry,
  resolveNormalizedSpreadGeometry,
  type SpreadGeometryInput,
} from "../lib/tarot-spread-geometry";

function positions(count: number, prefix = "position"): SpreadGeometryInput[] {
  return Array.from({ length: count }, (_, order) => ({
    key: `${prefix}-${order}`,
    order,
  }));
}

function catalogPositions(slug: string): SpreadGeometryInput[] {
  const template = currentSpreadCatalog.templates.find((item) => item.slug === slug);
  assert.ok(template, `missing template ${slug}`);
  return currentSpreadCatalog.positions
    .filter((position) => position.templateId === template.id)
    .sort((left, right) => left.order - right.order)
    .map((position) => ({ key: position.key, order: position.order }));
}

function resolvedCatalogSpread(slug: string): ResolvedTarotSpread {
  const templateSeed = currentSpreadCatalog.templates.find((item) => item.slug === slug);
  assert.ok(templateSeed, `missing template ${slug}`);
  const categorySeed = currentSpreadCatalog.categories.find((item) => item.id === templateSeed.categoryId);
  assert.ok(categorySeed, `missing category ${templateSeed.categoryId}`);

  const template: TarotCatalogTemplate = {
    ...templateSeed,
    name: templateSeed.name.en,
    description: templateSeed.description.en,
    positions: currentSpreadCatalog.positions
      .filter((position) => position.templateId === templateSeed.id)
      .map((position) => ({
        ...position,
        label: position.label.en,
        description: position.description.en,
        prompt: position.prompt.en,
      })),
  };
  const category: Pick<TarotCatalogCategory, "id" | "slug"> = {
    id: categorySeed.id,
    slug: categorySeed.slug,
  };

  return resolveTarotSpread(category, template);
}

test("normalized spread geometry stays bounded, ordered, and cardinality-safe", () => {
  for (const [layoutKey, count] of [
    ["single", 1],
    ["row-2", 2],
    ["row-3", 3],
    ["row-4", 4],
    ["row-5", 5],
    ["fallback", 6],
    ["fallback", 7],
    ["fallback", 8],
    ["fallback", 9],
    ["fallback", 10],
    ["fallback", 12],
  ] as const) {
    const input = positions(count, layoutKey);
    const resolved = resolveNormalizedSpreadGeometry(layoutKey, input);

    assert.equal(resolved.length, count, `${layoutKey} should resolve ${count} positions`);
    assert.deepEqual(resolved.map((position) => position.order), input.map((position) => position.order));
    assert.deepEqual(resolved.map((position) => position.key), input.map((position) => position.key));
    assert.equal(new Set(resolved.map((position) => position.key)).size, count);
    assert.ok(resolved.every((position) => position.x >= 0 && position.x <= 1));
    assert.ok(resolved.every((position) => position.y >= 0 && position.y <= 1));
  }
});

test("normalized geometry is pure and deterministic for known and fallback layouts", () => {
  const celtic = catalogPositions("celtic-cross");
  const first = resolveNormalizedSpreadGeometry("celtic-cross", celtic);
  const second = resolveNormalizedSpreadGeometry("celtic-cross", celtic);
  assert.deepEqual(first, second);
  assert.equal(first.length, 10);
  assert.notEqual(first[0].rotation, first[1].rotation);
  assert.equal(first[0].x, first[1].x);
  assert.equal(first[0].y, first[1].y);

  const fallback = resolveNormalizedSpreadGeometry("future-layout", positions(12, "future"));
  assert.deepEqual(fallback, resolveNormalizedSpreadGeometry("future-layout", positions(12, "future")));
  assert.equal(new Set(fallback.map((position) => `${position.x}:${position.y}`)).size, 12);
});

test("L1B consumes the resolved L1A contract without duplicating semantic spread data", () => {
  const spread = resolvedCatalogSpread("celtic-cross");
  const geometry = resolveTarotSpreadGeometry(spread);

  assert.equal(geometry.length, spread.cardCount);
  assert.equal(geometry.length, spread.positions.length);
  assert.deepEqual(
    geometry.map(({ key, order }) => ({ key, order })),
    spread.positions.map(({ key, order }) => ({ key, order })),
  );
  assert.equal(spread.positions[0].label, "The Present");
  assert.equal("x" in spread.positions[0], false);
  assert.ok(geometry.every((position) => position.x >= 0 && position.x <= 1));
  assert.ok(geometry.every((position) => position.y >= 0 && position.y <= 1));
});

test("Room compatibility projection accepts the complete resolved L1A spread", () => {
  const spread = resolvedCatalogSpread("celtic-cross");
  const layout = resolveSpreadLayout(spread);

  assert.equal(layout.length, spread.cardCount);
  assert.deepEqual(layout[0], { x: -160, y: 0, scale: 0.62, rotation: 0, zIndex: 1 });
  assert.deepEqual(layout[1], { x: -160, y: 0, scale: 0.62, rotation: 90, zIndex: 2 });
});

test("L1B rejects an inconsistent resolved spread cardinality", () => {
  const spread = resolvedCatalogSpread("celtic-cross");

  assert.throws(
    () => resolveTarotSpreadGeometry({ ...spread, cardCount: spread.cardCount + 1 }),
    /card count/i,
  );
});

test("known semantic layouts remain distinct from generic cardinality fallback", () => {
  const triangle = resolveNormalizedSpreadGeometry("triangle", catalogPositions("give-receive-create"));
  const fallback = resolveNormalizedSpreadGeometry("future-layout", catalogPositions("give-receive-create"));

  assert.ok(triangle[0].y < triangle[2].y);
  assert.equal(triangle[2].x, 0.5);
  assert.notDeepEqual(triangle.map((position) => [position.x, position.y]), fallback.map((position) => [position.x, position.y]));
});

test("normalized geometry projects through arbitrary board bounds without changing composition", () => {
  const geometry = resolveNormalizedSpreadGeometry("row-3", positions(3));
  const projected = projectNormalizedSpreadGeometry(geometry, { width: 400, height: 300 });

  assert.deepEqual(projected.map((position) => position.x), [
    (geometry[0].x - 0.5) * 400,
    (geometry[1].x - 0.5) * 400,
    (geometry[2].x - 0.5) * 400,
  ].map((value) => Number(value.toFixed(2))));
  assert.deepEqual(projected.map((position) => position.y), geometry.map((position) => Number(((position.y - 0.5) * 300).toFixed(2))));
});

test("Room placement helpers share one resolved semantic layout", () => {
  const input = catalogPositions("give-receive-create");
  const layout = resolveSpreadLayout("triangle", input);
  const expected = resolveCardPosition(2, input.length, layout);
  const plan = [{
    readingCardId: "reading-card-2",
    cardId: "card-2",
    cardNumber: 2,
    positionId: "position-2",
    positionKey: input[2].key,
    positionOrder: 2,
    positionLabel: "Creation",
    orientation: "upright" as const,
  }];

  const consumed = consumeDrawPlan(plan, [], 2, input.length, layout);
  assert.deepEqual(consumed?.position, expected);
  assert.deepEqual(consumed?.card && { x: consumed.card.x, y: consumed.card.y }, expected);
});
