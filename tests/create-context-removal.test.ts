import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const create = readFileSync(new URL("../app/create/ritual.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("create flow removes the optional context field and tightens the topic layout", () => {
  assert.doesNotMatch(create, /create-context-field|create-optional-context|optionalContext/);
  assert.doesNotMatch(styles, /\.create-context-field/);
  assert.match(styles, /\.create-topic-divider\{margin-top:22px;margin-bottom:20px/);
  assert.match(styles, /\.create-topic-divider\{margin-top:20px;margin-bottom:16px/);
});
