import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ReadingPanel } from "../components/reading/reading-panel";
import { splitReadingParagraphs } from "../lib/reading-text";

const panel = readFileSync(new URL("../components/reading/reading-panel.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/reading/reading-header.tsx", import.meta.url), "utf8");
const directAnswer = readFileSync(new URL("../components/reading/direct-answer.tsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../components/reading/tarot-evidence.tsx", import.meta.url), "utf8");
const followUp = readFileSync(new URL("../components/reading/follow-up-reading.tsx", import.meta.url), "utf8");
const room = readFileSync(new URL("../app/room/room.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("ReadingPanel keeps the personal reading hierarchy in a fixed order", () => {
  for (const component of ["ReadingHeader", "ReadingSpread", "DirectAnswer", "PersonalInsights", "ReflectionPrompts", "NextSteps", "TarotEvidence", "FollowUpReading"]) {
    assert.match(panel, new RegExp(component));
  }

  const order = ["ReadingHeader", "ReadingSpread", "DirectAnswer", "PersonalInsights", "NextSteps", "ReflectionPrompts", "TarotEvidence", "FollowUpReading"]
    .map((component) => panel.indexOf(`<${component}`));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.doesNotMatch(panel, /role=["']tablist/);
  assert.doesNotMatch(panel, /<main[\s>]/);
  assert.match(panel, /<FollowUpReading[\s\S]*key=\{followUpResetKey\}/);
  assert.match(panel, /resetEpoch=\{followUpResetKey\}/);
  assert.doesNotMatch(panel, /key=\{followUpQuestion\}/);
  assert.match(panel, /question=\{followUpQuestion\}/);
  assert.match(panel, /onQuestionChange=\{setFollowUpQuestion\}/);
  assert.match(panel, /<aside[\s\S]*aria-label=/);
  assert.match(panel, /aria-live=["']polite["']/);
  assert.match(header, /<header/);
  assert.match(panel, /reading-panel__scroll/);
  assert.match(panel, /deeperReading/);
  assert.match(panel, /reading\.personalInsights\.length > 0/);
  assert.match(panel, /reading\.reflectionPrompts\.length > 0/);
  assert.match(panel, /reading\.nextSteps\.length > 0/);
});

test("ReadingHeader makes the original question the reading title hierarchy", () => {
  assert.match(header, /session\.question/);
  assert.match(header, /reading-header__question/);
  assert.match(header, /<h1 className="reading-header__question/);
  assert.match(header, /reading-header__meta/);
  assert.doesNotMatch(panel, /reading-question/);
});

test("ReadingPanel preserves the real question and spread context while loading, errored, or empty", () => {
  const states = [
    { isLoading: true, error: null },
    { isLoading: false, error: "Reading could not be completed" },
    { isLoading: false, error: null },
  ];
  for (const state of states) {
    const markup = renderToStaticMarkup(createElement(ReadingPanel, {
      reading: null,
      locale: "vi",
      session: { question: "Should I accept the new role?", spreadName: "Three-card spread", deckName: "Moonlight deck" },
      artworkByReadingCardId: {},
      t: (key) => key,
      ...state,
    }));
    assert.match(markup, /reading-header__question/);
    assert.match(markup, /Should I accept the new role\?/);
    assert.match(markup, /Three-card spread/);
    assert.match(markup, /Moonlight deck/);
    if (state.isLoading) assert.match(markup, /reading\.loading/);
    else if (state.error) assert.match(markup, /role="alert">Reading could not be completed/);
    else assert.match(markup, /reading\.emptyTitle/);
  }
});

test("DirectAnswer gives the first deterministic paragraph one editorial takeaway", () => {
  assert.match(directAnswer, /const \[opening, \.\.\.remaining\] = paragraphs/);
  assert.match(directAnswer, /reading-takeaway/);
  assert.match(directAnswer, /reading-direct-answer__body/);
  assert.match(directAnswer, /remaining\.map/);
  assert.match(directAnswer, /reading\.takeaway/);
});

test("Insights and next steps keep all data while making the first two easy to scan", () => {
  const personalInsights = readFileSync(new URL("../components/reading/personal-insights.tsx", import.meta.url), "utf8");
  const nextSteps = readFileSync(new URL("../components/reading/next-steps.tsx", import.meta.url), "utf8");
  for (const component of [personalInsights, nextSteps]) {
    assert.match(component, /slice\(0, 2\)/);
    assert.match(component, /items\.slice\(2\)/);
    assert.match(component, /<details/);
    assert.match(component, /reading\.showMore/);
  }
});

test("Reflection prompts stay secondary inside a collapsed disclosure", () => {
  const reflection = readFileSync(new URL("../components/reading/reflection-prompts.tsx", import.meta.url), "utf8");
  assert.match(reflection, /<details/);
  assert.match(reflection, /<summary/);
  assert.match(reflection, /reading\.reflectionPrompts/);
  assert.match(reflection, /onSelect\(prompt\)/);
});

test("direct answers keep the Room's dark reading surface and readable palette", () => {
  assert.match(directAnswer, /reading-surface--midnight-navy/);
  assert.doesNotMatch(directAnswer, /reading-surface--ivory/);
  assert.match(directAnswer, /text-antique-gold/);
  assert.match(directAnswer, /text-ivory/);
  assert.match(css, /--color-midnight-navy:/);
  assert.match(css, /--color-ivory:/);
  assert.match(css, /--color-antique-gold:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-section--direct-answer\{[^}]*background:linear-gradient\(145deg,rgba\(8,24,40,\.72\),rgba\(5,18,32,\.94\)\)/);
  assert.doesNotMatch(css, /\.room-reading-panel-shell \.reading-section--direct-answer\{[^}]*rgba\(244,238,228/);
});

test("TarotEvidence uses collapsed native disclosure and safe React text", () => {
  assert.match(evidence, /<details/);
  assert.match(evidence, /<summary/);
  assert.match(evidence, /reading-card-evidence/);
  assert.match(evidence, /evidenceDisclosure/);
  assert.match(evidence, /data-reading-card-id/);
  assert.match(evidence, /data-position-key/);
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
  assert.match(followUp, /suggestions\.slice\(0, 3\)/);
  assert.match(followUp, /onQuestionChange\(suggestion\)/);
  assert.match(followUp, /aria-hidden=["']true["']/);
});

test("FollowUpReading exposes a clarification-card action without replacing manual follow-up", () => {
  assert.match(followUp, /onClarificationSubmit/);
  assert.match(followUp, /initialClarifications/);
  assert.match(followUp, /clarifications\.length >= 3/);
  assert.match(followUp, /clarificationLoading/);
  assert.match(followUp, /reading\.clarification/);
  assert.match(followUp, /reading-clarification/);
  assert.match(followUp, /locale/);
  assert.match(followUp, /entry\.card\.nameEn/);
  assert.match(panel, /onClarificationSubmit/);
  assert.match(panel, /supplementaryDraws/);
  assert.match(panel, /locale=\{locale\}/);
  assert.match(room, /api\(['"]tarot\/clarification/);
  assert.match(room, /request_id/);
  assert.match(room, /setInterpretation/);
});

test("follow-up history resets by reading epoch without persisting a transcript", () => {
  assert.match(followUp, /resetEpoch\?: number/);
  assert.match(panel, /key=\{followUpResetKey\}/);
  assert.match(panel, /resetEpoch=\{followUpResetKey\}/);
  assert.doesNotMatch(panel, /key=\{followUpQuestion\}/);
  assert.doesNotMatch(followUp, /sessionStorage|localStorage|records|tarot\/follow-up/);
  assert.match(room, /followUpResetKey=\{readingEpoch\.current\}/);
});

test("persisted clarification results are merged into the active reading snapshot", () => {
  assert.match(room, /supplementaryDraws/);
  assert.match(room, /clarification\.requestId/);
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

test("Room Reading Result uses the current production overview and interpretation grids", () => {
  assert.match(room, /ReadingPanel/);
  assert.doesNotMatch(room, /InterpretationTab|room-interpretation-tabs|interpretationOverviewTab/);
  assert.match(css, /\.reading-panel/);
  assert.ok(css.includes(".room-reading-panel-shell .reading-result-overview{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(250px,.72fr)"));
  assert.ok(css.includes(".room-reading-panel-shell .reading-result-content{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(276px,.76fr)"));
  assert.ok(css.includes(".room-reading-panel-shell .reading-result-content__rail .reading-section--follow-up{position:sticky;top:10px"));
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /safe-area-inset/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /reading-card-evidence/);
});

test("Reading Result owns the canvas under the shared header", () => {
  assert.ok(css.includes(".room-page.has-interpretation .room-reading-panel-shell{position:fixed;top:62px;right:0;bottom:0;left:0"));
  assert.ok(css.includes(".room-reading-panel-shell .reading-result-toolbar{position:sticky;top:0"));
  assert.ok(css.includes(".room-reading-panel-shell .reading-panel__scroll{flex:1 1 auto;min-width:0"));
  assert.match(css, /reading-result-overview[\s\S]*reading-result-meta/);
});

test("V1.1 makes the question subordinate and the takeaway editorial", () => {
  assert.match(css, /\.room-reading-panel-shell \.reading-header__question\{[^}]*font-size:clamp\(1\.4rem,2\.1vw,2rem\)/);
  assert.match(css, /\.room-reading-panel-shell \.reading-header__question\{[^}]*max-width:38ch/);
  assert.match(css, /\.room-reading-panel-shell \.reading-takeaway\{[^}]*border:0;[^}]*border-top:1px solid/);
  assert.match(css, /\.room-reading-panel-shell \.reading-takeaway\{[^}]*box-shadow:none/);
});

test("V1.1 keeps prose measured and reserves a real footer boundary", () => {
  assert.match(css, /\.room-reading-panel-shell \.reading-direct-answer__body,\.room-reading-panel-shell \.reading-section--deeper-reading p,\.room-reading-panel-shell \.reading-follow-up-answer p\{[^}]*max-width:72ch/);
  assert.match(css, /\.room-reading-panel-shell \.reading-panel__scroll\{[^}]*scroll-padding-bottom:clamp\(28px,4vh,48px\)/);
  assert.match(css, /\.room-reading-panel-shell \.reading-panel__actions\{[^}]*flex:0 0 auto/);
  assert.match(css, /\.room-reading-panel-shell \.reading-panel__actions\{[^}]*position:relative/);
});

test("V1.1 keeps mobile reading content clear of the action footer", () => {
  assert.match(css, /\.room-reading-panel-shell \.reading-header__question\{[^}]*font-size:clamp\(1\.5rem,7\.5vw,2rem\)/);
  assert.match(css, /@media\(max-width:768px\)\{[\s\S]*?\.room-reading-panel-shell \.reading-panel__scroll\{[^}]*padding-bottom:clamp\(24px,6vw,36px\)/);
});

test("final V1.1 polish aligns reading content to one centered editorial grid", () => {
  assert.match(css, /\.room-reading-panel-shell \.reading-section\{[^}]*width:100%;max-width:none/);
  assert.match(css, /\.room-reading-panel-shell \.brand-reading-section\{[^}]*--reading-content-width:min\(100%,800px\)/);
  assert.match(css, /\.room-reading-panel-shell \.brand-reading-section>\*\{[^}]*width:100%;max-width:var\(--reading-content-width\);[^}]*margin-inline:auto/);
  assert.match(css, /\.room-reading-panel-shell \.reading-takeaway\{[^}]*padding:clamp\(22px,2\.8vw,36px\) clamp\(18px,2vw,28px\) clamp\(30px,3\.5vw,44px\)/);
  assert.match(css, /\.room-reading-panel-shell \.reading-panel__actions\{[^}]*--reading-grid-gutter:max\(clamp\(24px,3\.6vw,48px\),calc\(\(100% - 800px\)\/2\)\);[^}]*padding-inline:var\(--reading-grid-gutter\)/);
});

test("final V1.1 polish lets the scroll region size to content before it shrinks", () => {
  assert.match(css, /\.room-reading-panel-shell \.reading-panel__scroll\{[^}]*flex:0 1 auto;[^}]*padding-bottom:clamp\(28px,4vh,48px\)/);
  assert.match(css, /@media\(max-width:768px\)\{[\s\S]*?\.room-reading-panel-shell \.reading-panel__scroll\{[^}]*flex:0 1 auto;[^}]*padding-bottom:clamp\(24px,6vw,36px\)/);
});
