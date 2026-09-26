import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { guidebookGroups } from "../lib/tarot";

const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-header.tsx",
  "../components/shell/natarot-sidebar.tsx",
  "../components/shell/natarot-footer.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("the Guidebook composes canonical NaTarot chrome without replacing commerce routes", () => {
  assert.match(shell, /"site-shell guidebook-shell guidebook-target-shell"/);
  assert.match(shell, /<NaTarotHeader\b/);
  assert.match(shell, /<NaTarotSidebar\b/);
  assert.match(shell, /<NaTarotFooter\b/);
  assert.match(shell, /const topNav = \[[\s\S]*\["nav\.decks", "\/guidebook"\]/);

  for (const route of ["/packages", "/affiliate", "/account"]) {
    assert.ok(shell.includes(route), `missing canonical route ${route}`);
  }
  assert.match(shell, /path === "\/guidebook" && href === "\/create"\) return "\/room\?ritual=1"/);
  assert.match(shell, /aria-current/);
  assert.match(pages, /className="guidebook-search"/);
  assert.match(translations, /searchCards:/);
});

test("the Guidebook worlds map keeps canonical five-family counts and target editorial composition", () => {
  assert.deepEqual(
    guidebookGroups.map((group) => [group.suit, group.cardIds.length]),
    [
      ["Major Arcana", 22],
      ["Wands", 14],
      ["Cups", 14],
      ["Swords", 14],
      ["Pentacles", 14],
    ],
  );

  for (const className of [
    "guidebook-target-hero",
    "guidebook-target-map",
    "guidebook-target-center",
    "guidebook-target-node",
    "guidebook-target-editorial",
    "guidebook-target-explore",
  ]) assert.match(pages, new RegExp(className));
  assert.match(pages, /<strong>78<\/strong>/);
  assert.match(pages, /pages\.exploreGroup/);
  assert.match(pages, /value=\{query\} onChange=\{\(event\) => setQuery\(event\.target\.value\)\}/);
  assert.match(pages, /card\.name\.toLowerCase\(\)\.includes\(query\.trim\(\)\.toLowerCase\(\)\)/);
});

test("the Guidebook target is responsive, observatory-backed, and motion-safe", () => {
  assert.match(styles, /\.guidebook-target-shell[^}]*celestial-observatory\.png/);
  assert.match(styles, /\.guidebook-target-sidebar/);
  assert.match(styles, /\.guidebook-target-map[^}]*grid-template-areas/);
  assert.match(styles, /@media\(max-width:700px\)[\s\S]*guidebook-target-map/);
  assert.match(styles, /@media\(max-width:420px\)[\s\S]*guidebook-target-map/);
  assert.match(styles, /@media\(max-height:820px\)[\s\S]*guidebook-target-map/);
  assert.match(styles, /prefers-reduced-motion:reduce[\s\S]*guidebook-target/);
  assert.match(translations, /exploreGroup:/);
});
