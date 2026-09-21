import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sqliteBackupHelper = join(projectRoot, "deploy/backup/natarot-sqlite-backup.mjs");
const backupScript = join(projectRoot, "deploy/backup/natarot-backup.sh");
const restoreScript = join(projectRoot, "deploy/backup/natarot-restore-test.sh");

function createFixtureDatabase(root: string): string {
  const databasePath = join(root, "source", "natarot.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE natarot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE tarot_cards (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
    CREATE TABLE records (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
    INSERT INTO natarot_migrations VALUES ('0000_fixture.sql', 1);
    INSERT INTO tarot_cards VALUES (1, 'the-fool');
    INSERT INTO records VALUES (1, 'fixture');
  `);
  database.close();
  return databasePath;
}

function runNode(script: string, args: string[]) {
  return spawnSync(process.execPath, ["--no-warnings", script, ...args], {
    encoding: "utf8",
  });
}

function createBackupFixture() {
  const root = mkdtempSync(join(tmpdir(), "natarot-backup-runner-"));
  const appRoot = join(root, "app");
  const configRoot = join(root, "config");
  const systemdUnit = join(configRoot, "natarot.service");
  const nginxConfig = join(configRoot, "natarot.conf");
  const envFile = join(configRoot, "natarot.env");
  mkdirSync(appRoot, { recursive: true });
  mkdirSync(configRoot, { recursive: true });
  writeFileSync(
    join(appRoot, "DEPLOYMENT_REVISION"),
    "source_commit=4db459a016f6335fc94a044a76318663c1b40af5\nbuilt_from=codex/auth-integration-a0\ndeployed_at=2026-09-19T19:46:03Z\n",
  );
  writeFileSync(systemdUnit, "[Service]\nExecStart=/usr/local/bin/node /opt/natarot/app.js\n");
  writeFileSync(nginxConfig, "server { server_name natarot.com; }\n");
  writeFileSync(envFile, "TAROT_AI_PROVIDER=fixture\nFIXTURE_PRIVATE_VALUE=fixture-should-not-copy-value\n");
  return {
    root,
    appRoot,
    configRoot,
    systemdUnit,
    nginxConfig,
    envFile,
    databasePath: createFixtureDatabase(root),
    backupRoot: join(root, "backups"),
  };
}

function runBackup(fixture: ReturnType<typeof createBackupFixture>, overrides: Record<string, string> = {}) {
  return spawnSync("bash", [backupScript], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NATAROT_APP_ROOT: fixture.appRoot,
      NATAROT_BACKUP_ROOT: fixture.backupRoot,
      NATAROT_DB_PATH: fixture.databasePath,
      NATAROT_ENV_FILE: fixture.envFile,
      NATAROT_NGINX_CONFIG: fixture.nginxConfig,
      NATAROT_NODE_BIN: process.execPath,
      NATAROT_SQLITE_HELPER: sqliteBackupHelper,
      NATAROT_SYSTEMD_UNIT: fixture.systemdUnit,
      NATAROT_MIN_FREE_KIB: "1",
      NATAROT_BACKUP_ID: "natarot-production-20260921-020000",
      NATAROT_BACKUP_TIMESTAMP: "2026-09-21T02:00:00Z",
      ...overrides,
    },
  });
}

function runRestore(fixture: ReturnType<typeof createBackupFixture>, archive: string, overrides: Record<string, string> = {}) {
  return spawnSync("bash", [restoreScript, "--archive", archive], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NATAROT_APP_ROOT: projectRoot,
      NATAROT_BACKUP_ROOT: fixture.backupRoot,
      NATAROT_NODE_BIN: process.execPath,
      NATAROT_PRODUCTION_DB_PATH: fixture.databasePath,
      NATAROT_SKIP_APP_SMOKE: "1",
      NATAROT_SKIP_MIGRATION: "1",
      ...overrides,
    },
  });
}

test("creates a verified SQLite copy from a live WAL database", () => {
  const root = mkdtempSync(join(tmpdir(), "natarot-backup-helper-"));
  try {
    const source = createFixtureDatabase(root);
    const destination = join(root, "backup", "natarot.sqlite");
    mkdirSync(dirname(destination), { recursive: true });

    const result = runNode(sqliteBackupHelper, [source, destination]);

    assert.equal(result.status, 0, result.stderr);
    const metadata = JSON.parse(result.stdout.trim());
    assert.equal(metadata.source.integrity, "ok");
    assert.equal(metadata.destination.integrity, "ok");
    assert.equal(metadata.destination.foreignKeyViolations, 0);
    assert.equal(metadata.destination.tables, 3);
    assert.equal(metadata.destination.migrations, 1);
    assert.equal(metadata.destination.rowCounts.tarot_cards, 1);
    assert.ok(metadata.destination.bytes > 0);

    const restored = new DatabaseSync(destination, { readOnly: true });
    const recordCount = Number(restored.prepare("SELECT count(*) AS count FROM records").get()?.count ?? 0);
    assert.equal(recordCount, 1);
    restored.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails without creating a destination when the source database is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "natarot-backup-helper-missing-"));
  try {
    const destination = join(root, "backup", "natarot.sqlite");
    const result = runNode(sqliteBackupHelper, [join(root, "missing.sqlite"), destination]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source database|ENOENT|not found/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("creates a private manifest, checksum, and archive without copying secret values", () => {
  const fixture = createBackupFixture();
  try {
    const result = runBackup(fixture);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /backup_complete/);

    const archive = join(fixture.backupRoot, "daily", "natarot-production-20260921-020000.tar.gz");
    assert.ok(existsSync(archive));
    const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
    assert.match(listing, /manifest\/backup-manifest\.json/);
    assert.match(listing, /database\/natarot\.sqlite/);
    assert.match(listing, /configuration\/runtime\/natarot\.env\.keys/);

    const extracted = join(fixture.root, "extracted");
    mkdirSync(extracted, { recursive: true });
    execFileSync("tar", ["-xzf", archive, "-C", extracted]);
    const bundleRoot = join(extracted, "natarot-production-20260921-020000");
    const manifest = readFileSync(join(bundleRoot, "manifest/backup-manifest.json"), "utf8");
    const envKeys = readFileSync(join(bundleRoot, "configuration/runtime/natarot.env.keys"), "utf8");
    assert.match(manifest, /4db459a016f6335fc94a044a76318663c1b40af5/);
    assert.match(manifest, /VACUUM INTO/);
    assert.match(envKeys, /FIXTURE_PRIVATE_VALUE=/);
    assert.doesNotMatch(manifest, /fixture-should-not-copy-value/);
    assert.doesNotMatch(envKeys, /fixture-should-not-copy-value/);

    const archiveHash = createHash("sha256").update(readFileSync(archive)).digest("hex");
    assert.equal(archiveHash, readFileSync(`${archive}.sha256`, "utf8").trim().split(/\s+/)[0]);
    for (const line of readFileSync(join(bundleRoot, "checksums/SHA256SUMS"), "utf8").trim().split(/\r?\n/)) {
      const [expected, relativePath] = line.split(/\s+/, 2);
      const actual = createHash("sha256").update(readFileSync(join(bundleRoot, relativePath))).digest("hex");
      assert.equal(actual, expected, relativePath);
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails safely before staging when disk headroom is below the configured threshold", () => {
  const fixture = createBackupFixture();
  try {
    const result = runBackup(fixture, { NATAROT_MIN_FREE_KIB: "99999999999" });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /disk|free space|headroom/i);
    assert.equal(readdirSync(join(fixture.backupRoot, "daily")).some((name) => name.endsWith(".tar.gz")), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("retains the newest seven daily archives and keeps a latest-success marker", () => {
  const fixture = createBackupFixture();
  try {
    for (let index = 1; index <= 9; index += 1) {
      const id = `natarot-production-202609${String(21 + index).padStart(2, "0")}-020000`;
      const result = runBackup(fixture, {
        NATAROT_BACKUP_ID: id,
        NATAROT_BACKUP_TIMESTAMP: `2026-09-${String(21 + index).padStart(2, "0")}T02:00:00Z`,
      });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    }

    const daily = readdirSync(join(fixture.backupRoot, "daily")).filter((name) => name.endsWith(".tar.gz"));
    assert.equal(daily.length, 7);
    assert.equal(readFileSync(join(fixture.backupRoot, "latest-success"), "utf8").trim(), "natarot-production-20260930-020000");
    assert.ok(existsSync(join(fixture.backupRoot, "daily", "natarot-production-20260930-020000.tar.gz")));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("restores and verifies an archive in an isolated temporary directory", () => {
  const fixture = createBackupFixture();
  try {
    const backup = runBackup(fixture);
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`);
    const archive = join(fixture.backupRoot, "daily", "natarot-production-20260921-020000.tar.gz");
    const before = createHash("sha256").update(readFileSync(fixture.databasePath)).digest("hex");

    const result = runRestore(fixture, archive);

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /restore_test_complete/);
    assert.equal(createHash("sha256").update(readFileSync(fixture.databasePath)).digest("hex"), before);
    assert.match(readFileSync(join(fixture.backupRoot, "last-restore-test"), "utf8"), /status=success/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("restores when tar reports a large listing under pipefail", () => {
  const fixture = createBackupFixture();
  try {
    const backup = runBackup(fixture);
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`);
    const archive = join(fixture.backupRoot, "daily", "natarot-production-20260921-020000.tar.gz");
    const fakeBin = join(fixture.root, "fake-bin");
    const fakeTar = join(fakeBin, "tar");
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(fakeTar, `#!/bin/sh
if [ "$1" = "-tzf" ]; then
  printf '%s\\n' 'natarot-production-20260921-020000/configuration/'
  dd if=/dev/zero bs=1048576 count=1 2>/dev/null
  exit $?
fi
exec /usr/bin/tar "$@"
`);
    chmodSync(fakeTar, 0o755);

    const result = runRestore(fixture, archive, {
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(readFileSync(join(fixture.backupRoot, "last-restore-test"), "utf8"), /status=success/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when an archive is missing", () => {
  const fixture = createBackupFixture();
  try {
    const result = runRestore(fixture, join(fixture.backupRoot, "daily/missing.tar.gz"));

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /archive|not found|missing/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("skips an overlapping backup without entering the staging path", async () => {
  const fixture = createBackupFixture();
  try {
    const first = spawn("bash", [backupScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NATAROT_APP_ROOT: fixture.appRoot,
        NATAROT_BACKUP_ROOT: fixture.backupRoot,
        NATAROT_DB_PATH: fixture.databasePath,
        NATAROT_ENV_FILE: fixture.envFile,
        NATAROT_NGINX_CONFIG: fixture.nginxConfig,
        NATAROT_NODE_BIN: process.execPath,
        NATAROT_SQLITE_HELPER: sqliteBackupHelper,
        NATAROT_SYSTEMD_UNIT: fixture.systemdUnit,
        NATAROT_MIN_FREE_KIB: "1",
        NATAROT_BACKUP_ID: "natarot-production-20260921-021000",
        NATAROT_BACKUP_TIMESTAMP: "2026-09-21T02:10:00Z",
        NATAROT_TEST_PAUSE_SECONDS: "2",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let firstOutput = "";
    first.stdout.on("data", (chunk) => { firstOutput += String(chunk); });
    first.stderr.on("data", (chunk) => { firstOutput += String(chunk); });

    const deadline = Date.now() + 2_000;
    while (!existsSync(join(fixture.backupRoot, "backup.lock.d")) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(existsSync(join(fixture.backupRoot, "backup.lock.d")));

    const second = runBackup(fixture, {
      NATAROT_BACKUP_ID: "natarot-production-20260921-021001",
      NATAROT_BACKUP_TIMESTAMP: "2026-09-21T02:10:01Z",
    });
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    assert.match(`${second.stdout}\n${second.stderr}`, /lock_busy/);

    await new Promise<void>((resolve, reject) => {
      first.on("close", (code) => {
        if (code === 0) resolve(); else reject(new Error(`${firstOutput}\nexit=${code}`));
      });
    });
    assert.ok(existsSync(join(fixture.backupRoot, "daily", "natarot-production-20260921-021000.tar.gz")));
    assert.equal(existsSync(join(fixture.backupRoot, "daily", "natarot-production-20260921-021001.tar.gz")), false);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
