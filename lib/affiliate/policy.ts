import type { D1Database } from "@cloudflare/workers-types";

export type AffiliatePolicyTier = {
  id: string;
  policyVersionId: string;
  tierCode: string;
  minQualifiedConversions: number;
  rateBps: number;
};

export type AffiliatePolicy = {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  attributionWindowDays: number;
  holdDays: number;
  currency: string;
  startsAt: number;
  endsAt: number | null;
  tiers: AffiliatePolicyTier[];
};

export async function getActiveAffiliatePolicy(database: D1Database, at: number, currency?: string): Promise<AffiliatePolicy | null> {
  const row = await database.prepare("SELECT id, version, status, attribution_window_days, hold_days, currency, starts_at, ends_at FROM affiliate_policy_versions WHERE status='ACTIVE' AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?) AND (? IS NULL OR currency=?) ORDER BY version DESC LIMIT 1").bind(at, at, currency ?? null, currency ?? null).first<Record<string, unknown>>();
  if (!row) return null;
  const tierRows = await database.prepare("SELECT id, policy_version_id, tier_code, min_qualified_conversions, rate_bps FROM affiliate_policy_tiers WHERE policy_version_id=? ORDER BY min_qualified_conversions ASC, id ASC").bind(row.id).all<Record<string, unknown>>();
  return {
    id: String(row.id),
    version: Number(row.version),
    status: String(row.status) as AffiliatePolicy["status"],
    attributionWindowDays: Number(row.attribution_window_days),
    holdDays: Number(row.hold_days),
    currency: String(row.currency),
    startsAt: Number(row.starts_at),
    endsAt: row.ends_at == null ? null : Number(row.ends_at),
    tiers: tierRows.results.map((tier) => ({
      id: String(tier.id),
      policyVersionId: String(tier.policy_version_id),
      tierCode: String(tier.tier_code),
      minQualifiedConversions: Number(tier.min_qualified_conversions),
      rateBps: Number(tier.rate_bps),
    })),
  };
}

export function selectAffiliateTier(policy: AffiliatePolicy, qualifiedConversionsIncludingCurrent: number): AffiliatePolicyTier | null {
  return [...policy.tiers]
    .sort((left, right) => right.minQualifiedConversions - left.minQualifiedConversions || left.id.localeCompare(right.id))
    .find((tier) => tier.minQualifiedConversions <= qualifiedConversionsIncludingCurrent) ?? null;
}

export function utcMonthBounds(timestamp: number): { start: number; end: number } {
  const date = new Date(timestamp);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  return { start, end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) };
}
