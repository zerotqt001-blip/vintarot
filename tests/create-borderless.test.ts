import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Create removes rectangular chrome from its glass shells", () => {
  assert.match(
    styles,
    /\.create-shell \.main-nav,\.create-shell \.personal-nav,\.create-shell \.create-flow-shell\{border:0;box-shadow:none\}/,
  );
});
