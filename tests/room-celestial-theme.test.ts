import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("room theme defines the Celestial Luxury Tarot palette", () => {
  assert.match(css, /--tarot-bg-deep:\s*#06111F/i);
  assert.match(css, /--tarot-bg:\s*#081A2B/i);
  assert.match(css, /--tarot-surface:\s*rgba\(7,\s*20,\s*36,\s*0\.78\)/i);
  assert.match(css, /--tarot-gold:\s*#C7A66A/i);
  assert.match(css, /--tarot-ivory:\s*#EEE7D8/i);
  assert.match(css, /--tarot-text-secondary:\s*#AEB7BE/i);
});

test("room uses the local observatory artwork and layered glass surfaces", () => {
  assert.match(css, /room-page[^\n]*celestial-observatory\.png/);
  assert.match(css, /room-page \.room-guide[^\n]*backdrop-filter:\s*blur\(14px\)/);
  assert.match(css, /room-page \.room-toolbar[^\n]*backdrop-filter:\s*blur\(14px\)/);
  assert.match(css, /room-page \.spread-slot[^\n]*border-color:\s*rgba\(199,\s*166,\s*106/);
  assert.ok(fs.existsSync(path.join(root, "public/room/celestial-observatory.png")));
});

test("room theme keeps interactions and motion accessible", () => {
  assert.match(css, /room-page \.tabletop[^\n]*touch-action:\s*none/);
  assert.match(css, /@media\(prefers-reduced-motion:\s*reduce\)[\s\S]*room-page \.tabletop/);
  assert.match(css, /@media\(max-width:\s*700px\)[\s\S]*room-page \.room-guide/);
});
