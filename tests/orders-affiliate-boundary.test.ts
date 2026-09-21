import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAffiliateConversion, captureAttribution } from "../lib/affiliate/service";
import { hashReferralCode } from "../lib/affiliate/repository";
import { createPendingOrder, fulfillOrder, recordVerifiedPayment } from "../lib/orders";
import { createCreditStore } from "../lib/credits/repository";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");

test("affiliate conversion is downstream of durable verified fulfillment and replay-safe Credits/VIP fulfillment", async () => {
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
  const database = createSqliteD1Database(sqlite);
  const store = createCreditStore(database, () => now);
  sqlite.prepare("UPDATE affiliate_policy_versions SET status='ACTIVE', starts_at=? WHERE id='affiliate-v1-default'").run(now - 1);
  for (const [id, code] of [["buyer", ""], ["affiliate", "NATAROT-REF"]] as const) {
    sqlite.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, 'USER')").run(id, id, `${id}@example.test`, "+84912345678", now, now);
    if (code) {
      const hash = await hashReferralCode(code);
      sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, created_at, updated_at) VALUES ('profile-boundary', ?, 'ACTIVE', ?, ?)").run(id, now, now);
      sqlite.prepare("INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, created_at) VALUES ('code-boundary', 'profile-boundary', ?, 'ACTIVE', ?)").run(hash, now);
    }
  }
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES ('package-boundary', 'package-boundary', 'Boundary', 'Biên', 1, ?, ?)").run(now, now);
  sqlite.prepare("INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, created_at) VALUES ('package-boundary-v1', 'package-boundary', 1, 9900, 'VND', 10, 86400, ?, 'packages-v1', 'active', ?, ?)").run(JSON.stringify({ credits: { units: 10 }, vip: { durationSeconds: 86400, benefitVersion: "vip-v1", benefits: {} } }), now - 1, now);
  const owner = { kind: "member" as const, ownerId: "member:buyer" };
  const attribution = await captureAttribution({ database, owner, rawCode: "NATAROT-REF", source: "query", now });
  assert.equal(attribution.accepted, true);
  const order = await createPendingOrder({ database, creditStore: store, owner, packageVersionId: "package-boundary-v1", idempotencyKey: "boundary-order", now: () => now });
  await assert.rejects(() => createAffiliateConversion({ database, event: {
    eventKey: "boundary-premature",
    orderId: order.id,
    fulfillmentId: "not-created",
    orderStatus: "FULFILLED",
    memberOwnerId: owner.ownerId,
    paymentReference: "not-stored",
    amountMinor: order.amountMinor,
    currency: order.currency,
    packageSnapshot: JSON.stringify(order.packageSnapshot),
    fulfilledAt: now,
  } }), /not found|fulfillment/i);
  await recordVerifiedPayment(database, { orderId: order.id, paymentReference: "boundary-payment", verifiedAt: now });
  const fulfilled = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now });
  const replay = await fulfillOrder({ database, creditStore: store, orderId: order.id, now: () => now + 1 });
  assert.equal(replay.fulfillment.id, fulfilled.fulfillment.id);
  assert.equal((await store.getBalance(owner)).totalUnits, 10);
  assert.equal((await createAffiliateConversion({ database, event: {
    eventKey: `order:${order.id}:fulfilled`,
    orderId: order.id,
    fulfillmentId: fulfilled.fulfillment.id,
    orderStatus: fulfilled.order.status,
    memberOwnerId: owner.ownerId,
    paymentReference: fulfilled.order.paymentReference!,
    amountMinor: fulfilled.order.amountMinor,
    currency: fulfilled.order.currency,
    packageSnapshot: JSON.stringify(fulfilled.order.packageSnapshot),
    fulfilledAt: fulfilled.order.fulfilledAt!,
  } }))?.id, `affiliate-conversion:${order.id}`);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions").get() as { count: number }).count, 1);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS count FROM order_fulfillments").get() as { count: number }).count, 1);
  sqlite.close();
});
