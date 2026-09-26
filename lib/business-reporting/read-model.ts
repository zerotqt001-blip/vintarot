import { createHash } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import {
  BUSINESS_REPORTING_ACTIVE_DAYS,
  BUSINESS_REPORTING_CUSTOMER_RETENTION_DAYS,
  BUSINESS_REPORTING_TIME_ZONE,
  BUSINESS_REPORTING_VERSION,
  type ActivityReportRow,
  type AffiliateReportRow,
  type BusinessReport,
  type CreditReportRow,
  type CustomerReportRow,
  type ReferralReportRow,
  type RevenueReportRow,
} from "./types";

const DAY_MS = 86_400_000;
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

type MemberRow = { id: string; createdAt: number; verifiedAt: number | null; disabled: number };
type SessionRow = { memberId: string; lastSeenAt: number };
type OrderRow = { id: string; ownerId: string; amountMinor: number; currency: string; status: string; fulfilledAt: number; refundedAt: number | null };
type ProfileRow = { id: string; memberId: string; status: string; createdAt: number; updatedAt: number };
type AttributionRow = { id: string; ownerKey: string; memberId: string | null; profileId: string; attributedAt: number; expiresAt: number };
type ConversionRow = { id: string; orderId: string; attributionId: string; profileId: string; status: string; fulfilledAt: number; updatedAt: number; tierCode: string | null };
type AffiliateLedgerRow = { conversionId: string; entryType: string; direction: string; amountMinor: number; currency: string; createdAt: number };
type CreditGrantRow = { sourceId: string | null; units: number };
type CreditLedgerRow = { eventType: string; units: number; effectiveAt: number };
type ReadingSessionRow = { userId: string | null; createdAt: number };
type SnapshotRow = { businessDate: string; activeUsers: number };
type SyncStateRow = { lastSuccessAt: number | null; lastBackupSuccessAt: number | null; lastBackupStatus: string | null; lastErrorCode: string | null; lastBackupErrorCode: string | null };

async function all<T>(database: D1Database, sql: string, ...values: unknown[]): Promise<T[]> {
  return (await database.prepare(sql).bind(...values).all<T>()).results;
}

async function first<T>(database: D1Database, sql: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(sql).bind(...values).first<T>()) || null;
}

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function businessDateKey(timestamp: number, timeZone = BUSINESS_REPORTING_TIME_ZONE): string {
  const parts = Object.fromEntries(dayFormatter(timeZone).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeZoneOffsetAt(timestamp: number, timeZone: string): number {
  const parts = Object.fromEntries(partsFormatter(timeZone).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  const wallClockUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return wallClockUtc - Math.floor(timestamp / 1000) * 1000;
}

function startOfBusinessDate(date: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const wallClockUtc = Date.UTC(year!, month! - 1, day!);
  const estimate = wallClockUtc - timeZoneOffsetAt(wallClockUtc, timeZone);
  return wallClockUtc - timeZoneOffsetAt(estimate, timeZone);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function opaqueReportId(namespace: "customer" | "affiliate", internalId: string): string {
  const digest = createHash("sha256").update(`${namespace}\0${internalId}`, "utf8").digest("hex").slice(0, 24);
  return `${namespace}_${digest}`;
}

function increment<K>(map: Map<K, number>, key: K, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (!value) {
    value = create();
    map.set(key, value);
  }
  return value;
}

function memberFromAccountOwner(ownerId: string): string {
  return ownerId.replace(/^member:/, "");
}

function dateRange(firstDate: string, lastDate: string): string[] {
  const dates: string[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export async function recordDailyActivitySnapshot(
  database: D1Database,
  input: { businessDate: string; activeUsers: number; capturedAt: number },
): Promise<void> {
  const date = new Date(`${input.businessDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.businessDate) {
    throw new Error("Invalid business activity date");
  }
  if (!Number.isSafeInteger(input.activeUsers) || input.activeUsers < 0 || !Number.isSafeInteger(input.capturedAt) || input.capturedAt < 0) {
    throw new Error("Invalid business activity snapshot");
  }
  await database.prepare(`INSERT INTO business_reporting_activity_daily (business_date, active_users, captured_at)
    VALUES (?, ?, ?) ON CONFLICT(business_date) DO UPDATE SET active_users=excluded.active_users, captured_at=excluded.captured_at`)
    .bind(input.businessDate, input.activeUsers, input.capturedAt).run();
}

async function snapshotCurrentDailyActive(database: D1Database, now: number, timeZone: string): Promise<number> {
  const date = businessDateKey(now, timeZone);
  const start = startOfBusinessDate(date, timeZone);
  const end = startOfBusinessDate(addDays(date, 1), timeZone);
  const result = await first<{ activeUsers: number }>(database, `SELECT COUNT(DISTINCT m.id) AS activeUsers
    FROM members m JOIN auth_sessions s ON s.member_id=m.id
    WHERE m.email_verified_at IS NOT NULL AND m.disabled=0 AND s.last_seen_at>=? AND s.last_seen_at<?`, start, end);
  const activeUsers = Number(result?.activeUsers ?? 0);
  await recordDailyActivitySnapshot(database, { businessDate: date, activeUsers, capturedAt: now });
  return activeUsers;
}

function stateLabel(member: MemberRow): CustomerReportRow["accountStatus"] {
  if (Number(member.disabled) !== 0) return "disabled";
  return member.verifiedAt === null ? "pending_verification" : "active";
}

export async function loadBusinessReport(database: D1Database, options: { now?: number; timeZone?: string } = {}): Promise<BusinessReport> {
  const now = options.now ?? Date.now();
  const timeZone = options.timeZone ?? BUSINESS_REPORTING_TIME_ZONE;
  const today = businessDateKey(now, timeZone);
  const todayStart = startOfBusinessDate(today, timeZone);
  const tomorrowStart = startOfBusinessDate(addDays(today, 1), timeZone);

  const [members, sessions, orderRows, profiles, attributions, conversions, affiliateLedger, grants, creditLedger, readingSessions, snapshotRows, syncState] = await Promise.all([
    all<MemberRow>(database, `SELECT id, created_at AS createdAt, email_verified_at AS verifiedAt, disabled FROM members ORDER BY created_at, id`),
    all<SessionRow>(database, `SELECT member_id AS memberId, MAX(last_seen_at) AS lastSeenAt FROM auth_sessions GROUP BY member_id`),
    all<OrderRow>(database, `SELECT o.id, a.owner_id AS ownerId, o.amount_minor AS amountMinor, o.currency, o.status,
        o.fulfilled_at AS fulfilledAt, o.refunded_at AS refundedAt
      FROM orders o
      JOIN credit_accounts a ON a.id=o.account_id AND a.owner_kind IN ('member', 'guest')
      JOIN order_fulfillments f ON f.order_id=o.id AND f.payment_event_id IS NOT NULL
      JOIN commercial_payment_events e ON e.id=f.payment_event_id
      WHERE o.status IN ('FULFILLED', 'REFUNDED') AND e.verification_status='VERIFIED'
        AND e.notification_type='ORDER_PAID' AND e.amount_minor=o.amount_minor AND e.currency=o.currency
      ORDER BY o.fulfilled_at, o.id`),
    all<ProfileRow>(database, `SELECT id, member_id AS memberId, status, created_at AS createdAt, updated_at AS updatedAt FROM affiliate_profiles ORDER BY created_at, id`),
    all<AttributionRow>(database, `SELECT id, owner_key AS ownerKey, member_id AS memberId, affiliate_profile_id AS profileId,
        attributed_at AS attributedAt, expires_at AS expiresAt FROM referral_attributions ORDER BY attributed_at, id`),
    all<ConversionRow>(database, `SELECT c.id, c.order_id AS orderId, c.attribution_id AS attributionId,
        c.affiliate_profile_id AS profileId, c.status, c.fulfilled_at AS fulfilledAt, c.updated_at AS updatedAt,
        t.tier_code AS tierCode FROM affiliate_conversions c LEFT JOIN affiliate_policy_tiers t ON t.id=c.tier_id ORDER BY c.created_at, c.id`),
    all<AffiliateLedgerRow>(database, `SELECT conversion_id AS conversionId, entry_type AS entryType, direction,
        amount_minor AS amountMinor, currency, created_at AS createdAt FROM affiliate_commission_ledger
      WHERE entry_type IN ('COMMISSION', 'REVERSAL', 'ADJUSTMENT')`),
    all<CreditGrantRow>(database, `SELECT source_id AS sourceId, units FROM credit_grants WHERE source='PURCHASE'`),
    all<CreditLedgerRow>(database, `SELECT event_type AS eventType, units, effective_at AS effectiveAt FROM credit_ledger
      WHERE event_type IN ('CONSUME', 'EXPIRATION', 'REFUND')`),
    all<ReadingSessionRow>(database, `SELECT user_id AS userId, created_at AS createdAt FROM reading_sessions ORDER BY created_at, id`),
    all<SnapshotRow>(database, `SELECT business_date AS businessDate, active_users AS activeUsers FROM business_reporting_activity_daily`),
    first<SyncStateRow>(database, `SELECT last_success_at AS lastSuccessAt, last_backup_success_at AS lastBackupSuccessAt,
        last_backup_status AS lastBackupStatus, last_error_code AS lastErrorCode, last_backup_error_code AS lastBackupErrorCode
      FROM business_reporting_sync_state WHERE id='primary'`),
  ]);

  const sessionLastSeen = new Map(sessions.map((row) => [row.memberId, Number(row.lastSeenAt)]));
  const verifiedOrders = orderRows.map((order) => ({ ...order, ownerMemberId: memberFromAccountOwner(order.ownerId), amountMinor: Number(order.amountMinor), fulfilledAt: Number(order.fulfilledAt), refundedAt: order.refundedAt === null ? null : Number(order.refundedAt) }));
  const verifiedOrderIds = new Set(verifiedOrders.map((order) => order.id));
  const memberById = new Map(members.map((member) => [member.id, member]));

  const activeCutoff = now - BUSINESS_REPORTING_ACTIVE_DAYS * DAY_MS;
  const activeUsers = members.filter((member) => Number(member.disabled) === 0 && member.verifiedAt !== null && (sessionLastSeen.get(member.id) ?? 0) >= activeCutoff).length;
  const newUsersToday = members.filter((member) => Number(member.createdAt) >= todayStart && Number(member.createdAt) < tomorrowStart).length;
  const newUsersLast7Days = members.filter((member) => Number(member.createdAt) >= now - 7 * DAY_MS && Number(member.createdAt) <= now).length;
  const newUsersLast30Days = members.filter((member) => Number(member.createdAt) >= now - 30 * DAY_MS && Number(member.createdAt) <= now).length;

  const revenueByDate = new Map<string, RevenueReportRow>();
  const customerPurchases = new Map<string, { count: number; spending: number }>();
  const firstPayingOrder = new Map<string, number>();
  const latestOrderActivity = new Map<string, number>();
  let verifiedRevenueMinor = 0;
  let successfulOrders = 0;
  const revenueRow = (date: string): RevenueReportRow => getOrCreate(revenueByDate, date, () => ({
    date, verifiedRevenueMinor: 0, successfulOrders: 0, refundsMinor: 0, netRevenueMinor: 0, newPayingCustomers: 0,
  }));
  for (const order of verifiedOrders) {
    const fulfilledDate = businessDateKey(order.fulfilledAt, timeZone);
    const sale = revenueRow(fulfilledDate);
    sale.verifiedRevenueMinor += order.amountMinor;
    verifiedRevenueMinor += order.amountMinor;
    latestOrderActivity.set(order.ownerMemberId, Math.max(latestOrderActivity.get(order.ownerMemberId) ?? 0, order.refundedAt ?? order.fulfilledAt));
    if (order.status === "FULFILLED") {
      sale.successfulOrders += 1;
      successfulOrders += 1;
      const purchases = getOrCreate(customerPurchases, order.ownerMemberId, () => ({ count: 0, spending: 0 }));
      purchases.count += 1;
      purchases.spending += order.amountMinor;
      firstPayingOrder.set(order.ownerMemberId, Math.min(firstPayingOrder.get(order.ownerMemberId) ?? Number.POSITIVE_INFINITY, order.fulfilledAt));
    } else {
      const refundDate = businessDateKey(order.refundedAt ?? order.fulfilledAt, timeZone);
      revenueRow(refundDate).refundsMinor += order.amountMinor;
    }
  }
  const payingByDate = new Map<string, number>();
  for (const fulfilledAt of firstPayingOrder.values()) increment(payingByDate, businessDateKey(fulfilledAt, timeZone), 1);
  for (const [date, count] of payingByDate) revenueRow(date).newPayingCustomers += count;
  const revenue = [...revenueByDate.values()].map((row) => ({ ...row, netRevenueMinor: row.verifiedRevenueMinor - row.refundsMinor })).sort((a, b) => a.date.localeCompare(b.date));
  const newPayingCustomers = [...firstPayingOrder.values()].filter((fulfilledAt) => businessDateKey(fulfilledAt, timeZone) === today).length;

  const lastRelevantActivity = new Map<string, number>();
  for (const member of members) lastRelevantActivity.set(member.id, Number(member.createdAt));
  for (const [memberId, lastSeenAt] of sessionLastSeen) lastRelevantActivity.set(memberId, Math.max(lastRelevantActivity.get(memberId) ?? 0, lastSeenAt));
  for (const [memberId, activityAt] of latestOrderActivity) lastRelevantActivity.set(memberId, Math.max(lastRelevantActivity.get(memberId) ?? 0, activityAt));
  const retentionCutoff = now - BUSINESS_REPORTING_CUSTOMER_RETENTION_DAYS * DAY_MS;
  const profileByMemberId = new Map(profiles.map((profile) => [profile.memberId, profile]));
  const customers: CustomerReportRow[] = members
    .filter((member) => (lastRelevantActivity.get(member.id) ?? Number(member.createdAt)) >= retentionCutoff)
    .map((member) => {
      const purchases = customerPurchases.get(member.id) ?? { count: 0, spending: 0 };
      const lastSeenAt = sessionLastSeen.get(member.id);
      return {
        customerId: opaqueReportId("customer", member.id),
        registrationDate: businessDateKey(Number(member.createdAt), timeZone),
        accountStatus: stateLabel(member),
        lastRecordedActivity: lastSeenAt === undefined ? null : businessDateKey(lastSeenAt, timeZone),
        totalVerifiedPurchases: purchases.count,
        totalVerifiedSpendingMinor: purchases.spending,
        affiliateParticipationStatus: profileByMemberId.get(member.id)?.status.toLowerCase() ?? "not_enrolled",
      };
    });

  const conversionsByAttribution = new Map<string, ConversionRow[]>();
  const conversionsByProfile = new Map<string, ConversionRow[]>();
  const conversionById = new Map<string, ConversionRow>();
  const profileActivity = new Map(profiles.map((profile) => [profile.id, Math.max(Number(profile.createdAt), Number(profile.updatedAt))]));
  for (const attribution of attributions) profileActivity.set(attribution.profileId, Math.max(profileActivity.get(attribution.profileId) ?? 0, Number(attribution.attributedAt)));
  for (const conversion of conversions) {
    conversionById.set(conversion.id, conversion);
    const byAttribution = conversionsByAttribution.get(conversion.attributionId) ?? [];
    byAttribution.push(conversion);
    conversionsByAttribution.set(conversion.attributionId, byAttribution);
    const byProfile = conversionsByProfile.get(conversion.profileId) ?? [];
    byProfile.push(conversion);
    conversionsByProfile.set(conversion.profileId, byProfile);
    profileActivity.set(conversion.profileId, Math.max(profileActivity.get(conversion.profileId) ?? 0, Number(conversion.fulfilledAt), Number(conversion.updatedAt)));
  }

  const profileLedger = new Map<string, Map<string, { total: number; pending: number; eligible: number; reversed: number }>>();
  let affiliateCommissionsMinor = 0;
  let pendingCommissionsMinor = 0;
  for (const ledger of affiliateLedger) {
    const conversion = conversionById.get(ledger.conversionId);
    if (!conversion || !verifiedOrderIds.has(conversion.orderId)) continue;
    const signed = ledger.direction === "CREDIT" ? Number(ledger.amountMinor) : -Number(ledger.amountMinor);
    affiliateCommissionsMinor += signed;
    if (conversion.status === "HELD") pendingCommissionsMinor += signed;
    const currencies = profileLedger.get(conversion.profileId) ?? new Map<string, { total: number; pending: number; eligible: number; reversed: number }>();
    const totals = currencies.get(ledger.currency) ?? { total: 0, pending: 0, eligible: 0, reversed: 0 };
    totals.total += signed;
    if (conversion.status === "HELD") totals.pending += signed;
    if (conversion.status === "ELIGIBLE") totals.eligible += signed;
    if (ledger.entryType === "REVERSAL" && ledger.direction === "DEBIT") totals.reversed += Number(ledger.amountMinor);
    currencies.set(ledger.currency, totals);
    profileLedger.set(conversion.profileId, currencies);
    profileActivity.set(conversion.profileId, Math.max(profileActivity.get(conversion.profileId) ?? 0, Number(ledger.createdAt)));
  }
  const referralCountByProfile = new Map<string, number>();
  for (const attribution of attributions) increment(referralCountByProfile, attribution.profileId, 1);
  const affiliate: AffiliateReportRow[] = [];
  for (const profile of profiles) {
    if ((profileActivity.get(profile.id) ?? Number(profile.createdAt)) < retentionCutoff) continue;
    const profileConversions = (conversionsByProfile.get(profile.id) ?? []).filter((conversion) => verifiedOrderIds.has(conversion.orderId));
    const tier = [...profileConversions].sort((a, b) => Number(b.fulfilledAt) - Number(a.fulfilledAt))[0]?.tierCode ?? "—";
    const currencies = profileLedger.get(profile.id);
    if (!currencies?.size) {
      affiliate.push({ affiliateId: opaqueReportId("affiliate", profile.id), referralCount: referralCountByProfile.get(profile.id) ?? 0, verifiedConversions: profileConversions.length, commissionTier: tier, currency: "VND", eligibleCommissionMinor: 0, pendingCommissionMinor: 0, reversedCommissionMinor: 0 });
      continue;
    }
    for (const [currency, totals] of currencies) {
      affiliate.push({ affiliateId: opaqueReportId("affiliate", profile.id), referralCount: referralCountByProfile.get(profile.id) ?? 0, verifiedConversions: profileConversions.length, commissionTier: tier, currency, eligibleCommissionMinor: totals.eligible, pendingCommissionMinor: totals.pending, reversedCommissionMinor: totals.reversed });
    }
  }

  const referrals: ReferralReportRow[] = attributions
    .filter((attribution) => Number(attribution.attributedAt) >= retentionCutoff)
    .map((attribution) => {
      const verifiedConversions = (conversionsByAttribution.get(attribution.id) ?? []).filter((conversion) => verifiedOrderIds.has(conversion.orderId));
      const conversion = verifiedConversions.at(-1);
      return {
        referrerId: opaqueReportId("affiliate", attribution.profileId),
        referredCustomerId: opaqueReportId("customer", attribution.memberId ?? attribution.ownerKey),
        attributionTimestamp: businessDateKey(Number(attribution.attributedAt), timeZone),
        attributionStatus: Number(attribution.expiresAt) <= now ? "expired" : attribution.memberId ? "claimed" : "attributed",
        verifiedConversionStatus: conversion?.status.toLowerCase() ?? "not_converted",
      };
    });

  const orderById = new Map(verifiedOrders.map((order) => [order.id, order]));
  const creditByDate = new Map<string, CreditReportRow>();
  const creditRow = (date: string): CreditReportRow => getOrCreate(creditByDate, date, () => ({ date, creditsSold: 0, creditsConsumed: 0, creditsExpired: 0, creditsRefunded: 0 }));
  let creditsSold = 0;
  for (const grant of grants) {
    const order = grant.sourceId ? orderById.get(grant.sourceId) : undefined;
    if (!order) continue;
    const units = Number(grant.units);
    creditsSold += units;
    creditRow(businessDateKey(order.fulfilledAt, timeZone)).creditsSold += units;
  }
  let creditsConsumed = 0;
  for (const entry of creditLedger) {
    const row = creditRow(businessDateKey(Number(entry.effectiveAt), timeZone));
    if (entry.eventType === "CONSUME") {
      const units = Math.abs(Number(entry.units));
      row.creditsConsumed += units;
      creditsConsumed += units;
    }
    if (entry.eventType === "EXPIRATION") row.creditsExpired += Math.abs(Number(entry.units));
    if (entry.eventType === "REFUND") row.creditsRefunded += Math.max(0, Number(entry.units));
  }
  const credits: CreditReportRow[] = [...creditByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const newUsersByDate = new Map<string, number>();
  for (const member of members) increment(newUsersByDate, businessDateKey(Number(member.createdAt), timeZone), 1);
  const sessionCountByDate = new Map<string, number>();
  const registeredReadersByDate = new Map<string, Set<string>>();
  for (const reading of readingSessions) {
    const date = businessDateKey(Number(reading.createdAt), timeZone);
    increment(sessionCountByDate, date, 1);
    if (reading.userId) {
      const readers = registeredReadersByDate.get(date) ?? new Set<string>();
      readers.add(reading.userId);
      registeredReadersByDate.set(date, readers);
    }
  }
  const returningUsersByDate = new Map<string, number>();
  const seenOnEarlierDay = new Set<string>();
  for (const [date, readers] of [...registeredReadersByDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let returning = 0;
    for (const memberId of readers) if (seenOnEarlierDay.has(memberId)) returning += 1;
    returningUsersByDate.set(date, returning);
    for (const memberId of readers) seenOnEarlierDay.add(memberId);
  }
  const activeUsersByDate = new Map(snapshotRows.map((snapshot) => [snapshot.businessDate, Number(snapshot.activeUsers)]));
  activeUsersByDate.set(today, await snapshotCurrentDailyActive(database, now, timeZone));
  const historyTimestamps = [
    ...members.map((member) => Number(member.createdAt)),
    ...readingSessions.map((row) => Number(row.createdAt)),
    ...verifiedOrders.map((row) => Number(row.fulfilledAt)),
    ...creditLedger.map((row) => Number(row.effectiveAt)),
  ];
  const firstDate = historyTimestamps.length ? businessDateKey(Math.min(...historyTimestamps), timeZone) : today;
  const activity: ActivityReportRow[] = dateRange(firstDate, today).map((date) => {
    const end = startOfBusinessDate(addDays(date, 1), timeZone);
    return {
      date,
      registeredUsers: members.filter((member) => Number(member.createdAt) < end).length,
      activeUsers: activeUsersByDate.get(date) ?? null,
      newUsers: newUsersByDate.get(date) ?? 0,
      tarotReadings: sessionCountByDate.get(date) ?? 0,
      returningUsers: returningUsersByDate.get(date) ?? 0,
    };
  });

  const state = syncState;
  const system = {
    lastSuccessfulSynchronization: state?.lastSuccessAt == null ? null : new Date(Number(state.lastSuccessAt)).toISOString(),
    lastBackup: state?.lastBackupSuccessAt == null ? null : new Date(Number(state.lastBackupSuccessAt)).toISOString(),
    backupVerificationStatus: state?.lastBackupStatus ?? "not_started",
    synchronizationErrors: [state?.lastErrorCode, state?.lastBackupErrorCode].filter(Boolean).join(", ") || "none",
    reportingVersion: BUSINESS_REPORTING_VERSION,
  };

  return {
    dashboard: {
      totalRegisteredUsers: members.length,
      newUsersToday,
      newUsersLast7Days,
      newUsersLast30Days,
      activeUsers,
      newPayingCustomers,
      verifiedRevenueMinor,
      successfulOrders,
      creditsSold,
      creditsConsumed,
      affiliateCommissionsMinor,
      pendingCommissionsMinor,
    },
    customers,
    revenue,
    affiliate: affiliate.sort((a, b) => a.affiliateId.localeCompare(b.affiliateId) || a.currency.localeCompare(b.currency)),
    referrals,
    activity,
    credits,
    system,
  };
}
