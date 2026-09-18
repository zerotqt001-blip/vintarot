import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { splitReadingParagraphs } from "../lib/reading-text";

const panel = readFileSync(new URL("../components/reading/reading-panel.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/reading/reading-header.tsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../components/reading/tarot-evidence.tsx", import.meta.url), "utf8");
const followUp = readFileSync(new URL("../components/reading/follow-up-reading.tsx", import.meta.url), "utf8");

test("ReadingPanel keeps the personal reading hierarchy in a fixed order", () => {
  for (const component of ["ReadingHeader", "DirectAnswer", "PersonalInsights", "ReflectionPrompts", "NextSteps", "TarotEvidence", "FollowUpReading"]) {
    assert.match(panel, new RegExp(component));
  }

  const order = ["ReadingHeader", "DirectAnswer", "PersonalInsights", "ReflectionPrompts", "NextSteps", "TarotEvidence", "FollowUpReading"]
    .map((component) => panel.indexOf(`<${component}`));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.doesNotMatch(panel, /role=["']tablist/);
  assert.doesNotMatch(panel, /<main[\s>]/);
  assert.doesNotMatch(panel, /<FollowUpReading\s+key=/);
  assert.match(panel, /question=\{followUpQuestion\}/);
  assert.match(panel, /onQuestionChange=\{setFollowUpQuestion\}/);
  assert.match(panel, /<aside[\s\S]*aria-label=/);
  assert.match(panel, /aria-live=["']polite["']/);
  assert.match(header, /<header/);
  assert.match(panel, /reading-panel__scroll/);
  assert.match(panel, /\) : isLoading \?/);
  assert.match(panel, /\) : error \?/);
  assert.match(panel, /reading-question/);
  assert.match(panel, /deeperReading/);
});

test("TarotEvidence uses collapsed native disclosure and safe React text", () => {
  assert.match(evidence, /<details/);
  assert.match(evidence, /<summary/);
  assert.match(evidence, /reading-card-evidence/);
  assert.match(evidence, /alt=/);
  assert.doesNotMatch(evidence, /dangerouslySetInnerHTML|innerHTML/);
});

test("FollowUpReading owns an input, answer list, and injected submit callback", () => {
  assert.match(followUp, /useState/);
  assert.match(followUp, /<input/);
  assert.match(followUp, /value=\{question\}/);
  assert.match(followUp, /onQuestionChange\(event\.target\.value\)/);
  assert.match(followUp, /onSubmit\(/);
  assert.match(followUp, /aria-live/);
  assert.match(followUp, /reading-follow-up-answer/);
});

test("splitReadingParagraphs removes empty entries and caps the primary reading", () => {
  assert.deepEqual(splitReadingParagraphs("  \n\n  "), []);
  assert.deepEqual(splitReadingParagraphs("One long paragraph without a blank line."), ["One long paragraph without a blank line."]);
  assert.deepEqual(
    splitReadingParagraphs(" First  \n\nSecond\n\n\nThird \n\nFourth\n\nFifth "),
    ["First", "Second", "Third", "Fourth"],
  );
  assert.deepEqual(splitReadingParagraphs("<script>alert(1)</script>"), ["<script>alert(1)</script>"]);
});

test("reading components expose the accessible 44px interaction and celestial language", () => {
  const components = [
    "reflection-prompts.tsx",
    "follow-up-reading.tsx",
    "reading-panel.tsx",
  ].map((file) => readFileSync(new URL(`../components/reading/${file}`, import.meta.url), "utf8")).join("\n");

  assert.match(components, /min-h-11/);
  assert.match(components, /focus-visible:ring/);
  assert.match(components, /midnight|navy/);
  assert.match(components, /antique-gold|gold/);
  assert.match(components, /prefers-reduced-motion|motion-reduce/);
});
