import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

 test("guidebook uses the three-screen cosmic card experience", () => {
  for (const className of [
    "guidebook-cosmic-page",
    "guidebook-worlds-page",
    "guidebook-library-page",
    "guidebook-card-detail-page",
    "guidebook-families",
    "guidebook-card-grid",
    "guidebook-narrative",
  ]) {
    assert.match(pages, new RegExp(className));
  }
  assert.match(pages, /history\.replaceState|useSearchParams|window\.location\.search/);
  assert.match(pages, /ArrowLeft/);
  assert.match(pages, /ArrowRight/);
  assert.match(pages, /touchstart|onTouchStart/);
  assert.match(pages, /keydown/);
  assert.match(pages, /cardNarrative\(.*reverse/);
});

test("guidebook tokens and responsive grid match the NaTarot visual system", () => {
  for (const token of [
    "--na-bg:#030D1C",
    "--na-bg-secondary:#071A31",
    "--na-surface:rgba(5, 20, 39, .84)",
    "--na-surface-light:rgba(15, 39, 64, .72)",
    "--na-gold:#C9A66B",
    "--na-gold-light:#E8CE99",
    "--na-gold-border:rgba(201,166,107,.38)",
    "--na-gold-soft:rgba(201,166,107,.12)",
    "--na-ivory:#F1EADF",
    "--na-text:#E8E3DA",
    "--na-text-secondary:#AAB4BE",
    "--na-muted:#738395",
    "--na-shadow:rgba(0,0,0,.40)",
  ]) assert.ok(styles.includes(token), `missing token ${token}`);
  assert.match(styles, /guidebook-card-grid[^}]*grid-template-columns:repeat\(5/);
  assert.ok(styles.includes("@media(max-width:950px)") && styles.includes(".guidebook-card-grid{grid-template-columns:repeat(3"));
  assert.ok(styles.includes("@media(max-width:700px)") && styles.includes(".guidebook-card-grid{grid-template-columns:repeat(2"));
  assert.match(styles, /backdrop-filter:blur\(16px\)/);
  assert.match(styles, /guidebook-cosmic-page[^}]*background/);
  assert.match(styles, /prefers-reduced-motion:reduce[^}]*guidebook/);
});
