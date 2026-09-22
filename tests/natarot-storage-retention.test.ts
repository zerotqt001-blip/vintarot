import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manager = join(projectRoot, "deploy/release/natarot-release-manager.sh");
const audit = join(projectRoot, "deploy/release/natarot-storage-audit.sh");

type Fixture = {
  root: string;
  appRoot: string;
  releaseRoot: string;
  current: string;
  previous1: string;
  previous2: string;
  stagingRoot: string;
  failedRoot: string;
  backupRoot: string;
  database: string;
  environment: string;
  candidateSource: string;
  unknown: string;
  initialBackupNames: string[];
  release: (id: string) => string;
};

function writeFile(path: string, contents: string, mode?: number) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, mode === undefined ? undefined : { mode });
}

function createVerifiedBackup(fixtureRoot: string) {
  const backupRoot = join(fixtureRoot, "backups");
  const id = "natarot-production-20260923-010000";
  const archive = join(backupRoot, "daily", `${id}.tar.gz`);
  writeFile(archive, "synthetic verified backup\n");
  const checksum = execFileSync("sha256sum", [archive], { encoding: "utf8" });
  writeFile(`${archive}.sha256`, checksum);
  writeFile(join(backupRoot, "weekly", "natarot-production-2026-W39.tar.gz"), "weekly\n");
  writeFile(join(backupRoot, "monthly", "natarot-production-2026-09.tar.gz"), "monthly\n");
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  writeFile(
    join(backupRoot, "last-status"),
    `status=success\nbackup_id=${id}\ntimestamp=${timestamp}\narchive_sha256=${checksum.split(" ")[0]}\n`,
  );
  writeFile(join(backupRoot, "latest-success"), `${id}\n`);
  writeFile(
    join(backupRoot, "last-restore-test"),
    `status=success\ntimestamp=${timestamp}\ndatabase_integrity=ok\nmigration=pass\napplication=pass\n`,
  );
  return { backupRoot, names: [archive, `${archive}.sha256`] };
}

function createReleaseFixture(options: {
  successfulReleaseCount?: number;
  candidateFiles?: string[];
  backupRootHasVerifiedPolicy?: boolean;
} = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "natarot-storage-retention-"));
  const appRoot = join(root, "natarot");
  const releaseRoot = join(appRoot, "releases");
  const current = join(appRoot, "current");
  const previous1 = join(appRoot, "previous-1");
  const previous2 = join(appRoot, "previous-2");
  const stagingRoot = join(appRoot, ".staging");
  const failedRoot = join(appRoot, ".failed");
  const database = join(root, "var/lib/natarot/natarot.sqlite");
  const environment = join(root, "etc/natarot.env");
  const candidateSource = join(root, "candidate-source");
  const unknown = join(releaseRoot, "unclassified-data");

  mkdirSync(releaseRoot, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });
  mkdirSync(failedRoot, { recursive: true });
  writeFile(database, "production database fixture\n");
  writeFile(environment, "NATAROT_TEST_VALUE=excluded\n", 0o600);

  const successfulReleaseCount = options.successfulReleaseCount ?? 3;
  const release = (id: string) => join(releaseRoot, id);
  for (let index = 1; index <= successfulReleaseCount; index += 1) {
    const id = `r-${String(index).padStart(3, "0")}`;
    mkdirSync(release(id), { recursive: true });
    writeFile(join(release(id), "DEPLOYMENT_SUCCESS"), `release=${id}\n`);
    writeFile(join(release(id), "DEPLOYMENT_REVISION"), `release_id=${id}\n`);
    writeFile(join(release(id), "dist/server/index.js"), "candidate runtime\n");
  }
  if (successfulReleaseCount > 0) {
    symlinkSync(join("releases", `r-${String(successfulReleaseCount).padStart(3, "0")}`), current);
  }
  if (successfulReleaseCount > 1) {
    symlinkSync(join("releases", `r-${String(successfulReleaseCount - 1).padStart(3, "0")}`), previous1);
  }
  if (successfulReleaseCount > 2) {
    symlinkSync(join("releases", `r-${String(successfulReleaseCount - 2).padStart(3, "0")}`), previous2);
  }
  mkdirSync(unknown, { recursive: true });
  writeFile(join(unknown, "do-not-delete.txt"), "unknown\n");

  mkdirSync(candidateSource, { recursive: true });
  writeFile(join(candidateSource, "dist/server/index.js"), "candidate runtime\n");
  writeFile(join(candidateSource, "node_modules/vinext/dist/cli.js"), "candidate vinext\n");
  for (const candidateFile of options.candidateFiles ?? []) {
    writeFile(join(candidateSource, candidateFile), "unsafe candidate\n");
  }

  const backup = createVerifiedBackup(root);
  if (!options.backupRootHasVerifiedPolicy) {
    writeFile(join(backup.backupRoot, "last-restore-test"), `status=success\ntimestamp=${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}\ndatabase_integrity=ok\nmigration=pass\napplication=pass\n`);
  }

  return {
    root,
    appRoot,
    releaseRoot,
    current,
    previous1,
    previous2,
    stagingRoot,
    failedRoot,
    backupRoot: backup.backupRoot,
    database,
    environment,
    candidateSource,
    unknown,
    initialBackupNames: backup.names,
    release,
  };
}

function envFor(fixture: Fixture, overrides: Record<string, string> = {}) {
  return {
    ...process.env,
    NATAROT_APP_ROOT: fixture.appRoot,
    NATAROT_RELEASE_ROOT: fixture.releaseRoot,
    NATAROT_STAGING_ROOT: fixture.stagingRoot,
    NATAROT_FAILED_ROOT: fixture.failedRoot,
    NATAROT_BACKUP_ROOT: fixture.backupRoot,
    NATAROT_BACKUP_STATUS_FILE: join(fixture.backupRoot, "last-status"),
    NATAROT_BACKUP_LATEST_FILE: join(fixture.backupRoot, "latest-success"),
    NATAROT_RESTORE_STATUS_FILE: join(fixture.backupRoot, "last-restore-test"),
    NATAROT_DB_PATH: fixture.database,
    NATAROT_ENV_FILE: fixture.environment,
    NATAROT_LOCK_PATH: join(fixture.root, "deploy.lock"),
    NATAROT_SERVICE: "natarot-fixture.service",
    NATAROT_CANDIDATE_SERVICE_PREFIX: "natarot-fixture-candidate@",
    NATAROT_SYSTEMCTL: join(fixture.root, "bin/systemctl"),
    NATAROT_CURL: join(fixture.root, "bin/curl"),
    NATAROT_BACKUP_COMMAND: join(fixture.root, "bin/backup-command"),
    NATAROT_MIN_FREE_KIB: "1",
    NATAROT_MIN_FREE_PERCENT: "0",
    NATAROT_BACKUP_MAX_AGE_SECONDS: "999999999",
    NATAROT_PRODUCTION_SMOKE_RESULT: "pass",
    NATAROT_TEST_SKIP_BACKUP: "1",
    NATAROT_TEST_SKIP_SERVICE: "1",
    NATAROT_SKIP_OWNERSHIP: "1",
    ...overrides,
  };
}

function runScript(script: string, fixture: Fixture, args: string[], overrides: Record<string, string> = {}) {
  return spawnSync("bash", [script, ...args], {
    cwd: projectRoot,
    env: envFor(fixture, overrides),
    encoding: "utf8",
    timeout: 30_000,
  });
}

function runManager(fixture: Fixture, args: string[], overrides: Record<string, string> = {}) {
  return runScript(manager, fixture, args, overrides);
}

function runAudit(fixture: Fixture, overrides: Record<string, string> = {}) {
  return runScript(audit, fixture, [], overrides);
}

function snapshotProtectedReferences(fixture: Fixture) {
  return {
    current: readlinkSync(fixture.current),
    previous1: readlinkSync(fixture.previous1),
    previous2: readlinkSync(fixture.previous2),
    database: readFileSync(fixture.database, "utf8"),
  };
}

function existingReleaseIds(fixture: Fixture) {
  return ["r-001", "r-002", "r-003", "r-004", "r-005"].filter((id) => existsSync(fixture.release(id)));
}

function backupNames(fixture: Fixture) {
  return fixture.initialBackupNames.filter((path) => existsSync(path));
}

test("storage audit classifies production, backup, database, and unknown paths without mutation", () => {
  const fixture = createReleaseFixture();
  const before = snapshotProtectedReferences(fixture);
  const result = runAudit(fixture);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /classification=application-release/);
  assert.match(result.stdout, /classification=database/);
  assert.match(result.stdout, /classification=database-backup/);
  assert.match(result.stdout, /classification=unknown/);
  assert.deepEqual(snapshotProtectedReferences(fixture), before);
});

test("cleanup keeps current and both rollback references and removes only old successful releases", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 5 });
  const result = runManager(fixture, ["cleanup"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(existingReleaseIds(fixture), ["r-003", "r-004", "r-005"]);
  assert.equal(readlinkSync(fixture.current), join("releases", "r-005"));
  assert.equal(readlinkSync(fixture.previous1), join("releases", "r-004"));
  assert.equal(readlinkSync(fixture.previous2), join("releases", "r-003"));
  assert.equal(existsSync(fixture.unknown), true);
  assert.equal(existsSync(fixture.database), true);
});

test("failed promotion restores the former current release and performs no cleanup", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 3 });
  const before = snapshotProtectedReferences(fixture);
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"], {
    NATAROT_PRODUCTION_SMOKE_RESULT: "fail",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /health|smoke|rollback/i);
  assert.deepEqual(snapshotProtectedReferences(fixture), before);
  assert.equal(existsSync(fixture.release("r-001")), true);
  assert.equal(existsSync(fixture.release("r-002")), true);
  assert.equal(existsSync(fixture.release("r-003")), true);
});

test("successful promotion mirrors the active revision marker at the application root", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 3 });
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(join(fixture.appRoot, "DEPLOYMENT_REVISION"), "utf8"), readFileSync(join(fixture.release("r-004"), "DEPLOYMENT_REVISION"), "utf8"));
});

test("production health tolerates the bounded service startup window", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 3 });
  const fakeSystemctl = join(fixture.root, "bin/systemctl");
  const fakeCurl = join(fixture.root, "bin/curl");
  const curlState = join(fixture.root, "curl-state");
  writeFile(fakeSystemctl, "#!/bin/sh\nexit 0\n", 0o755);
  writeFile(fakeCurl, "#!/bin/sh\nif [ ! -f \"$NATAROT_TEST_CURL_STATE\" ]; then\n  : > \"$NATAROT_TEST_CURL_STATE\"\n  exit 7\nfi\nexit 0\n", 0o755);
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"], {
    NATAROT_TEST_SKIP_SERVICE: "0",
    NATAROT_SYSTEMCTL: fakeSystemctl,
    NATAROT_CURL: fakeCurl,
    NATAROT_TEST_CURL_STATE: curlState,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(curlState), true);
});

test("candidate validation rejects environment and SQLite files", () => {
  const fixture = createReleaseFixture({ candidateFiles: [".env.local", "data/natarot.sqlite"] });
  const result = runManager(fixture, ["deploy", "--source-dir", fixture.candidateSource, "--release-id", "r-004"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /persistent|environment|sqlite/i);
});

test("database backup verification is separate from application cleanup", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 5, backupRootHasVerifiedPolicy: true });
  const result = runManager(fixture, ["verify-backups"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(fixture.backupRoot), true);
  assert.equal(runManager(fixture, ["cleanup"]).status, 0);
  assert.deepEqual(backupNames(fixture), fixture.initialBackupNames);
});

test("cleanup refuses to remove a release referenced by a running process", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 5 });
  const result = runManager(fixture, ["cleanup"], {
    NATAROT_ACTIVE_RELEASE: fixture.release("r-001"),
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /active process|referenced|protected/i);
  assert.equal(existsSync(fixture.release("r-001")), true);
});

test("flat migration keeps the external database and environment outside the release", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 0 });
  const flatFile = join(fixture.appRoot, "dist/server/index.js");
  writeFile(flatFile, "flat production runtime\n");
  writeFile(join(fixture.appRoot, "node_modules/vinext/dist/cli.js"), "flat vinext runtime\n");
  writeFile(join(fixture.appRoot, "node_modules/unenv/dist/runtime/node/internal/tls/index.js"), "dependency tls helper\n");
  const result = runManager(fixture, ["migrate-flat", "--release-id", "migration-001"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(existsSync(flatFile), false);
  assert.equal(existsSync(join(fixture.releaseRoot, "migration-001", "dist/server/index.js")), true);
  assert.equal(readFileSync(fixture.database, "utf8"), "production database fixture\n");
  assert.equal(existsSync(fixture.environment), true);
});

test("failed flat migration restores the original service unit before restarting", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 0 });
  writeFile(join(fixture.appRoot, "dist/server/index.js"), "flat production runtime\n");
  writeFile(join(fixture.appRoot, "node_modules/vinext/dist/cli.js"), "flat vinext runtime\n");
  const preexistingRevision = "source_commit=fixture-commit\ndeployed_at=fixture-time\n";
  writeFile(join(fixture.appRoot, "DEPLOYMENT_REVISION"), preexistingRevision);
  const serviceUnitPath = join(fixture.root, "etc/systemd/system/natarot.service");
  const serviceUnitSource = join(fixture.root, "candidate/natarot.service");
  const fakeSystemctl = join(fixture.root, "bin/systemctl");
  const fakeCurl = join(fixture.root, "bin/curl");
  writeFile(serviceUnitPath, `[Service]\nWorkingDirectory=${fixture.appRoot}\n`);
  writeFile(serviceUnitSource, `[Service]\nWorkingDirectory=${fixture.current}\n`);
  writeFile(fakeSystemctl, "#!/bin/sh\nexit 0\n", 0o755);
  writeFile(fakeCurl, "#!/bin/sh\nexit 0\n", 0o755);
  const result = runManager(fixture, ["migrate-flat", "--release-id", "migration-rollback"], {
    NATAROT_TEST_SKIP_SERVICE: "0",
    NATAROT_TEST_SKIP_INSTALL: "1",
    NATAROT_SYSTEMCTL: fakeSystemctl,
    NATAROT_CURL: fakeCurl,
    NATAROT_SERVICE_UNIT_PATH: serviceUnitPath,
    NATAROT_SERVICE_UNIT_SOURCE: serviceUnitSource,
    NATAROT_PRODUCTION_SMOKE_RESULT: "fail",
  });
  assert.notEqual(result.status, 0);
  assert.match(readFileSync(serviceUnitPath, "utf8"), new RegExp(`WorkingDirectory=${fixture.appRoot.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  assert.equal(existsSync(join(fixture.appRoot, "dist/server/index.js")), true);
  assert.equal(readFileSync(join(fixture.appRoot, "DEPLOYMENT_REVISION"), "utf8"), preexistingRevision);
  assert.equal(existsSync(fixture.current), false);
  assert.equal(existsSync(join(fixture.releaseRoot, "migration-rollback")), false);
});

test("flat migration refuses an unknown top-level directory before moving code", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 0 });
  writeFile(join(fixture.appRoot, "dist/server/index.js"), "flat production runtime\n");
  const unknownDirectory = join(fixture.appRoot, "runtime-data");
  writeFile(join(unknownDirectory, "do-not-move.txt"), "unknown persistent state\n");
  const result = runManager(fixture, ["migrate-flat", "--release-id", "migration-unknown"]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /unknown|flat_root/i);
  assert.equal(existsSync(join(fixture.appRoot, "dist/server/index.js")), true);
  assert.equal(existsSync(unknownDirectory), true);
  assert.equal(existsSync(fixture.current), false);
});

test("rollback test switches to a protected release and restores the original current target", () => {
  const fixture = createReleaseFixture({ successfulReleaseCount: 3 });
  const before = snapshotProtectedReferences(fixture);
  const result = runManager(fixture, ["rollback-test", "--to", "previous-1"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(snapshotProtectedReferences(fixture), before);
});

test("disk preflight refuses a configured insufficient-space threshold before mutation", () => {
  const fixture = createReleaseFixture();
  const before = snapshotProtectedReferences(fixture);
  const result = runManager(fixture, ["cleanup"], { NATAROT_MIN_FREE_KIB: "999999999999" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /disk|free|space|headroom/i);
  assert.deepEqual(snapshotProtectedReferences(fixture), before);
});
