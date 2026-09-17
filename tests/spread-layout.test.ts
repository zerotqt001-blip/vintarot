import assert from "node:assert/strict";
import test from "node:test";
import { currentSpreadCatalog } from "../lib/tarot-catalog";
import { resolveSpreadLayout } from "../lib/room-motion";

function template(slug: string) {
  const result = currentSpreadCatalog.templates.find((item) => item.slug === slug);
  assert.ok(result, `missing template ${slug}`);
  return {
    ...result,
    positions: currentSpreadCatalog.positions.filter((position) => position.templateId === result.id).sort((left, right) => left.order - right.order),
  };
}

test("Moonlight catalog contains every topic and all inspected child spreads", () => {
  assert.deepEqual(currentSpreadCatalog.categories.map((category) => category.slug), [
    "blank",
    "everyday",
    "self-care",
    "relationships",
    "planning",
    "moon-phase",
    "creativity",
    "business",
    "fools-journey",
  ]);
  assert.equal(currentSpreadCatalog.templates.length, 57);
  const blankCategory = currentSpreadCatalog.categories.find((category) => category.slug === "blank");
  assert.ok(blankCategory);
  assert.equal(currentSpreadCatalog.templates.filter((item) => item.categoryId === blankCategory.id).length, 0);
  assert.deepEqual(currentSpreadCatalog.templates.filter((item) => item.categoryId === "category-everyday").map((item) => item.slug), [
    "persona-obstacle-solution", "how-to-handle-it", "give-receive-create", "todays-forecast", "what-to-look-forward-to",
    "energy-refresh", "progress-check", "yesterday-today-tomorrow", "last-night-this-morning", "my-energy-today",
  ]);
  assert.equal(currentSpreadCatalog.templates.reduce((sum, item) => sum + item.cardCount, 0), currentSpreadCatalog.positions.length);
  assert.ok(currentSpreadCatalog.templates.every((item) => item.spreadType.length > 0));
});

test("semantic layout resolver preserves representative Moonlight arrangements", () => {
  const row = resolveSpreadLayout("row-3", template("persona-obstacle-solution").positions);
  assert.deepEqual(row.map((item) => item.x), [-250, 0, 250]);
  assert.ok(row.every((item) => item.y === 0));

  const triangle = resolveSpreadLayout("triangle", template("give-receive-create").positions);
  assert.ok(triangle[0].y < triangle[2].y && triangle[1].y < triangle[2].y);
  assert.equal(triangle[0].y, triangle[1].y);
  assert.equal(triangle[2].x, 0);

  const topAndBottom = resolveSpreadLayout("top-1-bottom-3", template("creativity-work-relationships").positions);
  assert.equal(topAndBottom[0].x, 0);
  assert.equal(topAndBottom[0].y < topAndBottom[1].y, true);
  assert.deepEqual(topAndBottom.slice(1).map((item) => item.y), [topAndBottom[1].y, topAndBottom[1].y, topAndBottom[1].y]);

  const branches = resolveSpreadLayout("yes-no", template("yes-or-no").positions);
  assert.equal(branches[0].y, branches[1].y);
  assert.ok(branches[2].y > branches[0].y && branches[3].y > branches[0].y);
  assert.ok(branches[2].x < branches[3].x);

  const cross = resolveSpreadLayout("celtic-cross", template("celtic-cross").positions);
  assert.equal(cross.length, 10);
  assert.equal(new Set(cross.map((item) => `${item.x}:${item.y}:${item.rotation}`)).size, 10);

  const row4 = resolveSpreadLayout("row-4", template("attracting-love").positions);
  const row5 = resolveSpreadLayout("row-5", template("product-market-fit").positions);
  assert.notDeepEqual(row4.map((item) => item.x), row5.map((item) => item.x));
  assert.ok(row5.every((item) => (item.scale ?? 1) < (row4[0].scale ?? 1)));
});
