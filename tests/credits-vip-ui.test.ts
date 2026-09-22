import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileSource = readFileSync(new URL("../app/pages.tsx", import.meta.url), "utf8");
const balanceRoute = readFileSync(new URL("../app/api/billing/balance/route.ts", import.meta.url), "utf8");
const entitlementRoute = readFileSync(new URL("../app/api/billing/entitlements/route.ts", import.meta.url), "utf8");

test("Profile exposes a minimal Credits/VIP status surface without payment controls", () => {
  assert.match(profileSource, /credits-vip-status/);
  assert.match(profileSource, /billing\/balance/);
  assert.match(profileSource, /billing\/entitlements/);
  assert.match(profileSource, /availableUnits/);
  assert.match(profileSource, /entitlementType/);
  assert.doesNotMatch(profileSource, /sepay|affiliate/i);
});

test("member billing status endpoints are no-store and owner-gated", () => {
  for (const source of [balanceRoute, entitlementRoute]) {
    assert.match(source, /requireMemberCreditOwner/);
    assert.match(source, /noStoreResponse/);
  }
});
