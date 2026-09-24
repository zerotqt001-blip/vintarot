import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shell = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-header.tsx",
  "../components/shell/natarot-sidebar.tsx",
  "../components/shell/natarot-footer.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const routeOwners = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("shared shell uses Logo without changing route destinations", () => {
  assert.ok(shell.includes("@/components/brand/logo"));
  assert.match(shell, /<Logo[^>]+variant=["']dark["']/);
  assert.match(shell, /<footer[\s\S]*<Logo/);

  for (const route of ["/guidebook", "/community", "/daily-spread", "/book", "/journal", "/profile"]) {
    assert.ok(`${shell}\n${routeOwners}`.includes(route), route);
  }
});

test("shell exposes responsive brand hooks", () => {
  assert.match(css, /\.brand-logo/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /tagline|brand-tagline/);
});

test("medium-width shell compacts the brand lockup before header controls overlap", () => {
  assert.match(css, /@media\(max-width:1100px\) and \(min-width:701px\)[\s\S]*brand-tagline\{display:none\}/);
  assert.match(css, /@media\(max-width:1100px\) and \(min-width:701px\)[\s\S]*brand-lockup\{flex:0 0 auto;/);
});
