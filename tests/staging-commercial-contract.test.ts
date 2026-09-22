import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(new URL("../scripts/seed-staging-commercial.mjs", import.meta.url), "utf8");

test("commercial staging seed is fail-closed to the isolated sandbox database", () => {
  assert.match(script, /NATAROT_STAGING_SEED !== "1"/);
  assert.match(script, /natarot-staging\\\/natarot\\.sqlite/);
  assert.match(script, /SEPAY_ENVIRONMENT.*sandbox/);
  assert.match(script, /package-staging-sepay-sandbox-v1/);
  assert.match(script, /10_000/);
  assert.doesNotMatch(script, /SEPAY_SECRET_KEY|SEPAY_IPN_SECRET|Authorization|X-Secret-Key/);
});
