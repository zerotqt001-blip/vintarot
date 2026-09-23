import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/celestial-background.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("practice page uses the Celestial sanctuary composition without replacing its actions", () => {
  for (const className of [
    "practice-cosmic-page",
    "practice-celestial-scene",
    "practice-card-stage",
    "practice-reflection",
    "practice-interpretation",
    "practice-community-card",
  ]) assert.match(pages, new RegExp(className));
  assert.match(pages, /shuffleDeck\(\)\[0\]/);
  assert.match(pages, /cardMeaning\(cards\[id\], locale\)/);
  assert.match(pages, /api\("records"/);
  assert.match(pages, /href="\/room"/);
  assert.match(pages, /cardChanging/);
  assert.match(pages, /practice-card-swap/);
  assert.match(shell, /practice-shell/);
  assert.match(styles, /\.practice-cosmic-page/);
  assert.match(styles, /prefers-reduced-motion[^}]*practice/);
});
