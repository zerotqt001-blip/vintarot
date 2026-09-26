import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { businessDateKey } from "../lib/business-reporting/read-model";
import { mirrorBackupRetention, selectOffsiteRetentionReferences, uploadVerifiedOffsiteBackup, type LocalBackupRetentionCandidate, type LocalBackupRetentionReference } from "../lib/business-reporting/offsite-backup";
import { BUSINESS_REPORTING_TIME_ZONE } from "../lib/business-reporting/types";
import type { DriveRuntimeConfig } from "../lib/google-drive";

const RETENTION_LIMITS = { daily: 7, weekly: 4, monthly: 3 } as const;
const BACKUP_FAILURE_ALERT_MS = 24 * 60 * 60 * 1000;
const BACKUP_JOB_TIMEOUT_MS = 45 * 60 * 1000;
const DRIVE_DEEP_VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;

type RetentionClass = keyof typeof RETENTION_LIMITS;
type BackupInventory = {
  latestBackupId: string;
  references: LocalBackupRetentionReference[];
  counts: Record<RetentionClass, number>;
};

function invalidInventory(): Error {
  return new Error("local_backup_inventory_invalid");
}

function parseKeyValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (/^[a-z][a-z0-9_]*$/.test(key)) values.set(key, value);
  }
  return values;
}

function readSmallRegularFile(path: string, maxBytes = 16 * 1024): string {
  const file = lstatSync(path);
  if (!file.isFile() || file.size > maxBytes) throw invalidInventory();
  return readFileSync(path, "utf8");
}

async function hashRegularFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const file = lstatSync(path);
  if (!file.isFile() || file.size <= 0) throw invalidInventory();
  const digest = createHash("sha256");
  let bytes = 0;
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk: string | Uint8Array) => {
      const value = new Uint8Array(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      digest.update(value);
      bytes += value.byteLength;
    });
    stream.once("error", reject);
    stream.once("end", resolvePromise);
  }).catch(() => { throw invalidInventory(); });
  return { sha256: digest.digest("hex"), bytes };
}

function timestampFromBackupId(backupId: string): string {
  const match = backupId.match(/^natarot-production-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) throw invalidInventory();
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString().slice(0, 19).replace(/[-:T]/g, "") !== `${year}${month}${day}${hour}${minute}${second}`) {
    throw invalidInventory();
  }
  return timestamp.toISOString();
}

async function verifiedArchive(path: string): Promise<{ sha256: string; bytes: number }> {
  const archive = await hashRegularFile(path);
  const sidecarText = readSmallRegularFile(path + ".sha256", 1024);
  const expected = sidecarText.trim().match(/^([a-f0-9]{64})(?:\s+\*?.+)?$/i)?.[1]?.toLowerCase();
  if (!expected || expected !== archive.sha256) throw invalidInventory();
  return archive;
}

function archiveFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.name.endsWith(".tar.gz"))
    .map((entry) => {
      if (!entry.isFile()) throw invalidInventory();
      return join(directory, entry.name);
    })
    .sort();
}

function inodeKey(path: string): string {
  const file = lstatSync(path);
  if (!file.isFile()) throw invalidInventory();
  return `${file.dev}:${file.ino}`;
}

export async function readLocalBackupReferences(backupRoot = process.env.NATAROT_BACKUP_ROOT || "/var/backups/natarot"): Promise<BackupInventory> {
  let root: string;
  try {
    root = realpathSync(backupRoot);
  } catch {
    throw invalidInventory();
  }
  const latestPath = join(root, "latest-success");
  const statusPath = join(root, "last-status");
  const latestBackupId = readSmallRegularFile(latestPath, 256).trim();
  if (!/^natarot-production-[A-Za-z0-9._-]+$/.test(latestBackupId)) throw invalidInventory();
  const status = parseKeyValues(readSmallRegularFile(statusPath));
  if (status.get("status") !== "success" || status.get("backup_id") !== latestBackupId || !Number.isFinite(Date.parse(status.get("timestamp") ?? ""))) {
    throw invalidInventory();
  }

  const directories = {
    daily: join(root, "daily"),
    weekly: join(root, "weekly"),
    monthly: join(root, "monthly"),
  };
  const counts = { daily: 0, weekly: 0, monthly: 0 };
  const candidates: LocalBackupRetentionCandidate[] = [];
  const dailyByInode = new Map<string, LocalBackupRetentionCandidate>();
  for (const path of archiveFiles(directories.daily)) {
    const file = basename(path);
    const match = file.match(/^(natarot-production-[A-Za-z0-9._-]+)\.tar\.gz$/);
    if (!match) throw invalidInventory();
    const backupId = match[1]!;
    const metadata = await verifiedArchive(path);
    const candidate: LocalBackupRetentionCandidate = {
      backupId,
      archivePath: path,
      archiveSha256: metadata.sha256,
      archiveBytes: metadata.bytes,
      backupTimestamp: timestampFromBackupId(backupId),
      retentionClass: "daily",
    };
    candidates.push(candidate);
    dailyByInode.set(inodeKey(path), candidate);
    counts.daily += 1;
  }
  if (!dailyByInode.has(inodeKey(join(directories.daily, `${latestBackupId}.tar.gz`)))) throw invalidInventory();

  for (const retentionClass of ["weekly", "monthly"] as const) {
    for (const path of archiveFiles(directories[retentionClass])) {
      const metadata = await verifiedArchive(path);
      const daily = dailyByInode.get(inodeKey(path));
      if (!daily || daily.archiveSha256 !== metadata.sha256 || daily.archiveBytes !== metadata.bytes) throw invalidInventory();
      candidates.push({ ...daily, retentionClass });
      counts[retentionClass] += 1;
    }
  }

  if (counts.daily < 1 || counts.weekly < 1 || counts.monthly < 1
    || counts.daily > RETENTION_LIMITS.daily || counts.weekly > RETENTION_LIMITS.weekly || counts.monthly > RETENTION_LIMITS.monthly) {
    throw invalidInventory();
  }
  return { latestBackupId, references: selectOffsiteRetentionReferences(candidates), counts };
}

export async function startBackupJob(database: D1Database, startedAt: number): Promise<string> {
  const staleRuns = await database.prepare(`UPDATE business_reporting_export_audit
    SET outcome='failure', started_at=?, finished_at=?, error_code='backup_job_interrupted'
    WHERE job_type='drive_backup_run' AND outcome='started' AND started_at<=?`)
    .bind(startedAt, startedAt, startedAt - BACKUP_JOB_TIMEOUT_MS).run();
  if (Number(staleRuns.meta.changes) > 0) {
    await database.prepare("UPDATE business_reporting_sync_state SET last_backup_error_code='backup_job_interrupted', updated_at=? WHERE id='primary'")
      .bind(startedAt).run();
  }
  const auditId = randomUUID();
  await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES (?, 'drive_backup_run', 'started', ?, NULL, 0, NULL)")
    .bind(auditId, startedAt).run();
  await database.prepare("UPDATE business_reporting_sync_state SET last_backup_status='pending', updated_at=? WHERE id='primary'")
    .bind(startedAt).run();
  return auditId;
}

export async function recordBackupJobFailure(database: D1Database, now: number, errorCode: string, auditId?: string): Promise<void> {
  if (auditId) {
    await database.prepare("UPDATE business_reporting_export_audit SET outcome='failure', finished_at=?, error_code=? WHERE id=? AND job_type='drive_backup_run' AND outcome='started'")
      .bind(now, errorCode, auditId).run();
  } else {
    await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES (?, 'drive_backup_run', 'failure', ?, ?, 0, ?)")
      .bind(randomUUID(), now, now, errorCode).run();
  }
  await database.prepare("UPDATE business_reporting_sync_state SET last_backup_status='failed', last_backup_error_code=?, updated_at=? WHERE id='primary'")
    .bind(errorCode, now).run();
}

export async function recordBackupJobSuccess(database: D1Database, startedAt: number, finishedAt: number, auditId?: string): Promise<void> {
  if (auditId) {
    await database.prepare("UPDATE business_reporting_export_audit SET outcome='success', finished_at=?, error_code=NULL WHERE id=? AND job_type='drive_backup_run' AND outcome='started'")
      .bind(finishedAt, auditId).run();
  } else {
    await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES (?, 'drive_backup_run', 'success', ?, ?, 0, NULL)")
      .bind(randomUUID(), startedAt, finishedAt).run();
  }
  await database.prepare("UPDATE business_reporting_sync_state SET last_backup_success_at=?, last_backup_status='verified', last_backup_error_code=NULL, updated_at=? WHERE id='primary'")
    .bind(finishedAt, finishedAt).run();
}

export async function maybeSendBackupFailureAlert(input: {
  database: D1Database;
  ownerEmail: string;
  apiKey: string;
  from: string;
  now: number;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (!input.ownerEmail || !input.apiKey || !input.from) return false;
  const failure = await input.database.prepare(`SELECT MIN(started_at) AS failureSince
    FROM business_reporting_export_audit
    WHERE job_type='drive_backup_run' AND outcome='failure'
      AND started_at >= COALESCE((SELECT MAX(finished_at) FROM business_reporting_export_audit WHERE job_type='drive_backup_run' AND outcome='success'), 0)`)
    .first<{ failureSince: number | null }>();
  if (failure?.failureSince == null) return false;
  const failureSince = Number(failure.failureSince);
  if (!Number.isFinite(failureSince) || input.now - failureSince < BACKUP_FAILURE_ALERT_MS) return false;
  const state = await input.database.prepare("SELECT last_backup_alert_sent_at AS lastAlertSentAt, last_backup_success_at AS lastSuccessAt, last_backup_error_code AS errorCode FROM business_reporting_sync_state WHERE id='primary'")
    .first<{ lastAlertSentAt: number | null; lastSuccessAt: number | null; errorCode: string | null }>();
  if (state?.lastAlertSentAt && input.now - Number(state.lastAlertSentAt) < BACKUP_FAILURE_ALERT_MS) return false;
  const validErrorCodes = new Set([
    "invalid_local_archive", "source_checksum_mismatch", "invalid_envelope", "decryption_failed", "encryption_failed",
    "remote_identity_mismatch", "duplicate_remote_file", "retention_unverified", "restore_verification_failed",
    "google_unavailable", "google_authorization", "backup_verification_failed", "local_backup_invalid", "offsite_backup_failed",
    "backup_job_interrupted",
  ]);
  const category = state?.errorCode && validErrorCodes.has(state.errorCode) ? state.errorCode : "backup_verification_failed";
  const lastSuccess = state?.lastSuccessAt && Number.isFinite(Number(state.lastSuccessAt))
    ? new Date(Number(state.lastSuccessAt)).toISOString()
    : "not yet verified / chưa có bản sao lưu được xác minh";

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: input.from,
        to: [input.ownerEmail],
        subject: "NaTarot backup needs attention",
        text: [
          "NaTarot encrypted Google Drive backup verification has been failing for more than 24 hours.",
          `Failure category: ${category}`,
          `Last successful backup: ${lastSuccess}`,
          "Review the natarot-business-control-center systemd service and its sanitized status records.",
          "",
          "Việc xác minh bản sao lưu mã hóa NaTarot lên Google Drive đã lỗi liên tục hơn 24 giờ.",
          `Nhóm lỗi: ${category}`,
          `Lần sao lưu thành công gần nhất: ${lastSuccess}`,
          "Hãy kiểm tra dịch vụ systemd natarot-business-control-center và bản ghi trạng thái đã được làm sạch.",
        ].join("\n"),
      }),
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  await input.database.prepare("UPDATE business_reporting_sync_state SET last_backup_alert_sent_at=?, updated_at=? WHERE id='primary'")
    .bind(input.now, input.now).run();
  return true;
}

async function restoreVerifier(archivePath: string, restoreStatusRoot: string, backupId: string): Promise<void> {
  const restoreCommand = process.env.NATAROT_RESTORE_TEST_COMMAND || "/usr/local/sbin/natarot-restore-test";
  execFileSync(restoreCommand, ["--archive", archivePath], {
    env: { ...process.env, NATAROT_BACKUP_ROOT: restoreStatusRoot, NATAROT_RESTORE_STATUS_FILE: join(restoreStatusRoot, `${backupId}.status`) },
    stdio: "ignore",
    timeout: 15 * 60 * 1000,
  });
}

function hcmcDate(timestamp: number): string {
  return businessDateKey(timestamp, BUSINESS_REPORTING_TIME_ZONE);
}

async function runOffsiteBackup(input: {
  database: D1Database;
  owner: { memberId: string; googleSubject: string; googleEmail: string };
  config: DriveRuntimeConfig;
  now: number;
  auditId: string;
}): Promise<{ status: "success" | "failed"; references: number }> {
  const restoreStatusRoot = process.env.NATAROT_RESTORE_STATUS_ROOT || "/var/lib/natarot/business-control-center/restore-status";
  const inventory = await readLocalBackupReferences();
  const lastRestore = await input.database.prepare("SELECT verified_at AS verifiedAt FROM business_reporting_backup_runs WHERE backup_id=? AND status='verified'")
    .bind(inventory.latestBackupId).first<{ verifiedAt: number | null }>();
  const shouldDeepVerifyLatest = !lastRestore?.verifiedAt || hcmcDate(Number(lastRestore.verifiedAt)) !== hcmcDate(input.now);
  const verifiedBackupIds: string[] = [];
  const ordered = [...inventory.references].reverse();

  for (const reference of ordered) {
    const row = await input.database.prepare("SELECT status, source_sha256 AS sourceSha256, source_bytes AS sourceBytes, verified_at AS verifiedAt FROM business_reporting_backup_runs WHERE backup_id=?")
      .bind(reference.backupId).first<{ status: string; sourceSha256: string | null; sourceBytes: number | null; verifiedAt: number | null }>();
    const forceVerify = reference.backupId === inventory.latestBackupId && shouldDeepVerifyLatest;
    const result = await uploadVerifiedOffsiteBackup({
      database: input.database,
      owner: input.owner,
      config: input.config,
      archivePath: reference.archivePath,
      backupId: reference.backupId,
      archiveSha256: reference.archiveSha256,
      archiveBytes: reference.archiveBytes,
      backupTimestamp: reference.backupTimestamp,
      retentionClasses: reference.retentionClasses,
      keyring: input.config.encryptionKeyring,
      restoreStatusRoot,
      forceVerify,
      now: input.now,
      restoreVerifier: ({ archivePath, restoreStatusRoot: statusRoot, backupId }) => restoreVerifier(archivePath, statusRoot, backupId),
    });
    if (result.status !== "verified") {
      await recordBackupJobFailure(input.database, Date.now(), result.errorCode ?? "offsite_backup_failed", input.auditId);
      return { status: "failed", references: inventory.references.length };
    }
    if (row?.status === "verified" && row.sourceSha256 === reference.archiveSha256 && Number(row.sourceBytes) === reference.archiveBytes) {
      verifiedBackupIds.push(reference.backupId);
    } else {
      const confirmed = await input.database.prepare("SELECT status FROM business_reporting_backup_runs WHERE backup_id=?")
        .bind(reference.backupId).first<{ status: string }>();
      if (confirmed?.status === "verified") verifiedBackupIds.push(reference.backupId);
    }
  }

  await mirrorBackupRetention({
    database: input.database,
    owner: input.owner,
    config: input.config,
    references: inventory.references.map(({ backupId, retentionClasses }) => ({ backupId, retentionClasses })),
    verifiedBackupIds,
  });
  await recordBackupJobSuccess(input.database, input.now, Date.now(), input.auditId);
  return { status: "success", references: inventory.references.length };
}

export async function runBusinessControlCenter(): Promise<void> {
  const [{ runtimeDatabase: database, runtimeEnv }, { resolveReportingOwner, syncBusinessReport }, { getGoogleDriveConfig }] = await Promise.all([
    import("../lib/runtime"),
    import("../lib/business-reporting/sync"),
    import("../lib/google-drive-config"),
  ]);
  const now = Date.now();
  const ownerResolution = await resolveReportingOwner(database);
  if (!ownerResolution.owner) {
    console.log(JSON.stringify({ service: "natarot-business-control-center", sheets: "blocked", backup: "blocked", reason: ownerResolution.blockedReason }));
    return;
  }
  const config = getGoogleDriveConfig(new Request(runtimeEnv.NATAROT_PUBLIC_ORIGIN || "https://natarot.com"));
  if (!config) {
    console.log(JSON.stringify({ service: "natarot-business-control-center", sheets: "blocked", backup: "blocked", reason: "google_configuration_unavailable" }));
    return;
  }

  let backupAuditId: string;
  try {
    backupAuditId = await startBackupJob(database, now);
  } catch {
    console.log(JSON.stringify({ service: "natarot-business-control-center", status: "failed", reason: "backup_audit_start_failed" }));
    process.exitCode = 1;
    return;
  }

  let sheetsStatus: string;
  let sheetsReason: string | null = null;
  try {
    const result = await syncBusinessReport(database, { config, now });
    sheetsStatus = result.status;
    if (result.status === "failed" || result.status === "blocked") sheetsReason = result.reason ?? "reporting_sync_failed";
  } catch {
    sheetsStatus = "failed";
    sheetsReason = "reporting_internal_error";
  }

  let backupStatus: string;
  let backupReason: string | null = null;
  let backupReferences = 0;
  try {
    const manager = process.env.NATAROT_RELEASE_MANAGER || "/usr/local/sbin/natarot-release-manager";
    execFileSync(manager, ["verify-backups"], { stdio: "ignore", timeout: 60_000 });
    const backup = await runOffsiteBackup({ database, owner: ownerResolution.owner, config, now, auditId: backupAuditId });
    backupStatus = backup.status;
    backupReferences = backup.references;
    if (backup.status === "failed") backupReason = "offsite_backup_failed";
  } catch (error) {
    backupStatus = "failed";
    backupReason = error instanceof Error && error.message === "local_backup_inventory_invalid" ? "local_backup_invalid" : "offsite_backup_failed";
    await recordBackupJobFailure(database, Date.now(), backupReason, backupAuditId);
  }

  let alertSent = false;
  try {
    alertSent = await maybeSendBackupFailureAlert({
      database,
      ownerEmail: ownerResolution.owner.googleEmail,
      apiKey: runtimeEnv.RESEND_API_KEY ?? "",
      from: runtimeEnv.NATAROT_EMAIL_FROM ?? "NaTarot <noreply@natarot.com>",
      now: Date.now(),
    });
  } catch {
    alertSent = false;
  }

  console.log(JSON.stringify({
    service: "natarot-business-control-center",
    timestamp: new Date(now).toISOString(),
    sheets: sheetsStatus,
    ...(sheetsReason ? { sheetsReason } : {}),
    backup: backupStatus,
    ...(backupReason ? { backupReason } : {}),
    backupReferences,
    alertSent,
  }));
  if (sheetsStatus === "failed" || backupStatus === "failed") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runBusinessControlCenter();
  } catch {
    console.log(JSON.stringify({ service: "natarot-business-control-center", status: "failed", reason: "runner_internal_error" }));
    process.exitCode = 1;
  }
}
