import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { createCreditStore, creditAccountId } from "../lib/credits/repository";
import { campaignDateKey, claimDailyReward, claimMarketingReward, expireDueCreditGrants, getDailyRewardState, getMarketingRewardStates } from "../lib/marketing/campaigns";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const DAY = 86_400_000;

type Fixture = {
  database: ReturnType<typeof createSqliteD1Database>;
  sqlite: DatabaseSync;
  now: { value: number };
};

function makeFixture(context: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "natarot-marketing-campaigns-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const now = { value: Date.parse("2026-01-01T12:00:00Z") };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite, now };
}

function insertMember(sqlite: DatabaseSync, id: string, disabled = 0): void {
  const now = Date.parse("2025-12-01T00:00:00Z");
  sqlite.prepare(`INSERT INTO members
    (id, username, email, phone, email_verified_at, created_at, updated_at, disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, id, `${id}@example.test`, "+84900000000", now, now, now, disabled);
}

function setDailyCampaign(sqlite: DatabaseSync, updates: Record<string, number | string | null> = {}): void {
  const fields: Record<string, number | string | null> = {
    status: "ACTIVE",
    start_at: 0,
    end_at: null,
    credit_expiration_seconds: 7 * 24 * 60 * 60,
    total_budget_units: 10_000,
    ...updates,
  };
  const columns = Object.keys(fields);
  sqlite.prepare(`UPDATE marketing_campaigns SET ${columns.map((column) => `${column}=?`).join(", ")} WHERE id='daily-rewards-v1'`)
    .run(...columns.map((column) => fields[column]!));
}

function insertRewardCampaign(sqlite: DatabaseSync, input: { id: string; name: string; frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" }): void {
  sqlite.prepare(`INSERT INTO marketing_campaigns (
    id, campaign_type, name, status, reward_units, start_at, end_at, time_zone, eligibility_rule,
    claim_frequency, credit_expiration_seconds, total_budget_units, per_user_limit, budget_used_units,
    config_version, created_at, updated_at
  ) VALUES (?, 'CUSTOM', ?, 'ACTIVE', 2, 0, NULL, 'Asia/Ho_Chi_Minh', 'ACTIVE_MEMBER', ?, 604800, 20, NULL, 0, 1, 0, 0)`)
    .run(input.id, input.name, input.frequency);
}

test("migration seeds the unchanged Welcome Bonus and a paused, budgeted Daily Rewards campaign", (context) => {
  const { sqlite } = makeFixture(context);
  const welcome = { ...sqlite.prepare("SELECT campaign_type, status, reward_units, claim_frequency, credit_expiration_seconds, total_budget_units, budget_used_units FROM marketing_campaigns WHERE id='welcome-bonus-v1'").get() as Record<string, unknown> };
  const daily = { ...sqlite.prepare("SELECT campaign_type, status, reward_units, claim_frequency, time_zone, credit_expiration_seconds, total_budget_units FROM marketing_campaigns WHERE id='daily-rewards-v1'").get() as Record<string, unknown> };

  assert.deepEqual(welcome, {
    campaign_type: "WELCOME_BONUS",
    status: "ACTIVE",
    reward_units: 1,
    claim_frequency: "ONCE",
    credit_expiration_seconds: null,
    total_budget_units: null,
    budget_used_units: 0,
  });
  assert.deepEqual(daily, {
    campaign_type: "DAILY_REWARD",
    status: "PAUSED",
    reward_units: 1,
    claim_frequency: "DAILY",
    time_zone: "Asia/Ho_Chi_Minh",
    credit_expiration_seconds: 7 * 24 * 60 * 60,
    total_budget_units: 10_000,
  });
});

test("Daily Rewards is server-paused by default and requires an enabled verified member", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "eligible-member");
  insertMember(sqlite, "disabled-member", 1);

  const paused = await claimDailyReward(database, "eligible-member", now.value);
  assert.equal(paused.status, "paused");
  setDailyCampaign(sqlite);
  const disabled = await claimDailyReward(database, "disabled-member", now.value);
  assert.equal(disabled.status, "not_eligible");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_grants").get() as { count: number }).count, 0);
});

test("campaign pause and resume gate claims without resetting issued budget", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "pause-member");
  setDailyCampaign(sqlite);

  assert.equal((await claimDailyReward(database, "pause-member", now.value)).status, "claimed");
  sqlite.prepare("UPDATE marketing_campaigns SET status='PAUSED', config_version=config_version+1 WHERE id='daily-rewards-v1'").run();
  assert.equal((await claimDailyReward(database, "pause-member", now.value + DAY)).status, "paused");
  sqlite.prepare("UPDATE marketing_campaigns SET status='ACTIVE', config_version=config_version+1 WHERE id='daily-rewards-v1'").run();
  assert.equal((await claimDailyReward(database, "pause-member", now.value + DAY)).status, "claimed");
  assert.equal((sqlite.prepare("SELECT budget_used_units FROM marketing_campaigns WHERE id='daily-rewards-v1'").get() as { budget_used_units: number }).budget_used_units, 2);
});

test("one local-day claim creates one canonical promotional grant and replay cannot duplicate it", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "daily-member");
  setDailyCampaign(sqlite);

  const first = await claimDailyReward(database, "daily-member", now.value);
  const replay = await claimDailyReward(database, "daily-member", now.value + 10);
  assert.equal(first.status, "claimed");
  assert.equal(first.units, 1);
  assert.equal(first.expiresAt, now.value + 7 * DAY);
  assert.equal(replay.status, "already_claimed");

  const grant = { ...sqlite.prepare("SELECT source, source_type, grant_key, units, expires_at FROM credit_grants").get() as Record<string, unknown> };
  assert.deepEqual(grant, {
    source: "PROMOTION",
    source_type: "MARKETING_CAMPAIGN",
    grant_key: `campaign:daily-rewards-v1:daily-member:${campaignDateKey(now.value, "Asia/Ho_Chi_Minh")}`,
    units: 1,
    expires_at: now.value + 7 * DAY,
  });
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='GRANT'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT budget_used_units FROM marketing_campaigns WHERE id='daily-rewards-v1'").get() as { budget_used_units: number }).budget_used_units, 1);
});

test("concurrent claims for the same member and local day increment budget and ledger once", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "racing-member");
  setDailyCampaign(sqlite, { total_budget_units: 1 });

  const results = await Promise.all([
    claimDailyReward(database, "racing-member", now.value),
    claimDailyReward(database, "racing-member", now.value),
  ]);
  assert.equal(results.filter((result) => result.status === "claimed").length, 1);
  assert.equal(results.filter((result) => result.status === "already_claimed").length, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='GRANT'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT budget_used_units FROM marketing_campaigns WHERE id='daily-rewards-v1'").get() as { budget_used_units: number }).budget_used_units, 1);
});

test("local-day boundaries follow the campaign IANA time zone", async (context) => {
  const { database, sqlite } = makeFixture(context);
  insertMember(sqlite, "boundary-member");
  setDailyCampaign(sqlite);
  const beforeMidnight = Date.parse("2026-01-01T16:59:59.000Z");
  const afterMidnight = Date.parse("2026-01-01T17:00:00.000Z");

  assert.equal(campaignDateKey(beforeMidnight, "Asia/Ho_Chi_Minh"), "2026-01-01");
  assert.equal(campaignDateKey(afterMidnight, "Asia/Ho_Chi_Minh"), "2026-01-02");
  assert.equal((await claimDailyReward(database, "boundary-member", beforeMidnight)).status, "claimed");
  assert.equal((await getDailyRewardState(database, "boundary-member", afterMidnight)).eligible, true);
  assert.equal((await claimDailyReward(database, "boundary-member", afterMidnight)).status, "claimed");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims WHERE member_id='boundary-member'").get() as { count: number }).count, 2);
});

test("claim periods and next reward time follow daylight-saving boundaries in the configured zone", async (context) => {
  const { database, sqlite } = makeFixture(context);
  insertMember(sqlite, "dst-boundary-member");
  setDailyCampaign(sqlite, { time_zone: "America/Los_Angeles" });
  const beforeLocalMidnight = Date.parse("2026-03-08T07:59:59.000Z");
  const afterLocalMidnight = Date.parse("2026-03-08T08:00:00.000Z");

  assert.equal(campaignDateKey(beforeLocalMidnight, "America/Los_Angeles"), "2026-03-07");
  assert.equal(campaignDateKey(afterLocalMidnight, "America/Los_Angeles"), "2026-03-08");
  assert.equal((await claimDailyReward(database, "dst-boundary-member", afterLocalMidnight)).status, "claimed");
  const nextDay = await getDailyRewardState(database, "dst-boundary-member", afterLocalMidnight + 1);
  assert.equal(nextDay.nextClaimAt, Date.parse("2026-03-09T07:00:00.000Z"));
});

test("budget exhaustion stops later claims without consuming additional campaign budget", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "budget-member");
  setDailyCampaign(sqlite, { total_budget_units: 1 });

  assert.equal((await claimDailyReward(database, "budget-member", now.value)).status, "claimed");
  assert.equal((await claimDailyReward(database, "budget-member", now.value + DAY)).status, "budget_exhausted");
  assert.equal((sqlite.prepare("SELECT budget_used_units FROM marketing_campaigns WHERE id='daily-rewards-v1'").get() as { budget_used_units: number }).budget_used_units, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='GRANT'").get() as { count: number }).count, 1);
});

test("custom weekly campaigns use the configured local period and appear in the authenticated reward catalog", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "weekly-member");
  insertRewardCampaign(sqlite, { id: "campaign-full-moon", name: "Full moon gift", frequency: "WEEKLY" });

  const rewards = await getMarketingRewardStates(database, "weekly-member", now.value);
  assert.equal(rewards.find((item) => item.campaign.id === "campaign-full-moon")?.state.status, "eligible");
  const first = await claimMarketingReward(database, "weekly-member", "campaign-full-moon", now.value);
  const replay = await claimMarketingReward(database, "weekly-member", "campaign-full-moon", now.value + 60_000);
  assert.equal(first.status, "claimed");
  assert.equal(replay.status, "already_claimed");

  const nextWeek = Date.parse("2026-01-04T17:00:00.000Z");
  assert.equal((await claimMarketingReward(database, "weekly-member", "campaign-full-moon", nextWeek)).status, "claimed");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims WHERE campaign_id='campaign-full-moon'").get() as { count: number }).count, 2);
  assert.equal((sqlite.prepare("SELECT budget_used_units FROM marketing_campaigns WHERE id='campaign-full-moon'").get() as { budget_used_units: number }).budget_used_units, 4);
});

test("promotional claims do not create revenue orders or affiliate commission records", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "promotion-isolation-member");
  setDailyCampaign(sqlite);
  await claimDailyReward(database, "promotion-isolation-member", now.value);

  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_commission_ledger").get() as { count: number }).count, 0);
});

test("expiration sweep records only due promotional units and preserves purchased Credits", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "expiration-member");
  setDailyCampaign(sqlite, { credit_expiration_seconds: 60 });
  const credits = createCreditStore(database, () => now.value);
  await credits.grantCredits({
    owner: { kind: "member", ownerId: "member:expiration-member" },
    source: "PURCHASE",
    units: 3,
    grantKey: "purchase-preserved",
    policyVersion: "test-v1",
    policySnapshot: { source: "PURCHASE" },
    reason: "test purchase",
  });
  await claimDailyReward(database, "expiration-member", now.value);
  now.value += 61_000;

  assert.deepEqual(await credits.getBalance({ kind: "member", ownerId: "member:expiration-member" }), { availableUnits: 3, reservedUnits: 0, totalUnits: 3 });
  assert.deepEqual(await expireDueCreditGrants(database, now.value), { expiredGrants: 1, expiredUnits: 1 });
  assert.deepEqual(await expireDueCreditGrants(database, now.value), { expiredGrants: 0, expiredUnits: 0 });
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='EXPIRATION' AND units=-1").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT available_units FROM credit_grants WHERE grant_key='purchase-preserved'").get() as { available_units: number }).available_units, 3);
  assert.equal((await credits.getBalance({ kind: "member", ownerId: "member:expiration-member" })).availableUnits, 3);
});

test("AI reading reservations consume expiring campaign Credits before purchased Credits", async (context) => {
  const { database, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "priority-member");
  setDailyCampaign(sqlite);
  await claimDailyReward(database, "priority-member", now.value);
  const owner = { kind: "member" as const, ownerId: "member:priority-member" };
  const credits = createCreditStore(database, () => now.value);
  const purchased = await credits.grantCredits({
    owner,
    source: "PURCHASE",
    units: 2,
    grantKey: "priority-purchase",
    policyVersion: "test-v1",
    policySnapshot: { source: "PURCHASE" },
    reason: "test purchase",
  });

  const reservation = await credits.reserveCredits({
    owner,
    units: 2,
    usageType: "TAROT_READING",
    resourceType: "reading_session",
    resourceId: "priority-reading",
    idempotencyKey: "tarot:priority-reading",
  });
  assert.deepEqual(reservation.allocations.map((allocation) => allocation.grantId), [
    `credit-grant:${creditAccountId(owner)}:campaign:daily-rewards-v1:priority-member:${campaignDateKey(now.value)}`,
    purchased.id,
  ]);
  const consumed = await credits.consumeReservation({ owner, reservationId: reservation.id, resultType: "tarot_reading", resultId: "reading-priority" });
  assert.equal(consumed.status, "CONSUMED");
  assert.equal((await credits.getBalance(owner)).totalUnits, 1);
});
