import assert from "node:assert/strict";
import test from "node:test";
import { currentSpreadCatalog } from "../lib/tarot-catalog";
import { deriveTarotSpreadSemantics, localizeTarotSpreadSemantics } from "../lib/tarot-spread-semantics";

function inputFor(template: (typeof currentSpreadCatalog.templates)[number]) {
  const category = currentSpreadCatalog.categories.find((item) => item.id === template.categoryId)!;
  const positions = currentSpreadCatalog.positions
    .filter((position) => position.templateId === template.id)
    .sort((left, right) => left.order - right.order);
  return {
    categorySlug: category.slug,
    categoryName: category.name,
    categoryDescription: category.description,
    template,
    positions,
  };
}

test("every supported spread derives bounded whole-spread semantics", () => {
  for (const template of currentSpreadCatalog.templates) {
    const semantics = localizeTarotSpreadSemantics(deriveTarotSpreadSemantics(inputFor(template)), "en");
    const keys = new Set(inputFor(template).positions.map((position) => position.key));

    assert.ok(semantics.purpose);
    assert.ok(semantics.questionSuitability.length > 0);
    assert.ok(semantics.synthesisGuidance);
    assert.ok(semantics.interpretationEmphasis.length > 0);
    assert.ok(semantics.positionRelationships.length <= 8);
    for (const relationship of semantics.positionRelationships) {
      assert.ok(keys.has(relationship.from), `${template.slug} has an unknown relationship source`);
      assert.ok(keys.has(relationship.to), `${template.slug} has an unknown relationship target`);
      assert.ok(relationship.relation);
    }
  }
});

test("semantics are deterministic, localized, and independent of geometry", () => {
  const template = currentSpreadCatalog.templates.find((item) => item.slug === "yes-or-no")!;
  const seed = deriveTarotSpreadSemantics(inputFor(template));
  assert.deepEqual(seed, deriveTarotSpreadSemantics(inputFor(template)));
  assert.equal(localizeTarotSpreadSemantics(seed, "vi").interpretationStrategy, "branching");
  assert.ok(localizeTarotSpreadSemantics(seed, "vi").purpose.length > 0);
  assert.equal("x" in seed, false);
  assert.equal("rotation" in seed, false);
  assert.ok(seed.positionRelationships.some((relationship) => relationship.from === "if_yes" && relationship.to === "yes_leads_to"));
});

test("known temporal and tension spreads expose their synthesis strategy", () => {
  const timeline = currentSpreadCatalog.templates.find((item) => item.slug === "past-present-future")!;
  const tension = currentSpreadCatalog.templates.find((item) => item.slug === "conflict-bridge-path")!;

  assert.equal(deriveTarotSpreadSemantics(inputFor(timeline)).interpretationStrategy, "timeline");
  assert.equal(deriveTarotSpreadSemantics(inputFor(tension)).interpretationStrategy, "tension-resolution");
});
