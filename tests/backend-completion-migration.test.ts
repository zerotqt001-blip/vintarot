import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");
const migrationDirectory = join(repoRoot, "drizzle");

function migrationNames(): string[] {
  return readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}

function applyMigrations(sqlite: DatabaseSync, beforeBackend = false): void {
  for (const name of migrationNames()) {
    if (beforeBackend && name.startsWith("0007_")) break;
    sqlite.exec(readFileSync(join(migrationDirectory, name), "utf8"));
  }
}

function columns(sqlite: DatabaseSync, table: string): string[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function tableExists(sqlite: DatabaseSync, table: string): boolean {
  return Boolean((sqlite.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { present?: number } | undefined)?.present);
}

test("the two historical 0007 migrations are additive and preserve backend/commercial tables", () => {
  const names = migrationNames();
  assert.deepEqual(names.slice(-3), ["0006_credits_vip.sql", "0007_backend_completion.sql", "0007_sepay_commercial.sql"]);

  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite);

  for (const column of ["role", "disabled_at", "disabled_reason", "disabled_by"]) {
    assert.ok(columns(sqlite, "members").includes(column), `members.${column}`);
  }
  assert.ok(columns(sqlite, "auth_sessions").includes("session_id"));
  for (const table of [
    "audit_events",
    "affiliate_profiles",
    "referral_codes",
    "referral_attributions",
    "affiliate_policy_versions",
    "affiliate_policy_tiers",
    "affiliate_conversions",
    "affiliate_commission_ledger",
    "commercial_payment_attempts",
    "commercial_payment_events",
  ]) {
    assert.equal(tableExists(sqlite, table), true, `expected ${table}`);
  }

  const policy = sqlite.prepare("SELECT id, status, attribution_window_days, hold_days FROM affiliate_policy_versions WHERE id = ?").get("affiliate-v1-default") as {
    id: string;
    status: string;
    attribution_window_days: number;
    hold_days: number;
  };
  assert.equal(policy.id, "affiliate-v1-default");
  assert.equal(policy.status, "DRAFT");
  assert.equal(policy.attribution_window_days, 30);
  assert.equal(policy.hold_days, 7);
  assert.deepEqual(
    (sqlite.prepare("SELECT tier_code, min_qualified_conversions, rate_bps FROM affiliate_policy_tiers WHERE policy_version_id = ? ORDER BY min_qualified_conversions").all("affiliate-v1-default") as Array<Record<string, unknown>>).map((row) => ({ ...row })),
    [
      { tier_code: "TIER_1", min_qualified_conversions: 0, rate_bps: 1000 },
      { tier_code: "TIER_2", min_qualified_conversions: 10, rate_bps: 2000 },
      { tier_code: "TIER_3", min_qualified_conversions: 30, rate_bps: 3000 },
    ],
  );
  for (const table of ["audit_events", "referral_codes", "affiliate_conversions", "affiliate_commission_ledger"]) {
    const indexes = sqlite.prepare(`PRAGMA index_list(${table})`).all() as Array<{ unique: number }>;
    assert.ok(indexes.some((index) => index.unique === 1), `expected a unique index on ${table}`);
  }
  assert.ok((sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get() as { count: number }).count > 0);
  assert.ok((sqlite.prepare("SELECT COUNT(*) AS count FROM packages").get() as { count: number }).count >= 0);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});

test("0007 upgrades legacy auth rows without changing existing domain tables", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  applyMigrations(sqlite, true);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("member-upgrade", "upgrade_user", "upgrade@example.test", "", 1, 1, 0);
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, member_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .run("token-hash-upgrade", "member-upgrade", 1, 1000, 1);
  const before = (sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get() as { count: number }).count;

  sqlite.exec(readFileSync(join(migrationDirectory, "0007_backend_completion.sql"), "utf8"));

  const member = sqlite.prepare("SELECT id, role, disabled, disabled_at FROM members WHERE id = ?").get("member-upgrade") as {
    id: string;
    role: string;
    disabled: number;
    disabled_at: number | null;
  };
  assert.equal(member.id, "member-upgrade");
  assert.equal(member.role, "USER");
  assert.equal(member.disabled, 0);
  assert.equal(member.disabled_at, null);
  const session = sqlite.prepare("SELECT session_id FROM auth_sessions WHERE token_hash = ?").get("token-hash-upgrade") as { session_id: string };
  assert.match(session.session_id, /^[0-9a-f]{32}$/);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get() as { count: number }).count, before);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM members WHERE id = ?").get("member-upgrade") as { count: number }).count, 1);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});
