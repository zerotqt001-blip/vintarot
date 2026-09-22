import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("full-feature commerce routes expose the existing owner-scoped contracts", () => {
  const routes = ["app/packages/page.tsx", "app/checkout/page.tsx", "app/affiliate/page.tsx"];
  for (const route of routes) assert.equal(existsSync(join(repoRoot, route)), true, `missing ${route}`);

  const packages = source("app/packages/page.tsx");
  const checkout = source("app/checkout/page.tsx");
  const affiliate = source("app/affiliate/page.tsx");
  const commerce = source("app/commerce/commerce-pages.tsx");

  assert.match(commerce, /\/api\/packages/);
  assert.match(commerce, /\/checkout\?package=/);
  assert.match(commerce, /\/api\/commercial\/checkout/);
  assert.match(commerce, /package_version_id/);
  assert.match(commerce, /idempotency_key/);
  assert.match(commerce, /checkout\.action/);
  assert.match(commerce, /checkoutReturnPath\(packageId\)/);
  assert.match(commerce, /setIdempotencyKey\(createCheckoutIdempotencyKey\(\)\)/);
  assert.match(commerce, /\/api\/account\/summary/);
  assert.match(commerce, /\/api\/account\/history\?kind=affiliate/);
  assert.match(commerce, /auth\?return_to=\/affiliate/);

  for (const page of [packages, checkout, affiliate, commerce]) {
    assert.doesNotMatch(page, /SEPAY_SECRET_KEY|NATAROT_PII_KEY|secretKey|token_hash|reading_payload/);
  }
});

test("account history provides minimal links to the owner-testable feature surfaces", () => {
  const account = source("components/account/account-history.tsx");
  for (const destination of ["/packages", "/affiliate", "/admin"]) assert.match(account, new RegExp(destination.replaceAll("/", "\\/")), destination);
});
