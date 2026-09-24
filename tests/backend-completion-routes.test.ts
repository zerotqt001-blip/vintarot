import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const routes = [
  "app/api/affiliate/attribute/route.ts",
  "app/api/account/summary/route.ts",
  "app/api/account/history/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/users/[id]/route.ts",
  "app/api/admin/users/[id]/sessions/route.ts",
  "app/api/admin/credits/route.ts",
  "app/api/admin/vip/route.ts",
  "app/api/admin/orders/route.ts",
  "app/api/admin/affiliate/route.ts",
  "app/api/admin/audit/route.ts",
];

test("backend completion routes exist and preserve server-side boundary contracts", () => {
  for (const relativePath of routes) assert.equal(existsSync(join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  const source = routes.map((relativePath) => readFileSync(join(repoRoot, relativePath), "utf8")).join("\n");
  assert.match(source, /noStoreResponse/);
  assert.match(source, /originCheck/);
  assert.match(source, /requirePermission/);
  assert.match(source, /idempotency_key/);
  assert.match(source, /reason/);
  assert.match(source, /\.strict\(\)/);
  assert.doesNotMatch(source, /request\.json\(\)|body\.owner|body\.role|body\.amount_minor\s*\)/);
  assert.doesNotMatch(source, /token_hash|reading_payload|rawCode.*affiliate/);
});

test("Affiliate dashboard remains an authenticated owner-scoped no-store projection", () => {
  const dashboard = readFileSync(join(repoRoot, "app/api/affiliate/dashboard/route.ts"), "utf8");
  const customer = readFileSync(join(repoRoot, "lib/affiliate/customer.ts"), "utf8");
  assert.match(dashboard, /requireMemberCreditOwner\(request, database\)/);
  assert.match(dashboard, /noStoreResponse/);
  assert.doesNotMatch(`${dashboard}\n${customer}`, /code_hash|password_hash|token_hash|payment_secret|payoutUrl/i);
  assert.doesNotMatch(dashboard, /request\.json\(\)|searchParams|body\.member|body\.profile/);
});

test("Affiliate commission adjustment audit keys are conversion-scoped and legacy-aware", () => {
  const route = readFileSync(join(repoRoot, "app/api/admin/affiliate/route.ts"), "utf8");
  const idempotency = readFileSync(join(repoRoot, "lib/affiliate/idempotency.ts"), "utf8");
  assert.match(route, /affiliateAdjustmentAuditIdempotencyKey\(conversion\.id,\s*parsed\.data\.idempotency_key\)/);
  assert.match(idempotency, /digestToken\(JSON\.stringify\(\{\s*conversionId,\s*idempotencyKey\s*\}\)\)/);
  assert.match(route, /legacyAuditKey/);
  assert.match(route, /SELECT target_id FROM audit_events[^]*bind\(legacyAuditKey\)/);
});
