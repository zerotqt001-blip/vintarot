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

test("member destinations have separate shared desktop and mobile access regions", () => {
  const shell = source("app/vintarot.tsx");
  const styles = source("app/globals.css");
  const sidebarIndex = shell.indexOf("<Sidebar collapsible");
  const desktopNavIndex = shell.indexOf('commerce-access-nav commerce-access-nav--desktop');
  const mobileNavIndex = shell.indexOf('commerce-access-nav commerce-access-nav--mobile');

  assert.notEqual(sidebarIndex, -1);
  assert.ok(desktopNavIndex >= 0 && desktopNavIndex < sidebarIndex, "desktop access must be outside the scrollable sidebar");
  assert.ok(mobileNavIndex >= 0 && mobileNavIndex < sidebarIndex, "mobile access must be outside the primary bottom navigation");
  assert.match(shell, /commerce-access-nav__link/);
  assert.match(shell, /className="main-nav"/);
  assert.doesNotMatch(shell, /<nav className="commerce-nav"/);
  assert.match(styles, /\.commerce-access-nav--desktop/);
  assert.match(styles, /\.commerce-access-nav--mobile/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /padding-bottom:calc\(132px \+ env\(safe-area-inset-bottom\)\)/);
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

test("account UI exposes top-up, VIP, history and Affiliate entry points with internal-test provenance", () => {
  const account = source("components/account/account-history.tsx");
  const summary = source("lib/account-history.ts");
  const messages = source("lib/i18n.ts");
  for (const marker of ["member.topUpCredits", "member.viewVipPackages", "member.orderHistory", "member.readingHistory", "member.openAffiliate", "member.internalTestGrant", "member.internalTestEntitlement"]) {
    assert.match(account, new RegExp(marker.replaceAll(".", "\\.")), marker);
  }
  assert.match(account, /initialKind/);
  assert.match(account, /isInternalTest/);
  assert.match(summary, /sourceType/);
  assert.match(messages, /vipCatalogPending/);
  assert.match(messages, /internalTestGrant/);
});

test("checkout creates the server-priced pending order before provider checkout and preserves the gate", () => {
  const commerce = source("app/commerce/commerce-pages.tsx");
  const orderIndex = commerce.indexOf('"/api/orders"');
  const providerIndex = commerce.indexOf('"/api/commercial/checkout"');
  assert.ok(orderIndex >= 0, "checkout must create the pending order first");
  assert.ok(providerIndex > orderIndex, "provider checkout must follow order creation");
  assert.match(commerce, /paymentUnavailable/);
  assert.match(commerce, /vipCatalogPending/);
  assert.match(commerce, /order.*pending|pending.*order/i);
});
