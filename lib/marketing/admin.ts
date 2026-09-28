import type { D1Database } from "@cloudflare/workers-types";
import { AdminServiceError } from "../admin/member-service";
import type { AdminActor } from "../admin/context";
import { hasPermission } from "../admin/permissions";
import { prepareAuditInsert } from "../audit/service";
import { createRequestFingerprint } from "../credits/ledger";

export type MarketingCampaignType = "WELCOME_BONUS" | "DAILY_REWARD" | "CUSTOM";
export type MarketingCampaignStatus = "ACTIVE" | "PAUSED" | "ENDED";
export type MarketingClaimFrequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type MarketingEligibilityRule = "NEW_MEMBER" | "ACTIVE_MEMBER";

export type MarketingCampaignInput = {
  campaignType: MarketingCampaignType;
  name: string;
  rewardUnits: number;
  startAt: number;
  endAt: number | null;
  timeZone: string;
  eligibilityRule: MarketingEligibilityRule;
  claimFrequency: MarketingClaimFrequency;
  creditExpirationSeconds: number | null;
  totalBudgetUnits: number | null;
  perUserLimit: number | null;
};

export type MarketingCampaignRecord = MarketingCampaignInput & {
  id: string;
  status: MarketingCampaignStatus;
  budgetUsedUnits: number;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
  claimedRewards: number;
  eligibleMembers: number;
  redeemedPromotionalUnits: number;
  expiredPromotionalUnits: number;
  returningUsers: number;
  budgetUtilizationPercent: number | null;
};

export type MarketingCampaignHistoryEntry = {
  id: string;
  action: string;
  actorId: string;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

type CampaignRow = {
  id: string;
  campaignType: MarketingCampaignType;
  name: string;
  status: MarketingCampaignStatus;
  rewardUnits: number;
  startAt: number;
  endAt: number | null;
  timeZone: string;
  eligibilityRule: MarketingEligibilityRule;
  claimFrequency: MarketingClaimFrequency;
  creditExpirationSeconds: number | null;
  totalBudgetUnits: number | null;
  perUserLimit: number | null;
  budgetUsedUnits: number;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
  claimedRewards: number;
  eligibleMembers: number;
  redeemedPromotionalUnits: number;
  expiredPromotionalUnits: number;
  returningUsers: number;
};

type AuditRow = { action: string; target_id: string | null; metadata_json: string };

function requireMarketingPermission(actor: AdminActor): void {
  if (!hasPermission(actor.role, "admin.marketing.manage")) throw new AdminServiceError("forbidden", "Forbidden.");
}

function requiredText(value: unknown, max: number): string {
  if (typeof value !== "string") throw new AdminServiceError("invalid", "Invalid campaign configuration.");
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new AdminServiceError("invalid", "Invalid campaign configuration.");
  return normalized;
}

function positiveInteger(value: unknown, nullable: boolean, max: number, field: string): number | null {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > max) {
    throw new AdminServiceError("invalid", `Invalid ${field}.`);
  }
  return Number(value);
}

function timestamp(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AdminServiceError("invalid", `Invalid ${field}.`);
  return Number(value);
}

function normalizeInput(input: MarketingCampaignInput): MarketingCampaignInput {
  if (!input || !["WELCOME_BONUS", "DAILY_REWARD", "CUSTOM"].includes(input.campaignType)) {
    throw new AdminServiceError("invalid", "Invalid campaign type.");
  }
  if (!["ONCE", "DAILY", "WEEKLY", "MONTHLY"].includes(input.claimFrequency)) {
    throw new AdminServiceError("invalid", "Invalid claim frequency.");
  }
  if (!["NEW_MEMBER", "ACTIVE_MEMBER"].includes(input.eligibilityRule)) {
    throw new AdminServiceError("invalid", "Invalid eligibility rule.");
  }
  const name = requiredText(input.name, 120);
  const rewardUnits = positiveInteger(input.rewardUnits, false, 1_000_000, "reward amount")!;
  const startAt = timestamp(input.startAt, "campaign start");
  const endAt = input.endAt === null ? null : timestamp(input.endAt, "campaign end");
  if (endAt !== null && endAt <= startAt) throw new AdminServiceError("invalid", "Campaign end must be after its start.");
  const timeZone = requiredText(input.timeZone, 80);
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(startAt));
  } catch {
    throw new AdminServiceError("invalid", "Invalid campaign time zone.");
  }
  return {
    campaignType: input.campaignType,
    name,
    rewardUnits,
    startAt,
    endAt,
    timeZone,
    eligibilityRule: input.eligibilityRule,
    claimFrequency: input.claimFrequency,
    creditExpirationSeconds: positiveInteger(input.creditExpirationSeconds, true, 10 * 365 * 24 * 60 * 60, "Credit expiry") as number | null,
    totalBudgetUnits: positiveInteger(input.totalBudgetUnits, true, 2_000_000_000, "campaign budget") as number | null,
    perUserLimit: positiveInteger(input.perUserLimit, true, 1_000_000, "per-user limit") as number | null,
  };
}

function auditKey(value: string): string {
  const normalized = requiredText(value, 160);
  return `marketing.campaign:${normalized}`;
}

function projection(row: CampaignRow, now: number): MarketingCampaignRecord {
  const status = row.status === "ACTIVE" && row.endAt !== null && Number(row.endAt) <= now ? "ENDED" : row.status;
  return {
    id: String(row.id),
    campaignType: row.campaignType,
    name: String(row.name),
    status,
    rewardUnits: Number(row.rewardUnits),
    startAt: Number(row.startAt),
    endAt: row.endAt === null ? null : Number(row.endAt),
    timeZone: String(row.timeZone),
    eligibilityRule: row.eligibilityRule,
    claimFrequency: row.claimFrequency,
    creditExpirationSeconds: row.creditExpirationSeconds === null ? null : Number(row.creditExpirationSeconds),
    totalBudgetUnits: row.totalBudgetUnits === null ? null : Number(row.totalBudgetUnits),
    perUserLimit: row.perUserLimit === null ? null : Number(row.perUserLimit),
    budgetUsedUnits: Number(row.budgetUsedUnits),
    configVersion: Number(row.configVersion),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    claimedRewards: Number(row.claimedRewards),
    eligibleMembers: Number(row.eligibleMembers),
    redeemedPromotionalUnits: Number(row.redeemedPromotionalUnits),
    expiredPromotionalUnits: Number(row.expiredPromotionalUnits),
    returningUsers: Number(row.returningUsers),
    budgetUtilizationPercent: row.totalBudgetUnits === null
      ? null
      : Math.round((Number(row.budgetUsedUnits) / Number(row.totalBudgetUnits)) * 10_000) / 100,
  };
}

function reportSql(): string {
  return `SELECT c.id, c.campaign_type AS campaignType, c.name, c.status, c.reward_units AS rewardUnits,
    c.start_at AS startAt, c.end_at AS endAt, c.time_zone AS timeZone,
    c.eligibility_rule AS eligibilityRule, c.claim_frequency AS claimFrequency,
    c.credit_expiration_seconds AS creditExpirationSeconds, c.total_budget_units AS totalBudgetUnits,
    c.per_user_limit AS perUserLimit, c.budget_used_units AS budgetUsedUnits,
    c.config_version AS configVersion, c.created_at AS createdAt, c.updated_at AS updatedAt,
    ((SELECT COUNT(*) FROM marketing_campaign_claims mc WHERE mc.campaign_id=c.id) +
      CASE WHEN c.id='welcome-bonus-v1' THEN (SELECT COUNT(*) FROM credit_grants g
        WHERE g.source='TRIAL' AND g.source_type='SIGNUP_TRIAL'
        AND NOT EXISTS (SELECT 1 FROM marketing_campaign_claims mc WHERE mc.credit_grant_id=g.id)) ELSE 0 END) AS claimedRewards,
    (SELECT COUNT(*) FROM members m WHERE m.disabled=0 AND m.email_verified_at IS NOT NULL
      AND (c.eligibility_rule='ACTIVE_MEMBER' OR (m.created_at>=c.start_at AND (c.end_at IS NULL OR m.created_at<c.end_at)))) AS eligibleMembers,
    (SELECT COALESCE(SUM(-l.units), 0) FROM credit_ledger l JOIN credit_grants g ON g.id=l.grant_id
      WHERE l.event_type='CONSUME' AND (EXISTS (SELECT 1 FROM marketing_campaign_claims mc WHERE mc.campaign_id=c.id AND mc.credit_grant_id=g.id)
        OR (c.id='welcome-bonus-v1' AND g.source='TRIAL' AND g.source_type='SIGNUP_TRIAL'))) AS redeemedPromotionalUnits,
    (SELECT COALESCE(SUM(-l.units), 0) FROM credit_ledger l JOIN credit_grants g ON g.id=l.grant_id
      WHERE l.event_type='EXPIRATION' AND (EXISTS (SELECT 1 FROM marketing_campaign_claims mc WHERE mc.campaign_id=c.id AND mc.credit_grant_id=g.id)
        OR (c.id='welcome-bonus-v1' AND g.source='TRIAL' AND g.source_type='SIGNUP_TRIAL'))) AS expiredPromotionalUnits,
    (SELECT COUNT(*) FROM (SELECT mc.member_id FROM marketing_campaign_claims mc
      WHERE mc.campaign_id=c.id GROUP BY mc.member_id HAVING COUNT(DISTINCT mc.claim_period)>=2)) AS returningUsers
    FROM marketing_campaigns c`;
}

async function allCampaignRows(database: D1Database): Promise<CampaignRow[]> {
  return (await database.prepare(`${reportSql()} ORDER BY c.created_at DESC, c.id`).all<CampaignRow>()).results;
}

export async function loadMarketingCampaignReport(database: D1Database, now = Date.now()): Promise<MarketingCampaignRecord[]> {
  return (await allCampaignRows(database)).map((row) => projection(row, now));
}

async function campaignRow(database: D1Database, id: string): Promise<CampaignRow | null> {
  return (await database.prepare(`${reportSql()} WHERE c.id=? LIMIT 1`).bind(id).first<CampaignRow>()) || null;
}

async function priorAudit(database: D1Database, key: string, action: string, fingerprint: string): Promise<AuditRow | null> {
  const row = await database.prepare("SELECT action, target_id, metadata_json FROM audit_events WHERE idempotency_key=? LIMIT 1")
    .bind(key).first<AuditRow>();
  if (!row) return null;
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(row.metadata_json) as Record<string, unknown>; } catch { /* malformed audit is treated as a conflict */ }
  if (row.action !== action || metadata.requestFingerprint !== fingerprint) {
    throw new AdminServiceError("invalid", "This idempotency key already belongs to a different campaign request.");
  }
  return row;
}

async function nextAuditTimestamp(database: D1Database, campaignId: string, now: number): Promise<number> {
  const row = await database.prepare("SELECT MAX(created_at) AS latest FROM audit_events WHERE target_type='marketing_campaign' AND target_id=?")
    .bind(campaignId).first<{ latest: number | null }>();
  return Math.max(now, Number(row?.latest ?? 0) + (row?.latest == null ? 0 : 1));
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function createMarketingCampaignAdminService(database: D1Database, now: () => number = Date.now) {
  async function lookup(id: string): Promise<MarketingCampaignRecord | null> {
    const row = await campaignRow(database, id);
    return row ? projection(row, now()) : null;
  }

  async function get(actor: AdminActor, id: string): Promise<MarketingCampaignRecord | null> {
    requireMarketingPermission(actor);
    return lookup(id);
  }

  async function report(actor: AdminActor): Promise<MarketingCampaignRecord[]> {
    requireMarketingPermission(actor);
    return loadMarketingCampaignReport(database, now());
  }

  async function requireCampaign(id: string): Promise<MarketingCampaignRecord> {
    const row = await lookup(id);
    if (!row) throw new AdminServiceError("not_found", "Campaign not found.");
    return row;
  }

  async function create(actor: AdminActor, rawInput: MarketingCampaignInput, options: { idempotencyKey: string }): Promise<MarketingCampaignRecord> {
    requireMarketingPermission(actor);
    const input = normalizeInput(rawInput);
    if (input.campaignType === "WELCOME_BONUS") throw new AdminServiceError("invalid", "The Welcome Bonus is a managed campaign and cannot be duplicated.");
    const key = auditKey(options.idempotencyKey);
    const fingerprint = createRequestFingerprint({ operation: "create", input });
    const action = "marketing.campaign.created";
    const replay = await priorAudit(database, key, action, fingerprint);
    if (replay?.target_id) return await requireCampaign(replay.target_id);

    const id = `marketing-campaign:${globalThis.crypto.randomUUID()}`;
    const createdAt = now();
    const auditId = globalThis.crypto.randomUUID();
    const metadata = { requestFingerprint: fingerprint, before: null, after: { ...input, status: "PAUSED" } };
    try {
      await database.batch([
        database.prepare(`INSERT INTO marketing_campaigns (
          id,campaign_type,name,status,reward_units,start_at,end_at,time_zone,eligibility_rule,claim_frequency,
          credit_expiration_seconds,total_budget_units,per_user_limit,budget_used_units,config_version,created_by,updated_by,created_at,updated_at
        ) VALUES (?,?,?,'PAUSED',?,?,?,?,?,?,?,?,?,0,1,?,?,?,?)`)
          .bind(id, input.campaignType, input.name, input.rewardUnits, input.startAt, input.endAt, input.timeZone,
            input.eligibilityRule, input.claimFrequency, input.creditExpirationSeconds, input.totalBudgetUnits,
            input.perUserLimit, actor.memberId, actor.memberId, createdAt, createdAt),
        prepareAuditInsert(database, {
          id: auditId,
          actorKind: "member",
          actorId: actor.memberId,
          action,
          targetType: "marketing_campaign",
          targetId: id,
          reason: "Campaign created in Marketing Admin.",
          idempotencyKey: key,
          metadata,
        }, createdAt, { ignoreExisting: false, guardSql: "changes()=1" }),
      ]);
    } catch (error) {
      const concurrentReplay = await priorAudit(database, key, action, fingerprint);
      if (concurrentReplay?.target_id) return await requireCampaign(concurrentReplay.target_id);
      throw error;
    }
    return await requireCampaign(id);
  }

  async function update(actor: AdminActor, id: string, rawInput: MarketingCampaignInput, options: { idempotencyKey: string }): Promise<MarketingCampaignRecord> {
    requireMarketingPermission(actor);
    const input = normalizeInput(rawInput);
    const existing = await requireCampaign(id);
    if (input.campaignType !== existing.campaignType) throw new AdminServiceError("invalid", "Campaign type cannot be changed after creation.");
    if (existing.campaignType === "WELCOME_BONUS" && (input.eligibilityRule !== "NEW_MEMBER" || input.claimFrequency !== "ONCE")) {
      throw new AdminServiceError("invalid", "Welcome Bonus must remain limited to new members and one-time registration.");
    }
    if (input.totalBudgetUnits !== null && input.totalBudgetUnits < existing.budgetUsedUnits) {
      throw new AdminServiceError("invalid", "Campaign budget cannot be set below units already issued.");
    }
    const key = auditKey(options.idempotencyKey);
    const fingerprint = createRequestFingerprint({ operation: "update", id, input });
    const action = "marketing.campaign.updated";
    const replay = await priorAudit(database, key, action, fingerprint);
    if (replay?.target_id === id) return await requireCampaign(id);
    const currentRow = await campaignRow(database, id);
    if (!currentRow) throw new AdminServiceError("not_found", "Campaign not found.");
    const createdAt = await nextAuditTimestamp(database, id, now());
    const before = projection(currentRow, createdAt);
    const metadata = { requestFingerprint: fingerprint, before, after: input };
    try {
      const results = await database.batch([
        database.prepare(`UPDATE marketing_campaigns SET campaign_type=?,name=?,reward_units=?,start_at=?,end_at=?,time_zone=?,
          eligibility_rule=?,claim_frequency=?,credit_expiration_seconds=?,total_budget_units=?,per_user_limit=?,
          config_version=config_version+1,updated_by=?,updated_at=?
          WHERE id=? AND config_version=? AND (? IS NULL OR budget_used_units<=?)`)
          .bind(input.campaignType, input.name, input.rewardUnits, input.startAt, input.endAt, input.timeZone,
            input.eligibilityRule, input.claimFrequency, input.creditExpirationSeconds, input.totalBudgetUnits,
            input.perUserLimit, actor.memberId, createdAt, id, existing.configVersion, input.totalBudgetUnits, input.totalBudgetUnits),
        prepareAuditInsert(database, {
          actorKind: "member",
          actorId: actor.memberId,
          action,
          targetType: "marketing_campaign",
          targetId: id,
          reason: "Campaign configuration updated in Marketing Admin.",
          idempotencyKey: key,
          metadata,
        }, createdAt, { ignoreExisting: false, guardSql: "changes()=1" }),
      ]);
      if (Number(results[0]?.meta.changes ?? 0) !== 1) {
        const current = await campaignRow(database, id);
        if (!current) throw new AdminServiceError("not_found", "Campaign not found.");
        if (input.totalBudgetUnits !== null && input.totalBudgetUnits < Number(current.budgetUsedUnits)) {
          throw new AdminServiceError("invalid", "Campaign budget cannot be set below units already issued.");
        }
        throw new AdminServiceError("invalid", "Campaign changed while this request was being saved. Reload and retry.");
      }
    } catch (error) {
      const concurrentReplay = await priorAudit(database, key, action, fingerprint);
      if (concurrentReplay?.target_id === id) return await requireCampaign(id);
      throw error;
    }
    return await requireCampaign(id);
  }

  async function setStatus(actor: AdminActor, id: string, status: MarketingCampaignStatus, options: { idempotencyKey: string }): Promise<MarketingCampaignRecord> {
    requireMarketingPermission(actor);
    if (!["ACTIVE", "PAUSED", "ENDED"].includes(status)) throw new AdminServiceError("invalid", "Invalid campaign status.");
    const existing = await requireCampaign(id);
    const key = auditKey(options.idempotencyKey);
    const fingerprint = createRequestFingerprint({ operation: "status", id, status });
    const action = "marketing.campaign.status_changed";
    const replay = await priorAudit(database, key, action, fingerprint);
    if (replay?.target_id === id) return await requireCampaign(id);
    const currentRow = await campaignRow(database, id);
    if (!currentRow) throw new AdminServiceError("not_found", "Campaign not found.");
    const createdAt = await nextAuditTimestamp(database, id, now());
    const before = projection(currentRow, createdAt);
    const metadata = { requestFingerprint: fingerprint, before: { status: before.status }, after: { status } };
    try {
      const results = await database.batch([
        database.prepare("UPDATE marketing_campaigns SET status=?, config_version=config_version+1, updated_by=?, updated_at=? WHERE id=? AND config_version=?")
          .bind(status, actor.memberId, createdAt, id, existing.configVersion),
        prepareAuditInsert(database, {
          actorKind: "member",
          actorId: actor.memberId,
          action,
          targetType: "marketing_campaign",
          targetId: id,
          reason: `Campaign status changed to ${status}.`,
          idempotencyKey: key,
          metadata,
        }, createdAt, { ignoreExisting: false, guardSql: "changes()=1" }),
      ]);
      if (Number(results[0]?.meta.changes ?? 0) !== 1) {
        const current = await campaignRow(database, id);
        if (!current) throw new AdminServiceError("not_found", "Campaign not found.");
        throw new AdminServiceError("invalid", "Campaign changed while this request was being saved. Reload and retry.");
      }
    } catch (error) {
      const concurrentReplay = await priorAudit(database, key, action, fingerprint);
      if (concurrentReplay?.target_id === id) return await requireCampaign(id);
      throw error;
    }
    return await requireCampaign(id);
  }

  async function history(actor: AdminActor, id: string, limit = 50): Promise<MarketingCampaignHistoryEntry[]> {
    requireMarketingPermission(actor);
    await requireCampaign(id);
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = await database.prepare(`SELECT id, action, actor_id AS actorId, reason, metadata_json AS metadataJson, created_at AS createdAt
      FROM audit_events WHERE target_type='marketing_campaign' AND target_id=?
      ORDER BY created_at DESC, id DESC LIMIT ?`).bind(id, boundedLimit).all<{
        id: string;
        action: string;
        actorId: string;
        reason: string;
        metadataJson: string;
        createdAt: number;
      }>();
    return rows.results.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      actorId: String(row.actorId),
      reason: String(row.reason),
      metadata: parseMetadata(row.metadataJson),
      createdAt: Number(row.createdAt),
    }));
  }

  return {
    create,
    update,
    setStatus,
    async list(actor: AdminActor): Promise<MarketingCampaignRecord[]> {
      return report(actor);
    },
    get,
    report,
    history,
  };
}
