import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(import.meta.dirname, "..", "scripts", "seed-production-catalog.mjs");

test("production catalog seed has a closed production-only contract", () => {
  assert.equal(existsSync(scriptPath), true, "production catalog seed operator is missing");
  const source = readFileSync(scriptPath, "utf8");
  assert.match(source, /1 Tarot Credit/);
  assert.match(source, /15_?000/);
  assert.match(source, /VND/);
  assert.match(source, /credit_units/);
  assert.match(source, /NATAROT_PRODUCTION_CATALOG_SEED/);
  assert.match(source, /NODE_ENV/);
  assert.match(source, /var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(source, /staging/i);
  assert.match(source, /SEPAY_ENVIRONMENT/);
  assert.match(source, /activePackageCount/);
  assert.match(source, /activePackageCount[^\n]*!==\s*1/);
  assert.match(source, /activeVersionCount/);
  assert.match(source, /activeVersionCount[^\n]*!==\s*1/);
  assert.doesNotMatch(source, /SEPAY_ENVIRONMENT\s*=\s*["'`]Sandbox/i);
});
