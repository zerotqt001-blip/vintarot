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

const validityDays = 30;
const validitySeconds = validityDays * 24 * 60 * 60;
const currency = "VND";
const policyVersion = "commercial-catalog-v1";
const approvedPackages = [
  { packageId: "package-tarot-credit-1", versionId: "package-tarot-credit-1-v1", slug: "tarot-credit-1", nameEn: "1 Credit", nameVi: "1 Credit", amountMinor: 15_000, creditUnits: 1, popular: false },
  { packageId: "package-tarot-credit-5", versionId: "package-tarot-credit-5-v1", slug: "tarot-credit-5", nameEn: "5 Credits", nameVi: "5 Credits", amountMinor: 69_000, creditUnits: 5, popular: false },
  { packageId: "package-tarot-credit-10", versionId: "package-tarot-credit-10-v1", slug: "tarot-credit-10", nameEn: "10 Credits", nameVi: "10 Credits", amountMinor: 129_000, creditUnits: 10, popular: true },
  { packageId: "package-tarot-credit-20", versionId: "package-tarot-credit-20-v1", slug: "tarot-credit-20", nameEn: "20 Credits", nameVi: "20 Credits", amountMinor: 229_000, creditUnits: 20, popular: false },
];
const legacyPackageIds = ["package-tarot-credit-v1"];
const now = Date.now();

function benefitSnapshotFor(item) {
  return JSON.stringify({
    credits: {
      units: item.creditUnits,
      expiresInSeconds: validitySeconds,
      validityDays: validityDays,
    },
    catalog: { popular: item.popular },
  });
}

function sameIds(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

const sqlite = new DatabaseSync(databasePath);
try {
  sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const unexpectedActive = sqlite.prepare("SELECT id FROM packages WHERE active = 1").all()
      .map((row) => row.id)
      .filter((id) => !approvedPackages.some((item) => item.packageId === id) && !legacyPackageIds.includes(id));
    if (unexpectedActive.length > 0) {
      throw new Error(`Production catalog has unexpected active packages: ${unexpectedActive.join(",")}`);
    }

    const insertPackage = sqlite.prepare("INSERT OR IGNORE INTO packages (id, slug, name_en, name_vi, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)");
    const activatePackage = sqlite.prepare("UPDATE packages SET active = 1, updated_at = ? WHERE id = ?");
    const insertVersion = sqlite.prepare("INSERT OR IGNORE INTO package_versions (id, package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at, created_at) VALUES (?, ?, 1, ?, ?, ?, NULL, ?, ?, 'active', 0, NULL, ?)");
    for (const item of approvedPackages) {
      const benefitSnapshot = benefitSnapshotFor(item);
      insertPackage.run(item.packageId, item.slug, item.nameEn, item.nameVi, now, now);
      const packageRow = sqlite.prepare("SELECT id, slug, name_en, name_vi FROM packages WHERE id = ?").get(item.packageId);
      if (!packageRow || packageRow.slug !== item.slug || packageRow.name_en !== item.nameEn || packageRow.name_vi !== item.nameVi) {
        throw new Error(`Production package identity conflicts with ${item.packageId}`);
      }
      activatePackage.run(now, item.packageId);
      insertVersion.run(item.versionId, item.packageId, item.amountMinor, currency, item.creditUnits, benefitSnapshot, policyVersion, now);
      const versionRow = sqlite.prepare("SELECT package_id, version, amount_minor, currency, credit_units, vip_duration_seconds, benefit_snapshot, policy_version, status, starts_at, ends_at FROM package_versions WHERE id = ?").get(item.versionId);
      if (!versionRow
        || versionRow.package_id !== item.packageId
        || Number(versionRow.version) !== 1
        || Number(versionRow.amount_minor) !== item.amountMinor
        || versionRow.currency !== currency
        || Number(versionRow.credit_units) !== item.creditUnits
        || versionRow.vip_duration_seconds !== null
        || versionRow.benefit_snapshot !== benefitSnapshot
        || versionRow.policy_version !== policyVersion
        || versionRow.status !== "active"
        || Number(versionRow.starts_at) !== 0
        || versionRow.ends_at !== null) {
        throw new Error(`Production package version conflicts with ${item.versionId}`);
      }
    }

    if (legacyPackageIds.length > 0) {
      sqlite.prepare(`UPDATE packages SET active = 0, updated_at = ? WHERE id IN (${legacyPackageIds.map(() => "?").join(",")})`).run(now, ...legacyPackageIds);
    }

    const activePackageRows = sqlite.prepare("SELECT id FROM packages WHERE active = 1").all();
    const activeVersionRows = sqlite.prepare("SELECT pv.id FROM package_versions pv JOIN packages p ON p.id = pv.package_id WHERE p.active = 1 AND pv.status = 'active' AND pv.starts_at <= ? AND (pv.ends_at IS NULL OR pv.ends_at > ?)").all(now, now);
    const activePackageIds = activePackageRows.map((row) => row.id);
    const activeVersionIds = activeVersionRows.map((row) => row.id);
    const activePackageCount = activePackageIds.length;
    const activeVersionCount = activeVersionIds.length;
    if (activePackageCount !== 4 || activeVersionCount !== 4
      || !sameIds(activePackageIds, approvedPackages.map((item) => item.packageId))
      || !sameIds(activeVersionIds, approvedPackages.map((item) => item.versionId))) {
      throw new Error(`Production catalog must contain exactly the approved four packages and versions; active_packages=${activePackageCount}, active_versions=${activeVersionCount}`);
    }

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  console.log(`Verified production catalog: ${approvedPackages.map((item) => `${item.creditUnits} Credit${item.creditUnits === 1 ? "" : "s"}=${item.amountMinor} ${currency}`).join(", ")}; validity=${validityDays} days; active_packages=4 active_versions=4`);
} finally {
  sqlite.close();
}
