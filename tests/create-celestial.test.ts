import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = "/Users/tranquangthanh/Documents/ChatGPT/test astra";
const create = readFileSync(`${root}/app/create/ritual.tsx`, "utf8");
const styles = readFileSync(`${root}/app/globals.css`, "utf8");

test("create ritual renders a data-driven celestial topic flow", () => {
  for (const className of [
    "create-cosmic-page",
    "create-celestial-scene",
    "create-topic-orb",
    "create-question-capsule",
    "create-suggestion-card",
  ]) assert.match(create, new RegExp(className));
  assert.match(create, /topicConfig/);
  assert.match(create, /messages\[locale\]\.create\.suggestions\[selectedTopic/);
  assert.match(create, /topic:/);
  assert.match(create, /currentQuestion/);
  assert.match(create, /selectedTopic/);
  assert.match(create, /lastTopic/);
  assert.match(styles, /\.create-shell/);
  assert.match(styles, /prefers-reduced-motion[^}]*create/);
});

test("create ritual exposes the NaTarot reference composition for both steps", () => {
  for (const className of [
    "create-flow-shell",
    "create-step-rail",
    "create-step-panel",
    "create-question-form",
    "create-topic-cluster",
    "create-suggestion-list",
    "create-transition-orchestrator",
  ]) assert.match(create, new RegExp(className));
  assert.match(create, /data-step="topics"/);
  assert.match(create, /data-step="suggestions"/);
  assert.match(create, /aria-pressed=\{lastTopic === key\}/);
  assert.match(create, /create-topic-identity/);
  assert.match(styles, /\.create-flow-shell/);
  assert.match(styles, /\.create-step-panel/);
  assert.match(styles, /\.create-transition-orchestrator/);
  assert.match(styles, /\.create-shell\{[^}]*width:100%/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("create ritual keeps the two-step transition keyboard-accessible", () => {
  assert.match(create, /useEffect/);
  assert.match(create, /useRef/);
  assert.match(create, /questionHeadingRef\.current\?\.focus\(\)/);
  assert.match(create, /tabIndex=\{-1\}/);
  assert.match(create, /role="group"/);
  assert.match(create, /setLastTopic\(key\)/);
  assert.match(create, /setSelectedTopic\(key\)/);
  assert.match(create, /setSelectedTopic\(null\)/);
  assert.match(create, /begin\(suggestion, selectedTopic\)/);
  assert.match(styles, /\.create-shell \.main\{padding:0 10px 35px\}/);
  assert.match(styles, /\.create-suggestion-card \.create-suggestion-star\{opacity:1\}/);
  assert.match(styles, /\.create-suggestion-card>svg:last-child\{[^}]*opacity:1/);
});
