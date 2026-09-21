#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly BACKUP_VERSION="natarot-backup-v1"
readonly BACKUP_ROOT="${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
readonly APP_ROOT="${NATAROT_APP_ROOT:-/opt/natarot}"
readonly DB_PATH="${NATAROT_DB_PATH:-/var/lib/natarot/natarot.sqlite}"
readonly ENV_FILE="${NATAROT_ENV_FILE:-/etc/natarot.env}"
readonly SYSTEMD_UNIT="${NATAROT_SYSTEMD_UNIT:-/etc/systemd/system/natarot.service}"
readonly NGINX_CONFIG="${NATAROT_NGINX_CONFIG:-/etc/nginx/sites-enabled/natarot}"
readonly NODE_BIN="${NATAROT_NODE_BIN:-/usr/local/bin/node}"
readonly SQLITE_HELPER="${NATAROT_SQLITE_HELPER:-/usr/local/lib/natarot/natarot-sqlite-backup.mjs}"
readonly MIN_FREE_KIB="${NATAROT_MIN_FREE_KIB:-1048576}"
readonly BACKUP_ID="${NATAROT_BACKUP_ID:-natarot-production-$(date -u +%Y%m%d-%H%M%S)}"
readonly BACKUP_TIMESTAMP="${NATAROT_BACKUP_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

case "$BACKUP_ID" in
  (*[!A-Za-z0-9._-]*|"")
    printf 'invalid backup id\n' >&2
    exit 64
    ;;
esac
case "$MIN_FREE_KIB" in
  (*[!0-9]*|"")
    printf 'invalid minimum free-space threshold\n' >&2
    exit 64
    ;;
esac

readonly LOG_DIR="$BACKUP_ROOT/logs"
readonly LOG_FILE="$LOG_DIR/backup.log"
readonly STATUS_FILE="$BACKUP_ROOT/last-status"
readonly LATEST_FILE="$BACKUP_ROOT/latest-success"
readonly STAGE_DIR="$BACKUP_ROOT/staging/$BACKUP_ID"
readonly ARCHIVE="$BACKUP_ROOT/daily/$BACKUP_ID.tar.gz"
readonly ARCHIVE_SHA="$ARCHIVE.sha256"
readonly LOCK_DIRECTORY="$BACKUP_ROOT/backup.lock.d"

stage="startup"
success=0
skipped=0
archive_sha256=""
lock_directory_owned=0

mkdir -p "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly" "$LOG_DIR" "$BACKUP_ROOT/staging"
chmod 0700 "$BACKUP_ROOT" "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly" "$LOG_DIR" "$BACKUP_ROOT/staging"

log() {
  local message="$1"
  printf '%s stage=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$stage" "$message" | tee -a "$LOG_FILE" >&2
}

write_status() {
  local status="$1"
  local exit_code="$2"
  local temporary="$STATUS_FILE.tmp.$$"
  {
    printf 'status=%s\n' "$status"
    printf 'backup_id=%s\n' "$BACKUP_ID"
    printf 'timestamp=%s\n' "$BACKUP_TIMESTAMP"
    printf 'stage=%s\n' "$stage"
    printf 'exit_code=%s\n' "$exit_code"
    if [[ -n "$archive_sha256" ]]; then
      printf 'archive_sha256=%s\n' "$archive_sha256"
    fi
    if [[ -f "$ARCHIVE" ]]; then
      printf 'archive_bytes=%s\n' "$(wc -c < "$ARCHIVE" | tr -d '[:space:]')"
    fi
  } > "$temporary"
  chmod 0600 "$temporary"
  mv -f "$temporary" "$STATUS_FILE"
}

cleanup_on_exit() {
  local exit_code=$?
  if (( success == 1 && exit_code == 0 )); then
    write_status success 0 || true
    log "backup_complete backup_id=$BACKUP_ID archive_sha256=$archive_sha256" || true
  elif (( skipped == 1 )); then
    write_status skipped 0 || true
  else
    write_status failed "$exit_code" || true
    log "backup_failed backup_id=$BACKUP_ID exit_code=$exit_code" || true
    if [[ -d "$STAGE_DIR" ]]; then
      rm -rf -- "$STAGE_DIR"
    fi
  fi
  if (( lock_directory_owned == 1 )); then
    rmdir "$LOCK_DIRECTORY" 2>/dev/null || true
  fi
}
trap cleanup_on_exit EXIT

if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_ROOT/backup.lock"
  if ! flock -n 9; then
    skipped=1
    log "backup_skipped reason=lock_busy"
    exit 0
  fi
else
  if ! mkdir "$LOCK_DIRECTORY" 2>/dev/null; then
    skipped=1
    log "backup_skipped reason=lock_busy"
    exit 0
  fi
  lock_directory_owned=1
fi

if [[ -n "${NATAROT_TEST_PAUSE_SECONDS:-}" ]]; then
  sleep "$NATAROT_TEST_PAUSE_SECONDS"
fi

stage="preflight"
[[ -x "$NODE_BIN" ]] || { log "missing_node path=$NODE_BIN"; exit 70; }
[[ -f "$SQLITE_HELPER" ]] || { log "missing_sqlite_helper path=$SQLITE_HELPER"; exit 70; }
[[ -f "$DB_PATH" ]] || { log "missing_database path=$DB_PATH"; exit 66; }
[[ -d "$APP_ROOT" ]] || { log "missing_application_root path=$APP_ROOT"; exit 66; }
[[ -f "$ENV_FILE" ]] || { log "missing_environment_file path=$ENV_FILE"; exit 66; }
[[ -f "$SYSTEMD_UNIT" ]] || { log "missing_systemd_unit path=$SYSTEMD_UNIT"; exit 66; }
[[ -f "$NGINX_CONFIG" ]] || { log "missing_nginx_config path=$NGINX_CONFIG"; exit 66; }
[[ -f "$APP_ROOT/DEPLOYMENT_REVISION" ]] || { log "missing_release_marker path=$APP_ROOT/DEPLOYMENT_REVISION"; exit 66; }

database_bytes=$(wc -c < "$DB_PATH" | tr -d '[:space:]')
free_kib=$(df -Pk "$BACKUP_ROOT" | awk 'NR == 2 { print $4 + 0 }')
required_kib=$((MIN_FREE_KIB + (database_bytes / 1024) * 4 + 262144))
if (( free_kib < required_kib )); then
  log "disk_preflight_failed free_kib=$free_kib required_kib=$required_kib"
  exit 75
fi
log "disk_preflight_passed free_kib=$free_kib required_kib=$required_kib"

stage="staging"
if [[ -e "$STAGE_DIR" || -e "$ARCHIVE" ]]; then
  log "backup_id_already_exists backup_id=$BACKUP_ID"
  exit 73
fi
mkdir -p "$STAGE_DIR/manifest" "$STAGE_DIR/database" "$STAGE_DIR/configuration/systemd" "$STAGE_DIR/configuration/nginx" "$STAGE_DIR/configuration/runtime" "$STAGE_DIR/recovery" "$STAGE_DIR/checksums"

stage="database_backup"
"$NODE_BIN" --no-warnings "$SQLITE_HELPER" "$DB_PATH" "$STAGE_DIR/database/natarot.sqlite" > "$STAGE_DIR/database/verification.json"
VERIFY_FILE="$STAGE_DIR/database/verification.json" "$NODE_BIN" --no-warnings --input-type=module - <<'NODE'
import { readFileSync } from "node:fs";
const verification = JSON.parse(readFileSync(process.env.VERIFY_FILE, "utf8"));
if (verification.source?.integrity !== "ok") throw new Error("source integrity was not ok");
if (verification.destination?.integrity !== "ok") throw new Error("destination integrity was not ok");
if (verification.destination?.foreignKeyViolations !== 0) throw new Error("foreign-key check failed");
if (verification.destination?.tables < 1) throw new Error("backup has no application tables");
if (!Object.hasOwn(verification.destination?.rowCounts ?? {}, "natarot_migrations")) {
  throw new Error("backup has no migration ledger");
}
NODE

stage="configuration_backup"
cp -p "$SYSTEMD_UNIT" "$STAGE_DIR/configuration/systemd/natarot.service"
cp -p "$NGINX_CONFIG" "$STAGE_DIR/configuration/nginx/$(basename "$NGINX_CONFIG")"
cp -p "$APP_ROOT/DEPLOYMENT_REVISION" "$STAGE_DIR/recovery/DEPLOYMENT_REVISION"

awk '
  {
    line = $0
    sub(/^[[:space:]]*/, "", line)
    sub(/^export[[:space:]]+/, "", line)
    if (line ~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/) {
      key = line
      sub(/[[:space:]]*=.*$/, "", key)
      print key "="
    }
  }
' "$ENV_FILE" | LC_ALL=C sort -u > "$STAGE_DIR/configuration/runtime/natarot.env.keys"
{
  printf 'source=%s\n' "$ENV_FILE"
  NATAROT_ENV_FILE_METADATA="$ENV_FILE" "$NODE_BIN" --no-warnings --input-type=module - <<'NODE'
import { statSync } from "node:fs";
const stat = statSync(process.env.NATAROT_ENV_FILE_METADATA);
console.log(`mode=${(stat.mode & 0o777).toString(8)}`);
console.log(`bytes=${stat.size}`);
NODE
  printf 'values=excluded\n'
} > "$STAGE_DIR/configuration/runtime/natarot.env.metadata"

{
  printf 'backup_version=%s\n' "$BACKUP_VERSION"
  printf 'backup_timestamp=%s\n' "$BACKUP_TIMESTAMP"
  printf 'hostname=%s\n' "$(hostname)"
  printf 'node=%s\n' "$("$NODE_BIN" --version)"
  printf 'database_source=%s\n' "$DB_PATH"
  printf 'database_backup_method=node:sqlite VACUUM INTO\n'
  printf 'production_service=%s\n' "$(systemctl is-active natarot.service 2>/dev/null || printf 'unknown')"
  printf 'nginx=%s\n' "$(nginx -v 2>&1 || printf 'unknown')"
  printf 'secrets=excluded\n'
  printf 'private_tls_keys=excluded\n'
  printf 'logs=excluded\n'
  printf 'temporary_files=excluded\n'
  printf 'rebuildable_source=excluded; recover from recorded Git commit\n'
} > "$STAGE_DIR/recovery/runtime.txt"
{
  printf '%s\n' 'Included: a consistent SQLite database backup, deployment revision, active Nginx site configuration, systemd service configuration, runtime/version metadata, environment variable names only, manifest, and checksums.'
  printf '%s\n' 'Excluded: plaintext environment values, private TLS keys, cookies, logs, node_modules, caches, temporary files, and repository build/source duplication.'
  printf '%s\n' 'Restore rule: extract into an isolated directory and never replace /var/lib/natarot/natarot.sqlite in a test.'
} > "$STAGE_DIR/recovery/restore-scope.txt"

for optional_path in \
  /usr/local/sbin/natarot-backup \
  /usr/local/sbin/natarot-restore-test \
  /usr/local/lib/natarot/natarot-sqlite-backup.mjs \
  /etc/systemd/system/natarot-backup.service \
  /etc/systemd/system/natarot-backup.timer \
  /etc/systemd/system/natarot-restore-test.service \
  /etc/systemd/system/natarot-restore-test.timer; do
  if [[ -f "$optional_path" ]]; then
    cp -p "$optional_path" "$STAGE_DIR/recovery/$(basename "$optional_path")"
  fi
done

stage="manifest"
NATAROT_MANIFEST_BACKUP_ID="$BACKUP_ID" NATAROT_MANIFEST_BACKUP_TIMESTAMP="$BACKUP_TIMESTAMP" NATAROT_MANIFEST_BACKUP_VERSION="$BACKUP_VERSION" NATAROT_MANIFEST_APP_ROOT="$APP_ROOT" NATAROT_MANIFEST_DB_PATH="$DB_PATH" NATAROT_MANIFEST_ENV_FILE="$ENV_FILE" NATAROT_MANIFEST_HOSTNAME="$(hostname)" NATAROT_MANIFEST_VERIFY_FILE="$STAGE_DIR/database/verification.json" NATAROT_MANIFEST_STAGE_DIR="$STAGE_DIR" "$NODE_BIN" --no-warnings --input-type=module - <<'NODE'
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.env.NATAROT_MANIFEST_STAGE_DIR;
const releaseLines = readFileSync(join(root, "recovery/DEPLOYMENT_REVISION"), "utf8")
  .split(/\r?\n/)
  .filter(Boolean);
const release = Object.fromEntries(releaseLines.map((line) => {
  const separator = line.indexOf("=");
  return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : [line, ""];
}));
const database = JSON.parse(readFileSync(process.env.NATAROT_MANIFEST_VERIFY_FILE, "utf8"));
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [relative(root, path)];
});
const manifest = {
  backupVersion: process.env.NATAROT_MANIFEST_BACKUP_VERSION,
  backupId: process.env.NATAROT_MANIFEST_BACKUP_ID,
  backupTimestamp: process.env.NATAROT_MANIFEST_BACKUP_TIMESTAMP,
  production: {
    applicationRoot: process.env.NATAROT_MANIFEST_APP_ROOT,
    release: Object.fromEntries(["source_commit", "built_from", "deployed_at", "previous_release"].filter((key) => release[key]).map((key) => [key, release[key]])),
  },
  runtime: {
    node: process.version,
    hostname: process.env.NATAROT_MANIFEST_HOSTNAME || process.env.HOSTNAME || "unknown",
  },
  database: {
    type: "sqlite",
    sourcePath: process.env.NATAROT_MANIFEST_DB_PATH,
    method: "node:sqlite VACUUM INTO",
    source: database.source,
    destination: database.destination,
    migrationLedger: database.destination.migrations,
  },
  configuration: {
    environmentSource: process.env.NATAROT_MANIFEST_ENV_FILE,
    environmentValues: "excluded",
    privateTlsKeys: "excluded",
  },
  includedArtifacts: walk(root).filter((path) => path !== "manifest/backup-manifest.json" && path !== "checksums/SHA256SUMS"),
  excludedArtifacts: ["plaintext environment values", "private TLS keys", "logs", "node_modules", "caches", "temporary files", "rebuildable source"],
  checksums: {
    file: "checksums/SHA256SUMS",
    archiveSidecar: process.env.NATAROT_MANIFEST_BACKUP_ID + ".tar.gz.sha256",
  },
};
writeFileSync(join(root, "manifest/backup-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
NODE

stage="checksums"
(
  cd "$STAGE_DIR"
  find . -type f ! -path './checksums/SHA256SUMS' -print | LC_ALL=C sort | while IFS= read -r file; do
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$file"; else shasum -a 256 "$file"; fi
  done > checksums/SHA256SUMS
  while IFS=' ' read -r expected file; do
    [[ -n "$expected" && -n "$file" ]] || continue
    if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$file" | awk '{ print $1 }'); else actual=$(shasum -a 256 "$file" | awk '{ print $1 }'); fi
    [[ "$actual" == "$expected" ]] || { printf 'checksum mismatch: %s\n' "$file" >&2; exit 1; }
  done < checksums/SHA256SUMS
)

stage="archive"
temporary_archive="$BACKUP_ROOT/daily/.$BACKUP_ID.tar.gz.tmp.$$"
tar -C "$BACKUP_ROOT/staging" -czf "$temporary_archive" "$BACKUP_ID"
tar -tzf "$temporary_archive" >/dev/null
mv -f "$temporary_archive" "$ARCHIVE"
chmod 0600 "$ARCHIVE"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$ARCHIVE" > "$ARCHIVE_SHA"; else shasum -a 256 "$ARCHIVE" > "$ARCHIVE_SHA"; fi
chmod 0600 "$ARCHIVE_SHA"
archive_sha256=$(awk '{ print $1 }' "$ARCHIVE_SHA")

stage="retention"
if week_key=$(date -u -d "$BACKUP_TIMESTAMP" +%G-W%V 2>/dev/null); then :; else week_key=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$BACKUP_TIMESTAMP" +%G-W%V); fi
month_key="${BACKUP_TIMESTAMP:0:7}"
weekly_archive="$BACKUP_ROOT/weekly/natarot-production-$week_key.tar.gz"
monthly_archive="$BACKUP_ROOT/monthly/natarot-production-$month_key.tar.gz"
if [[ ! -e "$weekly_archive" ]]; then
  ln "$ARCHIVE" "$weekly_archive"
  ln "$ARCHIVE_SHA" "$weekly_archive.sha256"
fi
if [[ ! -e "$monthly_archive" ]]; then
  ln "$ARCHIVE" "$monthly_archive"
  ln "$ARCHIVE_SHA" "$monthly_archive.sha256"
fi

prune_class() {
  local directory="$1"
  local keep="$2"
  local count=0
  local file
  while IFS= read -r file; do
    count=$((count + 1))
    if (( count > keep )) && [[ "$file" != "$ARCHIVE" ]]; then
      rm -f -- "$file" "$file.sha256"
    fi
  done < <(find "$directory" -maxdepth 1 -type f -name '*.tar.gz' -print | LC_ALL=C sort -r)
}
prune_class "$BACKUP_ROOT/daily" 7
prune_class "$BACKUP_ROOT/weekly" 4
prune_class "$BACKUP_ROOT/monthly" 3

stage="complete"
printf '%s\n' "$BACKUP_ID" > "$LATEST_FILE.tmp.$$"
chmod 0600 "$LATEST_FILE.tmp.$$"
mv -f "$LATEST_FILE.tmp.$$" "$LATEST_FILE"
rm -rf -- "$STAGE_DIR"
success=1
exit 0
