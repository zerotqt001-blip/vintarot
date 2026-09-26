import { createHash, randomUUID } from "node:crypto";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { loadBusinessReport } from "./read-model";
import {
  BUSINESS_REPORT_SHEETS,
  BusinessReportingGoogleError,
  ensureBusinessSpreadsheet,
  reportSheetColumnLabel,
  writeBusinessReportValues,
  type ReportingOwner,
  type ReportingRequest,
} from "./google-sheets";
import { BUSINESS_REPORTING_TIME_ZONE, type BusinessReport } from "./types";
import type { DriveRuntimeConfig } from "../google-drive";

const ROW_BATCH_COUNT = 250;
const RECONCILE_ROW_CHUNK = 500;
const LEASE_DURATION_MS = 20 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 15 * 60 * 1000;
const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;
const DATABASE_BATCH_STATEMENTS = 100;

type OwnerResolution =
  | { owner: ReportingOwner; blockedReason: null }
  | { owner: null; blockedReason: "no_connected_owner" | "multiple_connected_owners" };

type SyncOptions = {
  now?: number;
  forceReconcile?: boolean;
  config: DriveRuntimeConfig;
  request?: ReportingRequest;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

type SyncResult = {
  status: "success" | "blocked" | "skipped" | "failed";
  reason?: string;
  reconciled?: boolean;
  rowsWritten?: number;
};

type ReportRow = { key: string; cells: Array<string | number | boolean> };
type RowState = { rowKey: string; rowNumber: number; rowHash: string; updatedAt: number };
type SheetPlan = {
  sheetName: string;
  columnCount: number;
  rows: ReportRow[];
  previous: RowState[];
  placements: RowState[];
  writes: Array<{ rowNumber: number; cells: Array<string | number | boolean> }>;
  clears: number[];
};

export async function resolveReportingOwner(database: D1Database): Promise<OwnerResolution> {
  const owners = await database.prepare("SELECT m.id AS memberId, c.google_subject AS googleSubject, c.google_email AS googleEmail FROM members m JOIN google_drive_connections c ON c.member_id=m.id WHERE m.role='SUPER_ADMIN' AND m.disabled=0 AND m.disabled_at IS NULL AND m.email_verified_at IS NOT NULL ORDER BY m.id").all<ReportingOwner>();
  if (!owners.results.length) return { owner: null, blockedReason: "no_connected_owner" };
  if (owners.results.length !== 1) return { owner: null, blockedReason: "multiple_connected_owners" };
  const owner = owners.results[0];
  if (!owner?.memberId || !owner.googleSubject || !owner.googleEmail) return { owner: null, blockedReason: "no_connected_owner" };
  return { owner, blockedReason: null };
}

function isoAt(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function dashboardRows(report: BusinessReport, now: number): ReportRow[] {
  const metrics: Array<[string, number, string]> = [
    ["Total registered users", report.dashboard.totalRegisteredUsers, ""],
    ["New users today", report.dashboard.newUsersToday, ""],
    ["New users last 7 days", report.dashboard.newUsersLast7Days, ""],
    ["New users last 30 days", report.dashboard.newUsersLast30Days, ""],
    ["Active users", report.dashboard.activeUsers, ""],
    ["New paying customers", report.dashboard.newPayingCustomers, ""],
    ["Verified revenue", report.dashboard.verifiedRevenueMinor, "VND"],
    ["Successful orders", report.dashboard.successfulOrders, ""],
    ["Credits sold", report.dashboard.creditsSold, ""],
    ["Credits consumed", report.dashboard.creditsConsumed, ""],
    ["Affiliate commissions", report.dashboard.affiliateCommissionsMinor, "VND"],
    ["Pending commissions", report.dashboard.pendingCommissionsMinor, "VND"],
  ];
  return metrics.map(([metric, value, currency]) => ({
    key: "metric:" + metric,
    cells: [metric, value, currency, BUSINESS_REPORTING_TIME_ZONE, isoAt(now)],
  }));
}

function reportRows(report: BusinessReport, now: number): Map<string, ReportRow[]> {
  const output = new Map<string, ReportRow[]>();
  const syncErrors = report.system.synchronizationErrors || "none";
  output.set("Dashboard", dashboardRows(report, now));
  output.set("Customers", report.customers.map((row) => ({
    key: row.customerId,
    cells: [row.customerId, row.registrationDate, row.accountStatus, row.lastRecordedActivity ?? "", row.totalVerifiedPurchases, row.totalVerifiedSpendingMinor, row.affiliateParticipationStatus],
  })));
  output.set("Revenue", report.revenue.map((row) => ({
    key: row.date,
    cells: [row.date, row.verifiedRevenueMinor, row.successfulOrders, row.refundsMinor, row.netRevenueMinor, row.newPayingCustomers],
  })));
  output.set("Affiliate", report.affiliate.map((row) => ({
    key: row.affiliateId + ":" + row.currency,
    cells: [row.affiliateId, row.referralCount, row.verifiedConversions, row.commissionTier, row.currency, row.eligibleCommissionMinor, row.pendingCommissionMinor, row.reversedCommissionMinor],
  })));
  output.set("Referrals", report.referrals.map((row) => ({
    key: row.referrerId + ":" + row.referredCustomerId + ":" + row.attributionTimestamp,
    cells: [row.referrerId, row.referredCustomerId, row.attributionTimestamp, row.attributionStatus, row.verifiedConversionStatus],
  })));
  output.set("Activity", report.activity.map((row) => ({
    key: row.date,
    cells: [row.date, row.registeredUsers, row.activeUsers ?? "", row.newUsers, row.tarotReadings, row.returningUsers],
  })));
  output.set("Credits", report.credits.map((row) => ({
    key: row.date,
    cells: [row.date, row.creditsSold, row.creditsConsumed, row.creditsExpired, row.creditsRefunded],
  })));
  output.set("System", [
    { key: "metric:last-successful-synchronization", cells: ["Last successful synchronization", isoAt(now), "success", isoAt(now)] },
    { key: "metric:last-backup", cells: ["Last backup", report.system.lastBackup ?? "", report.system.backupVerificationStatus, isoAt(now)] },
    { key: "metric:backup-verification", cells: ["Backup verification status", report.system.backupVerificationStatus, report.system.backupVerificationStatus, isoAt(now)] },
    { key: "metric:synchronization-errors", cells: ["Synchronization errors", syncErrors, syncErrors === "none" ? "success" : "warning", isoAt(now)] },
    { key: "metric:reporting-version", cells: ["Reporting version", report.system.reportingVersion, "current", isoAt(now)] },
  ]);
  return output;
}

function rowHash(cells: Array<string | number | boolean>): string {
  return createHash("sha256").update(JSON.stringify(cells)).digest("hex");
}

function maxRowNumber(rows: RowState[]): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.rowNumber), 1);
}

async function loadRowState(database: D1Database, sheetName: string): Promise<RowState[]> {
  const result = await database.prepare("SELECT row_key AS rowKey, row_number AS rowNumber, row_hash AS rowHash, updated_at AS updatedAt FROM business_reporting_row_state WHERE sheet_name=? ORDER BY row_number")
    .bind(sheetName).all<RowState>();
  return result.results.map((row) => ({
    rowKey: row.rowKey,
    rowNumber: Number(row.rowNumber),
    rowHash: row.rowHash,
    updatedAt: Number(row.updatedAt),
  }));
}

function buildIncrementalPlan(sheetName: string, columnCount: number, rows: ReportRow[], previous: RowState[], now: number): SheetPlan {
  const previousByKey = new Map(previous.map((row) => [row.rowKey, row]));
  const desiredKeys = new Set(rows.map((row) => row.key));
  const removed = previous.filter((row) => !desiredKeys.has(row.rowKey));
  const freeRows = removed.map((row) => row.rowNumber).sort((a, b) => a - b);
  let nextRowNumber = maxRowNumber(previous) + 1;
  const placements: RowState[] = [];
  const writes: SheetPlan["writes"] = [];

  for (const row of [...rows].sort((a, b) => a.key.localeCompare(b.key))) {
    const existing = previousByKey.get(row.key);
    const rowNumber = existing?.rowNumber ?? freeRows.shift() ?? nextRowNumber++;
    const hash = rowHash(row.cells);
    placements.push({ rowKey: row.key, rowNumber, rowHash: hash, updatedAt: now });
    if (!existing || existing.rowHash !== hash) writes.push({ rowNumber, cells: row.cells });
  }

  return {
    sheetName,
    columnCount,
    rows,
    previous,
    placements,
    writes,
    clears: removed.map((row) => row.rowNumber).filter((rowNumber) => !placements.some((row) => row.rowNumber === rowNumber)),
  };
}

function buildReconciliationPlan(sheetName: string, columnCount: number, rows: ReportRow[], previous: RowState[], now: number): SheetPlan {
  const sorted = [...rows].sort((a, b) => a.key.localeCompare(b.key));
  const placements = sorted.map((row, index) => ({
    rowKey: row.key,
    rowNumber: index + 2,
    rowHash: rowHash(row.cells),
    updatedAt: now,
  }));
  const lastUsedRow = Math.max(maxRowNumber(previous), placements.at(-1)?.rowNumber ?? 1);
  const matrixLength = Math.max(0, lastUsedRow - 1);
  const cellsByRow = new Map(placements.map((placement, index) => [placement.rowNumber, sorted[index]!.cells]));
  const writes: SheetPlan["writes"] = [];
  for (let offset = 0; offset < matrixLength; offset += 1) {
    const rowNumber = offset + 2;
    writes.push({ rowNumber, cells: cellsByRow.get(rowNumber) ?? Array.from({ length: columnCount }, () => "") });
  }
  return { sheetName, columnCount, rows, previous, placements, writes, clears: [] };
}

function makeValueRanges(sheetName: string, writes: SheetPlan["writes"]): Array<{ range: string; values: Array<Array<string | number | boolean>> }> {
  const sorted = [...writes].sort((a, b) => a.rowNumber - b.rowNumber);
  const ranges: Array<{ range: string; values: Array<Array<string | number | boolean>> }> = [];
  for (let index = 0; index < sorted.length;) {
    const first = sorted[index]!;
    let endIndex = index;
    const contiguous: Array<Array<string | number | boolean>> = [first.cells];
    while (endIndex + 1 < sorted.length
      && sorted[endIndex + 1]!.rowNumber === sorted[endIndex]!.rowNumber + 1
      && contiguous.length < RECONCILE_ROW_CHUNK
      && JSON.stringify(contiguous).length < 400_000) {
      endIndex += 1;
      contiguous.push(sorted[endIndex]!.cells);
    }
    const last = sorted[endIndex]!;
    const lastColumn = reportSheetColumnLabel(Math.max(first.cells.length, last.cells.length));
    ranges.push({
      range: sheetName + "!A" + first.rowNumber + ":" + lastColumn + last.rowNumber,
      values: contiguous,
    });
    index = endIndex + 1;
  }
  return ranges;
}

function rowStateStatements(database: D1Database, plans: SheetPlan[], fullReconcile: boolean): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  if (fullReconcile) statements.push(database.prepare("DELETE FROM business_reporting_row_state"));
  for (const plan of plans) {
    const placementKeys = new Set(plan.placements.map((row) => row.rowKey));
    for (const old of plan.previous) {
      if (fullReconcile || !placementKeys.has(old.rowKey)) {
        statements.push(database.prepare("DELETE FROM business_reporting_row_state WHERE sheet_name=? AND row_key=?").bind(plan.sheetName, old.rowKey));
      }
    }
    for (const row of plan.placements) {
      statements.push(database.prepare("INSERT INTO business_reporting_row_state (sheet_name, row_key, row_number, row_hash, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sheet_name, row_key) DO UPDATE SET row_number=excluded.row_number, row_hash=excluded.row_hash, updated_at=excluded.updated_at")
        .bind(plan.sheetName, row.rowKey, row.rowNumber, row.rowHash, row.updatedAt));
    }
  }
  return statements;
}

async function applyRowState(database: D1Database, plans: SheetPlan[], fullReconcile: boolean): Promise<void> {
  const statements = rowStateStatements(database, plans, fullReconcile);
  for (let offset = 0; offset < statements.length; offset += DATABASE_BATCH_STATEMENTS) {
    await database.batch(statements.slice(offset, offset + DATABASE_BATCH_STATEMENTS));
  }
}

function safeErrorCode(error: unknown): string {
  if (error instanceof BusinessReportingGoogleError) return error.code;
  if (error instanceof Error && error.name === "GoogleDriveError") return "google_authorization";
  return "reporting_internal_error";
}

async function startAudit(database: D1Database, id: string, now: number): Promise<void> {
  await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES (?, 'sheets_sync', 'started', ?, NULL, 0, NULL)")
    .bind(id, now).run();
}

async function finishAudit(database: D1Database, id: string, now: number, outcome: "success" | "blocked" | "failure", rowsWritten: number, errorCode: string | null): Promise<void> {
  await database.prepare("UPDATE business_reporting_export_audit SET outcome=?, finished_at=?, rows_written=?, error_code=? WHERE id=?")
    .bind(outcome, now, rowsWritten, errorCode, id).run();
}

async function prepareLease(database: D1Database, leaseOwner: string, now: number): Promise<boolean> {
  const result = await database.prepare("UPDATE business_reporting_sync_state SET lease_owner=?, lease_expires_at=?, last_attempt_at=?, updated_at=? WHERE id='primary' AND (lease_expires_at IS NULL OR lease_expires_at<=?)")
    .bind(leaseOwner, now + LEASE_DURATION_MS, now, now, now).run();
  return Number(result.meta.changes) === 1;
}

async function releaseLease(database: D1Database, leaseOwner: string): Promise<void> {
  await database.prepare("UPDATE business_reporting_sync_state SET lease_owner=NULL, lease_expires_at=NULL WHERE id='primary' AND lease_owner=?")
    .bind(leaseOwner).run();
}

export async function syncBusinessReport(database: D1Database, options: SyncOptions): Promise<SyncResult> {
  const now = options.now ?? Date.now();
  const auditId = randomUUID();
  const ownerResolution = await resolveReportingOwner(database);
  await startAudit(database, auditId, now);

  if (!ownerResolution.owner) {
    await database.prepare("UPDATE business_reporting_sync_state SET last_attempt_at=?, last_error_code=?, updated_at=? WHERE id='primary'")
      .bind(now, ownerResolution.blockedReason, now).run();
    await finishAudit(database, auditId, now, "blocked", 0, ownerResolution.blockedReason);
    return { status: "blocked", reason: ownerResolution.blockedReason };
  }

  const retryState = await database.prepare("SELECT next_retry_at AS nextRetryAt, retry_attempt AS retryAttempt, last_error_code AS lastErrorCode FROM business_reporting_sync_state WHERE id='primary'")
    .first<{ nextRetryAt: number | null; retryAttempt: number; lastErrorCode: string | null }>();
  if (retryState?.lastErrorCode === "no_connected_owner" || retryState?.lastErrorCode === "multiple_connected_owners") {
    await database.prepare("UPDATE business_reporting_sync_state SET retry_attempt=0, next_retry_at=NULL, last_error_code=NULL WHERE id='primary'").run();
  } else if (retryState?.nextRetryAt != null && Number(retryState.nextRetryAt) > now) {
    await database.prepare("UPDATE business_reporting_sync_state SET last_attempt_at=?, updated_at=? WHERE id='primary'").bind(now, now).run();
    await finishAudit(database, auditId, now, "blocked", 0, "retry_backoff");
    return { status: "skipped", reason: "retry_backoff" };
  }

  const leaseOwner = randomUUID();
  if (!await prepareLease(database, leaseOwner, now)) {
    await finishAudit(database, auditId, now, "blocked", 0, "lease_held");
    return { status: "skipped", reason: "lease_held" };
  }

  let rowsWritten = 0;
  try {
    const currentOwner = await resolveReportingOwner(database);
    if (!currentOwner.owner || currentOwner.owner.memberId !== ownerResolution.owner.memberId) {
      const reason = currentOwner.blockedReason ?? "multiple_connected_owners";
      await finishAudit(database, auditId, now, "blocked", 0, reason);
      await database.prepare("UPDATE business_reporting_sync_state SET last_error_code=?, updated_at=? WHERE id='primary'").bind(reason, now).run();
      return { status: "blocked", reason };
    }

    const state = await database.prepare("SELECT spreadsheet_id AS spreadsheetId, last_reconciliation_date AS lastReconciliationDate FROM business_reporting_sync_state WHERE id='primary'")
      .first<{ spreadsheetId: string | null; lastReconciliationDate: string | null }>();
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_REPORTING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
    const fullReconcile = Boolean(options.forceReconcile || !state?.lastReconciliationDate || state.lastReconciliationDate !== localDate);
    const report = await loadBusinessReport(database, { now, timeZone: BUSINESS_REPORTING_TIME_ZONE });
    const workbook = await ensureBusinessSpreadsheet({
      database,
      owner: ownerResolution.owner,
      config: options.config,
      request: options.request,
      sleep: options.sleep,
      random: options.random,
    });
    const rowSets = reportRows(report, now);
    const plans: SheetPlan[] = [];
    for (const tab of BUSINESS_REPORT_SHEETS) {
      const rows = rowSets.get(tab.name) ?? [];
      const previous = await loadRowState(database, tab.name);
      plans.push(fullReconcile
        ? buildReconciliationPlan(tab.name, tab.headers.length, rows, previous, now)
        : buildIncrementalPlan(tab.name, tab.headers.length, rows, previous, now));
    }

    const allRanges: Array<{ range: string; values: Array<Array<string | number | boolean>> }> = [];
    for (const plan of plans) {
      const changes = fullReconcile
        ? plan.writes
        : [
          ...plan.writes,
          ...plan.clears.map((rowNumber) => ({ rowNumber, cells: Array.from({ length: plan.columnCount }, () => "") })),
        ];
      allRanges.push(...makeValueRanges(plan.sheetName, changes));
    }
    for (let offset = 0; offset < allRanges.length; offset += ROW_BATCH_COUNT) {
      const batch = allRanges.slice(offset, offset + ROW_BATCH_COUNT);
      await writeBusinessReportValues({
        database,
        owner: ownerResolution.owner,
        config: options.config,
        spreadsheetId: workbook.spreadsheetId,
        data: batch,
        request: options.request,
        sleep: options.sleep,
        random: options.random,
      });
      rowsWritten += batch.reduce((count, range) => count + range.values.length, 0);
    }

    await applyRowState(database, plans, fullReconcile);
    await database.prepare("UPDATE business_reporting_sync_state SET last_success_at=?, last_reconciliation_date=?, retry_attempt=0, next_retry_at=NULL, last_error_code=NULL, updated_at=? WHERE id='primary' AND lease_owner=?")
      .bind(now, fullReconcile ? localDate : state?.lastReconciliationDate ?? null, now, leaseOwner).run();
    await finishAudit(database, auditId, now, "success", rowsWritten, null);
    return { status: "success", reconciled: fullReconcile, rowsWritten };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    const retryAttempt = Number(retryState?.retryAttempt ?? 0);
    const retryDelay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** Math.min(retryAttempt, 4));
    await database.prepare("UPDATE business_reporting_sync_state SET last_error_code=?, retry_attempt=retry_attempt+1, next_retry_at=?, updated_at=? WHERE id='primary' AND lease_owner=?")
      .bind(errorCode, now + retryDelay, now, leaseOwner).run();
    await finishAudit(database, auditId, now, "failure", rowsWritten, errorCode);
    return { status: "failed", reason: errorCode, rowsWritten };
  } finally {
    await releaseLease(database, leaseOwner);
  }
}
