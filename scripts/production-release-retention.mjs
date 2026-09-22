import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_RELEASE_ROOT = "/opt";
export const DEFAULT_ACTIVE_RELEASE = "/opt/natarot";
export const DEFAULT_BACKUP_ROOT = "/var/backups/natarot";
export const DEFAULT_TEMP_ROOT = "/tmp";
export const DEFAULT_RETAINED_ROLLBACKS = 2;

const RELEASE_DIRECTORY_PATTERN = /^natarot\.(?:rollback|previous)-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CANDIDATE_DIRECTORY_PATTERN = /^natarot\.(?:candidate|deploy|extract)-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TEMP_ARCHIVE_PATTERN = /^natarot-release-[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz$/;

function parseKeyValueText(value) {
  return Object.fromEntries(
    String(value)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : [line, ""];
      }),
  );
}

export function parseRevisionMarker(value) {
  const marker = parseKeyValueText(value);
  const deployedAt = marker.deployed_at && Number.isFinite(Date.parse(marker.deployed_at))
    ? marker.deployed_at
    : null;
  return {
    ...marker,
    deployedAt,
    successful: Boolean(marker.source_commit && deployedAt),
  };
}

function dateValue(record) {
  const timestamp = record.marker?.deployedAt ? Date.parse(record.marker.deployedAt) : 0;
  return Number.isFinite(timestamp) ? timestamp : record.mtimeMs;
}

function isDirectChild(rootPath, candidatePath) {
  return path.dirname(path.resolve(candidatePath)) === path.resolve(rootPath);
}

function isInside(rootPath, candidatePath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function runDuKilobytes(targetPath) {
  try {
    const output = execFileSync("du", ["-sk", targetPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const kilobytes = Number.parseInt(output.trim().split(/\s+/)[0], 10);
    return Number.isFinite(kilobytes) ? kilobytes : null;
  } catch {
    return null;
  }
}

export function parseDfKilobytes(value) {
  const lines = String(value).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const fields = lines.at(-1).trim().split(/\s+/);
  if (fields.length < 5) return null;
  const totalKb = Number.parseInt(fields[1], 10);
  const usedKb = Number.parseInt(fields[2], 10);
  const availableKb = Number.parseInt(fields[3], 10);
  const usedPercent = Number.parseInt(fields[4].replace("%", ""), 10);
  if (![totalKb, usedKb, availableKb, usedPercent].every(Number.isFinite)) return null;
  return { totalKb, usedKb, availableKb, usedPercent };
}

export function readDiskSnapshot(targetPath) {
  try {
    const output = execFileSync("df", ["-Pk", targetPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return parseDfKilobytes(output);
  } catch {
    return null;
  }
}

async function readMarker(directoryPath) {
  try {
    return parseRevisionMarker(await readFile(path.join(directoryPath, "DEPLOYMENT_REVISION"), "utf8"));
  } catch {
    return { deployedAt: null, successful: false };
  }
}

async function inspectReleaseDirectory(rootPath, entryName, { includeSize = true } = {}) {
  const directoryPath = path.join(rootPath, entryName);
  const entryStat = await lstat(directoryPath);
  if (!entryStat.isDirectory() || entryStat.isSymbolicLink()) return null;
  const directoryRealPath = await realpath(directoryPath);
  const marker = await readMarker(directoryPath);
  return {
    name: entryName,
    path: directoryPath,
    realPath: directoryRealPath,
    mtimeMs: entryStat.mtimeMs,
    sizeKb: includeSize ? runDuKilobytes(directoryPath) : null,
    marker,
    successful: marker.successful,
  };
}

export async function inspectReleaseInventory({
  root = DEFAULT_RELEASE_ROOT,
  activePath = DEFAULT_ACTIVE_RELEASE,
  includeSize = true,
} = {}) {
  const rootPath = path.resolve(root);
  const rootRealPath = await realpath(rootPath).catch(() => rootPath);
  const activeRealPath = await realpath(activePath).catch(() => null);
  const entries = await readdir(rootPath, { withFileTypes: true });
  const releases = [];
  for (const entry of entries) {
    if (!RELEASE_DIRECTORY_PATTERN.test(entry.name)) continue;
    const record = await inspectReleaseDirectory(rootPath, entry.name, { includeSize }).catch(() => null);
    if (!record) continue;
    record.isActive = record.realPath === activeRealPath;
    releases.push(record);
  }
  return {
    root: rootPath,
    rootRealPath,
    activePath: path.resolve(activePath),
    activeRealPath,
    releases: releases.sort((left, right) => dateValue(right) - dateValue(left) || right.name.localeCompare(left.name)),
  };
}

export async function inspectStorage({
  root = DEFAULT_RELEASE_ROOT,
  activePath = DEFAULT_ACTIVE_RELEASE,
  backupRoot = DEFAULT_BACKUP_ROOT,
  includeSize = true,
} = {}) {
  const inventory = await inspectReleaseInventory({ root, activePath, includeSize });
  const activeSizeKb = includeSize ? runDuKilobytes(activePath) : null;
  const backupSizeKb = includeSize ? runDuKilobytes(backupRoot) : null;
  return {
    disk: readDiskSnapshot(root),
    releaseCount: 1 + inventory.releases.length,
    applicationReleaseSizeKb: [activeSizeKb, ...inventory.releases.map((release) => release.sizeKb)]
      .filter((value) => Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0),
    backupSizeKb,
    activeSizeKb,
    inventory,
  };
}

export function selectReleaseRetention(inventory, retainPrevious = DEFAULT_RETAINED_ROLLBACKS) {
  const successful = inventory.releases
    .filter((release) => release.successful && !release.isActive)
    .sort((left, right) => dateValue(right) - dateValue(left) || right.name.localeCompare(left.name));
  const protectedReleases = successful.slice(0, retainPrevious);
  const obsoleteReleases = successful.slice(retainPrevious);
  const unknownReleases = inventory.releases.filter((release) => !release.successful || release.isActive);
  return { successful, protectedReleases, obsoleteReleases, unknownReleases };
}

async function revalidateRelease(record, inventory) {
  if (!isDirectChild(inventory.root, record.path)) return false;
  if (record.isActive || record.realPath === inventory.activeRealPath) return false;
  const currentStat = await lstat(record.path).catch(() => null);
  if (!currentStat?.isDirectory() || currentStat.isSymbolicLink()) return false;
  const currentRealPath = await realpath(record.path).catch(() => null);
  if (!currentRealPath || !isInside(inventory.rootRealPath || inventory.root, currentRealPath) || currentRealPath !== record.realPath) return false;
  const currentMarker = await readMarker(record.path);
  return currentMarker.successful
    && currentMarker.source_commit === record.marker.source_commit
    && currentMarker.deployedAt === record.marker.deployedAt;
}

export async function pruneApplicationReleases({
  root = DEFAULT_RELEASE_ROOT,
  activePath = DEFAULT_ACTIVE_RELEASE,
  backupRoot = DEFAULT_BACKUP_ROOT,
  retainPrevious = DEFAULT_RETAINED_ROLLBACKS,
  execute = false,
} = {}) {
  const before = await inspectStorage({ root, activePath, backupRoot, includeSize: true });
  const selection = selectReleaseRetention(before.inventory, retainPrevious);
  const deleted = [];
  const skipped = [];

  if (execute && selection.successful.length < retainPrevious) {
    return {
      status: "blocked",
      reason: "only " + selection.successful.length + " successful rollback releases found; refusing to reduce rollback capacity",
      before,
      after: before,
      selection,
      deleted,
      skipped,
    };
  }

  if (execute) {
    for (const record of selection.obsoleteReleases) {
      if (!(await revalidateRelease(record, before.inventory))) {
        skipped.push({ name: record.name, reason: "revalidation_failed" });
        continue;
      }
      await rm(record.path, { recursive: true, force: false });
      deleted.push(record.name);
    }
  }

  const after = execute
    ? await inspectStorage({ root, activePath, backupRoot, includeSize: true })
    : before;
  return {
    status: "pass",
    before,
    after,
    selection,
    deleted,
    skipped,
  };
}

async function candidateMarkerIsManaged(directoryPath) {
  try {
    const marker = parseKeyValueText(await readFile(path.join(directoryPath, "DEPLOYMENT_CANDIDATE"), "utf8"));
    return marker.managed_by === "natarot-production-deploy";
  } catch {
    return false;
  }
}

export async function cleanupTemporaryArtifacts({
  root = DEFAULT_RELEASE_ROOT,
  activePath = DEFAULT_ACTIVE_RELEASE,
  tempRoot = DEFAULT_TEMP_ROOT,
  minAgeMs = 15 * 60 * 1000,
  execute = false,
} = {}) {
  const now = Date.now();
  const rootPath = path.resolve(root);
  const rootRealPath = await realpath(rootPath).catch(() => rootPath);
  const activeRealPath = await realpath(activePath).catch(() => null);
  const removed = [];
  const planned = [];
  const skipped = [];
  const rootEntries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
  for (const entry of rootEntries) {
    if (!CANDIDATE_DIRECTORY_PATTERN.test(entry.name)) continue;
    const candidatePath = path.join(rootPath, entry.name);
    const candidateStat = await lstat(candidatePath).catch(() => null);
    if (!candidateStat?.isDirectory() || candidateStat.isSymbolicLink()) {
      skipped.push({ path: candidatePath, reason: "not_a_real_directory" });
      continue;
    }
    const candidateRealPath = await realpath(candidatePath).catch(() => null);
    if (!candidateRealPath || candidateRealPath === activeRealPath || !isInside(rootRealPath, candidateRealPath)) {
      skipped.push({ path: candidatePath, reason: "protected_or_outside_root" });
      continue;
    }
    if (!(await candidateMarkerIsManaged(candidatePath))) {
      skipped.push({ path: candidatePath, reason: "missing_management_marker" });
      continue;
    }
    if (now - candidateStat.mtimeMs < minAgeMs) {
      skipped.push({ path: candidatePath, reason: "too_new" });
      continue;
    }
    if (execute) {
      await rm(candidatePath, { recursive: true, force: false });
      removed.push(candidatePath);
    } else {
      planned.push(candidatePath);
    }
  }

  const tempEntries = await readdir(path.resolve(tempRoot), { withFileTypes: true }).catch(() => []);
  for (const entry of tempEntries) {
    if (!TEMP_ARCHIVE_PATTERN.test(entry.name)) continue;
    const archivePath = path.join(path.resolve(tempRoot), entry.name);
    const archiveStat = await lstat(archivePath).catch(() => null);
    if (!archiveStat?.isFile() || archiveStat.isSymbolicLink()) {
      skipped.push({ path: archivePath, reason: "not_a_regular_file" });
      continue;
    }
    if (now - archiveStat.mtimeMs < minAgeMs) {
      skipped.push({ path: archivePath, reason: "too_new" });
      continue;
    }
    if (execute) {
      await rm(archivePath, { force: false });
      removed.push(archivePath);
    } else {
      planned.push(archivePath);
    }
  }

  return { status: "pass", removed, planned, skipped };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_RELEASE_ROOT,
    activePath: DEFAULT_ACTIVE_RELEASE,
    backupRoot: DEFAULT_BACKUP_ROOT,
    tempRoot: DEFAULT_TEMP_ROOT,
    retainPrevious: DEFAULT_RETAINED_ROLLBACKS,
    execute: false,
    cleanupTemp: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--cleanup-temp") options.cleanupTemp = true;
    else if (argument === "--root") { options.root = next; index += 1; }
    else if (argument === "--active") { options.activePath = next; index += 1; }
    else if (argument === "--backup-root") { options.backupRoot = next; index += 1; }
    else if (argument === "--temp-root") { options.tempRoot = next; index += 1; }
    else if (argument === "--retain-previous") { options.retainPrevious = Number.parseInt(next, 10); index += 1; }
    else throw new Error("unknown argument: " + argument);
  }
  if (!Number.isInteger(options.retainPrevious) || options.retainPrevious < 2) {
    throw new Error("--retain-previous must be an integer >= 2");
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await pruneApplicationReleases(options);
  const tempResult = options.cleanupTemp
    ? await cleanupTemporaryArtifacts({ ...options, execute: options.execute })
    : { status: "not_requested", removed: [], planned: [], skipped: [] };
  const tempPass = tempResult.status === "pass" || tempResult.status === "not_requested";
  const report = {
    storageGuard: result.status === "pass" && tempPass ? "PASS" : "FAIL",
    diskBefore: result.before.disk,
    diskAfter: result.after.disk,
    applicationReleasesBefore: result.before.releaseCount,
    applicationReleasesAfter: result.after.releaseCount,
    applicationReleaseSizeBeforeKb: result.before.applicationReleaseSizeKb,
    applicationReleaseSizeAfterKb: result.after.applicationReleaseSizeKb,
    backupSizeKb: result.after.backupSizeKb,
    protectedRollbacks: result.selection.protectedReleases.map((release) => release.name),
    oldReleasesRemoved: result.deleted,
    temporaryArtifactsRemoved: tempResult.removed,
    temporaryArtifactsPlanned: tempResult.planned || [],
    databaseBackupsTouched: "NO",
    backupRetention: "NOT_TOUCHED",
    logRetention: "NOT_TOUCHED",
    cleanupAutomated: "YES",
    execute: options.execute,
    result,
    tempResult,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (result.status !== "pass" || !tempPass) process.exitCode = 75;
  return report;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 70;
  });
}
