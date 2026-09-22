import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const css = readFileSync(join(root, "app", "globals.css"), "utf8");
const i18n = readFileSync(join(root, "lib", "i18n.ts"), "utf8");

test("account visual world is scoped, atmospheric, and responsive", () => {
  assert.match(css, /\.account-shell/);
  assert.match(css, /celestial-observatory\.png/);
  for (const selector of ["account-topbar", "account-rail", "account-main", "account-hero", "account-summary-grid", "account-transaction-row", "account-security-list"]) {
    assert.match(css, new RegExp(`\\.${selector}`));
  }
  for (const breakpoint of ["1280px", "1024px", "920px", "768px", "420px", "390px", "375px"]) {
    assert.match(css, new RegExp(`max-width:${breakpoint}`));
  }
  assert.match(css, /overflow-x:\s*(clip|hidden)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /account-shell[^}]*:focus-visible|account-shell[^}]*focus-visible/);
});

test("account copy is available in both locale trees", () => {
  assert.equal((i18n.match(/^    account: \{/gm) || []).length, 2);
  for (const key of ["title", "creditsAvailable", "recentReadings", "transactions", "securityTitle", "logout", "vipDays"]) {
    assert.ok((i18n.match(new RegExp(`^      ${key}:`, "gm")) || []).length >= 2, `missing bilingual account key ${key}`);
  }
});
