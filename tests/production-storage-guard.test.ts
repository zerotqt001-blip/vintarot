import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/prune-production-releases.sh", import.meta.url));

function makeDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

test("production storage guard keeps current plus two rollback releases and never touches backups", () => {
  const fixture = mkdtempSync("/tmp/natarot-storage-guard-");
  const releaseParent = join(fixture, "releases");
  const appRoot = join(releaseParent, "natarot");
  const backupRoot = join(fixture, "backups");
  const lockFile = join(fixture, "deploy.lock");

  try {
    makeDirectory(appRoot);
    makeDirectory(join(releaseParent, "natarot.rollback-20260920T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260921T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260922T010000Z"));
    makeDirectory(join(backupRoot, "daily"));
    writeFileSync(join(backupRoot, "daily", "keep-me.sqlite.tar.gz"), "backup");

    const output = execFileSync("bash", [script, "--post-deploy-confirmed"], {
      encoding: "utf8",
      env: {
        ...process.env,
        NATAROT_APP_ROOT: appRoot,
        NATAROT_BACKUP_ROOT: backupRoot,
        NATAROT_DEPLOY_LOCK: lockFile,
      },
    });

    assert.match(output, /VPS STORAGE GUARD:\s+PASS/);
    assert.match(output, /APPLICATION RELEASES BEFORE:\s+4/);
    assert.match(output, /APPLICATION RELEASES AFTER:\s+3/);
    assert.match(output, /OLD RELEASES REMOVED:\s+1/);
    assert.match(output, /DATABASE BACKUPS TOUCHED:\s+NO/);
    assert.match(output, /DEPLOY CLEANUP AUTOMATED:\s+YES/);
    assert.equal(existsSync(join(releaseParent, "natarot.rollback-20260920T010000Z")), false);
    assert.equal(existsSync(join(releaseParent, "natarot.rollback-20260921T010000Z")), true);
    assert.equal(existsSync(join(releaseParent, "natarot.rollback-20260922T010000Z")), true);
    assert.equal(existsSync(join(backupRoot, "daily", "keep-me.sqlite.tar.gz")), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("production storage guard never deletes during a dry run even with confirmation", () => {
  const fixture = mkdtempSync("/tmp/natarot-storage-guard-dry-run-");
  const releaseParent = join(fixture, "releases");
  const appRoot = join(releaseParent, "natarot");
  const backupRoot = join(fixture, "backups");
  const lockFile = join(fixture, "deploy.lock");

  try {
    makeDirectory(appRoot);
    makeDirectory(join(releaseParent, "natarot.rollback-20260920T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260921T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260922T010000Z"));
    makeDirectory(backupRoot);

    const output = execFileSync("bash", [script, "--dry-run", "--post-deploy-confirmed"], {
      encoding: "utf8",
      env: {
        ...process.env,
        NATAROT_APP_ROOT: appRoot,
        NATAROT_BACKUP_ROOT: backupRoot,
        NATAROT_DEPLOY_LOCK: lockFile,
      },
    });

    assert.match(output, /VPS STORAGE GUARD:\s+PASS \(dry-run/);
    assert.match(output, /OLD RELEASES REMOVED:\s+0/);
    assert.equal(existsSync(join(releaseParent, "natarot.rollback-20260920T010000Z")), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("production storage guard refuses cleanup without an explicit healthy post-deploy confirmation", () => {
  const fixture = mkdtempSync("/tmp/natarot-storage-guard-preflight-");
  const releaseParent = join(fixture, "releases");
  const appRoot = join(releaseParent, "natarot");
  const lockFile = join(fixture, "deploy.lock");

  try {
    makeDirectory(appRoot);
    makeDirectory(join(releaseParent, "natarot.rollback-20260920T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260921T010000Z"));
    makeDirectory(join(releaseParent, "natarot.rollback-20260922T010000Z"));

    assert.throws(
      () =>
        execFileSync("bash", [script], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NATAROT_APP_ROOT: appRoot,
            NATAROT_DEPLOY_LOCK: lockFile,
          },
        }),
      /post-deploy confirmation/
    );
    assert.equal(existsSync(join(releaseParent, "natarot.rollback-20260920T010000Z")), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("production storage guard refuses a backup root nested inside release storage", () => {
  const fixture = mkdtempSync("/tmp/natarot-storage-guard-overlap-");
  const releaseParent = join(fixture, "releases");
  const appRoot = join(releaseParent, "natarot");
  const rollbackRoot = join(releaseParent, "natarot.rollback-20260920T010000Z");
  const lockFile = join(fixture, "deploy.lock");
  const unsafeBackupRoot = join(rollbackRoot, "backups");

  try {
    makeDirectory(appRoot);
    makeDirectory(rollbackRoot);
    makeDirectory(join(releaseParent, "natarot.rollback-20260921T010000Z"));
    makeDirectory(unsafeBackupRoot);

    assert.throws(
      () =>
        execFileSync("bash", [script, "--post-deploy-confirmed"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NATAROT_APP_ROOT: appRoot,
            NATAROT_BACKUP_ROOT: unsafeBackupRoot,
            NATAROT_DEPLOY_LOCK: lockFile,
          },
        }),
      /backup root overlaps the release parent/
    );
    assert.equal(existsSync(rollbackRoot), true);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
