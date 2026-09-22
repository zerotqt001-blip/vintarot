import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { adjustAdminMemberCredits, grantAdminVip, revokeAdminVip } from "../lib/admin/actions";
import { getAdminDashboard, getAdminMemberDetail, listAdminMemberReadings, listAdminMembers } from "../lib/admin/read-model";
import { permissionsForRole, type AdminRole, type Permission } from "../lib/admin/permissions";
import { activateEntitlement } from "../lib/entitlements";
import { createCreditStore } from "../lib/credits/repository";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import type { AdminActor } from "../lib/admin/context";

const repoRoot = join(import.meta.dirname, "..");

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of [
    "0000_vengeful_ben_urich.sql",
    "0001_dynamic_tarot.sql",
    "0002_tarot_seed.sql",
    "0003_moonlight_spread_catalog.sql",
    "0004_member_auth.sql",
    "0004_reading_payload.sql",
    "0005_natarot_share_persistence.sql",
    "0006_credits_vip.sql",
    "0007_backend_completion.sql",
  ]) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

function actor(role: AdminRole = "SUPER_ADMIN", memberId = "member-admin"): AdminActor {
  return { memberId, role, permissions: permissionsForRole(role) };
}

async function insertMember(database: ReturnType<typeof createSqliteD1Database>, input: { id: string; role?: AdminRole; disabled?: boolean }) {
  await database.prepare("INSERT INTO members (id, username, email, phone, display_name, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(input.id, input.id, `${input.id}@example.test`, "+84912345678", `Display ${input.id}`, 100, 100, input.disabled ? 1 : 0, input.role ?? "USER").run();
}

async function seedTargetData(database: ReturnType<typeof createSqliteD1Database>) {
  await insertMember(database, { id: "member-admin", role: "SUPER_ADMIN" });
  await insertMember(database, { id: "member-alpha" });
  await insertMember(database, { id: "member-beta" });

  const owner = { kind: "member" as const, ownerId: "member:member-alpha" };
  await createCreditStore(database, () => 1_000).grantCredits({
    owner,
    source: "PROMOTION",
    units: 7,
    grantKey: "fixture-alpha",
    policyVersion: "test-v1",
    policySnapshot: { fixture: true },
    reason: "fixture credit",
  });
  await activateEntitlement(database, {
    owner,
    entitlementType: "VIP",
    benefitVersion: "vip-fixture-v1",
    startsAt: 1,
    endsAt: 10_000_000_000_000,
    sourceType: "ADMIN",
    sourceId: "member-admin",
    grantKey: "fixture-alpha-vip",
    benefitSnapshot: { fixture: true },
    now: 1_000,
  });

  await database.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES ('package-fixture', 'fixture', 'Fixture', 'Fixture', 1, 1, 1)").run();
  await database.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, created_at) VALUES ('package-version-fixture', 'package-fixture', 1, 12345, 'VND', 7, NULL, ?, 'test-v1', 'active', 1, 1)")
    .bind(JSON.stringify({ credits: { units: 7 } })).run();
  await database.prepare("INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status, idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at) VALUES ('order-alpha', 'credit-account:member:member:member-alpha', 'package-fixture', 'package-version-fixture', ?, 12345, 'VND', 'FULFILLED', 'order-fixture', 'fingerprint-fixture', 'payment-alpha-secret', 1, 2, 3)")
    .bind(JSON.stringify({ private: "package-snapshot" })).run();

  await database.prepare("INSERT INTO affiliate_profiles (id, member_id, status, created_at, updated_at) VALUES ('affiliate-alpha', 'member-alpha', 'ACTIVE', 1, 1)").run();
  await database.prepare("INSERT INTO affiliate_profiles (id, member_id, status, created_at, updated_at) VALUES ('affiliate-beta', 'member-beta', 'SUSPENDED', 1, 1)").run();
  await database.prepare("INSERT INTO records (id, owner, kind, data, created, updated) VALUES ('reading-alpha', 'member:member-alpha', 'tarot-reading', ?, 10, 20)")
    .bind(JSON.stringify({ question: "private question", reading_payload: "private-reading-payload", session_id: "session-alpha" })).run();
  await database.prepare("INSERT INTO records (id, owner, kind, data, created, updated) VALUES ('reading-beta', 'member:member-beta', 'tarot-reading', ?, 11, 21)")
    .bind(JSON.stringify({ question: "other private question" })).run();
  const category = await database.prepare("SELECT id FROM spread_categories ORDER BY id LIMIT 1").first<{ id: string }>();
  const template = await database.prepare("SELECT id, spread_type, card_count FROM spread_templates ORDER BY id LIMIT 1").first<{ id: string; spread_type: string; card_count: number }>();
  if (!category || !template) throw new Error("Fixture spread catalog is unavailable");
  await database.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, ?, NULL, ?, '', ?, ?, ?, ?, 'en', 'complete', ?, ?)")
    .bind("session-alpha", "member:member-alpha", "private session question", category.id, template.id, template.spread_type, template.card_count, 12, 13).run();
}

test("Admin search and detail projections are masked, metadata-first, and owner-scoped", async () => {
  const fixtureData = fixture();
  await seedTargetData(fixtureData.database);

  const matches = await listAdminMembers(fixtureData.database, actor(), { search: "alpha", limit: 20 });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.id, "member-alpha");
  assert.equal(matches[0]?.emailMasked, "m••••@example.test");
  assert.equal(matches[0]?.phoneMasked, "+84•••••••78");
  assert.doesNotMatch(JSON.stringify(matches), /member-alpha@example\.test|\+84912345678/);

  const detail = await getAdminMemberDetail(fixtureData.database, actor(), "member-alpha");
  assert.equal(detail.member.id, "member-alpha");
  const credits = detail.credits;
  assert.ok(credits);
  assert.equal(credits.balance.totalUnits, 7);
  const vip = detail.vip;
  assert.ok(vip);
  assert.equal(vip.length, 1);
  assert.ok(detail.orders);
  assert.equal(detail.orders.length, 1);
  assert.ok(detail.orders.every((order) => order.memberId === "member-alpha"));
  assert.equal(detail.orders[0]?.paymentReferenceMasked, "•••••••••••••••cret");
  const affiliate = detail.affiliate;
  assert.ok(affiliate);
  assert.equal(affiliate.profile?.id, "affiliate-alpha");
  assert.equal(affiliate.profile?.status, "ACTIVE");
  assert.ok(detail.readingUsage);
  assert.equal(detail.readingUsage.total, 2);
  assert.equal(detail.readingUsage.saved, 1);
  assert.equal(detail.readingUsage.sessions, 1);
  assert.doesNotMatch(JSON.stringify(detail), /private-reading-payload|private question|payment-alpha-secret|package-snapshot/);

  const readings = await listAdminMemberReadings(fixtureData.database, actor(), "member-alpha", 20);
  assert.deepEqual(readings.items.map((item) => item.id), ["reading-alpha"]);
  assert.equal(readings.items[0]?.sessionId, "session-alpha");
  assert.equal(Object.hasOwn(readings.items[0] as object, "data"), false);

  fixtureData.sqlite.close();
});

test("Admin dashboard exposes bounded operational counts without financial payloads", async () => {
  const fixtureData = fixture();
  await seedTargetData(fixtureData.database);
  const dashboard = await getAdminDashboard(fixtureData.database, actor(), { now: 1_000 });
  assert.deepEqual(dashboard.members, { total: 3, active: 3, disabled: 0 });
  assert.equal(dashboard.readings.saved, 2);
  assert.deepEqual(dashboard.orders, { total: 1, pending: 0, fulfilled: 1 });
  assert.equal(dashboard.vip.active, 1);
  assert.equal(JSON.stringify(dashboard).includes("payment-alpha-secret"), false);
  fixtureData.sqlite.close();
});

test("Admin credit commands use the canonical ledger and create one replay-safe audit event", async () => {
  const fixtureData = fixture();
  await seedTargetData(fixtureData.database);
  const staff = actor();

  const positive = await adjustAdminMemberCredits(fixtureData.database, staff, { memberId: "member-alpha", units: 5, reason: "owner QA credit grant", idempotencyKey: "qa-credit-1" });
  const replay = await adjustAdminMemberCredits(fixtureData.database, staff, { memberId: "member-alpha", units: 5, reason: "owner QA credit grant", idempotencyKey: "qa-credit-1" });
  assert.equal(positive.id, replay.id);
  assert.equal((await createCreditStore(fixtureData.database, () => 1_000).getBalance({ kind: "member", ownerId: "member:member-alpha" })).totalUnits, 12);
  assert.equal((await fixtureData.database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE account_id='credit-account:member:member:member-alpha' AND idempotency_key LIKE 'grant:adjustment:%qa-credit-1' ").first<{ count: number }>())?.count, 1);
  assert.equal((await fixtureData.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='credits.adjusted' AND target_id='member-alpha'").first<{ count: number }>())?.count, 1);

  await assert.rejects(() => adjustAdminMemberCredits(fixtureData.database, staff, { memberId: "member-alpha", units: -1, reason: "owner QA credit grant", idempotencyKey: "qa-credit-1" }), (error: unknown) => error instanceof Error && error.message.includes("different request"));
  assert.equal((await createCreditStore(fixtureData.database, () => 1_000).getBalance({ kind: "member", ownerId: "member:member-alpha" })).totalUnits, 12);

  await assert.rejects(() => adjustAdminMemberCredits(fixtureData.database, staff, { memberId: "member-alpha", units: -2, reason: "", idempotencyKey: "qa-credit-2" }));
  const negative = await adjustAdminMemberCredits(fixtureData.database, staff, { memberId: "member-alpha", units: -2, reason: "owner QA correction", idempotencyKey: "qa-credit-2" });
  assert.ok(negative.id);
  assert.equal((await createCreditStore(fixtureData.database, () => 1_000).getBalance({ kind: "member", ownerId: "member:member-alpha" })).totalUnits, 10);
  assert.equal((await fixtureData.database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE account_id='credit-account:member:member:member-alpha' AND event_type='ADJUSTMENT'").first<{ count: number }>())?.count, 2);
  fixtureData.sqlite.close();
});

test("Admin financial mutations roll back when their required audit insert fails", async () => {
  const creditFixture = fixture();
  await seedTargetData(creditFixture.database);
  creditFixture.sqlite.exec("CREATE TRIGGER fail_admin_credit_audit BEFORE INSERT ON audit_events WHEN NEW.action='credits.adjusted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(() => adjustAdminMemberCredits(creditFixture.database, actor(), { memberId: "member-alpha", units: 4, reason: "audit rollback test", idempotencyKey: "audit-rollback-credit" }));
  assert.equal((await createCreditStore(creditFixture.database, () => 1_000).getBalance({ kind: "member", ownerId: "member:member-alpha" })).totalUnits, 7);
  assert.equal((await creditFixture.database.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE event_type='ADJUSTMENT'").first<{ count: number }>())?.count, 0);
  assert.equal((await creditFixture.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='credits.adjusted'").first<{ count: number }>())?.count, 0);
  creditFixture.sqlite.close();

  const vipFixture = fixture();
  await seedTargetData(vipFixture.database);
  vipFixture.sqlite.exec("CREATE TRIGGER fail_admin_vip_audit BEFORE INSERT ON audit_events WHEN NEW.action='vip.granted' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(() => grantAdminVip(vipFixture.database, actor(), { memberId: "member-alpha", benefitVersion: "vip-audit-rollback", startsAt: 2_000, endsAt: 3_000, benefitSnapshot: { source: "test" }, reason: "audit rollback test", idempotencyKey: "audit-rollback-vip" }));
  assert.equal((await vipFixture.database.prepare("SELECT COUNT(*) AS count FROM entitlements WHERE benefit_version='vip-audit-rollback'").first<{ count: number }>())?.count, 0);
  assert.equal((await vipFixture.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='vip.granted'").first<{ count: number }>())?.count, 0);
  vipFixture.sqlite.close();
});

test("Admin VIP commands use entitlement invariants and audit grant/revoke", async () => {
  const fixtureData = fixture();
  await seedTargetData(fixtureData.database);
  const staff = actor();
  const granted = await grantAdminVip(fixtureData.database, staff, { memberId: "member-alpha", benefitVersion: "vip-admin-v1", startsAt: 2_000, endsAt: 3_000, benefitSnapshot: { source: "owner-qa" }, reason: "owner QA VIP grant", idempotencyKey: "qa-vip-1" });
  assert.equal(granted.sourceType, "ADMIN");
  assert.equal((await fixtureData.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='vip.granted'").first<{ count: number }>())?.count, 1);
  const revoked = await revokeAdminVip(fixtureData.database, staff, { memberId: "member-alpha", entitlementId: granted.id, reason: "owner QA VIP revoke", idempotencyKey: "qa-vip-revoke-1" });
  assert.equal(revoked, true);
  const revokedReplay = await revokeAdminVip(fixtureData.database, staff, { memberId: "member-alpha", entitlementId: granted.id, reason: "owner QA VIP revoke", idempotencyKey: "qa-vip-revoke-1" });
  assert.equal(revokedReplay, true);
  assert.equal((await fixtureData.database.prepare("SELECT status FROM entitlements WHERE id=?").bind(granted.id).first<{ status: string }>())?.status, "CANCELLED");
  assert.equal((await fixtureData.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='vip.revoked'").first<{ count: number }>())?.count, 1);
  fixtureData.sqlite.close();
});

test("Admin read models honor the server permission matrix", async () => {
  const fixtureData = fixture();
  await seedTargetData(fixtureData.database);
  await assert.rejects(() => getAdminDashboard(fixtureData.database, actor("CONTENT_ADMIN")), (error: unknown) => error instanceof Error && error.message === "Forbidden.");
  await assert.rejects(() => listAdminMemberReadings(fixtureData.database, actor("SUPPORT"), "member-alpha"), (error: unknown) => error instanceof Error && error.message === "Forbidden.");
  const supportMatches = await listAdminMembers(fixtureData.database, actor("SUPPORT"), { search: "alpha" });
  assert.equal(supportMatches.length, 1);
  const supportDetail = await getAdminMemberDetail(fixtureData.database, actor("SUPPORT"), "member-alpha");
  assert.equal(supportDetail.credits, null);
  assert.equal(supportDetail.vip, null);
  assert.equal(supportDetail.affiliate, null);
  assert.equal(supportDetail.readingUsage, null);
  assert.deepEqual(supportDetail.readings.items, []);
  const financeDetail = await getAdminMemberDetail(fixtureData.database, actor("FINANCE"), "member-alpha");
  assert.equal(financeDetail.credits?.balance.totalUnits, 7);
  assert.equal(financeDetail.vip?.length, 1);
  assert.equal(financeDetail.affiliate?.profile?.id, "affiliate-alpha");
  assert.equal(financeDetail.readingUsage, null);
  const usersOnlyActor: AdminActor = { ...actor("ADMIN"), permissions: new Set<Permission>(["admin.users.read"]) };
  const restrictedDetail = await getAdminMemberDetail(fixtureData.database, usersOnlyActor, "member-alpha");
  assert.equal(restrictedDetail.orders, null);
  fixtureData.sqlite.close();
});
