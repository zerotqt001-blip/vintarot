import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { guidebookGroups } from "../lib/tarot";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("the Guidebook shell exposes the Image 1 NaTarot chrome without replacing commerce routes", () => {
  for (const className of [
    "guidebook-target-shell",
    "guidebook-target-header",
    "guidebook-target-sidebar",
    "guidebook-target-footer",
    "guidebook-target-mobile-nav",
  ]) assert.match(shell, new RegExp(className));

  for (const route of ["/", "/room?ritual=1", "/packages", "/affiliate", "/account"]) {
    assert.ok(shell.includes(route), `missing canonical route ${route}`);
  }
  assert.match(shell, /guidebookTargetNav/);
  assert.match(shell, /guidebook:focus-search/);
  assert.match(shell, /aria-pressed/);
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
  assert.match(pages, /guidebookSearchRef/);
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
