#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly BACKUP_ROOT="${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
readonly APP_ROOT="${NATAROT_APP_ROOT:-/opt/natarot}"
readonly NODE_BIN="${NATAROT_NODE_BIN:-/usr/local/bin/node}"
readonly PRODUCTION_DB_PATH="${NATAROT_PRODUCTION_DB_PATH:-/var/lib/natarot/natarot.sqlite}"
readonly TEST_PORT="${NATAROT_RESTORE_TEST_PORT:-18878}"
readonly STATUS_FILE="$BACKUP_ROOT/last-restore-test"
readonly LOG_FILE="$BACKUP_ROOT/logs/restore-test.log"

archive=""
stage="startup"
restore_root=""
app_pid=""
success=0
application_status="skipped"
migration_status="skipped"
database_integrity="unknown"

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
    printf 'archive=%s\n' "$archive"
    printf 'database_integrity=%s\n' "${database_integrity:-unknown}"
    printf 'migration=%s\n' "$migration_status"
    printf 'application=%s\n' "$application_status"
    printf 'exit_code=%s\n' "$exit_code"
    printf 'timestamp=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$temporary"
  chmod 0600 "$temporary"
  mv -f "$temporary" "$STATUS_FILE"
}

cleanup_on_exit() {
  local exit_code=$?
  if [[ -n "$app_pid" ]]; then
    kill "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  if [[ -n "$restore_root" && -d "$restore_root" ]]; then
    rm -rf -- "$restore_root"
  fi
  if (( success == 1 && exit_code == 0 )); then
    write_status success 0 || true
    log "restore_test_complete application=$application_status migration=$migration_status" || true
  else
    write_status failed "$exit_code" || true
    log "restore_test_failed exit_code=$exit_code" || true
  fi
}
trap cleanup_on_exit EXIT

while (($# > 0)); do
  case "$1" in
    --archive)
      [[ $# -ge 2 ]] || { printf '%s\n' '--archive requires a path' >&2; exit 64; }
      archive="$2"
      shift 2
      ;;
    *)
      printf 'unknown argument: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done

mkdir -p "$BACKUP_ROOT/logs"
if [[ -z "$archive" ]]; then
  [[ -f "$BACKUP_ROOT/latest-success" ]] || { log 'missing latest-success marker'; exit 66; }
  latest_id=$(tr -d '[:space:]' < "$BACKUP_ROOT/latest-success")
  case "$latest_id" in
    natarot-production-[A-Za-z0-9._-]*) ;;
    (*) log 'invalid latest-success marker'; exit 65 ;;
  esac
  archive="$BACKUP_ROOT/daily/$latest_id.tar.gz"
fi

stage="preflight"
[[ -f "$archive" ]] || { log "missing archive path=$archive"; exit 66; }
[[ -x "$NODE_BIN" ]] || { log "missing_node path=$NODE_BIN"; exit 70; }
[[ "$PRODUCTION_DB_PATH" != "$archive" ]] || { log 'archive path cannot be the production database'; exit 65; }
command -v tar >/dev/null 2>&1 || { log 'missing tar'; exit 70; }

stage="extract"
restore_root=$(mktemp -d "${TMPDIR:-/tmp}/natarot-restore-test.XXXXXX")
archive_listing="$restore_root/archive-listing"
tar -tzf "$archive" > "$archive_listing"
bundle_name=$(awk -F/ 'NF > 1 { print $1; exit }' "$archive_listing")
case "$bundle_name" in
  natarot-production-[A-Za-z0-9._-]*) ;;
  (*) log 'archive bundle root is invalid'; exit 65 ;;
esac
tar -xzf "$archive" -C "$restore_root"
bundle="$restore_root/$bundle_name"
[[ -d "$bundle" ]] || { log 'archive bundle directory missing'; exit 65; }

stage="archive_verification"
archive_sidecar="$archive.sha256"
if [[ -f "$archive_sidecar" ]]; then
  expected_archive_hash=$(awk '{ print $1 }' "$archive_sidecar")
  if command -v sha256sum >/dev/null 2>&1; then actual_archive_hash=$(sha256sum "$archive" | awk '{ print $1 }'); else actual_archive_hash=$(shasum -a 256 "$archive" | awk '{ print $1 }'); fi
  [[ "$expected_archive_hash" == "$actual_archive_hash" ]] || { log 'archive sidecar checksum mismatch'; exit 65; }
fi
[[ -f "$bundle/checksums/SHA256SUMS" ]] || { log 'archive checksum file missing'; exit 65; }
while IFS=' ' read -r expected file; do
  [[ -n "$expected" && -n "$file" ]] || continue
  [[ "$file" == ./* && "$file" != *'..'* ]] || { log "unsafe checksum path=$file"; exit 65; }
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$bundle/$file" | awk '{ print $1 }'); else actual=$(shasum -a 256 "$bundle/$file" | awk '{ print $1 }'); fi
  [[ "$actual" == "$expected" ]] || { log "artifact checksum mismatch path=$file"; exit 65; }
done < "$bundle/checksums/SHA256SUMS"

stage="database_verification"
restored_db="$bundle/database/natarot.sqlite"
[[ -f "$restored_db" ]] || { log 'restored database missing'; exit 65; }
[[ "$restored_db" != "$PRODUCTION_DB_PATH" ]] || { log 'refusing to verify the production database path'; exit 65; }
RESTORED_DB="$restored_db" "$NODE_BIN" --no-warnings --input-type=module - > "$restore_root/database-verification.json" <<'NODE'
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.env.RESTORED_DB, { readOnly: true });
const integrity = String(db.prepare("PRAGMA integrity_check").get().integrity_check);
const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all().length;
const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name));
const migrations = tableNames.includes("natarot_migrations") ? Number(db.prepare("SELECT count(*) AS count FROM natarot_migrations").get().count) : null;
if (integrity !== "ok") throw new Error("restored database integrity check failed");
if (foreignKeyViolations !== 0) throw new Error("restored database foreign-key check failed");
if (tableNames.length === 0) throw new Error("restored database has no application tables");
if (migrations === null) throw new Error("restored database has no migration ledger");
console.log(JSON.stringify({ integrity, foreignKeyViolations, tables: tableNames.length, migrations }));
db.close();
NODE
database_integrity=$("$NODE_BIN" --no-warnings --input-type=module -e 'import { readFileSync } from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1], "utf8")).integrity);' "$restore_root/database-verification.json")
[[ "$database_integrity" == "ok" ]] || { log "database integrity was $database_integrity"; exit 65; }

stage="migration_verification"
if [[ -z "${NATAROT_SKIP_MIGRATION:-}" ]]; then
  [[ -f "$APP_ROOT/scripts/node-migrate.mjs" ]] || { log "missing migration runner path=$APP_ROOT/scripts/node-migrate.mjs"; exit 66; }
  NATAROT_DB_PATH="$restored_db" "$NODE_BIN" "$APP_ROOT/scripts/node-migrate.mjs" > "$restore_root/migration.log"
  migration_status="pass"
fi

stage="application_verification"
if [[ -z "${NATAROT_SKIP_APP_SMOKE:-}" ]]; then
  command -v curl >/dev/null 2>&1 || { log 'missing curl'; exit 70; }
  [[ -f "$APP_ROOT/node_modules/vinext/dist/cli.js" ]] || { log 'missing application runtime'; exit 66; }
  (
    cd "$APP_ROOT"
    exec env NATAROT_DB_PATH="$restored_db" NATAROT_TRUSTED_PROXY=false NODE_ENV=production "$NODE_BIN" "$APP_ROOT/node_modules/vinext/dist/cli.js" start --port "$TEST_PORT" --hostname 127.0.0.1
  ) > "$restore_root/application.log" 2>&1 &
  app_pid=$!
  ready=0
  for attempt in $(seq 1 60); do
    if curl -fsS --max-time 2 "http://127.0.0.1:$TEST_PORT/api/tarot/catalog?locale=en" -o "$restore_root/catalog.json"; then
      ready=1
      break
    fi
    sleep 0.5
  done
  [[ "$ready" == 1 ]] || { log 'restored application did not answer the catalog endpoint'; exit 65; }
  application_status="pass"
fi

success=1
exit 0
