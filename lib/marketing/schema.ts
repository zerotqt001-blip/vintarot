import { z } from "zod";

export const marketingCampaignSchema = z.object({
  campaignType: z.enum(["WELCOME_BONUS", "DAILY_REWARD", "CUSTOM"]),
  name: z.string().trim().min(1).max(120),
  rewardUnits: z.number().int().positive().max(1_000_000),
  startAt: z.number().int().nonnegative(),
  endAt: z.number().int().positive().nullable(),
  timeZone: z.string().trim().min(1).max(80),
  eligibilityRule: z.enum(["NEW_MEMBER", "ACTIVE_MEMBER"]),
  claimFrequency: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]),
  creditExpirationSeconds: z.number().int().positive().max(10 * 365 * 24 * 60 * 60).nullable(),
  totalBudgetUnits: z.number().int().positive().max(2_000_000_000).nullable(),
  perUserLimit: z.number().int().positive().max(1_000_000).nullable(),
}).strict();

export const marketingCampaignStatusSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED", "ENDED"]) }).strict();
