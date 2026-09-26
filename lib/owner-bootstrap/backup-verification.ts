import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { FirstOwnerProvisionInput } from "./provision";

export const FIRST_OWNER_BACKUP_ROOT = "/var/backups/natarot";
export const FIRST_OWNER_RELEASE_MANAGER = "/usr/local/sbin/natarot-release-manager";

const MAX_BACKUP_AGE_MS = 30 * 60 * 1000;
export const FIRST_OWNER_FINAL_BACKUP_MAX_AGE_MS = 25 * 60 * 1000;
const MAX_RESTORE_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function invalidBackupEvidence(): Error {
  return new Error("First-owner backup evidence validation failed.");
}

function readRegularFile(path: string, maxBytes = 16 * 1024): string {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) throw invalidBackupEvidence();
  return readFileSync(path, "utf8");
}

function parseKeyValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) throw invalidBackupEvidence();
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1).trim();
    if (!/^[a-z][a-z0-9_]*$/.test(key) || !value || values.has(key)) throw invalidBackupEvidence();
    values.set(key, value);
  }
  return values;
}

function parseTimestamp(value: string | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) throw invalidBackupEvidence();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().replace(".000Z", "Z") !== value) {
    throw invalidBackupEvidence();
  }
  return timestamp;
}

function backupTimestampFromId(backupId: string): string {
  const match = backupId.match(/^natarot-production-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) throw invalidBackupEvidence();
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (!Number.isFinite(timestamp.getTime())) throw invalidBackupEvidence();
  const formatted = timestamp.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  if (formatted !== `${year}${month}${day}${hour}${minute}${second}`) throw invalidBackupEvidence();
  return timestamp.toISOString().replace(".000Z", "Z");
}

async function sha256RegularFile(path: string): Promise<string> {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.size <= 0) throw invalidBackupEvidence();
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk: Buffer | string) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  }).catch(() => { throw invalidBackupEvidence(); });
  return hash.digest("hex");
}

export async function verifyFirstOwnerBackupEvidence(
  input: Pick<FirstOwnerProvisionInput, "backupId" | "backupSha256" | "restoreVerificationRef">,
  options: {
    backupRoot: string;
    now: () => number;
    maxBackupAgeMs?: number;
    runManagerVerifier: () => void;
  },
): Promise<void> {
  try {
    const maxBackupAgeMs = options.maxBackupAgeMs ?? MAX_BACKUP_AGE_MS;
    if (!/^natarot-production-\d{8}-\d{6}$/.test(input.backupId)
      || !/^[a-f0-9]{64}$/i.test(input.backupSha256)
      || !Number.isFinite(maxBackupAgeMs)
      || maxBackupAgeMs <= 0
      || !Number.isFinite(options.now())) throw invalidBackupEvidence();

    const rootMetadata = lstatSync(options.backupRoot);
    if (!rootMetadata.isDirectory()) throw invalidBackupEvidence();
    const root = realpathSync(options.backupRoot);
    if (!lstatSync(join(root, "daily")).isDirectory()) throw invalidBackupEvidence();
    const latestId = readRegularFile(join(root, "latest-success"), 256).trim();
    if (latestId !== input.backupId) throw invalidBackupEvidence();

    const backupStatus = parseKeyValues(readRegularFile(join(root, "last-status")));
    if (backupStatus.get("status") !== "success" || backupStatus.get("backup_id") !== input.backupId) {
      throw invalidBackupEvidence();
    }
    const backupTimestampText = backupStatus.get("timestamp");
    const backupTimestamp = parseTimestamp(backupTimestampText);
    if (backupTimestampText !== backupTimestampFromId(input.backupId)) throw invalidBackupEvidence();
    const assertBackupFresh = () => {
      const age = options.now() - backupTimestamp;
      if (!Number.isFinite(age) || age < 0 || age > maxBackupAgeMs) throw invalidBackupEvidence();
    };
    assertBackupFresh();

    const restoreStatus = parseKeyValues(readRegularFile(join(root, "last-restore-test")));
    if (restoreStatus.get("status") !== "success"
      || restoreStatus.get("database_integrity") !== "ok"
      || restoreStatus.get("migration") !== "pass"
      || restoreStatus.get("application") !== "pass") throw invalidBackupEvidence();
    const restoreTimestampText = restoreStatus.get("timestamp");
    const restoreTimestamp = parseTimestamp(restoreTimestampText);
    const restoreAge = options.now() - restoreTimestamp;
    if (restoreTimestamp <= backupTimestamp || restoreAge < 0 || restoreAge > MAX_RESTORE_AGE_MS) {
      throw invalidBackupEvidence();
    }
    if (input.restoreVerificationRef !== `${input.backupId}:restore:${restoreTimestampText}`) throw invalidBackupEvidence();

    const archivePath = join(root, "daily", `${input.backupId}.tar.gz`);
    const archiveHash = await sha256RegularFile(archivePath);
    const sidecar = readRegularFile(`${archivePath}.sha256`, 1024).trim();
    const sidecarHash = sidecar.match(/^([a-f0-9]{64})(?:\s+\*?\S+)?$/i)?.[1]?.toLowerCase();
    if (archiveHash !== input.backupSha256.toLowerCase() || sidecarHash !== archiveHash) throw invalidBackupEvidence();

    assertBackupFresh();
    options.runManagerVerifier();
    assertBackupFresh();
  } catch {
    throw invalidBackupEvidence();
  }
}

export function runFirstOwnerBackupManagerVerifier(): void {
  try {
    const env = {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      HOME: "/root",
      LC_ALL: "C",
      TZ: "UTC",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv;
    execFileSync(FIRST_OWNER_RELEASE_MANAGER, ["verify-backups"], {
      stdio: "ignore",
      timeout: 60_000,
      env,
    });
  } catch {
    throw invalidBackupEvidence();
  }
}
