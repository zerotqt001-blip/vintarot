import { DatabaseSync } from "node:sqlite";

const productionDatabasePath = "/var/lib/natarot/natarot.sqlite";
const databasePath = process.env.NATAROT_DB_PATH?.trim() ?? "";

if (process.env.NATAROT_PRODUCTION_CATALOG_SEED !== "1") {
  throw new Error("Refusing production catalog seed without NATAROT_PRODUCTION_CATALOG_SEED=1");
}
if (process.env.NODE_ENV !== "production") {
  throw new Error("Refusing production catalog seed unless NODE_ENV=production");
}
if (databasePath !== productionDatabasePath || /natarot-staging/i.test(databasePath)) {
  throw new Error("Refusing production catalog seed outside /var/lib/natarot/natarot.sqlite");
}
if ((process.env.SEPAY_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox") {
  throw new Error("Refusing production catalog seed with SEPAY_ENVIRONMENT=Sandbox");
}

const packageId = "package-tarot-credit-v1";
const versionId = "package-tarot-credit-v1-version-1";
const slug = "tarot-credit-v1";
const productName = "1 Tarot Credit";
const amountMinor = 15_000;
const currency = "VND";
const creditUnits = 1;
const policyVersion = "packages-v1";
const benefitSnapshot = "{}";
const now = Date.now();

const sqlite = new DatabaseSync(databasePath);
try {
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare("INSERT OR IGNORE INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
      .run(packageId, slug, productName, productName, now, now);

    const packageRow = sqlite.prepare("SELECT id, slug, name_en, name_vi, active FROM packages WHERE id = ?").get(packageId);
    if (!packageRow || packageRow.slug !== slug || packageRow.name_en !== productName || packageRow.name_vi !== productName || Number(packageRow.active) !== 1) {
      throw new Error("Production package identity conflicts with the existing catalog");
    }

    sqlite.prepare("INSERT OR IGNORE INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?, 'active', 0, NULL, ?)")
      .run(versionId, packageId, amountMinor, currency, creditUnits, benefitSnapshot, policyVersion, now);

    const versionRow = sqlite.prepare("SELECT package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at FROM package_versions WHERE id = ?").get(versionId);
    if (!versionRow
      || versionRow.package_id !== packageId
      || Number(versionRow.version) !== 1
      || Number(versionRow.amount_minor) !== amountMinor
      || versionRow.currency !== currency
      || Number(versionRow.credit_units) !== creditUnits
      || versionRow.vip_duration_seconds !== null
      || versionRow.benefit_snapshot !== benefitSnapshot
      || versionRow.policy_version !== policyVersion
      || versionRow.status !== "active"
      || Number(versionRow.starts_at) !== 0
      || versionRow.ends_at !== null) {
      throw new Error("Production package version conflicts with the existing catalog");
    }

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  const activeCount = sqlite.prepare("SELECT COUNT(*) AS count FROM package_versions pv JOIN packages p ON p.id = pv.package_id WHERE p.active = 1 AND pv.status = 'active' AND pv.starts_at <= ? AND (pv.ends_at IS NULL OR pv.ends_at > ?)").get(now, now);
  console.log(`Verified production package ${slug}: ${productName}, ${amountMinor} ${currency}, ${creditUnits} Credit; active_versions=${Number(activeCount.count)}`);
} finally {
  sqlite.close();
}
