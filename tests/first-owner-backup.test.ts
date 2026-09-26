import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

type BackupEvidenceInput = {
  backupId: string;
  backupSha256: string;
  restoreVerificationRef: string;
};
type VerifyBackupEvidence = (
  input: BackupEvidenceInput,
  options: { backupRoot: string; now: () => number; runManagerVerifier: () => void },
) => Promise<void>;

async function loadVerifier(): Promise<VerifyBackupEvidence> {
  const importFile = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const moduleUrl = new URL("../lib/owner-bootstrap/backup-verification.ts", import.meta.url).href;
  const loaded = await importFile(moduleUrl).catch(() => null);
  const verify = loaded?.verifyFirstOwnerBackupEvidence;
  assert.equal(typeof verify, "function", "production backup evidence verifier should exist");
  return verify as VerifyBackupEvidence;
}

function createBackupFixture(context: TestContext) {
  const backupRoot = mkdtempSync(join(tmpdir(), "natarot-first-owner-backup-"));
  context.after(() => rmSync(backupRoot, { recursive: true, force: true }));

  const backupId = "natarot-production-20260927-120000";
  const backupTimestamp = "2026-09-27T12:00:00Z";
  const restoreTimestamp = "2026-09-27T12:05:00Z";
  const archivePath = join(backupRoot, "daily", `${backupId}.tar.gz`);
  mkdirSync(join(backupRoot, "daily"));
  const archive = Buffer.from("synthetic production backup bytes");
  writeFileSync(archivePath, archive);
  const backupSha256 = createHash("sha256").update(archive).digest("hex");
  writeFileSync(`${archivePath}.sha256`, `${backupSha256}  ${backupId}.tar.gz\n`);
  writeFileSync(join(backupRoot, "latest-success"), `${backupId}\n`);
  writeFileSync(join(backupRoot, "last-status"), `status=success\nbackup_id=${backupId}\ntimestamp=${backupTimestamp}\n`);
  writeFileSync(join(backupRoot, "last-restore-test"), `status=success\ntimestamp=${restoreTimestamp}\ndatabase_integrity=ok\nmigration=pass\napplication=pass\n`);

  return {
    backupRoot,
    now: Date.parse("2026-09-27T12:06:00Z"),
    input: {
      backupId,
      backupSha256,
      restoreVerificationRef: `${backupId}:restore:${restoreTimestamp}`,
    },
    archivePath,
  };
}

test("first-owner backup verification binds the current recent archive, checksum, and post-backup restore result", async (context) => {
  const verifyFirstOwnerBackupEvidence = await loadVerifier();
  const fixture = createBackupFixture(context);
  let managerVerifierCalls = 0;

  await verifyFirstOwnerBackupEvidence(fixture.input, {
    backupRoot: fixture.backupRoot,
    now: () => fixture.now,
    runManagerVerifier: () => { managerVerifierCalls += 1; },
  });

  assert.equal(managerVerifierCalls, 1);
});

test("first-owner backup verification rejects stale, mismatched, failed, and tampered evidence", async (context) => {
  const verifyFirstOwnerBackupEvidence = await loadVerifier();
  const fixture = createBackupFixture(context);
  const baseOptions = {
    backupRoot: fixture.backupRoot,
    now: () => fixture.now,
    runManagerVerifier: () => undefined,
  };

  await assert.rejects(verifyFirstOwnerBackupEvidence({ ...fixture.input, backupId: "natarot-production-20260926-120000" }, baseOptions), Error);
  await assert.rejects(verifyFirstOwnerBackupEvidence({ ...fixture.input, backupSha256: "b".repeat(64) }, baseOptions), Error);
  await assert.rejects(verifyFirstOwnerBackupEvidence({ ...fixture.input, restoreVerificationRef: "stale-restore-ref" }, baseOptions), Error);

  writeFileSync(join(fixture.backupRoot, "last-status"), "status=failed\n");
  await assert.rejects(verifyFirstOwnerBackupEvidence(fixture.input, baseOptions), Error);
});

test("first-owner backup verification rejects stale archives, missing restores, and archive checksum changes", async (context) => {
  const verifyFirstOwnerBackupEvidence = await loadVerifier();
  const fixture = createBackupFixture(context);
  const baseOptions = {
    backupRoot: fixture.backupRoot,
    now: () => fixture.now,
    runManagerVerifier: () => undefined,
  };

  writeFileSync(join(fixture.backupRoot, "last-status"), `status=success\nbackup_id=${fixture.input.backupId}\ntimestamp=2026-09-27T11:00:00Z\n`);
  await assert.rejects(verifyFirstOwnerBackupEvidence(fixture.input, baseOptions), /backup evidence/i);

  const fresh = createBackupFixture(context);
  writeFileSync(join(fresh.backupRoot, "last-restore-test"), `status=success\ntimestamp=2026-09-27T11:59:00Z\ndatabase_integrity=ok\nmigration=pass\napplication=pass\n`);
  await assert.rejects(verifyFirstOwnerBackupEvidence(fresh.input, { ...baseOptions, backupRoot: fresh.backupRoot, now: () => fresh.now }), /backup evidence/i);

  const tampered = createBackupFixture(context);
  writeFileSync(tampered.archivePath, "changed archive bytes");
  await assert.rejects(verifyFirstOwnerBackupEvidence(tampered.input, { ...baseOptions, backupRoot: tampered.backupRoot, now: () => tampered.now }), /backup evidence/i);
  assert.match(readFileSync(tampered.archivePath, "utf8"), /changed archive bytes/);
});

test("first-owner backup verification rechecks freshness after archive and release-manager verification", async (context) => {
  const verifyFirstOwnerBackupEvidence = await loadVerifier();
  const fixture = createBackupFixture(context);
  let now = fixture.now;
  let managerVerifierCalls = 0;

  await assert.rejects(verifyFirstOwnerBackupEvidence(fixture.input, {
    backupRoot: fixture.backupRoot,
    now: () => now,
    runManagerVerifier: () => {
      managerVerifierCalls += 1;
      now = Date.parse("2026-09-27T12:31:00Z");
    },
  }), /backup evidence/i);

  assert.equal(managerVerifierCalls, 1);
});
