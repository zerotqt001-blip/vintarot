import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getAccountSummary, listAccountHistory, listAdminOrderReadModel, decodeHistoryCursor, encodeHistoryCursor } from "../lib/account-history";
import { createCreditStore, creditAccountId } from "../lib/credits/repository";
import { grantManualEntitlement } from "../lib/entitlements";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import type { CreditOwner } from "../lib/credits/types";

const repoRoot = join(import.meta.dirname, "..");
const owner: CreditOwner = { kind: "member", ownerId: "member:owner" };

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
  const now = 1_700_000_000_000;
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES ('owner', 'owner', 'owner@example.test', '+84912345678', ?, ?, 0, 'USER')").run(now, now);
  sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES ('other', 'other', 'other@example.test', '+84987654321', ?, ?, 0, 'USER')").run(now, now);
  return { sqlite, database: createSqliteD1Database(sqlite), now };
}

function seedOwnerData(fixture: ReturnType<typeof fixture>) {
  const { sqlite, now } = fixture;
  const template = sqlite.prepare("SELECT id, category_id, spread_type, card_count FROM spread_templates ORDER BY id LIMIT 1").get() as { id: string; category_id: string; spread_type: string; card_count: number };
  sqlite.prepare("INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id, spread_type, card_count, locale, status, created_at, updated_at) VALUES (?, 'member:owner', NULL, ?, '', ?, ?, ?, ?, 'en', 'complete', ?, ?)").run("session-owner", "private question", template.category_id, template.id, template.spread_type, template.card_count, now, now);
  sqlite.prepare("INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, reading_payload, model_name, prompt_version, created_at, updated_at) VALUES (?, ?, 'opening', '[]', 'synthesis', 'advice', 'closing', 'disclaimer', ?, 'model', 'prompt', ?, ?)").run("reading-owner", "session-owner", "private-reading-payload", now, now);
  sqlite.prepare("INSERT INTO records (id, owner, kind, data, created, updated) VALUES (?, 'member:owner', 'tarot-reading', ?, ?, ?)").run("saved-reading:reading-owner", JSON.stringify({ reading_id: "reading-owner", session_id: "session-owner" }), now, now);
  sqlite.prepare("INSERT INTO reading_shares (id, reading_id, token_hash, status, locale, public_contract_version, geometry_version, renderer_version, created_at, updated_at, revoked_at, expires_at) VALUES ('share-owner', 'reading-owner', 'token-hash-only', 'active', 'en', 's6', 'g1', 'r1', ?, ?, NULL, NULL)").run(now, now);

  const accountId = creditAccountId(owner);
  sqlite.prepare("INSERT OR IGNORE INTO credit_accounts (id, owner_kind, owner_id, mutation_version, created_at, updated_at) VALUES (?, 'member', ?, 0, ?, ?)").run(accountId, owner.ownerId, now, now);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES ('package-account', 'package-account', 'Account', 'Tài khoản', 1, ?, ?)").run(now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, created_at) VALUES ('package-account-v1', 'package-account', 1, 12345, 'VND', 10, 86400, '{}', 'packages-v1', 'active', ?, ?)").run(now - 1, now);
  sqlite.prepare("INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status, idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at, cancelled_at, refunded_at) VALUES ('order-account', ?, 'package-account', 'package-account-v1', 'private-package-snapshot', 12345, 'VND', 'FULFILLED', 'account-order', 'fingerprint', 'payment-ref', ?, ?, ?, NULL, NULL)").run(accountId, now, now, now);
  sqlite.prepare("INSERT INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES ('fulfillment-account', 'order-account', 'fulfillment-key', 'credits-vip-result', ?)").run(now);
  return accountId;
}

test("account history is owner-scoped, metadata-first, and cursor-stable", async () => {
  const fixtureData = fixture();
  seedOwnerData(fixtureData);
  const store = createCreditStore(fixtureData.database, () => fixtureData.now);
  await store.grantCredits({ owner, source: "PROMOTION", units: 4, grantKey: "account-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "test credit" });
  const first = await listAccountHistory({ database: fixtureData.database, owner, kind: "all", limit: 1 });
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  const second = await listAccountHistory({ database: fixtureData.database, owner, kind: "all", limit: 50, cursor: first.nextCursor });
  assert.ok(second.items.length >= 3);
  const allItems = [...first.items, ...second.items];
  assert.equal(new Set(allItems.map((item) => item.id)).size, allItems.length);
  const serialized = JSON.stringify(allItems);
  assert.doesNotMatch(serialized, /private-reading-payload|private-package-snapshot|token-hash-only/);
  assert.ok(allItems.some((item) => item.kind === "reading" && item.savedReadingId === "saved-reading:reading-owner"));
  assert.ok(allItems.some((item) => item.kind === "share" && item.readingId === "reading-owner"));
  assert.ok(allItems.some((item) => item.kind === "order" && item.paymentReference === "payment-ref"));
  assert.ok(allItems.some((item) => item.kind === "credit" && item.units === 4));
  assert.equal((await listAccountHistory({ database: fixtureData.database, owner: { kind: "member", ownerId: "member:other" }, kind: "all" })).items.length, 0);
  await assert.rejects(() => listAccountHistory({ database: fixtureData.database, owner, cursor: "not-a-cursor" }), (error: unknown) => error instanceof Error && error.message === "Invalid history cursor");
  await assert.rejects(() => listAccountHistory({ database: fixtureData.database, owner, limit: 51 }), (error: unknown) => error instanceof Error && error.message === "Invalid history limit");
  fixtureData.sqlite.close();
});

test("account summary exposes own Credits/VIP/member metadata and no auth secrets", async () => {
  const fixtureData = fixture();
  seedOwnerData(fixtureData);
  const store = createCreditStore(fixtureData.database, () => fixtureData.now);
  await store.grantCredits({ owner, source: "PROMOTION", units: 4, grantKey: "summary-credit", policyVersion: "credits-v1", policySnapshot: {}, reason: "summary credit" });
  const entitlement = await grantManualEntitlement({ database: fixtureData.database, owner, entitlementType: "VIP", benefitVersion: "vip-v1", startsAt: fixtureData.now, endsAt: fixtureData.now + 86_400_000, benefitSnapshot: { source: "test" }, idempotencyKey: "summary-vip", reason: "support grant", actorId: "member:admin", now: fixtureData.now });
  const summary = await getAccountSummary({ database: fixtureData.database, owner, now: fixtureData.now });
  assert.equal(summary.member.id, "owner");
  assert.equal(summary.credits.balance.totalUnits, 4);
  assert.equal(summary.vip[0]?.id, entitlement.id);
  assert.equal(summary.counts.readings, 1);
  assert.equal(summary.counts.shares, 1);
  assert.equal(summary.counts.orders, 1);
  assert.doesNotMatch(JSON.stringify(summary), /password_hash|token_hash|private-reading-payload|session_token/);
  fixtureData.sqlite.close();
});

test("admin order read model is provider-neutral and excludes Tarot-private content", async () => {
  const fixtureData = fixture();
  seedOwnerData(fixtureData);
  const models = await listAdminOrderReadModel({ database: fixtureData.database });
  assert.equal(models.length, 1);
  assert.deepEqual(models[0], {
    id: "order-account",
    ownerId: "member:owner",
    status: "FULFILLED",
    amountMinor: 12345,
    currency: "VND",
    paymentReference: "payment-ref",
    createdAt: fixtureData.now,
    paymentConfirmedAt: fixtureData.now,
    fulfilledAt: fixtureData.now,
    refundedAt: null,
    fulfillmentId: "fulfillment-account",
    fulfillmentResultSnapshot: "credits-vip-result",
  });
  assert.doesNotMatch(JSON.stringify(models), /private-reading-payload|private-package-snapshot/);
  assert.equal(decodeHistoryCursor(encodeHistoryCursor(10, "opaque"))?.id, "opaque");
  fixtureData.sqlite.close();
});
