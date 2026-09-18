import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("button variants preserve the shared control contract", () => {
  const source = read("components/ui/button.tsx");

  for (const variant of ["primary", "secondary", "ghost", "icon"]) {
    assert.match(source, new RegExp(`${variant}\\s*:`));
  }

  assert.match(source, /min-h-11|h-11|size-11/);
});

test("input and panel primitives use brand surfaces", () => {
  const input = read("components/ui/input.tsx");
  const panelPath = new URL("../components/ui/panel.tsx", import.meta.url);
  const panel = existsSync(panelPath) ? readFileSync(panelPath, "utf8") : "";
  const css = read("app/globals.css");

  assert.match(input, /bg-(?:brand-)?surface|var\(--color-surface\)/);
  assert.match(input, /var\(--color-focus\)|brand-focus-ring/);
  assert.match(panel, /export (?:const|function) Panel/);
  assert.match(css, /\.brand-panel\s*\{/);
  assert.match(css, /\.brand-icon-button\s*\{/);
});
