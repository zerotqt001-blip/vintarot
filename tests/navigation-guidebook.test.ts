import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shellSource = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const pagesSource = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("the primary cards navigation opens the guidebook directly", () => {
  assert.match(shellSource, /\["nav\.decks", Layers, "\/guidebook"\]/);
  assert.match(shellSource, /\["nav\.decks", "\/guidebook"\]/);
  assert.match(shellSource, /href="\/guidebook">\{t\("home\.explore"\)\}/);
  assert.doesNotMatch(shellSource, /\["nav\.decks"[^\n]*"\/decks"/);
});

test("the legacy decks route resolves to the card guidebook without a deck switcher", () => {
  assert.match(pagesSource, /if \(section === "decks" \|\| section === "guidebook"\) return <Library \/>/);
  assert.match(pagesSource, /function Library\(\) \{\s*return <GuidebookLibrary \/>;\s*\}/);
  assert.doesNotMatch(pagesSource, /function DigitalDecks/);
  assert.doesNotMatch(pagesSource, /TabsTrigger value="decks"/);
});

test("the navigation label is cards only in both locales", () => {
  assert.match(i18nSource, /decks: "Cards"/);
  assert.match(i18nSource, /decks: "Lá bài"/);
  assert.doesNotMatch(i18nSource, /decks: "Cards & decks"/);
  assert.doesNotMatch(i18nSource, /decks: "Lá bài & bộ bài"/);
});
