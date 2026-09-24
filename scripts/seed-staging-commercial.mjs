import { pbkdf2Sync, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.NATAROT_DB_PATH?.trim() ?? "";
if (process.env.NATAROT_STAGING_SEED !== "1") throw new Error("Refusing commercial seed without NATAROT_STAGING_SEED=1");
if (!/(^|\/)natarot-staging\/natarot\.sqlite$/.test(databasePath)) throw new Error("Refusing commercial seed outside the isolated staging database");
if ((process.env.SEPAY_ENVIRONMENT ?? "").trim().toLowerCase() !== "sandbox") throw new Error("Refusing commercial seed unless SEPAY_ENVIRONMENT=sandbox");

const packageId = "package-staging-sepay-sandbox-v1";
const versionId = "package-staging-sepay-sandbox-v1-version-1";
const slug = "staging-sepay-sandbox-v1";
const amountMinor = 10_000;
const creditUnits = 10;
const vipDurationSeconds = 86_400;
const policyVersion = "staging-sepay-v1";
const stagingMemberPassword = process.env.NATAROT_STAGING_MEMBER_PASSWORD?.trim() ?? "";
const benefitSnapshot = JSON.stringify({
  credits: { units: creditUnits },
  vip: { durationSeconds: vipDurationSeconds, benefitVersion: "vip-v1", benefits: { stagingSandbox: true } },
});
const now = Date.now();
const sqlite = new DatabaseSync(databasePath);
try {
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.prepare("INSERT OR IGNORE INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
    .run(packageId, slug, "NaTarot Sandbox Starter", "NaTarot Sandbox Starter", now, now);
  const packageRow = sqlite.prepare("SELECT slug, active FROM packages WHERE id = ?").get(packageId);
  if (!packageRow || packageRow.slug !== slug || Number(packageRow.active) !== 1) throw new Error("Staging package identity conflicts with the existing catalog");
  sqlite.prepare("INSERT OR IGNORE INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, ?, 'VND', ?, ?, ?, ?, 'active', ?, NULL, ?)")
    .run(versionId, packageId, amountMinor, creditUnits, vipDurationSeconds, benefitSnapshot, policyVersion, now, now);
  const versionRow = sqlite.prepare("SELECT amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status FROM package_versions WHERE id = ?").get(versionId);
  if (!versionRow || Number(versionRow.amount_minor) !== amountMinor || versionRow.currency !== "VND" || Number(versionRow.credit_units) !== creditUnits || Number(versionRow.vip_duration_seconds) !== vipDurationSeconds || versionRow.benefit_snapshot !== benefitSnapshot || versionRow.policy_version !== policyVersion || versionRow.status !== "active") {
    throw new Error("Staging package version conflicts with the existing catalog");
  }
  console.log(`Verified staging sandbox package ${slug}`);
  if (stagingMemberPassword) {
    if (stagingMemberPassword.length < 8 || stagingMemberPassword.length > 128) throw new Error("NATAROT_STAGING_MEMBER_PASSWORD must be 8-128 characters");
    const salt = randomBytes(16);
    const derived = pbkdf2Sync(stagingMemberPassword, salt, 600_000, 32, "sha256");
    const encode = (value) => value.toString("base64url");
    const passwordHash = `pbkdf2-sha256$v1$600000$${encode(salt)}$${encode(derived)}`;
    const memberId = "member-staging-sepay-sandbox-v1";
    sqlite.prepare("INSERT INTO members (id, username, email, phone, display_name, password_hash, google_subject, email_verified_at, created_at, updated_at, last_login_at, disabled) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 0) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash, email_verified_at=excluded.email_verified_at, updated_at=excluded.updated_at, disabled=0")
      .run(memberId, "sepay_staging", "sepay-staging-sandbox@example.test", "+849999999999", "SePay Staging", passwordHash, now, now, now);
    const memberRow = sqlite.prepare("SELECT id, username, email, email_verified_at, disabled FROM members WHERE id = ?").get(memberId);
    if (!memberRow || memberRow.username !== "sepay_staging" || memberRow.email !== "sepay-staging-sandbox@example.test" || memberRow.email_verified_at === null || Number(memberRow.disabled) !== 0) throw new Error("Staging member identity conflicts with the existing account");
    console.log("Verified staging sandbox member sepay_staging");
  }
} finally {
  sqlite.close();
}
