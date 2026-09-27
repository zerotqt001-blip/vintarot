import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as businessControlCenter from "../scripts/business-control-center";
import { buildRestoreVerifierEnvironment, maybeSendBackupFailureAlert, readLocalBackupReferences, recordBackupJobFailure, recordBackupJobSuccess, startBackupJob } from "../scripts/business-control-center";
import { createSqliteD1Database, type SqliteConnection } from "../lib/sqlite-d1";

const projectRoot = process.cwd();

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function addArchive(path: string, bytes: Buffer): void {
  writeFileSync(path, bytes, { mode: 0o600 });
  writeFileSync(path + ".sha256", `${hash(bytes)}  ${basename(path)}\n`, { mode: 0o600 });
}

function makeBackupWithManifest(backupId: string, backupTimestamp: string): Buffer {
  const root = mkdtempSync(join(tmpdir(), "natarot-backup-manifest-"));
  try {
    const manifestDirectory = join(root, backupId, "manifest");
    mkdirSync(manifestDirectory, { recursive: true });
    writeFileSync(join(manifestDirectory, "backup-manifest.json"), JSON.stringify({
      backupVersion: "natarot-backup-v1",
      backupId,
      backupTimestamp,
    }));
    const archivePath = join(root, "archive.tar.gz");
    execFileSync("tar", ["-czf", archivePath, "-C", root, backupId]);
    return readFileSync(archivePath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function makeBackupFixture(): { root: string; latestId: string } {
  const root = mkdtempSync(join(tmpdir(), "natarot-backup-inventory-"));
  for (const directory of ["daily", "weekly", "monthly"]) mkdirSync(join(root, directory));
  let latestId = "";
  for (let day = 20; day <= 26; day += 1) {
    const id = `natarot-production-202609${day}-120000`;
    const path = join(root, "daily", `${id}.tar.gz`);
    addArchive(path, Buffer.from(`verified synthetic archive ${day}`));
    latestId = id;
  }
  const newestDaily = join(root, "daily", `${latestId}.tar.gz`);
  const weekly = join(root, "weekly", "natarot-production-2026-W39.tar.gz");
  const monthly = join(root, "monthly", "natarot-production-2026-09.tar.gz");
  linkSync(newestDaily, weekly);
  linkSync(newestDaily + ".sha256", weekly + ".sha256");
  linkSync(newestDaily, monthly);
  linkSync(newestDaily + ".sha256", monthly + ".sha256");
  writeFileSync(join(root, "latest-success"), `${latestId}\n`, { mode: 0o600 });
  writeFileSync(join(root, "last-status"), `status=success\nbackup_id=${latestId}\ntimestamp=2026-09-26T12:00:00Z\n`, { mode: 0o600 });
  return { root, latestId };
}

test("local backup inventory verifies sidecars and maps hard-linked weekly/monthly references", async (context) => {
  const fixture = makeBackupFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const inventory = await readLocalBackupReferences(fixture.root);
  assert.equal(inventory.latestBackupId, fixture.latestId);
  assert.equal(inventory.references.length, 7);
  const latest = inventory.references.find((reference) => reference.backupId === fixture.latestId);
  assert.deepEqual(latest?.retentionClasses.sort(), ["daily", "monthly", "weekly"]);
  assert.equal(inventory.counts.daily, 7);
  assert.equal(inventory.counts.weekly, 1);
  assert.equal(inventory.counts.monthly, 1);
});

test("local backup inventory verifies retained weekly/monthly archives after their daily link is pruned", async (context) => {
  const fixture = makeBackupFixture();
  context.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const weekly = join(fixture.root, "weekly", "natarot-production-2026-W39.tar.gz");
  const monthly = join(fixture.root, "monthly", "natarot-production-2026-09.tar.gz");
  rmSync(weekly);
  rmSync(weekly + ".sha256");
  rmSync(monthly);
  rmSync(monthly + ".sha256");
  const retainedBackupId = "natarot-production-20260921-083347";
  const retainedArchive = makeBackupWithManifest(retainedBackupId, "2026-09-21T08:33:47Z");
  addArchive(weekly, retainedArchive);
  linkSync(weekly, monthly);
  linkSync(weekly + ".sha256", monthly + ".sha256");

  const inventory = await readLocalBackupReferences(fixture.root);
  const retained = inventory.references.find((reference) => reference.backupId === retainedBackupId);
  assert.equal(inventory.references.length, 8);
  assert.equal(retained?.archiveSha256, hash(retainedArchive));
  assert.deepEqual(retained?.retentionClasses.sort(), ["monthly", "weekly"]);
});

test("offsite restore verification runs against the active release with an isolated status root", () => {
  assert.deepEqual(buildRestoreVerifierEnvironment({ NODE_ENV: "production" }, "/tmp/natarot-restore-status", "backup-a"), {
    NODE_ENV: "production",
    NATAROT_APP_ROOT: "/opt/natarot/current",
    NATAROT_BACKUP_ROOT: "/tmp/natarot-restore-status",
    NATAROT_RESTORE_STATUS_FILE: "/tmp/natarot-restore-status/backup-a.status",
  });
  assert.equal(buildRestoreVerifierEnvironment({ NODE_ENV: "production", NATAROT_APP_ROOT: "/opt/natarot/releases/active" }, "/tmp/status", "backup-b").NATAROT_APP_ROOT,
    "/opt/natarot/releases/active");
});

test("local backup inventory fails closed for a corrupt archive checksum or retention overflow", async (context) => {
  const checksumFixture = makeBackupFixture();
  context.after(() => rmSync(checksumFixture.root, { recursive: true, force: true }));
  writeFileSync(join(checksumFixture.root, "daily", `${checksumFixture.latestId}.tar.gz`), "tampered");
  await assert.rejects(() => readLocalBackupReferences(checksumFixture.root));

  const overflowFixture = makeBackupFixture();
  context.after(() => rmSync(overflowFixture.root, { recursive: true, force: true }));
  const extraId = "natarot-production-20260919-120000";
  addArchive(join(overflowFixture.root, "daily", `${extraId}.tar.gz`), Buffer.from("extra verified-looking archive"));
  await assert.rejects(() => readLocalBackupReferences(overflowFixture.root));
});

test("systemd units install a locked root-only 15-minute job and leave its timer disabled by default", () => {
  const service = readFileSync(join(projectRoot, "deploy/systemd/natarot-business-control-center.service"), "utf8");
  const timer = readFileSync(join(projectRoot, "deploy/systemd/natarot-business-control-center.timer"), "utf8");
  assert.match(service, /^User=root$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(service, /^EnvironmentFile=-\/etc\/natarot\.env$/m);
  assert.match(service, /flock -n .*natarot-business-control-center/);
  assert.match(service, /ProtectSystem=full/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /TimeoutStartSec=/);
  assert.match(timer, /^OnUnitInactiveSec=15min$/m);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /natarot-business-control-center\.service/);
  assert.match(timer, /\[Install\][\s\S]*WantedBy=timers\.target/);
  assert.doesNotMatch(service, /natarot\.service/);
});

test("standalone runner recognizes the active-release symlink as its own entrypoint", (context) => {
  const root = mkdtempSync(join(tmpdir(), "natarot-bcc-entrypoint-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const releaseDirectory = join(root, "releases", "release-a");
  const distDirectory = join(releaseDirectory, "dist");
  mkdirSync(distDirectory, { recursive: true });
  const releaseEntry = join(distDirectory, "business-control-center.mjs");
  writeFileSync(releaseEntry, "export {};\n");
  const activeDirectory = join(root, "current");
  symlinkSync(releaseDirectory, activeDirectory, "dir");

  const detector = (businessControlCenter as unknown as Record<string, unknown>).isBusinessControlCenterEntrypoint as
    | ((entryPath: string | undefined, moduleUrl: string) => boolean)
    | undefined;
  assert.equal(detector?.(join(activeDirectory, "dist", "business-control-center.mjs"), pathToFileURL(releaseEntry).href), true);
  assert.equal(detector?.(undefined, pathToFileURL(releaseEntry).href), false);
});

test("the durable backup-run audit starts before Sheets synchronization and the final sync follows backup verification", () => {
  const runner = readFileSync(join(projectRoot, "scripts/business-control-center.ts"), "utf8");
  const runStart = runner.indexOf("await startBackupJob(database, now)");
  const sheetsSync = runner.indexOf("await syncBusinessReport(database, { config, now })");
  const backupRun = runner.indexOf("await runOffsiteBackup({ database, owner: ownerResolution.owner, config, now, auditId: backupAuditId })");
  const finalSync = runner.indexOf("await syncBusinessReport(database, { config, now: Date.now() })");
  assert.notEqual(runStart, -1, "runner must persist a run audit");
  assert.notEqual(sheetsSync, -1, "runner must perform its initial Sheets synchronization");
  assert.notEqual(backupRun, -1, "runner must verify the offsite backup after the initial synchronization");
  assert.notEqual(finalSync, -1, "runner must refresh the workbook after the backup outcome is recorded");
  assert.ok(runStart < sheetsSync, "timeout recovery must cover the entire scheduled run, including Sheets sync");
  assert.ok(sheetsSync < backupRun && backupRun < finalSync, "the final workbook refresh must observe the completed backup outcome");
});

test("backup failure alert waits 24 hours and sends no more than once per day", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-backup-alert-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, [join(projectRoot, "scripts/node-migrate.mjs")], {
    cwd: projectRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const now = Date.now();
  const calls: Array<{ url: string; authorization: string | null; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization"), body: String(init?.body ?? "") });
    return Response.json({ id: "synthetic-message" });
  };
  const alertInput = { database, ownerEmail: "owner@example.test", apiKey: "synthetic-resend-key", from: "NaTarot <noreply@natarot.com>", fetchImpl };

  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now + 48 * 60 * 60 * 1000 }), false);
  assert.equal(calls.length, 0);
  await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES ('failure-1', 'drive_backup_run', 'failure', ?, ?, 0, 'google_unavailable')")
    .bind(now - 24 * 60 * 60 * 1000, now - 24 * 60 * 60 * 1000).run();
  await database.prepare("INSERT INTO business_reporting_export_audit (id, job_type, outcome, started_at, finished_at, rows_written, error_code) VALUES ('item-success-1', 'drive_backup', 'success', ?, ?, 0, NULL)")
    .bind(now - 60 * 60 * 1000, now - 60 * 60 * 1000).run();
  await database.prepare("UPDATE business_reporting_sync_state SET last_backup_error_code='google_unavailable', last_backup_success_at=? WHERE id='primary'")
    .bind(now - 48 * 60 * 60 * 1000).run();

  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now - 60_000 }), false);
  assert.equal(calls.length, 0);
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.resend.com/emails");
  assert.equal(calls[0]?.authorization, "Bearer synthetic-resend-key");
  const sent = JSON.parse(calls[0]!.body) as { to: string[]; subject: string; text: string };
  assert.deepEqual(sent.to, ["owner@example.test"]);
  assert.match(sent.subject, /NaTarot backup/);
  assert.match(sent.text, /Failure category: google_unavailable/);
  assert.match(sent.text, /Last successful backup:/);
  assert.match(sent.text, /Nhóm lỗi: google_unavailable/);
  assert.doesNotMatch(sent.text, /customer|question|reading|payment|referral/i);
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now + 23 * 60 * 60 * 1000 }), false);
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now + 24 * 60 * 60 * 1000 }), true);
  assert.equal(calls.length, 2);

  await recordBackupJobSuccess(database, now + 25 * 60 * 60 * 1000, now + 25 * 60 * 60 * 1000);
  assert.equal((await database.prepare("SELECT last_backup_success_at AS lastSuccessAt FROM business_reporting_sync_state WHERE id='primary'").first<{ lastSuccessAt: number | null }>())?.lastSuccessAt, now + 25 * 60 * 60 * 1000);
  await recordBackupJobFailure(database, now + 26 * 60 * 60 * 1000, "google_unavailable");
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now + 49 * 60 * 60 * 1000 }), false);
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: now + 50 * 60 * 60 * 1000 }), true);
  assert.equal(calls.length, 3);
});

test("a timed-out backup run becomes an alertable failure when the next job starts", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "natarot-backup-timeout-"));
  const dbPath = join(directory, "natarot.sqlite");
  execFileSync(process.execPath, [join(projectRoot, "scripts/node-migrate.mjs")], {
    cwd: projectRoot,
    env: { ...process.env, NATAROT_DB_PATH: dbPath },
    stdio: "pipe",
  });
  const sqlite = new DatabaseSync(dbPath);
  const database = createSqliteD1Database(sqlite as unknown as SqliteConnection);
  context.after(() => {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const startedAt = Date.now() - 26 * 60 * 60 * 1000;
  const firstRunId = await startBackupJob(database, startedAt);
  const detectedAt = startedAt + 46 * 60 * 1000;
  await startBackupJob(database, detectedAt);
  const failedRun = await database.prepare("SELECT outcome, error_code AS errorCode FROM business_reporting_export_audit WHERE id=?")
    .bind(firstRunId).first<{ outcome: string; errorCode: string | null }>();
  assert.deepEqual(failedRun, { outcome: "failure", errorCode: "backup_job_interrupted" });
  assert.equal((await database.prepare("SELECT last_backup_status AS status, last_backup_error_code AS errorCode FROM business_reporting_sync_state WHERE id='primary'").first<{ status: string; errorCode: string | null }>())?.errorCode, "backup_job_interrupted");

  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ id: "synthetic-message" });
  };
  const alertInput = { database, ownerEmail: "owner@example.test", apiKey: "synthetic-resend-key", from: "NaTarot <noreply@natarot.com>", fetchImpl };
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: detectedAt + 23 * 60 * 60 * 1000 }), false);
  assert.equal(calls.length, 0);
  assert.equal(await maybeSendBackupFailureAlert({ ...alertInput, now: detectedAt + 24 * 60 * 60 * 1000 }), true);
  assert.deepEqual(calls, ["https://api.resend.com/emails"]);
});

test("release build bundles the standalone Node runner without requiring tsx at runtime", () => {
  const packageConfig = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  const builder = readFileSync(join(projectRoot, "scripts/build-business-control-center.mjs"), "utf8");
  assert.match(packageConfig.scripts.build ?? "", /build-project\.mjs/);
  assert.match(builder, /dist\/business-control-center\.mjs/);
  assert.match(builder, /dist\/provision-first-owner\.mjs/);
  assert.match(builder, /scripts\/provision-first-owner\.ts/);
  assert.match(builder, /platform: "node"/);
  assert.match(builder, /bundle: true/);
});
