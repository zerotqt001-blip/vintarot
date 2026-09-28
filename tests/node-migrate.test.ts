import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { applyMigration } from "../scripts/node-migrate.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationDirectory = join(repoRoot, "drizzle");

function migrationNames(): string[] {
  return readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}

test("Node migration bookkeeping is atomic when a migration statement fails", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL); CREATE TABLE migration_target (id INTEGER PRIMARY KEY)");

  assert.throws(() => applyMigration(
    sqlite,
    "0009_affiliate_referral_links.sql",
    "ALTER TABLE migration_target ADD COLUMN public_code text; CREATE UNIQUE INDEX broken_index ON migration_target(missing_column);",
  ));
  assert.deepEqual(sqlite.prepare("PRAGMA table_info(migration_target)").all().map((row) => row.name), ["id"]);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get() as { count: number }).count, 0);
  sqlite.close();
});

function createPreShareDatabase(dbPath: string): void {
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const migrations = migrationNames()
    .filter((name) => Number(name.slice(0, 4)) < 5)
    .sort();
  for (const name of migrations) {
    sqlite.exec(readFileSync(join(migrationDirectory, name), "utf8"));
    sqlite.prepare("INSERT INTO natarot_migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
  }
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("member-legacy", "legacy_reader", "legacy@example.test", "", 1, 1, 0);
  sqlite.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("session-legacy", "member-legacy", null, "A legacy question", "", "category-everyday", "spread-everyday-persona-obstacle-solution", "row-3", 3, "en", "complete", 1, 1);
  sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("reading-legacy", "session-legacy", "opening", "[]", "synthesis", "advice", "closing", "disclaimer", "legacy-model", "legacy-prompt", 1, 1);
  sqlite.close();
}

function createPreCampaignDatabase(dbPath: string): void {
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  for (const name of migrationNames().filter((migration) => Number(migration.slice(0, 4)) < 14)) {
    applyMigration(sqlite, name, readFileSync(join(migrationDirectory, name), "utf8"), 1);
  }
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("legacy-member", "legacy_reader", "legacy@example.test", "", 1, 1, 0);
  const accountId = "credit-account:member:member:legacy-member";
  sqlite.prepare("INSERT INTO credit_accounts (id, owner_kind, owner_id, mutation_version, mutation_token, created_at, updated_at) VALUES (?, 'member', ?, 3, NULL, 1, 2)")
    .run(accountId, "member:legacy-member");
  const grants = [
    { id: "legacy-trial-grant", source: "TRIAL", sourceType: "SIGNUP_TRIAL", key: "signup-trial:v1", units: 1, expiresAt: null },
    { id: "legacy-purchase-grant", source: "PURCHASE", sourceType: "COMMERCIAL_ORDER", key: "order:legacy", units: 4, expiresAt: null },
    { id: "legacy-promotion-grant", source: "PROMOTION", sourceType: "LEGACY_PROMO", key: "promo:legacy", units: 2, expiresAt: 50_000 },
  ];
  for (const grant of grants) {
    const fingerprint = grant.id.padEnd(64, "0").slice(0, 64);
    sqlite.prepare(`INSERT INTO credit_grants (id, account_id, source, source_type, source_id, grant_key, request_fingerprint,
      units, available_units, eligible_from, expires_at, policy_version, policy_snapshot, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'legacy-reference', ?, ?, ?, ?, 10, ?, 'legacy-v1', '{}', 10, 10)`)
      .run(grant.id, accountId, grant.source, grant.sourceType, grant.key, fingerprint, grant.units, grant.units, grant.expiresAt);
    sqlite.prepare(`INSERT INTO credit_ledger (id, account_id, grant_id, reservation_id, event_type, units, reference_type, reference_id,
      idempotency_key, request_fingerprint, actor_kind, actor_id, reason, effective_at, created_at, reversed_entry_id)
      VALUES (?, ?, ?, NULL, 'GRANT', ?, 'legacy', ?, ?, ?, 'system', NULL, 'Legacy grant', 10, 10, NULL)`)
      .run(`ledger-${grant.id}`, accountId, grant.id, grant.units, grant.id, `grant:${grant.key}`, fingerprint);
  }
  sqlite.prepare(`INSERT INTO credit_reservations (id, account_id, usage_type, units, resource_type, resource_id, idempotency_key,
    request_fingerprint, status, lease_expires_at, retry_count, result_type, result_id, reason, created_at, updated_at, consumed_at, released_at)
    VALUES ('legacy-reservation', ?, 'AI_READING', 1, 'reading', 'legacy-reading', 'legacy-reservation-key', ?, 'RESERVED', NULL, 0, NULL, NULL, 'Legacy reservation', 11, 11, NULL, NULL)`)
    .run(accountId, "r".repeat(64));
  sqlite.prepare(`INSERT INTO credit_reservation_allocations (id, reservation_id, grant_id, held_units, consumed_units, released_units, created_at, updated_at)
    VALUES ('legacy-allocation', 'legacy-reservation', 'legacy-purchase-grant', 1, 0, 0, 11, 11)`);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES ('legacy-package', 'legacy-package', 'Legacy', 'Cũ', 1, 1, 1)").run();
  sqlite.prepare(`INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds,
    benefit_snapshot, policy_version, status, starts_at, ends_at, created_at)
    VALUES ('legacy-package-v1', 'legacy-package', 1, 100, 'VND', 4, NULL, '{}', 'legacy-v1', 'active', 1, NULL, 1)`).run();
  sqlite.prepare(`INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status,
    idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at, cancelled_at, refunded_at)
    VALUES ('legacy-order', ?, 'legacy-package', 'legacy-package-v1', '{}', 100, 'VND', 'FULFILLED', 'legacy-order-key', ?,
      'legacy-payment', 12, 12, 13, NULL, NULL)`)
    .run(accountId, "o".repeat(64));
  sqlite.prepare(`INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at, updated_at)
    VALUES ('legacy-fulfillment', 'legacy-order', 'legacy-fulfillment-key', '{}', 13, 13)`).run();
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, created_at, updated_at) VALUES ('legacy-affiliate', 'legacy-member', 'ACTIVE', 1, 1)").run();
  sqlite.prepare(`INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at)
    VALUES ('legacy-referral-code', 'legacy-affiliate', ?, 'ACTIVE', 'legacy-fixture', 1, NULL)`)
    .run("c".repeat(64));
  sqlite.prepare(`INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at)
    VALUES ('legacy-attribution', 'member:legacy-member', 'legacy-member', 'legacy-affiliate', 'legacy-referral-code', 'legacy-fixture', 1, 100000, 1)`).run();
  sqlite.prepare(`INSERT INTO affiliate_conversions (id, event_key, order_id, fulfillment_id, member_id, attribution_id, affiliate_profile_id,
    policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference, package_snapshot, status, fulfilled_at,
    eligible_at, reversed_at, created_at, updated_at)
    VALUES ('legacy-conversion', 'legacy-event', 'legacy-order', 'legacy-fulfillment', 'legacy-member', 'legacy-attribution',
      'legacy-affiliate', 'affiliate-v1-default', 'affiliate-v1-default-tier-1', 100, 'VND', 10, 'legacy-payment', '{}',
      'HELD', 13, NULL, NULL, 13, 13)`).run();
  sqlite.prepare(`INSERT INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency,
    idempotency_key, reason, policy_snapshot, tier_snapshot, package_snapshot, created_at)
    VALUES ('legacy-commission', 'legacy-conversion', 'COMMISSION', 'CREDIT', 10, 'VND', 'legacy-commission-key',
      'Legacy commission', '{}', '{}', '{}', 13)`).run();
  sqlite.close();
}

test("Node migration bootstrap applies and repeats the full schema and seed", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-migrate-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { ...process.env, NATAROT_DB_PATH: dbPath };

  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], { cwd: repoRoot, env, stdio: "pipe" });

  const sqlite = new DatabaseSync(dbPath);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM tarot_cards").get() as { count: number }).count, 78);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM card_meanings").get() as { count: number }).count, 312);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations").get() as { count: number }).count, migrationNames().length);
  assert.deepEqual(
    sqlite.prepare("SELECT name FROM natarot_migrations ORDER BY name").all().map((row) => row.name),
    migrationNames(),
  );
  const columns = sqlite.prepare("PRAGMA table_info(readings)").all() as Array<{ name: string }>;
  assert.ok(columns.some((column) => column.name === "reading_payload"));
  for (const table of ["reading_shares", "share_events"]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
    );
  }
  const shareIndexes = sqlite.prepare("PRAGMA index_list('reading_shares')").all() as Array<{ name: string; unique: number; partial: number }>;
  assert.ok(shareIndexes.some((index) => index.name === "reading_shares_token_hash_unique" && index.unique === 1));
  assert.ok(shareIndexes.some((index) => index.name === "reading_shares_active_reading_unique" && index.unique === 1 && index.partial === 1));
  const shareColumns = sqlite.prepare("PRAGMA table_info('reading_shares')").all() as Array<{ name: string }>;
  assert.ok(shareColumns.some((column) => column.name === "token_hash"));
  assert.ok(!shareColumns.some((column) => column.name === "token" || column.name === "owner" || column.name === "user_id" || column.name === "guest_id"));
  const shareSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='reading_shares'").get() as { sql: string }).sql;
  const eventSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='share_events'").get() as { sql: string }).sql;
  assert.match(shareSql, /`status`\s+IN\s*\('active',\s*'revoked',\s*'expired'\)/i);
  assert.ok(eventSql.includes("CHECK (`event_name` IN ('share_created', 'share_opened', 'share_image_generated', 'share_image_downloaded', 'share_cta_clicked'))"));
  const shareForeignKeys = sqlite.prepare("PRAGMA foreign_key_list('reading_shares')").all() as Array<{ table: string; on_delete: string }>;
  assert.ok(shareForeignKeys.some((foreignKey) => foreignKey.table === "readings" && foreignKey.on_delete.toUpperCase() === "CASCADE"));
  const eventForeignKeys = sqlite.prepare("PRAGMA foreign_key_list('share_events')").all() as Array<{ table: string; on_delete: string }>;
  assert.ok(eventForeignKeys.some((foreignKey) => foreignKey.table === "reading_shares" && foreignKey.on_delete.toUpperCase() === "CASCADE"));
  for (const table of ["members", "auth_sessions", "auth_tokens", "oauth_states"]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
    );
  }
  for (const table of [
    "credit_accounts",
    "credit_grants",
    "credit_ledger",
    "credit_reservations",
    "credit_reservation_allocations",
    "packages",
    "package_versions",
    "orders",
    "entitlements",
    "order_fulfillments",
    "commercial_events",
    "commercial_payment_attempts",
    "commercial_payment_events",
    "readers",
    "reader_avatars",
  ]) {
    assert.equal(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name=?").get(table) as {
        count: number;
      }).count,
      1,
      `expected ${table} to exist`,
    );
  }
  const creditAccountIndexes = sqlite.prepare("PRAGMA index_list('credit_accounts')").all() as Array<{ name: string; unique: number }>;
  assert.ok(creditAccountIndexes.some((index) => index.name === "credit_accounts_owner_unique" && index.unique === 1));
  const reservationIndexes = sqlite.prepare("PRAGMA index_list('credit_reservations')").all() as Array<{ name: string; unique: number }>;
  assert.ok(reservationIndexes.some((index) => index.name === "credit_reservations_owner_key_unique" && index.unique === 1));
  const grantSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='credit_grants'").get() as { sql: string }).sql;
  assert.match(grantSql, /`available_units`\s+INTEGER\s+NOT NULL/i);
  assert.match(grantSql, /CHECK\s*\(`available_units`\s*>=\s*0\s+AND\s+`available_units`\s*<=\s*`units`\)/i);
  const ledgerSql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='credit_ledger'").get() as { sql: string }).sql;
  assert.match(ledgerSql, /`units`\s+INTEGER\s+NOT NULL/i);
  assert.match(ledgerSql, /CHECK\s*\(`units`\s*<>\s*0\)/i);
  const paymentEventIndexes = sqlite.prepare("PRAGMA index_list('commercial_payment_events')").all() as Array<{ name: string; unique: number; partial: number }>;
  assert.ok(paymentEventIndexes.some((index) => index.name === "commercial_payment_events_provider_key_unique" && index.unique === 1));
  assert.ok(paymentEventIndexes.some((index) => index.name === "commercial_payment_events_transaction_unique" && index.unique === 1 && index.partial === 1));
  const fulfillmentColumns = sqlite.prepare("PRAGMA table_info('order_fulfillments')").all() as Array<{ name: string; dflt_value: string | null }>;
  assert.ok(fulfillmentColumns.some((column) => column.name === "payment_event_id"));
  assert.ok(fulfillmentColumns.some((column) => column.name === "updated_at" && column.dflt_value === "0"));
  const orderColumns = sqlite.prepare("PRAGMA table_info('orders')").all() as Array<{ name: string }>;
  assert.ok(orderColumns.some((column) => column.name === "fulfillment_started_at"));
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});

test("Node migration bootstrap runs when invoked through a symlinked current release path", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-migrate-symlink-"));
  const linkedProject = join(directory, "current");
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  symlinkSync(repoRoot, linkedProject, "dir");

  execFileSync(process.execPath, [join(linkedProject, "scripts/node-migrate.mjs")], {
    cwd: linkedProject,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const sqlite = new DatabaseSync(dbPath);
  assert.equal(
    (sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name='0011_business_reporting.sql'").get() as { count: number }).count,
    1,
  );
  sqlite.close();
});

test("Node migration upgrades an existing pre-share database without losing member or reading data", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-migrate-upgrade-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  createPreShareDatabase(dbPath);

  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const sqlite = new DatabaseSync(dbPath);
  assert.deepEqual(
    sqlite.prepare("SELECT id, username FROM members").all().map(({ id, username }) => ({ id, username })),
    [{ id: "member-legacy", username: "legacy_reader" }],
  );
  assert.deepEqual(
    sqlite.prepare("SELECT id, session_id FROM readings").all().map(({ id, session_id }) => ({ id, session_id })),
    [{ id: "reading-legacy", session_id: "session-legacy" }],
  );
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0005_%'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0006_%'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0007_%'").get() as { count: number }).count, 2);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0008_%'").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM natarot_migrations WHERE name LIKE '0009_%'").get() as { count: number }).count, 2);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM reading_shares").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM credit_accounts").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_policy_versions").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM readers").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM reader_avatars").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_attempts").get() as { count: number }).count, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM commercial_payment_events").get() as { count: number }).count, 0);
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  sqlite.close();
});

test("campaign migrations preserve legacy Credit accounts, grants, ledger, reservations, and allocations", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-campaign-migration-"));
  const dbPath = join(directory, "natarot.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  createPreCampaignDatabase(dbPath);
  const sqlite = new DatabaseSync(dbPath);
  const preservedTables = [
    "credit_accounts",
    "credit_grants",
    "credit_ledger",
    "credit_reservations",
    "credit_reservation_allocations",
    "orders",
    "order_fulfillments",
    "affiliate_profiles",
    "referral_codes",
    "referral_attributions",
    "affiliate_conversions",
    "affiliate_commission_ledger",
  ];
  const before = Object.fromEntries(preservedTables.map((table) => [
    table,
    sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  ]));
  sqlite.close();

  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });

  const migrated = new DatabaseSync(dbPath);
  for (const table of preservedTables) {
    assert.deepEqual(migrated.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(), before[table], `${table} changed during campaign migrations`);
  }
  assert.deepEqual(migrated.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(
    migrated.prepare("SELECT id, status, reward_units, budget_used_units FROM marketing_campaigns ORDER BY id").all()
      .map((row) => ({ ...row })),
    [
      { id: "daily-rewards-v1", status: "PAUSED", reward_units: 1, budget_used_units: 0 },
      { id: "welcome-bonus-v1", status: "ACTIVE", reward_units: 1, budget_used_units: 1 },
    ],
  );
  const appliedCampaignMigrations = migrated.prepare("SELECT name FROM natarot_migrations WHERE name >= '0014_' ORDER BY name").all();
  assert.deepEqual(appliedCampaignMigrations.map(({ name }) => name), [
    "0014_marketing_campaigns.sql",
    "0015_business_reporting_campaigns.sql",
    "0016_credit_grant_expiry_index.sql",
  ]);
  const expiryIndexes = migrated.prepare("PRAGMA index_list('credit_grants')").all() as Array<{ name: string; partial: number }>;
  assert.ok(expiryIndexes.some((index) => index.name === "credit_grants_expiry_idx" && index.partial === 1));
  assert.deepEqual(
    migrated.prepare("PRAGMA index_info('credit_grants_expiry_idx')").all().map(({ name }) => name),
    ["expires_at", "id"],
  );
  const expiryIndexSql = (migrated.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='credit_grants_expiry_idx'").get() as { sql: string }).sql;
  assert.match(expiryIndexSql, /WHERE `expires_at` IS NOT NULL AND `available_units` > 0/i);
  migrated.close();
});
