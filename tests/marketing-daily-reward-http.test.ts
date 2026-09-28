import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { createMemberAuthStore, SESSION_COOKIE_NAME } from "../lib/member-auth";
import { createDailyRewardHandlers } from "../lib/marketing/handlers";
import { createMarketingRewardHandlers } from "../lib/marketing/handlers";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-daily-reward-http-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  const now = { value: Date.parse("2026-01-01T12:00:00Z") };
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  const auth = createMemberAuthStore(database);
  const handlers = createDailyRewardHandlers(database, () => now.value);
  const rewardHandlers = createMarketingRewardHandlers(database, () => now.value);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { auth, database, handlers, now, rewardHandlers, sqlite };
}

function insertMember(sqlite: DatabaseSync, id: string): void {
  const timestamp = Date.parse("2025-12-01T00:00:00Z");
  sqlite.prepare(`INSERT INTO members
    (id, username, email, phone, email_verified_at, created_at, updated_at, disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(id, id, `${id}@example.test`, "+84900000000", timestamp, timestamp, timestamp);
}

function sessionRequest(path: string, token?: string): Request {
  return new Request(`https://natarot.test${path}`, {
    method: path.endsWith("claim") ? "POST" : "GET",
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

test("Daily Rewards endpoints require a current member session and reject anonymous claims", async (context) => {
  const { handlers, sqlite } = makeFixture(context);
  const read = await handlers.GET(sessionRequest("/api/marketing/daily-rewards"));
  const claim = await handlers.POST(sessionRequest("/api/marketing/daily-rewards/claim"));

  assert.equal(read.status, 401);
  assert.equal(claim.status, 401);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims").get() as { count: number }).count, 0);
});

test("Daily Rewards claim derives its owner only from the authenticated session", async (context) => {
  const { auth, handlers, sqlite, now } = makeFixture(context);
  insertMember(sqlite, "session-owner");
  insertMember(sqlite, "forged-target");
  sqlite.prepare("UPDATE marketing_campaigns SET status='ACTIVE', start_at=0 WHERE id='daily-rewards-v1'").run();
  const session = await auth.createSession("session-owner", false);

  const response = await handlers.POST(new Request("https://natarot.test/api/marketing/daily-rewards/claim", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${session.raw}`, "content-type": "application/json", origin: "https://natarot.test" },
    body: JSON.stringify({ member_id: "forged-target", claim_period: "2099-01-01", units: 999_999, grant_key: "replayed" }),
  }));
  const body = await response.json() as { result?: { status?: string; units?: number } };

  assert.equal(response.status, 200);
  assert.equal(body.result?.status, "claimed");
  assert.equal(body.result?.units, 1);
  assert.equal((sqlite.prepare("SELECT member_id FROM marketing_campaign_claims").get() as { member_id: string }).member_id, "session-owner");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims WHERE member_id='forged-target'").get() as { count: number }).count, 0);
  assert.equal(now.value, Date.parse("2026-01-01T12:00:00Z"));
});

test("stale or disabled sessions cannot claim after authorization changes", async (context) => {
  const { auth, handlers, sqlite } = makeFixture(context);
  insertMember(sqlite, "disabled-session-owner");
  const session = await auth.createSession("disabled-session-owner", false);
  sqlite.prepare("UPDATE members SET disabled=1 WHERE id='disabled-session-owner'").run();

  const response = await handlers.POST(sessionRequest("/api/marketing/daily-rewards/claim", session.raw));
  assert.equal(response.status, 401);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims").get() as { count: number }).count, 0);
});

test("authenticated campaign rewards use the session owner and return no member identifiers", async (context) => {
  const { auth, rewardHandlers, sqlite } = makeFixture(context);
  insertMember(sqlite, "reward-session-owner");
  insertMember(sqlite, "reward-forged-target");
  sqlite.prepare("UPDATE marketing_campaigns SET status='ACTIVE', start_at=0 WHERE id='daily-rewards-v1'").run();
  const session = await auth.createSession("reward-session-owner", false);
  const headers = { cookie: `${SESSION_COOKIE_NAME}=${session.raw}`, "content-type": "application/json", origin: "https://natarot.test" };
  const listResponse = await rewardHandlers.GET(new Request("https://natarot.test/api/marketing/rewards", { headers }));
  const listBody = await listResponse.json() as { rewards?: Array<{ campaign: { id: string }; state: { status: string } }> };
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.rewards?.find((item) => item.campaign.id === "daily-rewards-v1")?.state.status, "eligible");
  assert.equal(JSON.stringify(listBody).includes("reward-session-owner"), false);

  const response = await rewardHandlers.claimPOST(new Request("https://natarot.test/api/marketing/rewards/daily-rewards-v1", {
    method: "POST", headers, body: JSON.stringify({ member_id: "reward-forged-target", units: 9_999_999 }),
  }), "daily-rewards-v1");
  const body = await response.json() as { result?: { status?: string; units?: number } };
  assert.equal(response.status, 200);
  assert.equal(body.result?.status, "claimed");
  assert.equal(body.result?.units, 1);
  assert.equal((sqlite.prepare("SELECT member_id FROM marketing_campaign_claims").get() as { member_id: string }).member_id, "reward-session-owner");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM marketing_campaign_claims WHERE member_id='reward-forged-target'").get() as { count: number }).count, 0);
});
