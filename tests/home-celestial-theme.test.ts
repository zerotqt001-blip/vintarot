import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = process.cwd();
const shell = readFileSync(`${root}/app/vintarot.tsx`, "utf8");
const styles = readFileSync(`${root}/app/globals.css`, "utf8");
const i18n = readFileSync(`${root}/lib/i18n.ts`, "utf8");

test("homepage renders the NaTarot celestial scene layers and daily ritual content", () => {
  assert.match(shell, /className=\{isHome \? "home-shell"/);
  for (const layer of ["sky", "nebula", "planets", "architecture", "floor", "foreground"]) {
    assert.match(shell, new RegExp(`cosmic-layer cosmic-${layer}`));
  }
  assert.match(shell, /NaTarot/);
  assert.match(shell, /home\.intro/);
  assert.match(shell, /home-hero-phase/);
});

test("homepage defines the midnight blue, antique gold glass palette and responsive motion", () => {
  for (const token of [
    "--na-bg-deep:#030C18",
    "--na-bg-navy:#061629",
    "--na-bg-blue:#09223A",
    "--na-gold:#C9A66B",
    "--na-gold-light:#E5CB98",
    "--na-ivory:#F0EADF",
  ]) {
    assert.match(styles, new RegExp(token));
  }
  assert.match(styles, /vintarot-cosmic-table\.png/);
  assert.match(styles, /backdrop-filter:\s*blur\(16px\)/);
  assert.match(styles, /\.home-shell \.cosmic-layer/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("homepage copy includes the bilingual NaTarot tagline and daily quote", () => {
  assert.match(i18n, /A SPACE BETWEEN YOU AND THE CARDS/);
  assert.match(i18n, /Một không gian để gặp lại trực giác của bạn/);
  assert.match(i18n, /Every card is a doorway, and you hold the key/);
  assert.match(i18n, /Mỗi lá bài là một cánh cửa, và bạn là chìa khóa/);
});
