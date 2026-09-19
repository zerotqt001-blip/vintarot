import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const shell = readFileSync(join(root, "app/vintarot.tsx"), "utf8");
const styles = readFileSync(join(root, "app/globals.css"), "utf8");

test("home create portal exposes one full-size CTA with a restrained celestial frame", () => {
  assert.match(shell, /className="ritual"[\s\S]*ritual-markers/);
  assert.match(styles, /\.home-shell \.ritual::before/);
  assert.match(styles, /\.home-shell \.ritual::after/);
  assert.match(styles, /\.home-shell \.ritual:active/);
  assert.match(styles, /\.home-shell \.ritual:focus-visible/);
  assert.match(styles, /\.home-shell \.ritual-markers/);
});

test("home navigation uses one accessible celestial icon system", () => {
  assert.match(shell, /data-nav-icon=\{variant\}/);
  assert.match(shell, /aria-current=\{isActive \? "page" : undefined\}/);
  for (const variant of ["home", "cards", "practice", "book"]) {
    assert.match(shell, new RegExp(`"${variant}"`));
  }
  assert.match(styles, /\.home-shell \.nav-orb::before/);
  assert.match(styles, /\.home-shell \.nav-orb::after/);
});

test("mobile home keeps the daily help control at the card edge and protects long labels", () => {
  assert.match(shell, /daily-panel[\s\S]*home-help/);
  assert.match(styles, /\.home-shell \.home-help/);
  assert.match(styles, /\.home-shell \.main-nav \.mobile-nav-label\{[^}]*text-overflow:clip/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("home mobile portal alignment is responsive without touching the Room surface", () => {
  assert.match(styles, /--home-artwork-center-y/);
  assert.match(styles, /--home-portal-size/);
  assert.match(styles, /@media\(max-width:430px\)[\s\S]*--home-portal-size/);
  assert.doesNotMatch(styles, /\.room-page \.ritual/);
});
