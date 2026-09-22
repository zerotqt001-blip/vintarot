import assert from "node:assert/strict";
import { test } from "node:test";
import { currentSpreadCatalog } from "../lib/tarot-catalog";
import {
  findCanonicalSpread,
  recommendTarotSpread,
  tarotTopics,
  type TarotTopic,
} from "../lib/tarot-recommendation";

test("detects a Vietnamese relationship question and recommends the canonical unclear-feelings spread", () => {
  const result = recommendTarotSpread("Người ấy còn tình cảm với tôi không?");

  assert.equal(result.detectedTopic, "relationships");
  assert.equal(result.categoryId, "category-relationships");
  assert.equal(result.recommendedSpreadId, "spread-relationships-unclear-feelings");
  assert.equal(result.mode, "auto");
  assert.equal(result.confidence, "high");
});

test("detects an English career decision and recommends Career Crossroads", () => {
  const result = recommendTarotSpread("Should I take this new career opportunity?");

  assert.equal(result.detectedTopic, "work");
  assert.equal(result.intent, "CAREER");
  assert.equal(result.recommendedSpreadId, "spread-planning-career-crossroads");
});

test("maps finance language to the existing work/business taxonomy", () => {
  const result = recommendTarotSpread("How should I approach my debt and budget?");

  assert.equal(result.detectedTopic, "work");
  assert.equal(result.intent, "FINANCE");
  assert.equal(result.categoryId, "category-business");
  assert.equal(result.recommendedSpreadId, "spread-business-strategic-overview-swot");
  assert.notEqual(result.detectedTopic, "finance");
});

test("handles mixed-language obstacle wording with a deterministic creative unblocker", () => {
  const result = recommendTarotSpread("What is blocking dòng sáng tạo của tôi?");

  assert.equal(result.detectedTopic, "creativity");
  assert.equal(result.intent, "OBSTACLE");
  assert.equal(result.recommendedSpreadId, "spread-creativity-getting-unstuck");
  assert.equal(result.confidence, "high");
});

test("uses a catalog-valid general fallback for empty and insufficient questions", () => {
  const empty = recommendTarotSpread("");
  const short = recommendTarotSpread("Why?");

  for (const result of [empty, short]) {
    assert.equal(result.detectedTopic, "idk");
    assert.equal(result.categoryId, "category-everyday");
    assert.equal(result.recommendedSpreadId, "spread-everyday-persona-obstacle-solution");
    assert.equal(result.confidence, "low");
  }
});

test("matches short signals by word boundary instead of substring", () => {
  const direction = recommendTarotSpread("What is next for me?");
  const neutral = recommendTarotSpread("How do I know what to do?");
  assert.equal(direction.detectedTopic, "idk");
  assert.equal(direction.recommendedSpreadId, "spread-planning-past-present-future");
  assert.equal(neutral.detectedTopic, "idk");
});

test("respects an explicitly selected existing topic over detected wording", () => {
  const result = recommendTarotSpread("Người ấy còn tình cảm với tôi không?", "work");

  assert.equal(result.detectedTopic, "work");
  assert.equal(result.categoryId, "category-business");
});

test("returns deterministic results and every topic resolves through the canonical catalog", () => {
  const question = "What should I learn from this change?";
  assert.deepEqual(recommendTarotSpread(question), recommendTarotSpread(question));

  for (const topic of tarotTopics) {
    const result = recommendTarotSpread("", topic as TarotTopic);
    const resolved = findCanonicalSpread(result.categoryId, result.recommendedSpreadId);

    assert.ok(resolved, `missing canonical spread for ${topic}`);
    assert.equal(resolved.template.categoryId, resolved.category.id);
    assert.equal(resolved.template.cardCount, resolved.positions.length);
  }
});

test("canonical lookup rejects mismatched or unknown identities without inventing a spread", () => {
  assert.equal(findCanonicalSpread("category-business", "spread-relationships-unclear-feelings"), null);
  assert.equal(findCanonicalSpread("category-missing", "spread-missing"), null);
  assert.equal(currentSpreadCatalog.templates.some((template) => template.id === "spread-missing"), false);
});
