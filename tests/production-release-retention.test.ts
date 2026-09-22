import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  cleanupTemporaryArtifacts,
  parseDfKilobytes,
  parseRevisionMarker,
  pruneApplicationReleases,
} from "../scripts/production-release-retention.mjs";

async function makeDirectory(root: string, name: string, marker?: string) {
  const directory = path.join(root, name);
  await mkdir(directory, { recursive: true });
  if (marker) await writeFile(path.join(directory, "DEPLOYMENT_REVISION"), marker);
  return directory;
}

function revision(commit: string, deployedAt: string) {
  return ["source_commit=", commit, "\ndeployed_at=", deployedAt, "\n"].join("");
}

test("parses disk metadata and release markers without treating unknown releases as successful", () => {
  assert.deepEqual(parseDfKilobytes("Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 1000 900 100 90% /\n"), {
    totalKb: 1000,
    usedKb: 900,
    availableKb: 100,
    usedPercent: 90,
  });
  assert.deepEqual(parseRevisionMarker("source_commit=abc\ndeployed_at=2026-09-23T00:00:00Z\n"), {
    source_commit: "abc",
    deployed_at: "2026-09-23T00:00:00Z",
    deployedAt: "2026-09-23T00:00:00Z",
    successful: true,
  });
  assert.equal(parseRevisionMarker("source_commit=abc\n").successful, false);
  assert.equal(parseRevisionMarker("release_id=managed-current\n").successful, true);
});

test("retains current plus two newest successful rollback releases and never prunes backups or unknown directories", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "natarot-retention-"));
  const active = path.join(root, "natarot");
  const backupRoot = path.join(root, "backups");
  await mkdir(active, { recursive: true });
  await mkdir(backupRoot, { recursive: true });
  await writeFile(path.join(backupRoot, "database-backup.tar.gz"), "backup");
  await makeDirectory(root, "natarot.rollback-newest", revision("newest", "2026-09-22T00:00:00Z"));
  await makeDirectory(root, "natarot.rollback-second", revision("second", "2026-09-21T00:00:00Z"));
  await makeDirectory(root, "natarot.rollback-old", revision("old", "2026-09-20T00:00:00Z"));
  await makeDirectory(root, "natarot.rollback-unknown");

  const dryRun = await pruneApplicationReleases({ root, activePath: active, backupRoot, execute: false });
  assert.equal(dryRun.status, "pass");
  assert.deepEqual(dryRun.selection.protectedReleases.map((release: { name: string }) => release.name), [
    "natarot.rollback-newest",
    "natarot.rollback-second",
  ]);
  assert.deepEqual(dryRun.selection.obsoleteReleases.map((release: { name: string }) => release.name), ["natarot.rollback-old"]);
  assert.deepEqual(dryRun.deleted, []);

  const result = await pruneApplicationReleases({ root, activePath: active, backupRoot, execute: true });
  assert.equal(result.status, "pass");
  assert.deepEqual(result.deleted, ["natarot.rollback-old"]);
  await assert.rejects(() => readFile(path.join(root, "natarot.rollback-old")));
  await readFile(path.join(root, "natarot.rollback-newest", "DEPLOYMENT_REVISION"));
  await readFile(path.join(root, "natarot.rollback-second", "DEPLOYMENT_REVISION"));
  await stat(path.join(root, "natarot.rollback-unknown"));
  await readFile(path.join(backupRoot, "database-backup.tar.gz"));
  await rm(root, { recursive: true, force: true });
});

test("cleans only marked stale deployment candidates and exact temp archives", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "natarot-temp-"));
  const active = path.join(root, "natarot");
  const tempRoot = path.join(root, "tmp");
  await mkdir(active, { recursive: true });
  await mkdir(tempRoot, { recursive: true });
  const stale = await makeDirectory(root, "natarot.candidate-stale");
  await writeFile(path.join(stale, "DEPLOYMENT_CANDIDATE"), "managed_by=natarot-production-deploy\n");
  const unknown = await makeDirectory(root, "natarot.candidate-unknown");
  const staging = await makeDirectory(root, "natarot-staging", "managed_by=natarot-production-deploy\n");
  const archive = path.join(tempRoot, "natarot-release-old.tar.gz");
  await writeFile(archive, "temporary archive");
  const oldDate = new Date(Date.now() - 60 * 60 * 1000);
  await utimes(stale, oldDate, oldDate);
  await utimes(archive, oldDate, oldDate);

  const result = await cleanupTemporaryArtifacts({ root, activePath: active, tempRoot, minAgeMs: 15 * 60 * 1000, execute: true });
  assert.equal(result.status, "pass");
  assert.deepEqual(result.removed.sort(), [archive, stale].sort());
  await assert.rejects(() => readFile(archive));
  await assert.rejects(() => stat(stale));
  await assert.rejects(() => stat(path.join(unknown, "DEPLOYMENT_CANDIDATE")));
  await stat(staging);
  await rm(root, { recursive: true, force: true });
});

test("understands the managed current/previous release topology", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "natarot-managed-"));
  const releaseRoot = path.join(root, "releases");
  const active = path.join(root, "current");
  await mkdir(releaseRoot, { recursive: true });
  const current = await makeDirectory(releaseRoot, "base-20260923T000000Z", "release_id=base-20260923T000000Z\n");
  await makeDirectory(releaseRoot, "legacy-first", revision("first", "2026-09-22T00:00:00Z"));
  await makeDirectory(releaseRoot, "legacy-second", revision("second", "2026-09-21T00:00:00Z"));
  await makeDirectory(releaseRoot, "obsolete-older", revision("older", "2026-09-20T00:00:00Z"));
  await symlink(current, active);

  const result = await pruneApplicationReleases({ root: releaseRoot, activePath: active, backupRoot: path.join(root, "backups"), execute: true });
  assert.equal(result.status, "pass");
  assert.equal(result.before.releaseCount, 4);
  assert.equal(result.after.releaseCount, 3);
  assert.deepEqual(result.selection.protectedReleases.map((release: { name: string }) => release.name), ["legacy-first", "legacy-second"]);
  assert.deepEqual(result.deleted, ["obsolete-older"]);
  assert.ok((result.before.activeSizeKb ?? 0) > 0);
  await stat(active);
  await stat(path.join(releaseRoot, "base-20260923T000000Z", "DEPLOYMENT_REVISION"));
  await rm(root, { recursive: true, force: true });
});

test("retention script contracts use one flock lock and do not contain broad deletion patterns", async () => {
  const [lockScript, retentionScript] = await Promise.all([
    readFile(path.join(process.cwd(), "scripts/production-deploy-lock.sh"), "utf8"),
    readFile(path.join(process.cwd(), "scripts/production-release-retention.sh"), "utf8"),
  ]);
  assert.match(lockScript, /flock -n 9/);
  assert.match(retentionScript, /run\/lock\/natarot-deploy\.lock/);
  assert.match(retentionScript, /--cleanup-temp/);
  assert.doesNotMatch(retentionScript, /rm\s+-rf\s+[^-]/);
});
