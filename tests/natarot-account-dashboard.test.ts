import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

test("Account dashboard keeps owner-scoped data contracts and the shared composition", () => {
  const account = read("components/account/account-history.tsx");
  const route = read("app/account/page.tsx");

  for (const marker of ["account-dashboard", "account-profile-card", "account-stat-grid", "account-quick-grid", "account-history-panel"]) {
    assert.match(account, new RegExp(marker), marker);
  }
  assert.match(account, /\/api\/account\/summary/);
  assert.match(account, /\/api\/account\/history/);
  assert.match(account, /nextCursor/);
  assert.match(route, /path="\/account"/);
  assert.match(route, /AccountHistory/);
  assert.doesNotMatch(account, /96|1\.245\.000|320\.000|4\.860\.000|THANH123/);
  assert.doesNotMatch(account, /href="\/admin"/);
});
