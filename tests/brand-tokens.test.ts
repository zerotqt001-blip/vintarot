import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const projectRoot = new URL("../", import.meta.url);
const brandTokens = [
  "--color-bg-deep",
  "--color-bg",
  "--color-surface",
  "--color-surface-elevated",
  "--color-gold",
  "--color-gold-bright",
  "--color-gold-muted",
  "--color-ivory",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-border-active",
  "--color-focus",
];

test("canonical NaTarot tokens exist", () => {
  for (const token of brandTokens) {
    assert.match(css, new RegExp(`${token}\\s*:`));
  }

  assert.match(css, /--color-bg-deep\s*:\s*#061522/);
  assert.match(css, /--color-gold\s*:\s*#d7b36a/);
  assert.match(css, /--color-ivory\s*:\s*#f4ebdd/);
});

test("stable logo asset paths exist", () => {
  for (const relativePath of [
    "public/brand/natarot-icon.svg",
    "public/brand/natarot-logo-dark.svg",
    "public/brand/natarot-logo-light.svg",
  ]) {
    assert.equal(existsSync(new URL(relativePath, projectRoot)), true, relativePath);
  }
});

test("Logo component exposes the approved variants without embedding a screenshot", () => {
  const logoPath = new URL("../components/brand/logo.tsx", import.meta.url);
  const source = existsSync(logoPath) ? readFileSync(logoPath, "utf8") : "";

  assert.match(source, /variant/);
  assert.match(source, /dark/);
  assert.match(source, /light/);
  assert.match(source, /icon/);
  assert.doesNotMatch(source, /MORE THAN A READING/);
});
