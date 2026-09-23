import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

test("shared shell exports one canonical chrome contract", () => {
  const shell = read("components/shell/natarot-shell.tsx");
  assert.match(shell, /export (default )?function NaTarotShell/);
  assert.match(shell, /NaTarotHeader/);
  assert.match(shell, /NaTarotSidebar/);
  assert.match(shell, /NaTarotFooter/);
});

test("shared token layer defines the NaTarot semantic palette", () => {
  const css = read("app/globals.css");
  for (const token of ["--nt-bg-primary", "--nt-surface", "--nt-gold", "--nt-text-primary", "--nt-success"]) {
    assert.match(css, new RegExp(token));
  }
});

test("route wrappers keep protected data sources and destinations", () => {
  assert.match(read("app/packages/page.tsx"), /PackagesPage/);
  assert.match(read("app/affiliate/page.tsx"), /AffiliateDashboardPage/);
  assert.match(read("app/account/page.tsx"), /AccountHistory/);
  assert.match(read("app/commerce/commerce-pages.tsx"), /api\/commercial\/checkout/);
});
