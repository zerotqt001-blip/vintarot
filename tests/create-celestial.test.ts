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
