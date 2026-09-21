import type { D1Database } from "@cloudflare/workers-types";
import type { PackageBenefitSnapshot, PackageVersion } from "./types";

type PackageVersionRow = Omit<PackageVersion, "benefitSnapshot" | "status"> & {
  benefitSnapshot: string;
  status: PackageVersion["status"];
};

async function rows<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T[]> {
  const result = await database.prepare(statement).bind(...values).all<T>();
  return result.results;
}

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

export function parsePackageBenefitSnapshot(value: string): PackageBenefitSnapshot {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as PackageBenefitSnapshot;
  } catch {
    // Invalid snapshots are rejected by the caller that requires a benefit.
  }
  return {};
}

function mapPackageVersion(row: PackageVersionRow): PackageVersion {
  return {
    ...row,
    version: Number(row.version),
    amountMinor: Number(row.amountMinor),
    creditUnits: Number(row.creditUnits),
    vipDurationSeconds: row.vipDurationSeconds === null ? null : Number(row.vipDurationSeconds),
    startsAt: Number(row.startsAt),
    endsAt: row.endsAt === null ? null : Number(row.endsAt),
    createdAt: Number(row.createdAt),
    benefitSnapshot: parsePackageBenefitSnapshot(row.benefitSnapshot),
  };
}

const packageVersionSelect = `SELECT pv.id, pv.package_id AS packageId, p.slug, p.name_en AS nameEn, p.name_vi AS nameVi,
  pv.version, pv.amount_minor AS amountMinor, pv.currency, pv.credit_units AS creditUnits,
  pv.vip_duration_seconds AS vipDurationSeconds, pv.benefit_snapshot AS benefitSnapshot,
  pv.policy_version AS policyVersion, pv.status, pv.starts_at AS startsAt, pv.ends_at AS endsAt, pv.created_at AS createdAt
  FROM package_versions pv JOIN packages p ON p.id = pv.package_id`;

export async function listActivePackageVersions(database: D1Database, now = Date.now()): Promise<PackageVersion[]> {
  const packageRows = await rows<PackageVersionRow>(database, `${packageVersionSelect}
    WHERE p.active = 1 AND pv.status = 'active' AND pv.starts_at <= ? AND (pv.ends_at IS NULL OR pv.ends_at > ?)
    ORDER BY p.slug, pv.version DESC`, now, now);
  return packageRows.map(mapPackageVersion);
}

export async function getActivePackageVersion(database: D1Database, packageVersionId: string, now = Date.now()): Promise<PackageVersion | null> {
  const row = await first<PackageVersionRow>(database, `${packageVersionSelect}
    WHERE pv.id = ? AND p.active = 1 AND pv.status = 'active' AND pv.starts_at <= ? AND (pv.ends_at IS NULL OR pv.ends_at > ?)`, packageVersionId, now, now);
  return row ? mapPackageVersion(row) : null;
}
