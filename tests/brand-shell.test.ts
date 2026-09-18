import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shell = readFileSync(new URL("../app/vintarot.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("shared shell uses Logo without changing route destinations", () => {
  assert.ok(shell.includes("@/components/brand/logo"));
  assert.match(shell, /<Logo[^>]+variant=["']dark["']/);
  assert.match(shell, /<footer[\s\S]*<Logo/);

  for (const route of ["/guidebook", "/community", "/daily-spread", "/book", "/journal", "/profile"]) {
    assert.ok(shell.includes(route), route);
  }
});

test("shell exposes responsive brand hooks", () => {
  assert.match(css, /\.brand-logo/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /tagline|brand-tagline/);
});
