import type { D1Database } from "@cloudflare/workers-types";
import type { CreditOwner } from "../credits/types";
import { getActiveAffiliatePolicy, selectAffiliateTier, utcMonthBounds, type AffiliatePolicy, type AffiliatePolicyTier } from "./policy";
import { getAffiliateSummary, listAffiliateHistory } from "./service";
import { memberIdFromOwner } from "./repository";

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

export type AffiliateCustomerDashboard = {
  profile: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" } | null;
  policy: PublicAffiliatePolicy | null;
  progress: AffiliateTierProgress | null;
  referralLink: { available: false; reason: "not_supported_by_current_backend" };
  summary: Awaited<ReturnType<typeof getAffiliateSummary>>;
  history: CustomerAffiliateHistoryItem[];
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

export async function getAffiliateCustomerDashboard(database: D1Database, owner: CreditOwner, now = Date.now()): Promise<AffiliateCustomerDashboard> {
  const memberId = memberIdFromOwner(owner.ownerId);
  const summary = await getAffiliateSummary(database, owner.ownerId);
  const history = memberId
    ? (await listAffiliateHistory(database, owner.ownerId)).map((item) => ({
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
  if (!memberId) {
    return { profile: null, policy: null, progress: null, referralLink: { available: false, reason: "not_supported_by_current_backend" }, summary, history };
  }

  const profile = await database.prepare("SELECT status FROM affiliate_profiles WHERE member_id=? LIMIT 1").bind(memberId).first<{ status: string }>();
  const policy = await getActiveAffiliatePolicy(database, now);
  const publicPolicy = projectAffiliatePolicy(policy);
  if (!profile || profile.status !== "ACTIVE" || !policy || !publicPolicy) {
    return {
      profile: profile && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(profile.status) ? { status: profile.status as AffiliateCustomerDashboard["profile"]["status"] } : null,
      policy: publicPolicy,
      progress: null,
      referralLink: { available: false, reason: "not_supported_by_current_backend" },
      summary,
      history,
    };
  }

  const bounds = utcMonthBounds(now);
  const row = await database.prepare("SELECT COUNT(*) AS count FROM affiliate_conversions WHERE affiliate_profile_id=? AND fulfilled_at >= ? AND fulfilled_at < ? AND status <> 'REVERSED'").bind((await database.prepare("SELECT id FROM affiliate_profiles WHERE member_id=? LIMIT 1").bind(memberId).first<{ id: string }>())?.id ?? "", bounds.start, bounds.end).first<{ count: number }>();
  const qualifiedConversions = Number(row?.count ?? 0);
  const current = selectAffiliateTier(policy, qualifiedConversions);
  const next = nextTier(policy, qualifiedConversions);
  return {
    profile: { status: "ACTIVE" },
    policy: publicPolicy,
    progress: { qualifiedConversions, currentTier: current ? publicTier(current) : null, nextTier: next ? publicTier(next) : null },
    referralLink: { available: false, reason: "not_supported_by_current_backend" },
    summary,
    history,
  };
}

