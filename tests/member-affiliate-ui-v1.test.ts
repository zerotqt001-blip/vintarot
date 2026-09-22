import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(join(repoRoot, relativePath), "utf8");

test("customer Affiliate read routes preserve public and owner-scoped boundaries", () => {
  const policy = source("app/api/affiliate/policy/route.ts");
  const dashboard = source("app/api/affiliate/dashboard/route.ts");
  assert.equal(existsSync(join(repoRoot, "lib/affiliate/customer.ts")), true);
  assert.match(policy, /getActiveAffiliatePolicy/);
  assert.match(policy, /noStoreResponse/);
  assert.match(dashboard, /requireMemberCreditOwner/);
  assert.match(dashboard, /noStoreResponse/);
  assert.doesNotMatch(dashboard, /code_hash|token_hash|payment_secret|payout/i);
});

test("member UI renders server catalog data without submitting authoritative price", () => {
  const commerce = source("app/commerce/commerce-pages.tsx");
  assert.match(commerce, /benefitSnapshot/);
  assert.match(commerce, new RegExp("/api/packages"));
  assert.match(commerce, new RegExp("/api/account/summary"));
  assert.match(commerce, /checkoutReturnPath\(packageId\)/);
  assert.match(commerce, /idempotency_key/);
  assert.match(commerce, new RegExp("/api/commercial/checkout"));
  const requestBody = commerce.slice(commerce.indexOf("body: JSON.stringify"), commerce.indexOf("body: JSON.stringify") + 320);
  assert.doesNotMatch(requestBody, /amount_minor|commission_minor|currency/);
});

test("Affiliate UI uses dynamic policy/dashboard data and has no fake payout action", () => {
  const commerce = source("app/commerce/commerce-pages.tsx");
  assert.match(commerce, new RegExp("/api/affiliate/policy"));
  assert.match(commerce, new RegExp("/api/affiliate/dashboard"));
  assert.match(commerce, /referralLink/);
  assert.match(commerce, /currentTier/);
  assert.match(commerce, /commissionMinor/);
  assert.match(commerce, /not_supported_by_current_backend/);
  assert.doesNotMatch(commerce, /withdraw|payout.*POST|requestPayout/i);
});

test("shared shell and account expose member destinations while preserving existing paths", () => {
  const shell = source("app/vintarot.tsx");
  const account = source("components/account/account-history.tsx");
  const styles = source("app/globals.css");
  for (const destination of ["/packages", "/affiliate", "/account", "/guidebook", "/create", "/daily-spread"]) {
    assert.match(`${shell}\n${account}`, new RegExp(destination.replaceAll("/", "\\/")), destination);
  }
  assert.match(shell, /nav\.membership/);
  assert.match(shell, /nav\.affiliate/);
  assert.match(shell, /nav\.account/);
  assert.match(styles, /commerce|functional/);
  assert.match(styles, /max-width:768px/);
});

test("localized functional states are present for member and Affiliate surfaces", () => {
  const messages = source("lib/i18n.ts");
  const commerce = source("app/commerce/commerce-pages.tsx");
  for (const key of ["member:", "packageEmpty", "affiliate:", "policyUnavailable", "payoutUnavailable"]) {
    assert.match(messages, new RegExp(key));
  }
  assert.match(commerce, /useLanguage/);
  assert.match(commerce, /role="status"/);
});
