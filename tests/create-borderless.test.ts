import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Create removes desktop rectangular chrome while preserving mobile navigation", () => {
  assert.match(
    styles,
    /\.create-shell \.personal-nav,\.create-shell \.create-flow-shell\{border:0;box-shadow:none\}/,
  );
  assert.match(styles, /@media\(min-width:701px\)\{\.create-shell \.main-nav\{border:0;box-shadow:none\}\}/);
});
