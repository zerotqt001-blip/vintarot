import type { D1Database } from "@cloudflare/workers-types";
import { ensureAffiliateReferralLink } from "./referral-link";
import type { AffiliateReferralLink } from "./types";

type EligibleMemberState = {
  id: string;
  email_verified_at: number | null;
  disabled: number;
  disabled_at: number | null;
};

export type AffiliateEnrollmentResult =
  | { enrolled: true; profileId: string; status: "ACTIVE"; profileCreated: boolean; referralLink: Extract<AffiliateReferralLink, { available: true }> }
  | { enrolled: false; reason: "member_not_found" | "not_verified" | "disabled" | "profile_suspended"; profileId?: string; status?: "SUSPENDED" };

export type AffiliateEnrollmentBackfillSummary = {
  eligibleMembers: number;
  enrolled: number;
  profilesCreated: number;
  linksEnsured: number;
  suspendedPreserved: number;
};

function memberEligibilityReason(member: EligibleMemberState | null): "member_not_found" | "not_verified" | "disabled" | null {
  if (!member) return "member_not_found";
  if (member.disabled !== 0 || member.disabled_at !== null) return "disabled";
  if (member.email_verified_at === null) return "not_verified";
  return null;
}

export async function ensureAffiliateEnrollment(input: {
  database: D1Database;
  memberId: string;
  now?: number;
  origin?: string;
}): Promise<AffiliateEnrollmentResult> {
  const memberId = input.memberId.trim();
  if (!memberId || memberId.length > 160) return { enrolled: false, reason: "member_not_found" };

  const member = await input.database.prepare("SELECT id, email_verified_at, disabled, disabled_at FROM members WHERE id=? LIMIT 1")
    .bind(memberId)
    .first<EligibleMemberState>();
  const ineligibleReason = memberEligibilityReason(member);
  if (ineligibleReason) return { enrolled: false, reason: ineligibleReason };

  const now = input.now ?? Date.now();
  const profileId = `affiliate-profile:${globalThis.crypto.randomUUID()}`;
  const inserted = await input.database.prepare("INSERT OR IGNORE INTO affiliate_profiles (id, member_id, status, fraud_note_ciphertext, created_at, updated_at) SELECT ?, id, 'ACTIVE', NULL, ?, ? FROM members WHERE id=? AND email_verified_at IS NOT NULL AND disabled=0 AND disabled_at IS NULL")
    .bind(profileId, now, now, memberId)
    .run();
  const profile = await input.database.prepare("SELECT id, status FROM affiliate_profiles WHERE member_id=? LIMIT 1")
    .bind(memberId)
    .first<{ id: string; status: string }>();
  if (!profile) {
    // The member may have become disabled or unverified between the read and insert.
    const latestMember = await input.database.prepare("SELECT id, email_verified_at, disabled, disabled_at FROM members WHERE id=? LIMIT 1")
      .bind(memberId)
      .first<EligibleMemberState>();
    return { enrolled: false, reason: memberEligibilityReason(latestMember) ?? "member_not_found" };
  }

  if (profile.status === "SUSPENDED") {
    return { enrolled: false, reason: "profile_suspended", profileId: String(profile.id), status: "SUSPENDED" };
  }

  if (profile.status === "INACTIVE") {
    await input.database.prepare("UPDATE affiliate_profiles SET status='ACTIVE', updated_at=? WHERE id=? AND status='INACTIVE' AND EXISTS (SELECT 1 FROM members WHERE id=? AND email_verified_at IS NOT NULL AND disabled=0 AND disabled_at IS NULL)")
      .bind(now, profile.id, memberId)
      .run();
  }
  const current = await input.database.prepare("SELECT id, status FROM affiliate_profiles WHERE id=? LIMIT 1")
    .bind(profile.id)
    .first<{ id: string; status: string }>();
  if (!current || current.status !== "ACTIVE") {
    const latestMember = await input.database.prepare("SELECT id, email_verified_at, disabled, disabled_at FROM members WHERE id=? LIMIT 1")
      .bind(memberId)
      .first<EligibleMemberState>();
    return { enrolled: false, reason: memberEligibilityReason(latestMember) ?? (current?.status === "SUSPENDED" ? "profile_suspended" : "disabled"), ...(current?.status === "SUSPENDED" ? { profileId: String(profile.id), status: "SUSPENDED" as const } : {}) };
  }

  const referralLink = await ensureAffiliateReferralLink(input.database, { kind: "member", ownerId: `member:${memberId}` }, input.origin, now);
  if (!referralLink.available) throw new Error(`Affiliate enrollment link unavailable: ${referralLink.reason}`);

  return {
    enrolled: true,
    profileId: String(current.id),
    status: "ACTIVE",
    profileCreated: Number(inserted.meta.changes) === 1,
    referralLink,
  };
}

export async function backfillAffiliateEnrollment(input: { database: D1Database; now?: number; origin?: string }): Promise<AffiliateEnrollmentBackfillSummary> {
  const members = await input.database.prepare("SELECT id FROM members WHERE email_verified_at IS NOT NULL AND disabled=0 AND disabled_at IS NULL ORDER BY id ASC")
    .all<{ id: string }>();
  const summary: AffiliateEnrollmentBackfillSummary = {
    eligibleMembers: members.results.length,
    enrolled: 0,
    profilesCreated: 0,
    linksEnsured: 0,
    suspendedPreserved: 0,
  };

  for (const member of members.results) {
    const result = await ensureAffiliateEnrollment({ database: input.database, memberId: member.id, now: input.now, origin: input.origin });
    if (result.enrolled) {
      summary.enrolled += 1;
      summary.linksEnsured += 1;
      if (result.profileCreated) summary.profilesCreated += 1;
    } else if (result.reason === "profile_suspended") {
      summary.suspendedPreserved += 1;
    }
  }

  return summary;
}
