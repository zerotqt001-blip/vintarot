import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const shellSource = [
  "../components/shell/natarot-shell.tsx",
  "../components/shell/natarot-sidebar.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

test("home navigation and ritual labels use true arc text", () => {
  assert.match(shellSource, /arc-label/);
  assert.match(shellSource, /<textPath/);
  assert.match(shellSource, /className=\"ritual-label\"/);
  assert.match(shellSource, /curve=\"left\"/);
});
