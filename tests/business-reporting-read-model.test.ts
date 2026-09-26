import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";
import { loadBusinessReport, recordDailyActivitySnapshot } from "../lib/business-reporting/read-model";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const now = Date.UTC(2026, 8, 26, 5, 0, 0);

function makeFixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "natarot-business-reporting-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, ["scripts/node-migrate.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { database, sqlite };
}

function addMember(sqlite: DatabaseSync, input: {
  id: string; createdAt: number; verifiedAt: number | null; disabled?: number; lastSeenAt?: number | null;
}) {
  sqlite.prepare(`INSERT INTO members (id, username, email, phone, created_at, updated_at, email_verified_at, disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.id, `user-${input.id}`, `${input.id}@example.test`, "synthetic-phone", input.createdAt, input.createdAt, input.verifiedAt, input.disabled ?? 0);
  if (input.lastSeenAt !== undefined && input.lastSeenAt !== null) {
    sqlite.prepare(`INSERT INTO auth_sessions (token_hash, member_id, created_at, expires_at, last_seen_at, revoked_at, session_id)
      VALUES (?, ?, ?, ?, ?, NULL, ?)`)
      .run(`hash-${input.id}`, input.id, input.createdAt, input.lastSeenAt + 86_400_000, input.lastSeenAt, `session-${input.id}`);
  }
}

function addVerifiedOrder(sqlite: DatabaseSync, input: {
  suffix: string; memberId: string; status: "FULFILLED" | "REFUNDED" | "PAYMENT_CONFIRMED";
  amountMinor: number; fulfilledAt: number; refundedAt?: number | null;
  verificationStatus?: "VERIFIED" | "REJECTED"; eventAmountMinor?: number; attachFulfillment?: boolean;
}) {
  const accountId = `account-${input.memberId}`;
  const packageId = `package-${input.suffix}`;
  const packageVersionId = `package-version-${input.suffix}`;
  const orderId = `order-${input.suffix}`;
  const eventId = `payment-event-${input.suffix}`;
  sqlite.prepare("INSERT OR IGNORE INTO credit_accounts (id, owner_kind, owner_id, created_at, updated_at) VALUES (?, 'member', ?, ?, ?)")
    .run(accountId, `member:${input.memberId}`, now, now);
  sqlite.prepare("INSERT INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, 'Test', 'Test', 1, ?, ?)")
    .run(packageId, input.suffix, now, now);
  sqlite.prepare(`INSERT INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds,
      benefit_snapshot, policy_version, status, starts_at, ends_at, created_at)
    VALUES (?, ?, 1, ?, 'VND', 0, NULL, '{}', 'test-v1', 'active', ?, NULL, ?)`)
    .run(packageVersionId, packageId, input.amountMinor, now - 1_000_000, now);
  sqlite.prepare(`INSERT INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency,
      status, idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at,
      cancelled_at, refunded_at, fulfillment_started_at)
    VALUES (?, ?, ?, ?, '{}', ?, 'VND', ?, ?, 'fingerprint', ?, ?, ?, ?, NULL, ?, ?)`)
    .run(orderId, accountId, packageId, packageVersionId, input.amountMinor, input.status, `key-${input.suffix}`, `payment-ref-${input.suffix}`, input.fulfilledAt, input.fulfilledAt, input.fulfilledAt, input.refundedAt ?? null, input.fulfilledAt);
  sqlite.prepare(`INSERT INTO commercial_payment_events (id, order_id, provider, environment, provider_event_key, provider_order_id,
      provider_invoice_number, provider_transaction_id, notification_type, provider_order_status, provider_transaction_status,
      provider_transaction_type, amount_minor, currency, source, payload_hash, verification_status, rejection_code,
      received_at, verified_at, created_at)
    VALUES (?, ?, 'sepay', 'production', ?, ?, ?, ?, 'ORDER_PAID', 'CAPTURED', 'APPROVED', 'PAYMENT', ?, 'VND', 'ipn',
      'payload-hash', ?, NULL, ?, ?, ?)`)
    .run(eventId, orderId, `event-key-${input.suffix}`, `provider-order-${input.suffix}`, `invoice-${input.suffix}`, `transaction-${input.suffix}`, input.eventAmountMinor ?? input.amountMinor, input.verificationStatus ?? "VERIFIED", now, now, now);
  if (input.attachFulfillment ?? input.status !== "PAYMENT_CONFIRMED") {
    sqlite.prepare(`INSERT INTO order_fulfillments (id, order_id, payment_event_id, fulfillment_key, result_snapshot, created_at, updated_at)
      VALUES (?, ?, ?, ?, '{}', ?, ?)`)
      .run(`fulfillment-${input.suffix}`, orderId, eventId, `fulfillment-key-${input.suffix}`, input.fulfilledAt, input.fulfilledAt);
  }
  return { accountId, orderId, fulfillmentId: `fulfillment-${input.suffix}` };
}

function addCreditLedger(sqlite: DatabaseSync, input: { id: string; accountId: string; eventType: "CONSUME" | "EXPIRATION" | "REFUND"; units: number; effectiveAt: number }) {
  sqlite.prepare(`INSERT INTO credit_ledger (id, account_id, grant_id, reservation_id, event_type, units, reference_type, reference_id,
      idempotency_key, request_fingerprint, actor_kind, actor_id, reason, effective_at, created_at, reversed_entry_id)
    VALUES (?, ?, NULL, NULL, ?, ?, 'test', ?, ?, 'fingerprint', 'system', 'system', 'synthetic reason', ?, ?, NULL)`)
    .run(input.id, input.accountId, input.eventType, input.units, input.id, `key-${input.id}`, input.effectiveAt, input.effectiveAt);
}

function addAffiliateConversion(sqlite: DatabaseSync, input: {
  suffix: string; memberId: string; profileId: string; attributionId: string; orderId: string; fulfillmentId: string;
  orderAmountMinor: number; commissionMinor: number; status: "HELD" | "ELIGIBLE" | "REVERSED"; now: number;
}) {
  const conversionId = `conversion-${input.suffix}`;
  sqlite.prepare(`INSERT INTO affiliate_conversions (id, event_key, order_id, fulfillment_id, member_id, attribution_id,
      affiliate_profile_id, policy_version_id, tier_id, amount_minor, currency, commission_minor, payment_reference,
      package_snapshot, status, fulfilled_at, eligible_at, reversed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'affiliate-v1-default', 'affiliate-v1-default-tier-1', ?, 'VND', ?, ?, '{}', ?, ?, ?, ?, ?, ?)`)
    .run(conversionId, `event-${input.suffix}`, input.orderId, input.fulfillmentId, input.memberId, input.attributionId,
      input.profileId, input.orderAmountMinor, input.commissionMinor, `private-payment-reference-${input.suffix}`, input.status,
      input.now, input.status === "ELIGIBLE" ? input.now + 1_000 : null, input.status === "REVERSED" ? input.now + 2_000 : null, input.now, input.now);
  const originalLedgerId = `commission-${input.suffix}`;
  sqlite.prepare(`INSERT INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency,
      idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot,
      fraud_note_ciphertext, created_at)
    VALUES (?, ?, 'COMMISSION', 'CREDIT', ?, 'VND', ?, NULL, 'system', 'system', 'private commission reason',
      'private policy snapshot', 'private tier snapshot', 'private package snapshot', 'private fraud note', ?)`)
    .run(originalLedgerId, conversionId, input.commissionMinor, `ledger-${input.suffix}`, input.now);
  if (input.status === "REVERSED") {
    sqlite.prepare(`INSERT INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency,
        idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot,
        fraud_note_ciphertext, created_at)
      VALUES (?, ?, 'REVERSAL', 'DEBIT', ?, 'VND', ?, ?, 'system', 'system', 'private reversal reason',
        'private policy snapshot', 'private tier snapshot', 'private package snapshot', 'private fraud note', ?)`)
      .run(`reversal-${input.suffix}`, conversionId, input.commissionMinor, `reversal-key-${input.suffix}`, originalLedgerId, input.now + 2_000);
  }
  if (input.status === "ELIGIBLE") {
    sqlite.prepare(`INSERT INTO affiliate_commission_ledger (id, conversion_id, entry_type, direction, amount_minor, currency,
        idempotency_key, reversal_of_id, actor_kind, actor_id, reason, policy_snapshot, tier_snapshot, package_snapshot,
        fraud_note_ciphertext, created_at)
      VALUES (?, ?, 'ADJUSTMENT', 'CREDIT', 500, 'VND', ?, NULL, 'admin', 'synthetic-admin', 'private adjustment reason',
        'private policy snapshot', 'private tier snapshot', 'private package snapshot', 'private fraud note', ?)`)
      .run(`adjustment-${input.suffix}`, conversionId, `adjustment-key-${input.suffix}`, input.now + 1_000);
  }
}

function addReadingSession(sqlite: DatabaseSync, input: { id: string; memberId: string; createdAt: number; question: string }) {
  sqlite.prepare(`INSERT INTO reading_sessions (id, user_id, guest_id, question, optional_context, category_id, spread_template_id,
      spread_type, card_count, locale, status, created_at, updated_at)
    VALUES (?, ?, NULL, ?, 'private optional context', 'category-everyday', 'spread-everyday-persona-obstacle-solution', 'row-3', 3, 'en', 'complete', ?, ?)`)
    .run(input.id, input.memberId, input.question, input.createdAt, input.createdAt);
}

test("dashboard counts active verified members and registrations in the HCMC reporting day", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-active", createdAt: now - 2 * 86_400_000, verifiedAt: now - 2 * 86_400_000, lastSeenAt: now - 3 * 86_400_000 });
  addMember(sqlite, { id: "member-new-today", createdAt: now - 2 * 60 * 60_000, verifiedAt: now - 60 * 60_000, lastSeenAt: now - 60 * 60_000 });
  addMember(sqlite, { id: "member-old", createdAt: now - 40 * 86_400_000, verifiedAt: now - 40 * 86_400_000, lastSeenAt: now - 31 * 86_400_000 });
  addMember(sqlite, { id: "member-unverified", createdAt: now - 60 * 60_000, verifiedAt: null, lastSeenAt: now - 10 * 60_000 });
  addMember(sqlite, { id: "member-disabled", createdAt: now - 60 * 60_000, verifiedAt: now - 60 * 60_000, disabled: 1, lastSeenAt: now - 10 * 60_000 });

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });

  assert.equal(report.dashboard.totalRegisteredUsers, 5);
  assert.equal(report.dashboard.activeUsers, 2);
  assert.equal(report.dashboard.newUsersToday, 3);
  assert.equal(report.dashboard.newUsersLast7Days, 4);
  assert.equal(report.dashboard.newUsersLast30Days, 4);
});

test("daily activity snapshot is an aggregate upsert and rejects invalid counters", async (context) => {
  const { database, sqlite } = makeFixture(context);
  await recordDailyActivitySnapshot(database, { businessDate: "2026-09-25", activeUsers: 4, capturedAt: now - 1_000 });
  await recordDailyActivitySnapshot(database, { businessDate: "2026-09-25", activeUsers: 6, capturedAt: now });

  const snapshot = sqlite.prepare("SELECT business_date AS businessDate, active_users AS activeUsers, captured_at AS capturedAt FROM business_reporting_activity_daily").get() as { businessDate: string; activeUsers: number; capturedAt: number };
  assert.equal(snapshot.businessDate, "2026-09-25");
  assert.equal(snapshot.activeUsers, 6);
  assert.equal(snapshot.capturedAt, now);
  await assert.rejects(recordDailyActivitySnapshot(database, { businessDate: "not-a-date", activeUsers: 1, capturedAt: now }));
  await assert.rejects(recordDailyActivitySnapshot(database, { businessDate: "2026-09-25", activeUsers: -1, capturedAt: now }));
});

test("customer rows are opaque, minimal, and expire after 90 days without relevant activity", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-private-alpha", createdAt: now - 20 * 86_400_000, verifiedAt: now - 20 * 86_400_000, lastSeenAt: now - 2 * 86_400_000 });
  addMember(sqlite, { id: "member-expired-beta", createdAt: now - 100 * 86_400_000, verifiedAt: now - 100 * 86_400_000, lastSeenAt: now - 100 * 86_400_000 });

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });
  const serialized = JSON.stringify(report.customers);

  assert.equal(report.customers.length, 1);
  assert.match(report.customers[0]!.customerId, /^customer_[a-f0-9]{24}$/);
  assert.equal(report.customers[0]!.accountStatus, "active");
  assert.ok(!serialized.includes("member-private-alpha"));
  assert.ok(!serialized.includes("@example.test"));
  assert.ok(!serialized.includes("synthetic-phone"));
  assert.ok(!serialized.includes("password_hash"));
});

test("verified revenue excludes pending, rejected, and mismatched events and books full refunds on the refund date", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-payer", createdAt: now - 100 * 86_400_000, verifiedAt: now - 100 * 86_400_000, lastSeenAt: now - 100 * 86_400_000 });
  const today = businessDayStart(now);
  addVerifiedOrder(sqlite, { suffix: "paid", memberId: "member-payer", status: "FULFILLED", amountMinor: 100_000, fulfilledAt: today + 10_000 });
  addVerifiedOrder(sqlite, { suffix: "refund", memberId: "member-payer", status: "REFUNDED", amountMinor: 20_000, fulfilledAt: today - 86_400_000, refundedAt: today + 20_000 });
  addVerifiedOrder(sqlite, { suffix: "pending", memberId: "member-payer", status: "PAYMENT_CONFIRMED", amountMinor: 900_000, fulfilledAt: today + 15_000, attachFulfillment: false });
  addVerifiedOrder(sqlite, { suffix: "rejected", memberId: "member-payer", status: "FULFILLED", amountMinor: 800_000, fulfilledAt: today + 20_000, verificationStatus: "REJECTED" });
  addVerifiedOrder(sqlite, { suffix: "mismatch", memberId: "member-payer", status: "FULFILLED", amountMinor: 700_000, fulfilledAt: today + 30_000, eventAmountMinor: 699_999 });

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });
  const todayRevenue = report.revenue.find((row) => row.date === "2026-09-26");

  assert.equal(report.dashboard.verifiedRevenueMinor, 120_000);
  assert.equal(report.dashboard.successfulOrders, 1);
  assert.equal(report.dashboard.newPayingCustomers, 1);
  assert.equal(report.customers[0]!.totalVerifiedPurchases, 1);
  assert.equal(report.customers[0]!.totalVerifiedSpendingMinor, 100_000);
  assert.equal(todayRevenue?.verifiedRevenueMinor, 100_000);
  assert.equal(todayRevenue?.refundsMinor, 20_000);
  assert.equal(todayRevenue?.netRevenueMinor, 80_000);
});

test("Credit totals use verified purchase grants and canonical ledger event signs", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-credit", createdAt: now - 2 * 86_400_000, verifiedAt: now - 2 * 86_400_000 });
  const today = businessDayStart(now);
  const paid = addVerifiedOrder(sqlite, { suffix: "credit-paid", memberId: "member-credit", status: "FULFILLED", amountMinor: 30_000, fulfilledAt: today + 10_000 });
  const pending = addVerifiedOrder(sqlite, { suffix: "credit-pending", memberId: "member-credit", status: "PAYMENT_CONFIRMED", amountMinor: 50_000, fulfilledAt: today + 20_000, attachFulfillment: false });
  const insertGrant = sqlite.prepare(`INSERT INTO credit_grants (id, account_id, source, source_type, source_id, grant_key,
      request_fingerprint, units, available_units, eligible_from, expires_at, policy_version, policy_snapshot, created_at, updated_at)
    VALUES (?, ?, 'PURCHASE', 'ORDER', ?, ?, 'fingerprint', ?, ?, ?, NULL, 'test-v1', '{}', ?, ?)`);
  insertGrant.run("grant-paid", paid.accountId, paid.orderId, "grant-paid", 10, 5, today, today, today);
  insertGrant.run("grant-pending", pending.accountId, pending.orderId, "grant-pending", 50, 50, today, today, today);
  addCreditLedger(sqlite, { id: "consume-today", accountId: paid.accountId, eventType: "CONSUME", units: -2, effectiveAt: today + 30_000 });
  addCreditLedger(sqlite, { id: "expire-today", accountId: paid.accountId, eventType: "EXPIRATION", units: -3, effectiveAt: today + 40_000 });
  addCreditLedger(sqlite, { id: "refund-today", accountId: paid.accountId, eventType: "REFUND", units: 1, effectiveAt: today + 50_000 });

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });
  const todayCredits = report.credits.find((row) => row.date === "2026-09-26");

  assert.equal(report.dashboard.creditsSold, 10);
  assert.equal(report.dashboard.creditsConsumed, 2);
  assert.deepEqual(todayCredits, { date: "2026-09-26", creditsSold: 10, creditsConsumed: 2, creditsExpired: 3, creditsRefunded: 1 });
});

test("Affiliate rows preserve held, eligible, adjustment, and reversal ledger totals without exporting private snapshots", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-referrer", createdAt: now - 20 * 86_400_000, verifiedAt: now - 20 * 86_400_000 });
  sqlite.prepare("INSERT INTO affiliate_profiles (id, member_id, status, created_at, updated_at) VALUES ('profile-private', 'member-referrer', 'ACTIVE', ?, ?)")
    .run(now - 20 * 86_400_000, now - 1_000);
  sqlite.prepare(`INSERT INTO referral_codes (id, affiliate_profile_id, code_hash, status, source, created_at, expires_at)
    VALUES ('code-private', 'profile-private', 'synthetic-code-hash', 'ACTIVE', 'test', ?, NULL)`).run(now - 20 * 86_400_000);

  const expectedRows = [
    { suffix: "held", memberId: "member-held", status: "HELD" as const, commission: 5_000 },
    { suffix: "eligible", memberId: "member-eligible", status: "ELIGIBLE" as const, commission: 3_000 },
    { suffix: "reversed", memberId: "member-reversed", status: "REVERSED" as const, commission: 2_000 },
  ];
  for (const item of expectedRows) {
    addMember(sqlite, { id: item.memberId, createdAt: now - 10 * 86_400_000, verifiedAt: now - 10 * 86_400_000 });
    const order = addVerifiedOrder(sqlite, { suffix: `affiliate-${item.suffix}`, memberId: item.memberId, status: "FULFILLED", amountMinor: 40_000, fulfilledAt: now - 1_000 });
    const attributionId = `attribution-${item.suffix}`;
    sqlite.prepare(`INSERT INTO referral_attributions (id, owner_key, member_id, affiliate_profile_id, referral_code_id, source, attributed_at, expires_at, created_at)
      VALUES (?, ?, ?, 'profile-private', 'code-private', 'test', ?, ?, ?)`)
      .run(attributionId, `owner-private-${item.suffix}`, item.memberId, now - 5_000, now + 30 * 86_400_000, now - 5_000);
    addAffiliateConversion(sqlite, { suffix: item.suffix, memberId: item.memberId, profileId: "profile-private", attributionId,
      orderId: order.orderId, fulfillmentId: order.fulfillmentId, orderAmountMinor: 40_000, commissionMinor: item.commission, status: item.status, now: now - 1_000 });
  }

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });
  const affiliate = report.affiliate[0];
  const privateFields = JSON.stringify({ affiliate: report.affiliate, referrals: report.referrals });

  assert.equal(report.dashboard.affiliateCommissionsMinor, 8_500);
  assert.equal(report.dashboard.pendingCommissionsMinor, 5_000);
  assert.equal(affiliate?.referralCount, 3);
  assert.equal(affiliate?.verifiedConversions, 3);
  assert.equal(affiliate?.eligibleCommissionMinor, 3_500);
  assert.equal(affiliate?.pendingCommissionMinor, 5_000);
  assert.equal(affiliate?.reversedCommissionMinor, 2_000);
  assert.ok(!privateFields.includes("profile-private"));
  assert.ok(!privateFields.includes("member-held"));
  assert.ok(!privateFields.includes("owner-private"));
  assert.ok(!privateFields.includes("synthetic-code-hash"));
  assert.ok(!privateFields.includes("private-payment-reference"));
  assert.ok(!privateFields.includes("private policy snapshot"));
  assert.ok(!privateFields.includes("private fraud note"));
});

test("daily activity counts returning readers but never exports Tarot questions or interpretations", async (context) => {
  const { database, sqlite } = makeFixture(context);
  addMember(sqlite, { id: "member-reader", createdAt: now - 3 * 86_400_000, verifiedAt: now - 3 * 86_400_000, lastSeenAt: now - 5 * 60_000 });
  addReadingSession(sqlite, { id: "reading-session-first", memberId: "member-reader", createdAt: now - 2 * 86_400_000, question: "private Tarot question marker" });
  addReadingSession(sqlite, { id: "reading-session-return", memberId: "member-reader", createdAt: now - 1 * 86_400_000, question: "another private Tarot question marker" });
  sqlite.prepare(`INSERT INTO readings (id, session_id, opening, card_readings, synthesis, advice, closing, disclaimer, model_name, prompt_version, created_at, updated_at)
    VALUES ('reading-private', 'reading-session-return', 'opening', '[]', 'private Tarot interpretation marker', 'private advice', 'closing', 'disclaimer', 'test-model', 'test-prompt', ?, ?)`)
    .run(now - 1 * 86_400_000, now - 1 * 86_400_000);

  const report = await loadBusinessReport(database, { now, timeZone: "Asia/Ho_Chi_Minh" });
  const yesterday = report.activity.find((row) => row.date === "2026-09-25");
  const today = report.activity.find((row) => row.date === "2026-09-26");
  const serialized = JSON.stringify(report);

  assert.equal(yesterday?.tarotReadings, 1);
  assert.equal(yesterday?.returningUsers, 1);
  assert.equal(yesterday?.registeredUsers, 1);
  assert.equal(today?.activeUsers, 1);
  assert.equal(today?.newUsers, 0);
  assert.ok(!serialized.includes("private Tarot question marker"));
  assert.ok(!serialized.includes("private Tarot interpretation marker"));
  assert.ok(!serialized.includes("private advice"));
});

function businessDayStart(timestamp: number): number {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day! - 1, 17);
}
