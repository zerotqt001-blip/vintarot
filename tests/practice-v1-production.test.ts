import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-header.tsx",
  "../components/shell/natarot-sidebar.tsx",
  "../components/shell/natarot-footer.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("Practice V1 keeps the target shell and existing interaction contracts", () => {
  for (const marker of [
    "practice-v1",
    "practice-v1-guidance",
    "practice-v1-card-meta",
    "practice-v1-step",
    "practice-v1-footer",
  ]) assert.match(pages + shell + styles, new RegExp(marker));

  for (const marker of [
    "practice-v1-icon-button",
    "header.search",
    "header.theme",
    "nav.drawNow",
    "nav.membership",
    "nav.affiliate",
    "nav.account",
  ]) assert.match(shell + translations, new RegExp(marker));

  assert.match(pages, /shuffleDeck\(\)\[0\]/);
  assert.match(pages, /cardMeaning\(cards\[id\], locale\)/);
  assert.match(pages, /api\("records"/);
  assert.match(pages, /href="\/room"/);
  assert.match(styles, /prefers-reduced-motion[^}]*practice-v1/);
});
