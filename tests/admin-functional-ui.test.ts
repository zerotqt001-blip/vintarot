import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const files = [
  "app/account/page.tsx",
  "app/admin/page.tsx",
  "app/admin/admin-console.tsx",
  "components/account/account-history.tsx",
  "components/affiliate/referral-capture.tsx",
];

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("backend completion exposes only a small functional UI surface", () => {
  for (const file of files) assert.equal(existsSync(join(repoRoot, file)), true, `missing ${file}`);
  const admin = source("app/admin/admin-console.tsx");
  const account = source("components/account/account-history.tsx");
  const referral = source("components/affiliate/referral-capture.tsx");
  const pageSources = files.map(source).join("\n");

  assert.match(pageSources, /FUNCTIONAL UI — NOT FINAL DESIGN/);
  for (const endpoint of [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/orders",
    "/api/admin/affiliate",
    "/api/admin/audit",
    "/api/admin/credits",
    "/api/admin/vip",
    "/api/admin/users/",
    "/readings",
  ]) assert.match(admin, new RegExp(endpoint.replaceAll("/", "\\/")), endpoint);
  for (const label of ["Dashboard", "Users", "Credits", "VIP", "Orders", "Affiliate", "Readings", "Audit"]) assert.match(admin, new RegExp(label), label);
  assert.match(admin, /q=/);
  assert.match(admin, /emailMasked|phoneMasked/);
  assert.match(admin, /paymentReferenceMasked/);
  assert.doesNotMatch(admin, /paymentReference\s*:/);
  assert.match(account, /\/api\/account\/summary/);
  assert.match(account, /\/api\/account\/history/);
  assert.match(admin, /reason/);
  assert.match(admin, /idempotency_key/);
  assert.match(admin, /aria-live/);
  assert.match(referral, /\/api\/affiliate\/attribute/);
  assert.match(referral, /useEffect/);
  assert.doesNotMatch(pageSources, /dangerouslySetInnerHTML|reading_payload|token_hash|localStorage|sessionStorage/);
});

test("account and admin links are reachable from the existing shell without changing brand destinations", () => {
  const shell = [
    "components/shell/natarot-shell.tsx",
    "components/shell/natarot-header.tsx",
    "components/shell/natarot-sidebar.tsx",
    "components/shell/natarot-footer.tsx",
  ].map(source).join("\n");
  const adminPage = source("app/admin/page.tsx");
  const accountPage = source("app/account/page.tsx");
  assert.match(shell, /ReferralCapture/);
  assert.match(adminPage, /AdminConsole/);
  assert.match(accountPage, /AccountHistory/);
  assert.match(shell, /\/profile/);
  assert.match(shell, /\/guidebook/);
});
