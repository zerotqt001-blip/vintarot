import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Daily Rewards page uses authenticated server state and localizes the member claim flow", () => {
  const page = read("app/daily-rewards/page.tsx");
  const client = read("app/daily-rewards/daily-rewards.tsx");
  const messages = read("lib/i18n.ts");
  assert.match(page, /getPageMember\(\)/);
  assert.match(page, /authenticated=\{Boolean\(member\)\}/);
  assert.match(client, /\/api\/marketing\/rewards/);
  assert.match(client, /\/api\/marketing\/rewards\/\$\{encodeURIComponent\(campaignId\)\}/);
  for (const key of ["statusEligible", "statusClaimed", "statusPaused", "statusBudget", "expires", "nextClaim"]) {
    assert.match(messages, new RegExp(`${key}:`));
  }
  assert.doesNotMatch(client, /member_id|grant_key|claim_period/);
});

test("campaign manager is hidden from non-Super Admins and changes use the guarded APIs", () => {
  const page = read("app/admin/marketing/campaigns/page.tsx");
  const client = read("app/admin/marketing/campaigns/campaign-manager.tsx");
  const collectionApi = read("app/api/admin/marketing/campaigns/route.ts");
  const itemApi = read("app/api/admin/marketing/campaigns/[id]/route.ts");
  assert.match(page, /role\?\.role !== "SUPER_ADMIN"/);
  assert.match(page, /Number\(role\.disabled\) !== 0/);
  for (const route of [collectionApi, itemApi]) {
    assert.match(route, /admin\.marketing\.manage/);
    assert.match(route, /originCheck/);
  }
  assert.match(client, /Idempotency-Key/);
  assert.match(client, /Change history/);
  assert.match(client, /Create paused campaign/);
});

test("Rewards interface styles are responsive and do not target Tarot Room surfaces", () => {
  const memberStyles = read("app/daily-rewards/daily-rewards.module.css");
  const adminStyles = read("app/admin/marketing/campaigns/campaign-manager.module.css");
  assert.match(memberStyles, /@media\(max-width:650px\)/);
  assert.match(adminStyles, /@media\(max-width:680px\)/);
  assert.match(memberStyles, /--nt-gold-bright/);
  assert.match(memberStyles, /--nt-font-display/);
  assert.doesNotMatch(`${memberStyles}\n${adminStyles}`, /\.room-|\.room-page|\.tarot-room/);
});
