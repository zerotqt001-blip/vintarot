import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

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
