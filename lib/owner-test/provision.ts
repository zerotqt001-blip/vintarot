import type { D1Database } from "@cloudflare/workers-types";
import { createAuditService } from "../audit/service";
import type { AuditEvent } from "../audit/types";
import { createAffiliateProfile } from "../affiliate/service";
import { createCreditStore, type CreditGrant } from "../credits/repository";
import { activateEntitlement, type Entitlement } from "../entitlements";
import { createMemberAuthStore, hashPassword, normalizeEmail, normalizePhone, normalizeUsername, validatePassword } from "../member-auth";
import type { CreditOwner } from "../credits/types";

export const OWNER_TEST_CREDIT_UNITS = 100;
export const OWNER_TEST_SOURCE_TYPE = "OWNER_TEST_GRANT";
export const OWNER_TEST_CREDIT_GRANT_KEY = "owner-test:credits:v1";
export const OWNER_TEST_VIP_GRANT_KEY = "owner-test:vip:v1";
export const OWNER_TEST_POLICY_VERSION = "owner-test-v1";
const OWNER_TEST_ACTOR_ID = "owner-test-provisioner";
const OWNER_TEST_REASON = "OWNER_TEST_GRANT: internal QA account; no payment or purchase";

export type OwnerTestProvisionInput = {
  database: D1Database;
  username: string;
  email: string;
  phone: string;
  password: string;
  displayName?: string;
  now?: number;
};

export type OwnerTestProvisionResult = {
  memberId: string;
  role: "ADMIN";
  creditGrant: CreditGrant;
  entitlement: Entitlement;
  affiliateProfileId: string;
  auditEvent: AuditEvent;
};

type IdentityRow = {
  id: string;
  username: string;
  email: string;
  phone: string;
  password_hash: string | null;
  email_verified_at: number | null;
  role: string;
  disabled: number;
};

async function findIdentityRows(database: D1Database, username: string, email: string, phone: string): Promise<IdentityRow[]> {
  const rows = await Promise.all([
    database.prepare("SELECT id, username, email, phone, password_hash, email_verified_at, role, disabled FROM members WHERE username=?").bind(username).first<IdentityRow>(),
    database.prepare("SELECT id, username, email, phone, password_hash, email_verified_at, role, disabled FROM members WHERE email=?").bind(email).first<IdentityRow>(),
    database.prepare("SELECT id, username, email, phone, password_hash, email_verified_at, role, disabled FROM members WHERE phone=?").bind(phone).first<IdentityRow>(),
  ]);
  return rows.filter((row): row is IdentityRow => Boolean(row));
}

async function resolveMember(input: OwnerTestProvisionInput, timestamp: number): Promise<string> {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const password = validatePassword(input.password);
  const existingRows = await findIdentityRows(input.database, username, email, phone);
  const memberIds = new Set(existingRows.map((row) => row.id));
  if (memberIds.size > 1) throw new Error("Owner test identity conflict: identifiers belong to different members");
  const existing = existingRows[0] ?? null;
  if (existing && (existing.username !== username || existing.email !== email || existing.phone !== phone)) {
    throw new Error("Owner test identity conflict: existing member does not match the requested identity");
  }

  const passwordHash = await hashPassword(password);
  let memberId = existing?.id;
  if (!memberId) {
    const member = await createMemberAuthStore(input.database, () => timestamp).createMember({
      username,
      email,
      phone,
      passwordHash,
      emailVerifiedAt: timestamp,
      displayName: input.displayName ?? null,
    });
    memberId = member.id;
  } else {
    const displayNameSql = input.displayName === undefined ? "display_name" : "?";
    const values = input.displayName === undefined
      ? [passwordHash, timestamp, timestamp, memberId]
      : [passwordHash, timestamp, input.displayName, timestamp, memberId];
    const statement = input.displayName === undefined
      ? "UPDATE members SET password_hash=?, email_verified_at=COALESCE(email_verified_at, ?), role='ADMIN', disabled=0, updated_at=? WHERE id=?"
      : `UPDATE members SET password_hash=?, email_verified_at=COALESCE(email_verified_at, ?), display_name=${displayNameSql}, role='ADMIN', disabled=0, updated_at=? WHERE id=?`;
    await input.database.prepare(statement).bind(...values).run();
  }

  await input.database.prepare("UPDATE members SET role='ADMIN', disabled=0, updated_at=? WHERE id=?").bind(timestamp, memberId).run();
  return memberId;
}

async function ensureAffiliateProfile(database: D1Database, memberId: string, timestamp: number): Promise<string> {
  const existing = await database.prepare("SELECT id FROM affiliate_profiles WHERE member_id=? LIMIT 1").bind(memberId).first<{ id: string }>();
  if (existing) return existing.id;
  const profileId = `affiliate-profile:owner-test:${memberId}`;
  try {
    return (await createAffiliateProfile({ database, memberOwnerId: `member:${memberId}`, profileId, now: timestamp })).id;
  } catch (error) {
    const concurrent = await database.prepare("SELECT id FROM affiliate_profiles WHERE member_id=? LIMIT 1").bind(memberId).first<{ id: string }>();
    if (concurrent) return concurrent.id;
    throw error;
  }
}

export async function provisionOwnerTestAccount(input: OwnerTestProvisionInput): Promise<OwnerTestProvisionResult> {
  const timestamp = input.now ?? Date.now();
  const memberId = await resolveMember(input, timestamp);
  const owner: CreditOwner = { kind: "member", ownerId: `member:${memberId}` };
  const creditGrant = await createCreditStore(input.database, () => timestamp).grantCredits({
    owner,
    source: "ADMIN",
    units: OWNER_TEST_CREDIT_UNITS,
    grantKey: OWNER_TEST_CREDIT_GRANT_KEY,
    eligibleFrom: 0,
    expiresAt: null,
    sourceType: OWNER_TEST_SOURCE_TYPE,
    sourceId: memberId,
    policyVersion: OWNER_TEST_POLICY_VERSION,
    policySnapshot: { internalTestOnly: true, paid: false, purpose: "owner_qa", units: OWNER_TEST_CREDIT_UNITS },
    reason: OWNER_TEST_REASON,
  });
  const entitlement = await activateEntitlement(input.database, {
    owner,
    entitlementType: "VIP",
    benefitVersion: "vip-owner-test-v1",
    startsAt: 0,
    endsAt: null,
    sourceType: OWNER_TEST_SOURCE_TYPE,
    sourceId: memberId,
    grantKey: OWNER_TEST_VIP_GRANT_KEY,
    benefitSnapshot: { internalTestOnly: true, paid: false, purpose: "owner_qa" },
    now: timestamp,
  });
  const affiliateProfileId = await ensureAffiliateProfile(input.database, memberId, timestamp);
  const auditEvent = await createAuditService(input.database, () => timestamp).append({
    actorKind: "system",
    actorId: OWNER_TEST_ACTOR_ID,
    action: "owner_test.provisioned",
    targetType: "member",
    targetId: memberId,
    reason: OWNER_TEST_REASON,
    idempotencyKey: `owner-test:provision:${memberId}:v1`,
    metadata: {
      role: "ADMIN",
      creditGrantKey: OWNER_TEST_CREDIT_GRANT_KEY,
      creditUnits: OWNER_TEST_CREDIT_UNITS,
      entitlementGrantKey: OWNER_TEST_VIP_GRANT_KEY,
      affiliateProfileId,
      sourceType: OWNER_TEST_SOURCE_TYPE,
      payment: "not_purchased",
    },
  });
  return { memberId, role: "ADMIN", creditGrant, entitlement, affiliateProfileId, auditEvent };
}
