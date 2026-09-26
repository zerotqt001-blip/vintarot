import type { D1Database } from "@cloudflare/workers-types";
import type { CreditOwner } from "../credits/types";
import { getActiveAffiliatePolicy, selectAffiliateTier, utcMonthBounds, type AffiliatePolicy, type AffiliatePolicyTier } from "./policy";
import { getAffiliateOwnerSummary, listAffiliateOwnerHistory } from "./service";
import { memberIdFromOwner } from "./repository";
import { ensureAffiliateReferralLink } from "./referral-link";
import type { AffiliateProfileStatus, AffiliateReferralLink } from "./types";

export type PublicAffiliateTier = {
  tierCode: string;
  minQualifiedConversions: number;
  rateBps: number;
};

export type PublicAffiliatePolicy = {
  version: number;
  currency: string;
  attributionWindowDays: number;
  holdDays: number;
  tiers: PublicAffiliateTier[];
};

export type AffiliateTierProgress = {
  qualifiedConversions: number;
  currentTier: PublicAffiliateTier | null;
  nextTier: PublicAffiliateTier | null;
};

export type CustomerAffiliateHistoryItem = {
  id: string;
  amountMinor: number;
  currency: string;
  commissionMinor: number;
  status: string;
  fulfilledAt: number;
  eligibleAt: number | null;
  reversedAt: number | null;
  createdAt: number;
};

export type CustomerAffiliateReferral = {
  id: string;
  signupAt: number;
  state: "VERIFIED";
};

export type AffiliateIncomeSummary = {
  currency: string | null;
  currentMonthMinor: number;
  confirmedMinor: number;
  pendingMinor: number;
  totalMinor: number;
};

export type AffiliateCustomerDashboard = {
  profile: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" } | null;
  policy: PublicAffiliatePolicy | null;
  progress: AffiliateTierProgress | null;
  referralLink: AffiliateReferralLink;
  summary: Awaited<ReturnType<typeof getAffiliateOwnerSummary>>;
  income: AffiliateIncomeSummary;
  history: CustomerAffiliateHistoryItem[];
  referrals: { count: number; history: CustomerAffiliateReferral[] };
};

function publicTier(tier: AffiliatePolicyTier): PublicAffiliateTier {
  return {
    tierCode: tier.tierCode,
    minQualifiedConversions: tier.minQualifiedConversions,
    rateBps: tier.rateBps,
  };
}

export function projectAffiliatePolicy(policy: AffiliatePolicy | null): PublicAffiliatePolicy | null {
  if (!policy || policy.status !== "ACTIVE") return null;
  return {
    version: policy.version,
    currency: policy.currency,
    attributionWindowDays: policy.attributionWindowDays,
    holdDays: policy.holdDays,
    tiers: policy.tiers.map(publicTier),
  };
}

function nextTier(policy: AffiliatePolicy, qualifiedConversions: number): AffiliatePolicyTier | null {
  return [...policy.tiers]
    .filter((tier) => tier.minQualifiedConversions > qualifiedConversions)
    .sort((left, right) => left.minQualifiedConversions - right.minQualifiedConversions || left.id.localeCompare(right.id))[0] ?? null;
}

function emptyIncome(): AffiliateIncomeSummary {
  return { currency: null, currentMonthMinor: 0, confirmedMinor: 0, pendingMinor: 0, totalMinor: 0 };
}

async function getAffiliateReferrals(database: D1Database, memberId: string): Promise<AffiliateCustomerDashboard["referrals"]> {
  const profile = await database.prepare("SELECT id FROM affiliate_profiles WHERE member_id=? LIMIT 1")
    .bind(memberId)
    .first<{ id: string }>();
  if (!profile) return { count: 0, history: [] };
  const eligible = "a.affiliate_profile_id=? AND a.member_id IS NOT NULL AND a.member_id<>? AND m.email_verified_at IS NOT NULL AND m.disabled=0 AND m.disabled_at IS NULL";
  const countRow = await database.prepare(`SELECT COUNT(*) AS count FROM referral_attributions a JOIN members m ON m.id=a.member_id WHERE ${eligible}`)
    .bind(profile.id, memberId)
    .first<{ count: number }>();
  const rows = await database.prepare(`SELECT a.id, m.created_at AS signup_at FROM referral_attributions a JOIN members m ON m.id=a.member_id WHERE ${eligible} ORDER BY m.created_at DESC, a.id DESC LIMIT 20`)
    .bind(profile.id, memberId)
    .all<{ id: string; signup_at: number }>();
  return {
    count: Number(countRow?.count ?? 0),
    history: rows.results.map((row) => ({ id: String(row.id), signupAt: Number(row.signup_at), state: "VERIFIED" })),
  };
}

async function getAffiliateIncome(database: D1Database, memberId: string, now: number): Promise<AffiliateIncomeSummary> {
  const bounds = utcMonthBounds(now);
  const row = await database.prepare(`SELECT
    COUNT(DISTINCT c.currency) AS currency_count,
    MAX(c.currency) AS currency,
    COALESCE(SUM(CASE WHEN c.fulfilled_at >= ? AND c.fulfilled_at < ? THEN CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE -l.amount_minor END ELSE 0 END), 0) AS current_month,
    COALESCE(SUM(CASE WHEN c.status='ELIGIBLE' THEN CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE -l.amount_minor END ELSE 0 END), 0) AS confirmed,
    COALESCE(SUM(CASE WHEN c.status='HELD' THEN CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE -l.amount_minor END ELSE 0 END), 0) AS pending,
    COALESCE(SUM(CASE WHEN l.direction='CREDIT' THEN l.amount_minor ELSE -l.amount_minor END), 0) AS total
    FROM affiliate_conversions c
    JOIN affiliate_commission_ledger l ON l.conversion_id=c.id
    WHERE c.affiliate_profile_id IN (SELECT id FROM affiliate_profiles WHERE member_id=?)`).bind(bounds.start, bounds.end, memberId).first<Record<string, unknown>>();
  const currencyCount = Number(row?.currency_count ?? 0);
  return {
    currency: currencyCount === 1 && row?.currency ? String(row.currency) : null,
    currentMonthMinor: Number(row?.current_month ?? 0),
    confirmedMinor: Number(row?.confirmed ?? 0),
    pendingMinor: Number(row?.pending ?? 0),
    totalMinor: Number(row?.total ?? 0),
  };
}

export async function getAffiliateCustomerDashboard(database: D1Database, owner: CreditOwner, now = Date.now()): Promise<AffiliateCustomerDashboard> {
  const memberId = memberIdFromOwner(owner.ownerId);
  const rawSummary = await getAffiliateOwnerSummary(database, owner.ownerId);
  const referrals = memberId ? await getAffiliateReferrals(database, memberId) : { count: 0, history: [] };
  if (!memberId) {
    return { profile: null, policy: null, progress: null, referralLink: { available: false, reason: "not_eligible" }, summary: rawSummary, income: emptyIncome(), history: [], referrals };
  }

  const profile = await database.prepare("SELECT id, status FROM affiliate_profiles WHERE member_id=? LIMIT 1").bind(memberId).first<{ id: string; status: string }>();
  const policy = await getActiveAffiliatePolicy(database, now);
  const publicPolicy = projectAffiliatePolicy(policy);
  const dashboardReady = Boolean(profile?.status === "ACTIVE" && policy && publicPolicy);
  const summary = dashboardReady
    ? rawSummary
    : { ...rawSummary, creditedMinor: 0, debitedMinor: 0, netMinor: 0 };
  const income = dashboardReady ? await getAffiliateIncome(database, memberId, now) : emptyIncome();
  const history = dashboardReady
    ? (await listAffiliateOwnerHistory(database, owner.ownerId)).map((item) => ({
      id: item.id,
      amountMinor: item.amountMinor,
      currency: item.currency,
      commissionMinor: item.commissionMinor,
      status: item.status,
      fulfilledAt: item.fulfilledAt,
      eligibleAt: item.eligibleAt,
      reversedAt: item.reversedAt,
      createdAt: item.createdAt,
    }))
    : [];
  if (!dashboardReady || !profile || !policy || !publicPolicy) {
    const referralLink = profile?.status === "ACTIVE"
      ? await ensureAffiliateReferralLink(database, owner, undefined, now)
      : { available: false as const, reason: !profile ? "not_eligible" as const : "profile_inactive" as const };
    return {
      profile: profile && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(profile.status) ? { status: profile.status as AffiliateProfileStatus } : null,
      policy: publicPolicy,
      progress: null,
      referralLink,
      summary,
      income,
      history,
      referrals,
    };
  }

  const bounds = utcMonthBounds(now);
  const row = await database.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions WHERE affiliate_profile_id=? AND fulfilled_at >= ? AND fulfilled_at < ? AND status <> 'REVERSED'").bind(profile.id, bounds.start, bounds.end).first<{ count: number }>();
  const qualifiedConversions = Number(row?.count ?? 0);
  const current = selectAffiliateTier(policy, qualifiedConversions);
  const next = nextTier(policy, qualifiedConversions);
  return {
    profile: { status: "ACTIVE" },
    policy: publicPolicy,
    progress: { qualifiedConversions, currentTier: current ? publicTier(current) : null, nextTier: next ? publicTier(next) : null },
    referralLink: await ensureAffiliateReferralLink(database, owner, undefined, now),
    summary,
    income,
    history,
    referrals,
  };
}
