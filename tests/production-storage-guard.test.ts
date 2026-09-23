import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BACKUP_ROOT, DEFAULT_LOCK_PATH, planReleaseCleanup } from "../scripts/production-storage-guard.mjs";

test("storage guard retains the current release and the two newest verified rollbacks", () => {
  const plan = planReleaseCleanup({
    root: "/opt/natarot",
    successfulReleases: [
      { path: "/opt/natarot.rollback-newest", deployedAt: 30_000, verified: true, isSymlink: false },
      { path: "/opt/natarot.rollback-previous", deployedAt: 20_000, verified: true, isSymlink: false },
      { path: "/opt/natarot.previous-old", deployedAt: 10_000, verified: true, isSymlink: false },
    ],
    temporaryEntries: [],
  });

  assert.deepEqual(plan.retained, [
    "/opt/natarot",
    "/opt/natarot.rollback-newest",
    "/opt/natarot.rollback-previous",
  ]);
  assert.deepEqual(plan.releaseRemovals, ["/opt/natarot.previous-old"]);
  assert.equal(plan.databaseBackupsTouched, false);
});

test("storage guard leaves unsafe, protected, and young temporary paths alone", () => {
  const plan = planReleaseCleanup({
    root: "/opt/natarot",
    successfulReleases: [
      { path: "/opt/natarot.rollback-old", deployedAt: 1, verified: true, isSymlink: true },
      { path: "/var/lib/natarot.sqlite", deployedAt: 1, verified: true, isSymlink: false },
    ],
    temporaryEntries: [
      { path: "/opt/natarot.candidate-active", ageMs: 60_000, inactive: false, isSymlink: false },
      { path: "/opt/natarot.tmp-old", ageMs: 8 * 60 * 60 * 1000, inactive: true, isSymlink: false },
      { path: "/var/backups/natarot/archive.sqlite", ageMs: 8 * 60 * 60 * 1000, inactive: true, isSymlink: false },
    ],
    protectedPaths: ["/opt/natarot.rollback-old", "/var/lib/natarot.sqlite", "/var/backups/natarot/archive.sqlite"],
  });

  assert.deepEqual(plan.releaseRemovals, []);
  assert.deepEqual(plan.temporaryRemovals, ["/opt/natarot.tmp-old"]);
  assert.deepEqual(plan.skipped, [
    { path: "/opt/natarot.rollback-old", reason: "symlink" },
    { path: "/var/lib/natarot.sqlite", reason: "protected" },
    { path: "/opt/natarot.candidate-active", reason: "active-or-young-temporary" },
    { path: "/var/backups/natarot/archive.sqlite", reason: "protected" },
  ]);
});

test("storage guard keeps its lock and backup locations explicit", () => {
  assert.equal(DEFAULT_LOCK_PATH, "/run/lock/natarot-deploy.lock");
  assert.equal(DEFAULT_BACKUP_ROOT, "/var/backups/natarot");
});
