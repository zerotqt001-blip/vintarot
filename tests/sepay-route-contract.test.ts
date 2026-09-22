import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("commercial checkout route requires trusted member/origin boundaries", () => {
  const checkout = source("app/api/commercial/checkout/route.ts");
  assert.match(checkout, /originCheck\(request\)/);
  assert.match(checkout, /requireMemberCreditOwner\(request, database\)/);
  assert.match(checkout, /handleCommercialCheckout/);
  assert.doesNotMatch(checkout, /SEPAY_SECRET_KEY\s*:/);
});

test("SePay IPN route passes the raw request through the Gateway handler", () => {
  const ipn = source("app/api/commercial/sepay/ipn/route.ts");
  assert.match(ipn, /handleSePayIpn\(request/);
  assert.doesNotMatch(ipn, /json\(request\)/);
  assert.doesNotMatch(ipn, /console\.(log|error).*request/);
});

test("return and reconciliation routes use the member boundary and no production endpoint", () => {
  const returnRoute = source("app/api/commercial/return/route.ts");
  const reconcile = source("app/api/commercial/orders/[id]/reconcile/route.ts");
  assert.match(returnRoute, /requireMemberCreditOwner\(request, database\)/);
  assert.match(returnRoute, /handleCommercialReturn/);
  assert.match(reconcile, /originCheck\(request\)/);
  assert.match(reconcile, /requireMemberCreditOwner\(request, database\)/);
  assert.match(reconcile, /handleCommercialReconcile/);
  assert.doesNotMatch(`${returnRoute}\n${reconcile}`, /pgapi\.sepay\.vn|pay\.sepay\.vn/);
});
