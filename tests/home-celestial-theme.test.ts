import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/celestial-background.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("homepage renders the NaTarot celestial scene and approved hero hierarchy", () => {
  assert.match(shell, /const shellClassName = variant === "membership"[\s\S]*"home-shell"/);
  assert.match(shell, /className=\{shellClassName\}/);
  for (const layer of ["sky", "nebula", "planets", "architecture", "floor", "foreground"]) {
    assert.match(shell, new RegExp(`cosmic-layer cosmic-${layer}`));
  }
  assert.match(shell, /NaTarot/);
  assert.match(shell, /className="home-hero"/);
  assert.match(shell, /className="home-value-props"/);
  assert.match(shell, /hero-phase/);
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

test("homepage copy includes the bilingual NaTarot tagline and value language", () => {
  assert.match(i18n, /A SPACE BETWEEN YOU AND THE CARDS/);
  assert.match(i18n, /Một không gian để gặp lại trực giác của bạn/);
  assert.match(i18n, /Explore yourself/);
  assert.match(i18n, /Khám phá bản thân/);
});
