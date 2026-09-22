import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("Admin APIs cover dashboard, search, user detail, readings, orders, audit, Credits and VIP", () => {
  const files = [
    "app/api/admin/overview/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/admin/users/[id]/route.ts",
    "app/api/admin/users/[id]/readings/route.ts",
    "app/api/admin/orders/route.ts",
    "app/api/admin/credits/route.ts",
    "app/api/admin/vip/route.ts",
    "app/api/admin/affiliate/route.ts",
    "app/api/admin/audit/route.ts",
  ];
  for (const file of files) assert.equal(existsSync(join(repoRoot, file)), true, `missing ${file}`);
  const all = files.map(source).join("\n");
  for (const permission of ["admin.dashboard.read", "admin.users.read", "admin.readings.read", "admin.orders.read", "admin.affiliate.read", "admin.audit.read", "admin.credits.adjust", "admin.vip.adjust"]) {
    assert.match(all, new RegExp(permission.replaceAll(".", "\\.")), permission);
  }
  assert.match(source("app/api/admin/users/route.ts"), /search|q/);
  assert.match(source("app/api/admin/users/[id]/route.ts"), /getAdminMemberDetail/);
  assert.match(source("app/api/admin/users/[id]/readings/route.ts"), /listAdminMemberReadings/);
  assert.match(source("app/api/admin/orders/route.ts"), /listAdminOrders/);
  assert.match(source("app/api/admin/credits/route.ts"), /adjustAdminMemberCredits/);
  assert.match(source("app/api/admin/vip/route.ts"), /grantAdminVip|revokeAdminVip/);
  assert.doesNotMatch(all, /reading_payload|token_hash|password_hash|dangerouslySetInnerHTML|eval\(/);
});

test("Admin mutations keep strict reason/idempotency and delegate to domain actions", () => {
  const credits = source("app/api/admin/credits/route.ts");
  const vip = source("app/api/admin/vip/route.ts");
  for (const sourceText of [credits, vip]) {
    assert.match(sourceText, /originCheck/);
    assert.match(sourceText, /reason/);
    assert.match(sourceText, /idempotency_key/);
    assert.doesNotMatch(sourceText, /UPDATE\\s+(credit_|entitlements)/i);
  }
  assert.doesNotMatch(credits, /createCreditStore/);
  assert.doesNotMatch(vip, /grantManualEntitlement|revokeEntitlement/);
});
