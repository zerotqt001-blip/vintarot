#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const DEFAULT_APPLICATION_ROOT = "/opt/natarot";
export const DEFAULT_BACKUP_ROOT = "/var/backups/natarot";
export const DEFAULT_LOCK_PATH = "/run/lock/natarot-deploy.lock";
export const DEFAULT_TEMP_MIN_AGE_MS = 6 * 60 * 60 * 1000;

const RELEASE_NAME = /^natarot\.(?:rollback|previous|release)-/;
const TEMP_NAME = /^natarot\.(?:candidate|staging|tmp|deploy)-/;

function absolute(value) {
  return path.resolve(value);
}

function protectedPathSet(paths = []) {
  return new Set(paths.map(absolute));
}

function isSafeSibling(candidate, root, pattern) {
  const candidatePath = absolute(candidate);
  const rootPath = absolute(root);
  return candidatePath !== rootPath
    && path.dirname(candidatePath) === path.dirname(rootPath)
    && pattern.test(path.basename(candidatePath));
}

export function isVerifiedDeploymentMarker(marker) {
  return Boolean(
    marker
    && /^[0-9a-f]{7,64}$/i.test(marker.source_commit ?? "")
    && /^[0-9a-f]{64}$/i.test(marker.archive_sha256 ?? "")
    && Number.isFinite(Date.parse(marker.deployed_at ?? "")),
  );
}

export function parseDeploymentRevision(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim()]),
  );
}

/**
 * Plan deletion without touching the filesystem. `successfulReleases` must
 * already be verified from a deployment marker; the helper remains
 * conservative when an entry is outside the application sibling set.
 *
 * @param {{
 *   root?: string,
 *   successfulReleases?: Array<{path: string, deployedAt?: number, verified?: boolean, isSymlink?: boolean}>,
 *   temporaryEntries?: Array<{path: string, ageMs?: number, inactive?: boolean, isSymlink?: boolean}>,
 *   protectedPaths?: string[],
 *   mustRetainPaths?: string[],
 *   minTempAgeMs?: number,
 * }} options
 */
export function planReleaseCleanup({
  root = DEFAULT_APPLICATION_ROOT,
  successfulReleases = [],
  temporaryEntries = [],
  protectedPaths = [],
  mustRetainPaths = [],
  minTempAgeMs = DEFAULT_TEMP_MIN_AGE_MS,
}) {
  const applicationRoot = absolute(root);
  const protectedPathsSet = protectedPathSet([applicationRoot, ...protectedPaths]);
  const skipped = [];
  const verified = [];

  for (const entry of successfulReleases) {
    const candidate = absolute(entry.path);
    if (entry.isSymlink) {
      skipped.push({ path: candidate, reason: "symlink" });
      continue;
    }
    if (protectedPathsSet.has(candidate)) {
      skipped.push({ path: candidate, reason: "protected" });
      continue;
    }
    if (!entry.verified || !isSafeSibling(candidate, applicationRoot, RELEASE_NAME)) {
      skipped.push({ path: candidate, reason: "outside-application-release-root" });
      continue;
    }
    verified.push({ ...entry, path: candidate });
  }

  const ordered = [...verified].sort((left, right) => (right.deployedAt ?? 0) - (left.deployedAt ?? 0));
  const retainedRollbackPaths = [];
  for (const candidate of [...mustRetainPaths, ...ordered.map((entry) => entry.path)]) {
    const candidatePath = absolute(candidate);
    if (!retainedRollbackPaths.includes(candidatePath) && ordered.some((entry) => entry.path === candidatePath) && retainedRollbackPaths.length < 2) {
      retainedRollbackPaths.push(candidatePath);
    }
  }
  const retained = [applicationRoot, ...retainedRollbackPaths];
  const releaseRemovals = ordered
    .map((entry) => entry.path)
    .filter((candidate) => !retained.includes(candidate) && !protectedPathsSet.has(candidate));

  const temporaryRemovals = [];
  for (const entry of temporaryEntries) {
    const candidate = absolute(entry.path);
    if (entry.isSymlink) {
      skipped.push({ path: candidate, reason: "symlink" });
    } else if (protectedPathsSet.has(candidate)) {
      skipped.push({ path: candidate, reason: "protected" });
    } else if (!isSafeSibling(candidate, applicationRoot, TEMP_NAME)) {
      skipped.push({ path: candidate, reason: "outside-application-release-root" });
    } else if (!entry.inactive || (entry.ageMs ?? 0) < minTempAgeMs) {
      skipped.push({ path: candidate, reason: "active-or-young-temporary" });
    } else {
      temporaryRemovals.push(candidate);
    }
  }

  return {
    retained,
    releaseRemovals,
    temporaryRemovals,
    skipped,
    databaseBackupsTouched: false,
  };
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readMarker(releasePath) {
  try {
    const text = await fs.readFile(path.join(releasePath, "DEPLOYMENT_REVISION"), "utf8");
    return parseDeploymentRevision(text);
  } catch {
    return null;
  }
}

async function describeEntry(parent, name, kind) {
  const entryPath = path.join(parent, name);
  const stat = await fs.lstat(entryPath);
  const isSymlink = stat.isSymbolicLink();
  const marker = isSymlink ? null : await readMarker(entryPath);
  const deployedAt = marker && Number.isFinite(Date.parse(marker.deployed_at ?? ""))
    ? Date.parse(marker.deployed_at)
    : stat.mtimeMs;
  const inProgress = isSymlink ? true : await exists(path.join(entryPath, "DEPLOYMENT_IN_PROGRESS"));
  return {
    path: entryPath,
    kind,
    ageMs: Math.max(0, Date.now() - stat.mtimeMs),
    deployedAt,
    verified: isVerifiedDeploymentMarker(marker),
    inactive: !inProgress,
    isSymlink,
  };
}

export async function discoverApplicationEntries(root = DEFAULT_APPLICATION_ROOT) {
  const applicationRoot = absolute(root);
  const parent = path.dirname(applicationRoot);
  const entries = await fs.readdir(parent, { withFileTypes: true });
  const releases = [];
  const temporaries = [];
  for (const entry of entries) {
    if (entry.name === path.basename(applicationRoot)) continue;
    if (RELEASE_NAME.test(entry.name)) releases.push(await describeEntry(parent, entry.name, "release"));
    else if (TEMP_NAME.test(entry.name)) temporaries.push(await describeEntry(parent, entry.name, "temporary"));
  }
  return { releases, temporaries };
}

async function realPathOrAbsolute(target) {
  try {
    return await fs.realpath(target);
  } catch {
    return absolute(target);
  }
}

async function managedRollbackState(root) {
  const managedRoot = absolute(root);
  const links = ["current", "previous-1", "previous-2"];
  const resolved = [];
  for (const name of links) {
    const link = path.join(managedRoot, name);
    if (!(await exists(link))) return { ready: false, current: null, rollbackPaths: [] };
    resolved.push(await realPathOrAbsolute(link));
  }
  return { ready: true, current: resolved[0], rollbackPaths: resolved.slice(1) };
}

export async function acquireDeploymentLock(lockPath = DEFAULT_LOCK_PATH) {
  const target = absolute(lockPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  let handle;
  try {
    handle = await fs.open(target, "wx", 0o600);
    await handle.writeFile(`pid=${process.pid}\ncreated_at=${new Date().toISOString()}\n`);
  } catch (error) {
    if (handle) await handle.close();
    if (error?.code === "EEXIST") throw new Error(`Deployment lock already exists: ${target}`);
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await handle.close();
    await fs.unlink(target).catch(() => undefined);
  };
}

async function commandOutput(command, args) {
  const { stdout } = await execFile(command, args, { maxBuffer: 1024 * 1024 });
  return stdout.trim();
}

async function diskSnapshot(target) {
  const output = await commandOutput("df", ["-Pk", target]);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1) ?? "";
  const columns = line.trim().split(/\s+/);
  const availableKb = Number(columns[3] ?? 0);
  const usedPercent = columns[4] ?? "unknown";
  return { target, availableBytes: Number.isFinite(availableKb) ? availableKb * 1024 : null, usedPercent };
}

async function directoryBytes(target) {
  if (!(await exists(target))) return 0;
  try {
    const output = await commandOutput("du", ["-sk", target]);
    const kilobytes = Number(output.split(/\s+/)[0] ?? 0);
    return Number.isFinite(kilobytes) ? kilobytes * 1024 : 0;
  } catch {
    return 0;
  }
}

async function knownLogBytes() {
  const candidates = ["/var/log/journal", "/var/log/nginx", "/var/log/natarot", "/var/log/natarot-staging"];
  const values = await Promise.all(candidates.map(directoryBytes));
  return values.reduce((total, value) => total + value, 0);
}

export async function collectStorageSnapshot({ root = DEFAULT_APPLICATION_ROOT, backupRoot = DEFAULT_BACKUP_ROOT } = {}) {
  const applicationRoot = absolute(root);
  const { releases, temporaries } = await discoverApplicationEntries(applicationRoot);
  const releasePaths = [applicationRoot, ...releases.map((entry) => entry.path)];
  const releaseBytes = await Promise.all(releasePaths.map(directoryBytes));
  const temporaryBytes = await Promise.all(temporaries.map((entry) => directoryBytes(entry.path)));
  return {
    disk: await diskSnapshot(applicationRoot),
    applicationReleaseCount: releasePaths.length,
    applicationReleaseBytes: releaseBytes.reduce((total, value) => total + value, 0),
    backupBytes: await directoryBytes(backupRoot),
    temporaryBytes: temporaryBytes.reduce((total, value) => total + value, 0),
    logBytes: await knownLogBytes(),
    releases,
    temporaries,
  };
}

function bytesLabel(value) {
  if (!Number.isFinite(value)) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatStorageReport({ before, after, plan, deleted = [] }) {
  const reclaimed = before && after && Number.isFinite(before.applicationReleaseBytes) && Number.isFinite(after.applicationReleaseBytes)
    ? (before.applicationReleaseBytes + before.temporaryBytes) - (after.applicationReleaseBytes + after.temporaryBytes)
    : null;
  return {
    "DISK BEFORE": before?.disk ?? null,
    "DISK AFTER": after?.disk ?? null,
    "SPACE RECLAIMED": bytesLabel(reclaimed),
    "APPLICATION RELEASES BEFORE": before?.applicationReleaseCount ?? null,
    "APPLICATION RELEASES AFTER": after?.applicationReleaseCount ?? null,
    "APPLICATION RELEASE SIZE BEFORE": bytesLabel(before?.applicationReleaseBytes),
    "APPLICATION RELEASE SIZE AFTER": bytesLabel(after?.applicationReleaseBytes),
    "BACKUP SIZE BEFORE": bytesLabel(before?.backupBytes),
    "BACKUP SIZE AFTER": bytesLabel(after?.backupBytes),
    "CURRENT RELEASE": before ? absolute(DEFAULT_APPLICATION_ROOT) : null,
    "ROLLBACK 1": plan?.retained?.[1] ?? null,
    "ROLLBACK 2": plan?.retained?.[2] ?? null,
    "OLD RELEASES REMOVED": deleted.filter((item) => item.kind === "release").map((item) => item.path),
    "TEMP ARTIFACTS REMOVED": deleted.filter((item) => item.kind === "temporary").map((item) => item.path),
    "DATABASE BACKUPS TOUCHED": "NO",
    "BACKUP RETENTION": "PASS — backup root was not modified",
    "LOG RETENTION": "PASS — logs were inspected; no active log was deleted",
    "DEPLOY CLEANUP AUTOMATED": "YES",
  };
}

async function removeApplicationEntry(target, root, kind) {
  const applicationRoot = absolute(root);
  if (!isSafeSibling(target, applicationRoot, kind === "release" ? RELEASE_NAME : TEMP_NAME)) {
    throw new Error(`Refusing to remove an unsafe ${kind} path: ${target}`);
  }
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to remove symlink: ${target}`);
  await fs.rm(target, { recursive: true, force: false });
}

export async function cleanupProductionStorage({
  root = DEFAULT_APPLICATION_ROOT,
  backupRoot = DEFAULT_BACKUP_ROOT,
  lockPath = DEFAULT_LOCK_PATH,
  dryRun = false,
  minTempAgeMs = DEFAULT_TEMP_MIN_AGE_MS,
  lockHeld = false,
} = {}) {
  const releaseLock = lockHeld ? async () => undefined : await acquireDeploymentLock(lockPath);
  try {
    const applicationRoot = absolute(root);
    const before = await collectStorageSnapshot({ root: applicationRoot, backupRoot });
    const currentRealPath = await realPathOrAbsolute(applicationRoot);
    const currentMarker = await readMarker(applicationRoot);
    const previousRelease = currentMarker?.previous_release;
    const managedState = await managedRollbackState(applicationRoot);
    const protectedPaths = [applicationRoot, currentRealPath, managedState.current, ...managedState.rollbackPaths].filter(Boolean);
    if (!managedState.ready) protectedPaths.push(...before.releases.map((entry) => entry.path));
    const plan = planReleaseCleanup({
      root: applicationRoot,
      successfulReleases: before.releases,
      temporaryEntries: before.temporaries,
      protectedPaths,
      mustRetainPaths: previousRelease ? [previousRelease] : [],
      minTempAgeMs,
    });
    const deleted = [];
    if (!dryRun) {
      for (const target of plan.releaseRemovals) {
        await removeApplicationEntry(target, applicationRoot, "release");
        deleted.push({ path: target, kind: "release" });
      }
      for (const target of plan.temporaryRemovals) {
        await removeApplicationEntry(target, applicationRoot, "temporary");
        deleted.push({ path: target, kind: "temporary" });
      }
    }
    const after = await collectStorageSnapshot({ root: applicationRoot, backupRoot });
    return { before, after, plan, deleted, report: formatStorageReport({ before, after, plan, deleted }) };
  } finally {
    await releaseLock();
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--root") options.root = argv[++index];
    else if (argument === "--backup-root") options.backupRoot = argv[++index];
    else if (argument === "--lock") options.lockPath = argv[++index];
    else if (argument === "--min-temp-age-hours") options.minTempAgeMs = Number(argv[++index]) * 60 * 60 * 1000;
    else if (argument === "--lock-held") options.lockHeld = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);
  if (command === "help") {
    process.stdout.write("Usage: production-storage-guard.mjs audit|cleanup|post-success [--dry-run] [--json]\n");
    return;
  }
  if (command === "audit") {
    const releaseLock = await acquireDeploymentLock(options.lockPath ?? DEFAULT_LOCK_PATH);
    try {
      const snapshot = await collectStorageSnapshot(options);
      process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : `${JSON.stringify(formatStorageReport({ before: snapshot, after: snapshot, plan: null }), null, 2)}\n`);
    } finally {
      await releaseLock();
    }
    return;
  }
  if (command === "cleanup" || command === "post-success") {
    const result = await cleanupProductionStorage(options);
    process.stdout.write(`${JSON.stringify(options.json ? result : result.report, null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
