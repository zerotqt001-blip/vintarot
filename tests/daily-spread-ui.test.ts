import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const shellSource = readFileSync(new URL("../components/shell/natarot-shell.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("daily spread uses the celestial shell while preserving its card back", () => {
  assert.match(shellSource, /path === "\/daily-spread"/);
  assert.match(shellSource, /daily-shell/);
  assert.match(pageSource, /daily-cosmic-page/);
  assert.match(pageSource, /daily-stage/);
  assert.match(pageSource, /daily-reflection/);
  assert.match(pageSource, /className="flip-front" aria-hidden=\{!flipped\[index\]\}/);
  assert.match(styles, /\.daily-shell\{/);
  assert.match(styles, /\.daily-shell\{[^]*celestial-observatory\.png/);
  assert.match(styles, /\.daily-shell\{[^]*width:100%;[^]*flex:1 1 auto/);
  assert.match(styles, /\.daily-shell\.site-shell \.site-sidebar/);
  assert.match(styles, /\.daily-shell \.daily-card-slot \.flip-card\{[^]*height:clamp\(213px,22\.5vw,294px\)/);
  assert.match(styles, /\.daily-shell \.top-actions \.button\.black/);
  assert.match(styles, /\.daily-shell \.card-back/);
  assert.match(styles, /url\('\/cards\/vintarot-card-back\.png'\)/);
});
