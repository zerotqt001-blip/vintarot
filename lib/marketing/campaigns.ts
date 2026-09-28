import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { createCreditStore, creditAccountId, prepareGrantCreditsStatements } from "../credits/repository";

export const WELCOME_BONUS_CAMPAIGN_ID = "welcome-bonus-v1";
export const DAILY_REWARDS_CAMPAIGN_ID = "daily-rewards-v1";
export const DEFAULT_CAMPAIGN_TIME_ZONE = "Asia/Ho_Chi_Minh";

type CampaignRow = {
  id: string;
  campaignType: "WELCOME_BONUS" | "DAILY_REWARD" | "CUSTOM";
  name: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  rewardUnits: number;
  startAt: number;
  endAt: number | null;
  timeZone: string;
  eligibilityRule: "NEW_MEMBER" | "ACTIVE_MEMBER";
  claimFrequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  creditExpirationSeconds: number | null;
  totalBudgetUnits: number | null;
  perUserLimit: number | null;
  budgetUsedUnits: number;
  configVersion: number;
};

type ClaimRow = {
  id: string;
  units: number;
  claimedAt: number;
  expiresAt: number | null;
  creditGrantId: string | null;
};

export type DailyRewardStatus =
  | "eligible"
  | "claimed"
  | "already_claimed"
  | "paused"
  | "scheduled"
  | "ended"
  | "not_eligible"
  | "per_user_limit"
  | "budget_exhausted"
  | "unavailable";

export type DailyRewardState = {
  status: DailyRewardStatus;
  eligible: boolean;
  campaign: {
    id: string;
    name: string;
    rewardUnits: number;
    campaignType: CampaignRow["campaignType"];
    claimFrequency: CampaignRow["claimFrequency"];
    timeZone: string;
    creditExpirationSeconds: number | null;
  } | null;
  claim: { units: number; claimedAt: number; expiresAt: number | null } | null;
  nextClaimAt: number | null;
};

export type DailyRewardClaimResult = DailyRewardState & {
  status: Exclude<DailyRewardStatus, "eligible">;
  units: number;
  claimedAt: number | null;
  expiresAt: number | null;
};

async function first<T>(database: D1Database, sql: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(sql).bind(...values).first<T>()) || null;
}

function changed(result: D1Result<unknown> | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

function campaignSelect(): string {
  return `SELECT id, campaign_type AS campaignType, name, status, reward_units AS rewardUnits,
    start_at AS startAt, end_at AS endAt, time_zone AS timeZone, eligibility_rule AS eligibilityRule,
    claim_frequency AS claimFrequency, credit_expiration_seconds AS creditExpirationSeconds,
    total_budget_units AS totalBudgetUnits, per_user_limit AS perUserLimit,
    budget_used_units AS budgetUsedUnits, config_version AS configVersion
    FROM marketing_campaigns`;
}

async function rewardCampaign(database: D1Database, campaignId: string): Promise<CampaignRow | null> {
  return first<CampaignRow>(database, `${campaignSelect()} WHERE id=? AND campaign_type IN ('DAILY_REWARD','CUSTOM') LIMIT 1`, campaignId);
}

export async function prepareWelcomeSignupStatements(database: D1Database, memberId: string, now: number): Promise<D1PreparedStatement[]> {
  const campaign = await first<CampaignRow>(database, `${campaignSelect()} WHERE id=? AND campaign_type='WELCOME_BONUS' LIMIT 1`, WELCOME_BONUS_CAMPAIGN_ID);
  if (!campaign || campaign.eligibilityRule !== "NEW_MEMBER" || campaign.claimFrequency !== "ONCE"
    || campaign.status !== "ACTIVE" || Number(campaign.startAt) > now
    || (campaign.endAt !== null && Number(campaign.endAt) <= now)) return [];

  const claimPeriod = "once";
  const claimId = `campaign-claim:${campaign.id}:${memberId}:${claimPeriod}`;
  const grantKey = "signup-trial:v1";
  const creditOwner = { kind: "member" as const, ownerId: `member:${memberId}` };
  const accountId = creditAccountId(creditOwner);
  const grantId = `credit-grant:${accountId}:${grantKey}`;
  const expiresAt = campaign.creditExpirationSeconds === null ? null : now + Number(campaign.creditExpirationSeconds) * 1_000;
  const grantGuardSql = "EXISTS (SELECT 1 FROM marketing_campaign_claims WHERE id = ?)";
  const statements: D1PreparedStatement[] = [
    database.prepare(`UPDATE marketing_campaigns SET budget_used_units=budget_used_units + reward_units,
      updated_at=? WHERE id=? AND campaign_type='WELCOME_BONUS' AND status='ACTIVE' AND config_version=?
      AND start_at<=? AND (end_at IS NULL OR end_at>?)
      AND (total_budget_units IS NULL OR budget_used_units + reward_units <= total_budget_units)
      AND (per_user_limit IS NULL OR (SELECT COUNT(*) FROM marketing_campaign_claims WHERE campaign_id=? AND member_id=?) < per_user_limit)
      AND NOT EXISTS (SELECT 1 FROM marketing_campaign_claims WHERE campaign_id=? AND member_id=? AND claim_period=?)
      AND EXISTS (SELECT 1 FROM members WHERE id=? AND disabled=0)`)
      .bind(now, campaign.id, Number(campaign.configVersion), now, now, campaign.id, memberId, campaign.id, memberId, claimPeriod, memberId),
    database.prepare(`INSERT OR IGNORE INTO marketing_campaign_claims
      (id, campaign_id, member_id, claim_period, credit_grant_id, units, claimed_at, expires_at)
      SELECT ?, ?, ?, ?, NULL, ?, ?, ? WHERE changes()=1`)
      .bind(claimId, campaign.id, memberId, claimPeriod, Number(campaign.rewardUnits), now, expiresAt),
    ...prepareGrantCreditsStatements(database, {
      owner: creditOwner,
      source: "TRIAL",
      units: Number(campaign.rewardUnits),
      grantKey,
      sourceType: "SIGNUP_TRIAL",
      sourceId: memberId,
      eligibleFrom: now,
      expiresAt,
      policyVersion: "signup-trial-v1",
      policySnapshot: { grantKey, units: Number(campaign.rewardUnits), expiresAt },
      reason: "Free signup trial credit",
    }, {
      timestamp: now,
      createAccount: true,
      requireMemberRecord: true,
      memberRecordId: memberId,
      guardSql: grantGuardSql,
      guardValues: [claimId],
    }),
    database.prepare("UPDATE marketing_campaign_claims SET credit_grant_id=? WHERE id=? AND credit_grant_id IS NULL AND EXISTS (SELECT 1 FROM credit_grants WHERE id=? AND account_id=?)")
      .bind(grantId, claimId, grantId, accountId),
  ];
  return statements;
}

function safeDateParts(timestamp: number, timeZone: string): { year: number; month: number; day: number } {
  if (!Number.isFinite(timestamp)) throw new Error("Invalid campaign timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

export function campaignDateKey(timestamp: number, timeZone = DEFAULT_CAMPAIGN_TIME_ZONE): string {
  const { year, month, day } = safeDateParts(timestamp, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function timeZoneOffsetAt(timestamp: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const wallClockUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return wallClockUtc - Math.floor(timestamp / 1000) * 1000;
}

function nextLocalDayStart(timestamp: number, timeZone: string): number {
  const { year, month, day } = safeDateParts(timestamp, timeZone);
  const targetWallClockUtc = Date.UTC(year, month - 1, day + 1);
  let estimate = targetWallClockUtc - timeZoneOffsetAt(targetWallClockUtc, timeZone);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    estimate = targetWallClockUtc - timeZoneOffsetAt(estimate, timeZone);
  }
  return estimate;
}

function localBoundaryStart(year: number, month: number, day: number, timeZone: string): number {
  const wallClockUtc = Date.UTC(year, month - 1, day);
  let estimate = wallClockUtc - timeZoneOffsetAt(wallClockUtc, timeZone);
  for (let attempt = 0; attempt < 3; attempt += 1) estimate = wallClockUtc - timeZoneOffsetAt(estimate, timeZone);
  return estimate;
}

function claimPeriodKey(timestamp: number, campaign: CampaignRow): string {
  if (campaign.claimFrequency === "ONCE") return "once";
  const { year, month, day } = safeDateParts(timestamp, campaign.timeZone);
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (campaign.claimFrequency === "DAILY") return date;
  if (campaign.claimFrequency === "MONTHLY") return date.slice(0, 7);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const isoDay = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - isoDay);
  const weekYear = localDate.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - (firstThursday.getUTCDay() || 7));
  const week = 1 + Math.round((localDate.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function nextClaimPeriodStart(timestamp: number, campaign: CampaignRow): number | null {
  if (campaign.claimFrequency === "ONCE") return null;
  const { year, month, day } = safeDateParts(timestamp, campaign.timeZone);
  if (campaign.claimFrequency === "DAILY") return nextLocalDayStart(timestamp, campaign.timeZone);
  let target: Date;
  if (campaign.claimFrequency === "WEEKLY") {
    target = new Date(Date.UTC(year, month - 1, day));
    const weekDay = target.getUTCDay();
    target.setUTCDate(target.getUTCDate() + ((8 - weekDay) % 7 || 7));
  } else {
    target = new Date(Date.UTC(year, month, 1));
  }
  return localBoundaryStart(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), campaign.timeZone);
}

function publicCampaign(campaign: CampaignRow): NonNullable<DailyRewardState["campaign"]> {
  return {
    id: campaign.id,
    name: campaign.name,
    rewardUnits: Number(campaign.rewardUnits),
    campaignType: campaign.campaignType,
    claimFrequency: campaign.claimFrequency,
    timeZone: campaign.timeZone,
    creditExpirationSeconds: campaign.creditExpirationSeconds === null ? null : Number(campaign.creditExpirationSeconds),
  };
}

function statusState(status: DailyRewardStatus, campaign: CampaignRow | null, claim: ClaimRow | null = null, nextClaimAt: number | null = null): DailyRewardState {
  return {
    status,
    eligible: status === "eligible",
    campaign: campaign ? publicCampaign(campaign) : null,
    claim: claim ? {
      units: Number(claim.units),
      claimedAt: Number(claim.claimedAt),
      expiresAt: claim.expiresAt === null ? null : Number(claim.expiresAt),
    } : null,
    nextClaimAt,
  };
}

async function memberEligible(database: D1Database, memberId: string, campaign: CampaignRow): Promise<boolean> {
  if (!memberId.trim()) return false;
  const member = await first<{ createdAt: number }>(database,
    "SELECT created_at AS createdAt FROM members WHERE id=? AND disabled=0 AND email_verified_at IS NOT NULL LIMIT 1", memberId);
  if (!member) return false;
  return campaign.eligibilityRule !== "NEW_MEMBER"
    || (Number(member.createdAt) >= Number(campaign.startAt)
      && (campaign.endAt === null || Number(member.createdAt) < Number(campaign.endAt)));
}

async function claimForPeriod(database: D1Database, campaignId: string, memberId: string, claimPeriod: string): Promise<ClaimRow | null> {
  return first<ClaimRow>(database, `SELECT id, units, claimed_at AS claimedAt, expires_at AS expiresAt,
    credit_grant_id AS creditGrantId FROM marketing_campaign_claims
    WHERE campaign_id=? AND member_id=? AND claim_period=? LIMIT 1`, campaignId, memberId, claimPeriod);
}

async function calculateState(database: D1Database, memberId: string, now: number, campaign: CampaignRow | null): Promise<DailyRewardState> {
  if (!campaign) return statusState("unavailable", null);
  if (campaign.campaignType === "WELCOME_BONUS") return statusState("unavailable", campaign);
  if (!(await memberEligible(database, memberId, campaign))) return statusState("not_eligible", campaign);
  if (campaign.status === "PAUSED") return statusState("paused", campaign);
  if (campaign.status === "ENDED" || (campaign.endAt !== null && Number(campaign.endAt) <= now)) return statusState("ended", campaign);
  if (Number(campaign.startAt) > now) return statusState("scheduled", campaign);
  if (campaign.status !== "ACTIVE") return statusState("paused", campaign);

  const period = claimPeriodKey(now, campaign);
  const existing = await claimForPeriod(database, campaign.id, memberId, period);
  if (existing) {
    const nextPeriod = nextClaimPeriodStart(now, campaign);
    const withinCampaign = nextPeriod !== null && (campaign.endAt === null || nextPeriod < Number(campaign.endAt));
    return statusState("already_claimed", campaign, existing, withinCampaign ? nextPeriod : null);
  }
  if (campaign.perUserLimit !== null) {
    const totalClaims = await first<{ count: number }>(database,
      "SELECT COUNT(*) AS count FROM marketing_campaign_claims WHERE campaign_id=? AND member_id=?", campaign.id, memberId);
    if (Number(totalClaims?.count ?? 0) >= Number(campaign.perUserLimit)) return statusState("per_user_limit", campaign);
  }
  if (campaign.totalBudgetUnits !== null && Number(campaign.budgetUsedUnits) + Number(campaign.rewardUnits) > Number(campaign.totalBudgetUnits)) {
    return statusState("budget_exhausted", campaign);
  }
  return statusState("eligible", campaign);
}

export async function getDailyRewardState(database: D1Database, memberId: string, now = Date.now()): Promise<DailyRewardState> {
  const campaign = await rewardCampaign(database, DAILY_REWARDS_CAMPAIGN_ID);
  return calculateState(database, memberId, now, campaign);
}

export async function getMarketingRewardState(database: D1Database, memberId: string, campaignId: string, now = Date.now()): Promise<DailyRewardState> {
  const campaign = await rewardCampaign(database, campaignId);
  return calculateState(database, memberId, now, campaign);
}

export async function getMarketingRewardStates(database: D1Database, memberId: string, now = Date.now()): Promise<Array<{ campaign: NonNullable<DailyRewardState["campaign"]>; state: DailyRewardState }>> {
  const campaigns = await database.prepare(`${campaignSelect()} WHERE campaign_type IN ('DAILY_REWARD','CUSTOM') ORDER BY start_at DESC, created_at DESC, id`)
    .all<CampaignRow>();
  const output: Array<{ campaign: NonNullable<DailyRewardState["campaign"]>; state: DailyRewardState }> = [];
  for (const campaign of campaigns.results) {
    const state = await calculateState(database, memberId, now, campaign);
    if (state.campaign) output.push({ campaign: state.campaign, state });
  }
  return output;
}

function resultFromState(state: DailyRewardState): DailyRewardClaimResult {
  return {
    ...state,
    status: state.status === "eligible" ? "unavailable" : state.status,
    units: state.claim?.units ?? 0,
    claimedAt: state.claim?.claimedAt ?? null,
    expiresAt: state.claim?.expiresAt ?? null,
  };
}

export async function claimMarketingReward(database: D1Database, memberId: string, campaignId: string, now = Date.now()): Promise<DailyRewardClaimResult> {
  if (!memberId.trim()) return resultFromState(statusState("not_eligible", null));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const campaign = await rewardCampaign(database, campaignId);
    const state = await calculateState(database, memberId, now, campaign);
    if (!campaign || !state.eligible) return resultFromState(state);

    const period = claimPeriodKey(now, campaign);
    const claimId = `campaign-claim:${campaign.id}:${memberId}:${period}`;
    const grantKey = `campaign:${campaign.id}:${memberId}:${period}`;
    const expiresAt = campaign.creditExpirationSeconds === null ? null : now + Number(campaign.creditExpirationSeconds) * 1_000;
    const creditOwner = { kind: "member" as const, ownerId: `member:${memberId}` };
    const accountId = creditAccountId(creditOwner);
    const grantId = `credit-grant:${accountId}:${grantKey}`;
    const grantGuardSql = "EXISTS (SELECT 1 FROM marketing_campaign_claims WHERE id = ?)";
    const grantInput = {
      owner: creditOwner,
      source: "PROMOTION" as const,
      units: Number(campaign.rewardUnits),
      grantKey,
      eligibleFrom: now,
      expiresAt,
      sourceType: "MARKETING_CAMPAIGN",
      sourceId: campaign.id,
      policyVersion: "marketing-campaign-v1",
      policySnapshot: {
        campaignId: campaign.id,
        campaignType: campaign.campaignType,
        claimPeriod: period,
        units: Number(campaign.rewardUnits),
        timeZone: campaign.timeZone,
        expiresAt,
      },
      reason: `${campaign.name} reward`,
    };
    const statements = [
      database.prepare(`UPDATE marketing_campaigns SET budget_used_units=budget_used_units + reward_units,
        updated_at=? WHERE id=? AND campaign_type=? AND status='ACTIVE'
        AND config_version=? AND start_at<=? AND (end_at IS NULL OR end_at>?)
        AND (total_budget_units IS NULL OR budget_used_units + reward_units <= total_budget_units)
        AND (per_user_limit IS NULL OR (SELECT COUNT(*) FROM marketing_campaign_claims WHERE campaign_id=? AND member_id=?) < per_user_limit)
        AND NOT EXISTS (SELECT 1 FROM marketing_campaign_claims WHERE campaign_id=? AND member_id=? AND claim_period=?)
        AND EXISTS (SELECT 1 FROM members m WHERE m.id=? AND m.disabled=0 AND m.email_verified_at IS NOT NULL
          AND (eligibility_rule='ACTIVE_MEMBER' OR (m.created_at>=start_at AND (end_at IS NULL OR m.created_at<end_at))))`)
        .bind(now, campaign.id, campaign.campaignType, Number(campaign.configVersion), now, now, campaign.id, memberId, campaign.id, memberId, period, memberId),
      database.prepare(`INSERT OR IGNORE INTO marketing_campaign_claims
        (id, campaign_id, member_id, claim_period, credit_grant_id, units, claimed_at, expires_at)
        SELECT ?, ?, ?, ?, NULL, ?, ?, ? WHERE changes()=1`)
        .bind(claimId, campaign.id, memberId, period, Number(campaign.rewardUnits), now, expiresAt),
      ...prepareGrantCreditsStatements(database, grantInput, {
        timestamp: now,
        createAccount: true,
        requireMemberRecord: true,
        memberRecordId: memberId,
        guardSql: grantGuardSql,
        guardValues: [claimId],
      }),
      database.prepare("UPDATE marketing_campaign_claims SET credit_grant_id=? WHERE id=? AND credit_grant_id IS NULL AND EXISTS (SELECT 1 FROM credit_grants WHERE id=? AND account_id=?)")
        .bind(grantId, claimId, grantId, accountId),
    ];
    let result: D1Result<unknown>[];
    try {
      result = await database.batch(statements);
    } catch (error) {
      const existing = await claimForPeriod(database, campaign.id, memberId, period);
      if (existing) return resultFromState(await calculateState(database, memberId, now, campaign));
      throw error;
    }

    if (changed(result[0]) === 0) {
      const currentCampaign = await rewardCampaign(database, campaign.id);
      if (currentCampaign && Number(currentCampaign.configVersion) !== Number(campaign.configVersion)) continue;
      return resultFromState(await calculateState(database, memberId, now, currentCampaign));
    }
    const persisted = await claimForPeriod(database, campaign.id, memberId, period);
    if (!persisted?.creditGrantId) throw new Error("Campaign claim did not link to its canonical Credit grant");
    return {
      ...statusState("claimed", campaign, persisted, null),
      status: "claimed",
      units: Number(persisted.units),
      claimedAt: Number(persisted.claimedAt),
      expiresAt: persisted.expiresAt === null ? null : Number(persisted.expiresAt),
    };
  }
  return resultFromState(await getMarketingRewardState(database, memberId, campaignId, now));
}

export async function claimDailyReward(database: D1Database, memberId: string, now = Date.now()): Promise<DailyRewardClaimResult> {
  return claimMarketingReward(database, memberId, DAILY_REWARDS_CAMPAIGN_ID, now);
}

export async function expireDueCreditGrants(database: D1Database, now = Date.now(), limit = 500): Promise<{ expiredGrants: number; expiredUnits: number }> {
  const boundedLimit = Math.max(1, Math.min(5_000, Math.trunc(limit)));
  const due = await database.prepare(`SELECT g.id AS grantId, a.owner_kind AS ownerKind, a.owner_id AS ownerId
    FROM credit_grants g JOIN credit_accounts a ON a.id=g.account_id
    WHERE g.expires_at IS NOT NULL AND g.expires_at<=? AND g.available_units>0
    ORDER BY g.expires_at, g.id LIMIT ?`).bind(now, boundedLimit).all<{ grantId: string; ownerKind: "member" | "guest"; ownerId: string }>();
  const store = createCreditStore(database, () => now);
  let expiredGrants = 0;
  let expiredUnits = 0;
  for (const grant of due.results) {
    const expired = await store.expireGrant({ owner: { kind: grant.ownerKind, ownerId: grant.ownerId }, grantId: grant.grantId });
    if (expired > 0) {
      expiredGrants += 1;
      expiredUnits += expired;
    }
  }
  return { expiredGrants, expiredUnits };
}
