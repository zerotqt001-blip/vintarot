import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-header.tsx",
  "../components/shell/natarot-sidebar.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile primary navigation exposes readable labels and preserves Room's dedicated controls", () => {
  assert.match(shell, /path === "\/room"/);
  assert.match(shell, /variant === "immersive"[\s\S]*"site-shell room-shell"/);
  assert.match(shell, /className="nav-label">\{t\(key\)\}<\/span>/);
  assert.match(styles, /\.nt-global-sidebar \.nav-label\{display:block/);
});

test("mobile primary navigation moves to a full-width bottom bar with safe-area spacing", () => {
  assert.match(styles, /\.site-shell:not\(\.room-shell\) \.site-sidebar/);
  assert.match(styles, /top:auto!important/);
  assert.match(styles, /bottom:0!important/);
  assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /\.home-shell \.topbar-nav,\.site-shell:not\(\.room-shell\) \.topbar-nav\{display:none\}/);
  assert.match(styles, /padding-bottom:calc\(104px \+ env\(safe-area-inset-bottom\)\)!important/);
  assert.match(styles, /\.nt-global-sidebar \.nav-label\{display:block/);
});

test("mobile bottom navigation clears the old fixed footer and keeps the page content reachable", () => {
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) footer,\.home-shell footer|\.home-shell footer,\.site-shell:not\(\.room-shell\) footer)\{display:none\}/);
  assert.match(styles, /(?:\.site-shell:not\(\.room-shell\) \.main,\.home-shell \.main|\.home-shell \.main,\.site-shell:not\(\.room-shell\) \.main)\{[^}]*padding-bottom:calc\(/);
});
