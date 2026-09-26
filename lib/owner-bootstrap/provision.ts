import { prepareAuditInsert } from "../audit/service";
import { normalizeEmail } from "../member-auth";
import type { TransactionalD1Database } from "../sqlite-d1";

export const FIRST_OWNER_BOOTSTRAP_AUDIT_KEY = "natarot:first-owner:bootstrap:v1";

export type FirstOwnerProvisionInput = {
  memberId: string;
  email: string;
  identityVerificationRef: string;
  ownerAuthorizationRef: string;
  operatorRef: string;
  backupId: string;
  backupSha256: string;
  restoreVerificationRef: string;
};

export type FirstOwnerProvisionResult = {
  memberId: string;
  revokedSessions: number;
  auditEventId: string;
};

type OwnerCandidate = {
  id: string;
  email: string;
  role: string;
  password_hash: string | null;
  email_verified_at: number | null;
  disabled: number;
  disabled_at: number | null;
};

function requiredReference(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid first-owner provisioning input.");
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{5,159}$/.test(normalized)) {
    throw new Error("Invalid first-owner provisioning input.");
  }
  return normalized;
}

function normalizeOwnerEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid first-owner provisioning input.");
  try {
    return normalizeEmail(value);
  } catch {
    throw new Error("Invalid first-owner provisioning input.");
  }
}

function validatedInput(input: FirstOwnerProvisionInput) {
  const memberId = requiredReference(input?.memberId);
  const email = normalizeOwnerEmail(input?.email);
  const identityVerificationRef = requiredReference(input?.identityVerificationRef);
  const ownerAuthorizationRef = requiredReference(input?.ownerAuthorizationRef);
  const operatorRef = requiredReference(input?.operatorRef);
  const backupId = requiredReference(input?.backupId);
  const restoreVerificationRef = requiredReference(input?.restoreVerificationRef);
  if (typeof input?.backupSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(input.backupSha256.trim())) {
    throw new Error("Invalid first-owner provisioning input.");
  }
  return {
    memberId,
    email,
    identityVerificationRef,
    ownerAuthorizationRef,
    operatorRef,
    backupId,
    backupSha256: input.backupSha256.trim().toLowerCase(),
    restoreVerificationRef,
  };
}

export async function provisionFirstOwner(
  database: TransactionalD1Database,
  input: FirstOwnerProvisionInput,
  now: () => number = () => Date.now(),
): Promise<FirstOwnerProvisionResult> {
  if (!database || typeof database.transaction !== "function") {
    throw new Error("First-owner provisioning is unavailable.");
  }
  const owner = validatedInput(input);
  const timestamp = now();
  const auditEventId = globalThis.crypto.randomUUID();

  return database.transaction(async () => {
    const bootstrap = await database.prepare("SELECT id FROM audit_events WHERE idempotency_key=? LIMIT 1")
      .bind(FIRST_OWNER_BOOTSTRAP_AUDIT_KEY)
      .first<{ id: string }>();
    if (bootstrap) throw new Error("First-owner provisioning has already been used.");

    const existingSuperAdmin = await database.prepare("SELECT id FROM members WHERE role='SUPER_ADMIN' LIMIT 1")
      .first<{ id: string }>();
    if (existingSuperAdmin) throw new Error("A SUPER_ADMIN already exists.");

    const candidate = await database.prepare(`SELECT id, email, role, password_hash, email_verified_at, disabled, disabled_at
      FROM members WHERE id=? LIMIT 1`).bind(owner.memberId).first<OwnerCandidate>();
    if (!candidate
      || candidate.email !== owner.email
      || candidate.role !== "USER"
      || candidate.disabled !== 0
      || candidate.disabled_at !== null
      || candidate.email_verified_at === null
      || !candidate.password_hash) {
      throw new Error("The new verified Owner account is not eligible.");
    }

    const verification = await database.prepare(`SELECT 1 AS verified FROM auth_tokens
      WHERE member_id=? AND kind='email-verification' AND consumed_at IS NOT NULL LIMIT 1`)
      .bind(candidate.id)
      .first<{ verified: number }>();
    if (!verification) throw new Error("The new verified Owner account is not eligible.");

    const qaProvision = await database.prepare(`SELECT id FROM audit_events
      WHERE target_type='member' AND target_id=? AND action='owner_test.provisioned' LIMIT 1`)
      .bind(candidate.id)
      .first<{ id: string }>();
    if (qaProvision) throw new Error("The new verified Owner account is not eligible.");

    const update = await database.prepare(`UPDATE members SET role='SUPER_ADMIN', updated_at=?
      WHERE id=? AND email=? AND role='USER' AND disabled=0 AND disabled_at IS NULL
        AND email_verified_at IS NOT NULL AND password_hash IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth_tokens
          WHERE member_id=? AND kind='email-verification' AND consumed_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM audit_events
          WHERE target_type='member' AND target_id=? AND action='owner_test.provisioned')
        AND NOT EXISTS (SELECT 1 FROM members WHERE role='SUPER_ADMIN')
        AND NOT EXISTS (SELECT 1 FROM audit_events WHERE idempotency_key=?)`)
      .bind(timestamp, candidate.id, owner.email, candidate.id, candidate.id, FIRST_OWNER_BOOTSTRAP_AUDIT_KEY)
      .run();
    if (Number(update.meta.changes) !== 1) throw new Error("The new verified Owner account is not eligible.");

    const revoked = await database.prepare("UPDATE auth_sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL")
      .bind(timestamp, candidate.id)
      .run();

    await prepareAuditInsert(database, {
      id: auditEventId,
      actorKind: "system",
      actorId: "first-owner-provisioner",
      action: "member.first_owner.provisioned",
      targetType: "member",
      targetId: candidate.id,
      reason: "First Owner provisioning after independent identity verification and explicit Owner authorization.",
      idempotencyKey: FIRST_OWNER_BOOTSTRAP_AUDIT_KEY,
      outcome: "SUCCESS",
      metadata: {
        identityVerificationRef: owner.identityVerificationRef,
        ownerApprovalRecord: owner.ownerAuthorizationRef,
        operatorRef: owner.operatorRef,
        backupId: owner.backupId,
        archiveChecksum: owner.backupSha256,
        restoreVerificationRef: owner.restoreVerificationRef,
        verificationMethod: "consumed_app_token",
      },
    }, timestamp, { ignoreExisting: false }).run();

    return {
      memberId: candidate.id,
      revokedSessions: Number(revoked.meta.changes),
      auditEventId,
    };
  });
}
