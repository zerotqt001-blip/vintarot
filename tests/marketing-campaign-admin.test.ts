import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { hasPermission } from "../lib/admin/permissions";
import { createMarketingCampaignAdminService } from "../lib/marketing/admin";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-marketing-admin-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  const now = { value: Date.parse("2026-01-01T12:00:00Z") };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const admin = createMarketingCampaignAdminService(database, () => now.value);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { admin, database, now, sqlite };
}

const superAdmin = { memberId: "owner-member", role: "SUPER_ADMIN" as const, permissions: new Set(["admin.marketing.manage" as const]) };
const staffAdmin = { memberId: "staff-member", role: "ADMIN" as const, permissions: new Set<string>() };

const customCampaign = {
  campaignType: "CUSTOM" as const,
  name: "Full moon reading",
  rewardUnits: 2,
  startAt: Date.parse("2026-01-02T00:00:00Z"),
  endAt: Date.parse("2026-02-01T00:00:00Z"),
  timeZone: "Asia/Ho_Chi_Minh",
  eligibilityRule: "ACTIVE_MEMBER" as const,
  claimFrequency: "DAILY" as const,
  creditExpirationSeconds: 7 * 24 * 60 * 60,
  totalBudgetUnits: 500,
  perUserLimit: 10,
};

test("only SUPER_ADMIN is authorized to manage marketing campaigns", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "admin.marketing.manage"), true);
  assert.equal(hasPermission("ADMIN", "admin.marketing.manage"), false);
  assert.equal(hasPermission("FINANCE", "admin.marketing.manage"), false);
  assert.equal(hasPermission("SUPPORT", "admin.marketing.manage"), false);
  assert.equal(hasPermission("CONTENT_ADMIN", "admin.marketing.manage"), false);
  assert.equal(hasPermission("USER", "admin.marketing.manage"), false);
});

test("campaign creation starts paused and records an auditable before/after history entry", async (context) => {
  const { admin, database } = makeFixture(context);
  const created = await admin.create(superAdmin, customCampaign, { idempotencyKey: "create-full-moon-001" });

  assert.equal(created.status, "PAUSED");
  assert.equal(created.name, customCampaign.name);
  assert.equal(created.rewardUnits, 2);
  assert.equal(created.claimedRewards, 0);
  const events = await database.prepare("SELECT action, target_type, target_id, metadata_json FROM audit_events WHERE target_type='marketing_campaign'").all<{
    action: string;
    target_type: string;
    target_id: string;
    metadata_json: string;
  }>();
  assert.equal(events.results.length, 1);
  assert.equal(events.results[0]?.action, "marketing.campaign.created");
  assert.equal(events.results[0]?.target_id, created.id);
  assert.equal(JSON.parse(events.results[0]!.metadata_json).after.name, customCampaign.name);
});

test("admin mutation replay is idempotent and a reused key with different input is rejected", async (context) => {
  const { admin } = makeFixture(context);
  const first = await admin.create(superAdmin, customCampaign, { idempotencyKey: "create-full-moon-002" });
  const replay = await admin.create(superAdmin, customCampaign, { idempotencyKey: "create-full-moon-002" });
  assert.equal(replay.id, first.id);
  await assert.rejects(
    admin.create(superAdmin, { ...customCampaign, rewardUnits: 3 }, { idempotencyKey: "create-full-moon-002" }),
    /idempotency key/i,
  );
});

test("campaign updates cannot reduce total budget below units already issued", async (context) => {
  const { admin, sqlite } = makeFixture(context);
  const created = await admin.create(superAdmin, customCampaign, { idempotencyKey: "create-full-moon-003" });
  sqlite.prepare("UPDATE marketing_campaigns SET budget_used_units=2 WHERE id=?").run(created.id);

  await assert.rejects(
    admin.update(superAdmin, created.id, { ...customCampaign, totalBudgetUnits: 1 }, { idempotencyKey: "reduce-budget-too-far" }),
    /below.*issued|already issued/i,
  );
  const after = await admin.get(superAdmin, created.id);
  assert.equal(after?.totalBudgetUnits, 500);
});

test("stale campaign status updates fail instead of reporting an unapplied change", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  const racingDatabase = {
    prepare: database.prepare.bind(database),
    batch: async (statements: Parameters<D1Database["batch"]>[0]) => {
      sqlite.prepare("UPDATE marketing_campaigns SET config_version=config_version+1 WHERE id='daily-rewards-v1'").run();
      return database.batch(statements);
    },
  } as unknown as D1Database;
  const admin = createMarketingCampaignAdminService(racingDatabase, () => now.value);

  await assert.rejects(
    admin.setStatus(superAdmin, "daily-rewards-v1", "ACTIVE", { idempotencyKey: "activate-stale-daily" }),
    /changed while this request/i,
  );
  assert.equal((await admin.get(superAdmin, "daily-rewards-v1"))?.status, "PAUSED");
  assert.equal((await database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE idempotency_key='marketing.campaign:activate-stale-daily'").first<{ count: number }>())?.count, 0);
});

test("campaign history and summary report aggregate outcomes without member identifiers", async (context) => {
  const { admin } = makeFixture(context);
  const created = await admin.create(superAdmin, customCampaign, { idempotencyKey: "create-full-moon-004" });
  await admin.setStatus(superAdmin, created.id, "ACTIVE", { idempotencyKey: "activate-full-moon-004" });
  const updated = await admin.update(superAdmin, created.id, { ...customCampaign, rewardUnits: 3 }, { idempotencyKey: "update-full-moon-004" });
  const history = await admin.history(superAdmin, created.id);
  const report = await admin.report(superAdmin);

  assert.equal(updated.status, "ACTIVE");
  assert.deepEqual(history.map((event) => event.action), ["marketing.campaign.updated", "marketing.campaign.status_changed", "marketing.campaign.created"]);
  const row = report.find((item) => item.id === created.id);
  assert.ok(row);
  assert.equal(row.claimedRewards, 0);
  assert.equal(row.expiredPromotionalUnits, 0);
  assert.equal(row.budgetUtilizationPercent, 0);
  assert.equal(JSON.stringify(row).includes("memberId"), false);
});

test("staff role is rejected by campaign mutations even when a caller forges permissions", async (context) => {
  const { admin } = makeFixture(context);
  await assert.rejects(
    admin.create({ ...staffAdmin, permissions: new Set(["admin.marketing.manage"]) }, customCampaign, { idempotencyKey: "staff-create-denied" }),
    /forbidden/i,
  );
});
