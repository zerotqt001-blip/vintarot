import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const panel = read("components/reading/reading-panel.tsx");
const directAnswer = read("components/reading/direct-answer.tsx");
const translations = read("lib/i18n.ts");
const followUp = read("components/reading/follow-up-reading.tsx");
const room = read("app/room/room.tsx");
const css = read("app/globals.css");

test("V1.3 groups supporting material without changing the follow-up path", () => {
  assert.match(panel, /reading-supporting/);
  assert.match(panel, /reading-supporting__title/);
  assert.match(panel, /reading-supporting[\s\S]*ReflectionPrompts[\s\S]*TarotEvidence/);
  assert.match(panel, /reading-supporting__title[\s\S]*supportingMaterial/);
  assert.match(followUp, /visibleSuggestions = suggestions\.slice\(0, 3\)/);
  assert.match(followUp, /reading-follow-up-input/);
  assert.match(room, /<ReadingPanel[\s\S]*onFollowUpSubmit=\{readingComplete\?submitFollowUp:undefined\}/);
});

test("V1.3 uses conversational section labels instead of report-style all caps", () => {
  for (const label of [
    'takeaway: "What matters most"',
    'personalInsights: "What to notice"',
    'nextSteps: "What you can try"',
    'tarotEvidence: "What are the cards saying?"',
    'supportingMaterial: "Look closer"',
    'takeaway: "Điều quan trọng nhất"',
    'personalInsights: "Điều đáng chú ý"',
    'nextSteps: "Bạn có thể thử gì?"',
    'tarotEvidence: "Các lá bài nói gì?"',
    'supportingMaterial: "Nhìn sâu hơn"',
  ]) assert.equal(translations.includes(label), true, `missing translation: ${label}`);
  assert.doesNotMatch(translations, /takeaway: "ĐIỀU QUAN TRỌNG NHẤT"/);
  assert.doesNotMatch(translations, /personalInsights: "NHỮNG ĐIỀU ĐÁNG CHÚ Ý"/);
  assert.doesNotMatch(translations, /nextSteps: "BẠN CÓ THỂ LÀM GÌ LÚC NÀY\?"/);
});

test("V1.3 keeps the answer open and gives supporting Tarot material a quieter rhythm", () => {
  assert.doesNotMatch(directAnswer, /\buppercase\b/);
  assert.match(css, /\.room-reading-panel-shell \.reading-takeaway h3\{[^}]*text-transform:none/);
  assert.match(css, /\.room-reading-panel-shell \.brand-reading-section\{--reading-content-width:min\(100%,820px\)/);
  assert.match(css, /\.room-reading-panel-shell \.reading-supporting\{[^}]*max-width:820px/);
  assert.match(css, /\.room-reading-panel-shell \.reading-supporting \.reading-light-disclosure,[^}]*\{[^}]*border:0/);
  assert.match(css, /\.reading-supporting \.reading-evidence-disclosure\{[^}]*border:0/);
  assert.match(css, /\.room-reading-panel-shell \.reading-supporting \.reading-card-evidence\{[^}]*border-top:0/);
});

test("V1.3 keeps the single explicit 01/02/03 ordinal system", () => {
  const insights = read("components/reading/personal-insights.tsx");
  const nextSteps = read("components/reading/next-steps.tsx");
  assert.match(insights, /String\(offset \+ index \+ 1\)\.padStart\(2, ["']0["']\)/);
  assert.match(nextSteps, /String\(offset \+ index \+ 1\)\.padStart\(2, ["']0["']\)/);
  assert.doesNotMatch(css, /counter\(reading-row\)|counter-reset:reading-row|counter-increment:reading-row/);
});
