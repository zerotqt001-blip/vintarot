import assert from "node:assert/strict";
import test from "node:test";
import { mapCatalogRows, type CatalogRows } from "../lib/tarot-repository";

test("catalog response groups active categories and ordered templates/positions", () => {
  const rows: CatalogRows = {
    categories: [{ id: "cat-planning", slug: "planning", nameEn: "Planning", nameVi: "Lập kế hoạch", descriptionEn: "Plan", descriptionVi: "Lập kế hoạch", icon: "compass", imageUrl: null, displayOrder: 1, active: true }],
    templates: [{ id: "spread-step", categoryId: "cat-planning", slug: "one-small-step", nameEn: "One Small Step", nameVi: "Một bước nhỏ", descriptionEn: "Step", descriptionVi: "Bước", cardCount: 1, spreadType: "single", displayOrder: 0, active: true }],
    positions: [{ id: "pos-focus", templateId: "spread-step", key: "next_step", order: 0, labelEn: "Your focus", labelVi: "Trọng tâm của bạn", descriptionEn: "Focus", descriptionVi: "Trọng tâm", promptEn: "What next?", promptVi: "Tiếp theo là gì?" }],
  };
  const catalog = mapCatalogRows(rows, "en");
  assert.deepEqual(catalog.categories[0].templates[0].positions.map((position) => position.key), ["next_step"]);
  assert.equal(catalog.categories[0].templates[0].cardCount, 1);
  assert.equal(catalog.categories[0].templates[0].name, "One Small Step");
});

test("catalog rejects a template whose position count disagrees with card_count", () => {
  assert.throws(() => mapCatalogRows({ categories: [], templates: [{ id: "spread", categoryId: "cat", slug: "bad", nameEn: "Bad", nameVi: "Sai", descriptionEn: "Bad", descriptionVi: "Sai", cardCount: 2, spreadType: "single", displayOrder: 0, active: true }], positions: [] }, "en"), /position count/i);
});
