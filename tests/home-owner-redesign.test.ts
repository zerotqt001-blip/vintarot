import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const messages = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("Home uses the approved single hierarchy and canonical member destinations", () => {
  assert.match(shell, /className="home-primary-nav"/);
  assert.match(shell, /className="home-header-nav"/);
  assert.match(shell, /className="home-hero"/);
  assert.match(shell, /className="home-value-props"/);
  assert.match(shell, /className="home-footer"/);

  for (const destination of ["/create", "/guidebook", "/community", "/book", "/packages", "/affiliate", "/account"]) {
    assert.match(shell, new RegExp(destination.replaceAll("/", "\\/")), destination);
  }

  assert.doesNotMatch(shell, /<section className="daily-panel"/);
  assert.doesNotMatch(shell, /<section className="feature-row"/);
  assert.match(shell, /!isHome[\s\S]*className="personal-nav"/);
});

test("Home header keeps only the target center navigation and exposes honest controls", () => {
  assert.match(shell, /const homeTopNav = \[\["nav\.decks"[\s\S]*\["nav\.practice"[\s\S]*\["nav\.book"/);
  assert.doesNotMatch(shell, /const homeTopNav = \[\["nav\.home"/);
  assert.match(shell, /Search/);
  assert.match(shell, /home-theme-toggle/);
  assert.match(shell, /href="\/guidebook"[\s\S]*Search/);
  assert.match(shell, /className="home-footer-socials" aria-hidden="true"/);
});

test("Home target copy and responsive surface hooks are localized", () => {
  for (const marker of ["valueSelf", "valueOpenings", "valueAgency", "drawNow", "theme"]) {
    assert.match(messages, new RegExp(marker));
  }
  assert.match(styles, /\.home-hero/);
  assert.match(styles, /\.home-primary-nav/);
  assert.match(styles, /\.home-value-props/);
  assert.match(styles, /\.home-footer/);
  assert.match(styles, /@media\(max-width:1500px\) and \(min-width:701px\)/);
  assert.match(styles, /@media\(max-width:920px\) and \(min-width:701px\)/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /@media\(max-width:430px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});
