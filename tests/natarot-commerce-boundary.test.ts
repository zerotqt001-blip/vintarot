import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

test("Affiliate has one active UI owner and commerce keeps Checkout contracts", () => {
  const commerce = read("app/commerce/commerce-pages.tsx");
  const route = read("app/affiliate/page.tsx");

  assert.match(route, /components\/affiliate\/affiliate-dashboard/);
  assert.match(commerce, /export function PackagesPage/);
  assert.match(commerce, /export function CheckoutPage/);
  assert.match(commerce, /api\/commercial\/checkout/);
  assert.doesNotMatch(commerce, /export function AffiliatePage/);
  assert.doesNotMatch(commerce, /function AffiliateDashboardView/);
});

test("Packages keeps the server-projected catalog and credit validity fields", () => {
  const commerce = read("app/commerce/commerce-pages.tsx");
  assert.match(commerce, new RegExp("/api/packages"));
  assert.match(commerce, /benefitSnapshot\.credits\.expiresInSeconds/);
  assert.match(commerce, /benefitSnapshot\.catalog\?\.popular/);
  assert.match(commerce, /idempotency_key/);
});
