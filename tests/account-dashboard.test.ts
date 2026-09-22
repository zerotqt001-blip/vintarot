import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { accountDisplayName, formatAccountDate, formatAccountMoney, localizedPackageName, orderStatusLabel } from "../components/account/account-dashboard";

const source = readFileSync(join(import.meta.dirname, "..", "components", "account", "account-dashboard.tsx"), "utf8");

test("account display helpers preserve real member and package values", () => {
  assert.equal(accountDisplayName({ displayName: "  Nguyễn Minh Anh ", username: "owner" }), "Nguyễn Minh Anh");
  assert.equal(accountDisplayName({ displayName: "", username: "owner" }), "owner");
  assert.equal(localizedPackageName({ nameEn: "Twenty Credits", nameVi: "Gói 20 Credits" }, "vi"), "Gói 20 Credits");
  assert.equal(localizedPackageName({ nameEn: "Twenty Credits", nameVi: "Gói 20 Credits" }, "en"), "Twenty Credits");
  assert.match(formatAccountDate(1_700_000_000_000, "vi"), /2023/);
  assert.match(formatAccountMoney(229_000, "VND", "vi"), /229/);
  assert.equal(orderStatusLabel("FULFILLED", "vi"), "Hoàn tất");
  assert.equal(orderStatusLabel("UNKNOWN", "en"), "UNKNOWN");
  assert.match(source, /account\.vipDays/);
  assert.doesNotMatch(source, /VIP \$\{Math\.round/);
});

test("dashboard consumes canonical owner-scoped surfaces and existing destinations", () => {
  for (const endpoint of ["/api/account/summary", "/api/account/history", "/api/tarot/saved-readings", "/api/auth/logout"]) {
    assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const destination of ["/packages", "/affiliate", "/profile", "/journal?tab=saved", "/room", "/account#transactions"]) {
    assert.ok(source.includes(destination), `missing account destination ${destination}`);
  }
  for (const selector of ["account-dashboard", "account-hero", "account-summary-grid", "account-recent-readings", "account-quick-links", "account-transactions", "account-security"]) {
    assert.match(source, new RegExp(selector));
  }
  assert.match(source, /aria-live/);
  assert.match(source, /no-store/);
  assert.doesNotMatch(source, /owner_test|229\.000|demo|Admin console/);
});
