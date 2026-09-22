import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = "/Users/tranquangthanh/Documents/ChatGPT/test astra";
const pages = readFileSync(`${root}/app/pages.tsx`, "utf8");
const shell = readFileSync(`${root}/app/vintarot.tsx`, "utf8");
const styles = readFileSync(`${root}/app/globals.css`, "utf8");
const translations = readFileSync(`${root}/lib/i18n.ts`, "utf8");

test("Practice V1 keeps the target shell and existing interaction contracts", () => {
  for (const marker of [
    "practice-v1",
    "practice-v1-guidance",
    "practice-v1-card-meta",
    "practice-v1-step",
    "practice-v1-footer",
  ]) assert.match(pages + shell + styles, new RegExp(marker));

  for (const marker of [
    "practiceNav",
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
