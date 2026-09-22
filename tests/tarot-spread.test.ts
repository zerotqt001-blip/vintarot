import assert from "node:assert/strict";
import test from "node:test";
import type { TarotCatalogCategory, TarotCatalogTemplate } from "../lib/tarot-catalog";
import { resolveTarotSpread } from "../lib/tarot-spread";

const category: TarotCatalogCategory = {
  id: "category-planning",
  slug: "planning",
  name: "Lập kế hoạch",
  description: "Định hướng thực tế.",
  icon: "compass",
  imageUrl: null,
  displayOrder: 4,
  active: true,
  templates: [],
};

function template(overrides: Partial<TarotCatalogTemplate> = {}): TarotCatalogTemplate {
  return {
    id: "spread-planning-step",
    categoryId: category.id,
    slug: "one-small-step",
    name: "Một bước nhỏ",
    description: "Một bước rõ ràng tiếp theo.",
    cardCount: 2,
    spreadType: "row-2",
    displayOrder: 0,
    active: true,
    positions: [
      {
        id: "position-next",
        templateId: "spread-planning-step",
        key: "next_step",
        order: 1,
        label: "Bước tiếp theo",
        description: "Điều nên làm tiếp.",
        prompt: "Bước nào đang mở ra?",
      },
      {
        id: "position-focus",
        templateId: "spread-planning-step",
        key: "focus",
        order: 0,
        label: "Trọng tâm",
        description: "Điều cần được nhìn rõ.",
        prompt: "Điều gì cần tập trung?",
      },
    ],
    ...overrides,
  };
}

test("resolves category and template identity with localized semantic fields", () => {
  const resolved = resolveTarotSpread(category, template());

  assert.deepEqual(resolved, {
    categoryId: "category-planning",
    categorySlug: "planning",
    templateId: "spread-planning-step",
    slug: "one-small-step",
    name: "Một bước nhỏ",
    description: "Một bước rõ ràng tiếp theo.",
    cardCount: 2,
    spreadType: "row-2",
    positions: [
      {
        id: "position-focus",
        templateId: "spread-planning-step",
        key: "focus",
        order: 0,
        label: "Trọng tâm",
        description: "Điều cần được nhìn rõ.",
        prompt: "Điều gì cần tập trung?",
      },
      {
        id: "position-next",
        templateId: "spread-planning-step",
        key: "next_step",
        order: 1,
        label: "Bước tiếp theo",
        description: "Điều nên làm tiếp.",
        prompt: "Bước nào đang mở ra?",
      },
    ],
  });
});

test("rejects a template that does not belong to the supplied category", () => {
  assert.throws(
    () => resolveTarotSpread(category, template({ categoryId: "category-everyday" })),
    /category/i,
  );
});

test("rejects a card count that disagrees with the resolved positions", () => {
  assert.throws(
    () => resolveTarotSpread(category, template({ cardCount: 3 })),
    /position count/i,
  );
});

test("does not mutate the catalog input while producing deterministic order", () => {
  const source = template();
  const originalPositions = structuredClone(source.positions);

  const first = resolveTarotSpread(category, source);
  const second = resolveTarotSpread(category, source);

  assert.deepEqual(first, second);
  assert.deepEqual(source.positions, originalPositions);
  assert.notStrictEqual(first.positions, source.positions);
});

test("does not add geometry to the semantic contract", () => {
  const resolved = resolveTarotSpread(category, template());
  const positionKeys = Object.keys(resolved.positions[0]);

  assert.deepEqual(positionKeys, ["id", "templateId", "key", "order", "label", "description", "prompt"]);
  assert.equal("x" in resolved, false);
  assert.equal("y" in resolved, false);
  assert.equal("rotation" in resolved, false);
  assert.equal("scale" in resolved, false);
  assert.equal("zIndex" in resolved, false);
});
