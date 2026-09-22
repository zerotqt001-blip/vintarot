import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const scriptPath = join(import.meta.dirname, "..", "scripts", "seed-production-catalog.mjs");

test("production catalog seed has a closed production-only contract", () => {
  assert.equal(existsSync(scriptPath), true, "production catalog seed operator is missing");
  const source = readFileSync(scriptPath, "utf8");
  for (const [name, amount, units] of [
    ["1 Credit", "15_?000", "1"],
    ["5 Credits", "69_?000", "5"],
    ["10 Credits", "129_?000", "10"],
    ["20 Credits", "229_?000", "20"],
  ]) {
    assert.match(source, new RegExp(name));
    assert.match(source, new RegExp(amount));
    assert.match(source, new RegExp(`creditUnits: ${units}`));
  }
  assert.match(source, /popular:\s*true/);
  assert.match(source, /validityDays\s*=\s*30/);
  assert.match(source, /expiresInSeconds/);
  assert.match(source, /VND/);
  assert.match(source, /credit_units/);
  assert.match(source, /NATAROT_PRODUCTION_CATALOG_SEED/);
  assert.match(source, /NODE_ENV/);
  assert.match(source, /var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(source, /staging/i);
  assert.match(source, /SEPAY_ENVIRONMENT/);
  assert.match(source, /activePackageCount/);
  assert.match(source, /activePackageCount[^\n]*!==\s*4/);
  assert.match(source, /activeVersionCount/);
  assert.match(source, /activeVersionCount[^\n]*!==\s*4/);
  assert.doesNotMatch(source, /SEPAY_ENVIRONMENT\s*=\s*["'`]Sandbox/i);
});

test("checkout discloses server-provided 30-day validity in both locales", () => {
  const translations = readFileSync(join(import.meta.dirname, "..", "lib", "i18n.ts"), "utf8");
  const checkout = readFileSync(join(import.meta.dirname, "..", "app", "commerce", "commerce-pages.tsx"), "utf8");
  assert.match(translations, /Valid for \{value\} days from credit activation/);
  assert.match(translations, /Hạn sử dụng: \{value\} ngày kể từ khi Credit được cộng/);
  assert.match(checkout, /creditValidity/);
});
