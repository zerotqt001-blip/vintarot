import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile primary navigation exposes readable labels and preserves Room's dedicated controls", () => {
  assert.match(shell, /const isRoom = path === "\/room";/);
  assert.match(shell, /isRoom \? "site-shell room-shell"/);
  assert.match(shell, /className="mobile-nav-label">\{t\(key\)\}<\/span>/);
});

test("mobile primary navigation moves to a full-width bottom bar with safe-area spacing", () => {
  assert.match(styles, /\.site-shell:not\(\.room-shell\) \.site-sidebar/);
  assert.match(styles, /top:auto!important/);
  assert.match(styles, /bottom:0!important/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.home-shell \.topbar-nav,\.site-shell:not\(\.room-shell\) \.topbar-nav\{display:none\}/);
  assert.match(styles, /padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\)!important/);
  assert.match(styles, /\.mobile-nav-label\{display:block/);
});

test("mobile bottom navigation clears the old fixed footer and keeps the page content reachable", () => {
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) footer,\.home-shell footer|\.home-shell footer,\.site-shell:not\(\.room-shell\) footer)\{display:none\}/);
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) \.main,\.home-shell \.main|\.home-shell \.main,\.site-shell:not\(\.room-shell\) \.main)\{[^}]*padding-bottom:calc\(/);
});

test("Room navigation tucks to the left edge on desktop pointers and opens on hover or keyboard focus", () => {
  assert.ok(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*and\s*\(min-width:\s*821px\)/.test(styles), "Room auto-hide should only target desktop pointer devices");
  assert.ok(/\.room-shell \.site-sidebar\s*\{[^}]*transform:\s*translateX\(calc\(-100% \+ 14px\)\)/s.test(styles), "Room navigation should leave a 14px edge trigger");
  assert.ok(/\.room-shell \.site-sidebar:hover\s*,\s*\.room-shell \.site-sidebar:focus-within\s*\{[^}]*transform:\s*translateX\(0\)/s.test(styles), "Hover and keyboard focus should reveal Room navigation");
});
