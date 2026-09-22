import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const header = read("components/reading/reading-header.tsx");
const insights = read("components/reading/personal-insights.tsx");
const nextSteps = read("components/reading/next-steps.tsx");
const followUp = read("components/reading/follow-up-reading.tsx");
const room = read("app/room/room.tsx");
const css = read("app/globals.css");

test("V1.2 gives header metadata separate editorial roles", () => {
  assert.match(header, /reading-header__positions/);
  assert.match(header, /reading-header__deck/);
  assert.match(header, /data-reading-meta=["']positions["']/);
  assert.match(header, /data-reading-meta=["']deck["']/);
});

test("V1.2 renders one explicit padded ordinal for editorial rows", () => {
  for (const component of [insights, nextSteps]) {
    assert.match(component, /reading-editorial-list__index/);
    assert.match(component, /padStart\(2, ["']0["']\)/);
  }
  assert.doesNotMatch(css, /counter\(reading-row\)|counter-reset:reading-row|counter-increment:reading-row/);
});

test("V1.2 scopes compact header, quiet metadata, and editorial rhythm to the reading shell", () => {
  assert.match(css, /\.room-reading-panel-shell \.brand-reading-header\{[^}]*padding:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-header__meta\{[^}]*letter-spacing:\.[0-9]/);
  assert.match(css, /\.room-reading-panel-shell \.reading-header__positions\{[^}]*color:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-header__deck\{[^}]*color:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-direct-answer__body\{[^}]*margin-top:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-section--deeper-reading,[^}]*padding-block:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-editorial-list__item\{[^}]*padding:/);
  assert.match(css, /\.room-reading-panel-shell \.reading-direct-answer__body,[^}]*max-width:72ch/);
  assert.match(css, /@media\(max-width:768px\)\{[\s\S]*?\.room-reading-panel-shell \.reading-header__meta\{[^}]*font-size:/);
});

test("V1.2 leaves the approved follow-up and left-stage boundaries intact", () => {
  assert.match(followUp, /visibleSuggestions = suggestions\.slice\(0, 3\)/);
  assert.match(followUp, /reading-follow-up__suggestions/);
  assert.match(followUp, /reading-follow-up-input/);
  assert.match(room, /<ReadingPanel[\s\S]*onFollowUpSubmit=\{readingComplete\?submitFollowUp:undefined\}/);
  assert.match(room, /className=\"room-reading-panel-shell\"/);
});
