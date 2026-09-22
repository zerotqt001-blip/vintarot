#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly APP_ROOT="${NATAROT_APP_ROOT:-/opt/natarot}"
readonly RELEASE_ROOT="${NATAROT_RELEASE_ROOT:-$APP_ROOT/releases}"
readonly STAGING_ROOT="${NATAROT_STAGING_ROOT:-$APP_ROOT/.staging}"
readonly FAILED_ROOT="${NATAROT_FAILED_ROOT:-$APP_ROOT/.failed}"
readonly CURRENT_LINK="${NATAROT_CURRENT_LINK:-$APP_ROOT/current}"
readonly PREVIOUS1_LINK="${NATAROT_PREVIOUS1_LINK:-$APP_ROOT/previous-1}"
readonly PREVIOUS2_LINK="${NATAROT_PREVIOUS2_LINK:-$APP_ROOT/previous-2}"
readonly SHARED_NODE_MODULES="${NATAROT_SHARED_NODE_MODULES:-/opt/natarot-deps/node_modules}"
readonly DB_PATH="${NATAROT_DB_PATH:-/var/lib/natarot/natarot.sqlite}"
readonly ENV_FILE="${NATAROT_ENV_FILE:-/etc/natarot.env}"
readonly BACKUP_ROOT="${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
readonly BACKUP_STATUS_FILE="${NATAROT_BACKUP_STATUS_FILE:-$BACKUP_ROOT/last-status}"
readonly BACKUP_LATEST_FILE="${NATAROT_BACKUP_LATEST_FILE:-$BACKUP_ROOT/latest-success}"
readonly RESTORE_STATUS_FILE="${NATAROT_RESTORE_STATUS_FILE:-$BACKUP_ROOT/last-restore-test}"
readonly BACKUP_COMMAND="${NATAROT_BACKUP_COMMAND:-/usr/local/sbin/natarot-backup}"
readonly BACKUP_SERVICE="${NATAROT_BACKUP_SERVICE:-natarot-backup.service}"
readonly BACKUP_MAX_AGE_SECONDS="${NATAROT_BACKUP_MAX_AGE_SECONDS:-172800}"
readonly RESTORE_MAX_AGE_SECONDS="${NATAROT_RESTORE_MAX_AGE_SECONDS:-3888000}"
readonly SERVICE="${NATAROT_SERVICE:-natarot.service}"
readonly SERVICE_UNIT_PATH="${NATAROT_SERVICE_UNIT_PATH:-/etc/systemd/system/$SERVICE}"
readonly SERVICE_UNIT_SOURCE="${NATAROT_SERVICE_UNIT_SOURCE:-}"
readonly CANDIDATE_SERVICE_PREFIX="${NATAROT_CANDIDATE_SERVICE_PREFIX:-natarot-candidate@}"
readonly CANDIDATE_PORT="${NATAROT_CANDIDATE_PORT:-8878}"
readonly PRODUCTION_PORT="${NATAROT_PRODUCTION_PORT:-8787}"
readonly SYSTEMCTL="${NATAROT_SYSTEMCTL:-systemctl}"
readonly CURL="${NATAROT_CURL:-curl}"
readonly CURL_TIMEOUT_SECONDS="${NATAROT_CURL_TIMEOUT_SECONDS:-15}"
readonly LOCK_PATH="${NATAROT_LOCK_PATH:-/run/lock/natarot-deploy.lock}"
readonly MIN_FREE_KIB="${NATAROT_MIN_FREE_KIB:-1048576}"
readonly MIN_FREE_PERCENT="${NATAROT_MIN_FREE_PERCENT:-10}"
readonly CLEANUP_MIN_FREE_KIB="${NATAROT_CLEANUP_MIN_FREE_KIB:-$MIN_FREE_KIB}"
readonly CLEANUP_MIN_FREE_PERCENT="${NATAROT_CLEANUP_MIN_FREE_PERCENT:-0}"
readonly APP_USER="${NATAROT_APP_USER:-natarot}"
readonly APP_GROUP="${NATAROT_APP_GROUP:-natarot}"

lock_fd_open=0
lock_directory_owned=0
promotion_attempted=0
promotion_committed=0
old_current_target=""
candidate_release_dir=""
staging_release_dir=""
migration_attempted=0
migration_committed=0
migration_destination=""
migration_service_stopped=0
migration_moved_entries=()
migration_service_backup=""
migration_service_unit_updated=0

log() {
  printf '%s phase=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${phase:-startup}" "$1" >&2
}

die() {
  log "error=$1"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing_command=$1"
}

for required in awk basename cat chmod cp date df dirname du find grep install ln mkdir mv readlink rm rmdir sort tr wc; do
  require_command "$required"
done
if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
  die "missing_command=sha256sum-or-shasum"
fi

canonical_existing() {
  local path="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$path" 2>/dev/null && return 0
  fi
  if readlink -f "$path" 2>/dev/null; then
    return 0
  fi
  if [[ -d "$path" ]]; then
    (cd -P "$path" && pwd -P)
    return
  fi
  local parent base
  parent=$(dirname "$path")
  base=$(basename "$path")
  printf '%s/%s\n' "$(cd -P "$parent" && pwd -P)" "$base"
}

canonical_path() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    canonical_existing "$path"
  else
    local parent base
    parent=$(dirname "$path")
    base=$(basename "$path")
    printf '%s/%s\n' "$(canonical_existing "$parent")" "$base"
  fi
}

assert_inside() {
  local root candidate root_real candidate_real
  root="$1"
  candidate="$2"
  root_real=$(canonical_existing "$root")
  candidate_real=$(canonical_path "$candidate")
  case "$candidate_real" in
    "$root_real"/*) ;;
    *) die "unsafe_path_outside_root path=$candidate root=$root" ;;
  esac
}

assert_release_id() {
  local release_id="$1"
  [[ "$release_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "invalid_release_id"
}

assert_external_state() {
  assert_managed_roots
  local release_real backup_real db_real env_real
  release_real=$(canonical_path "$RELEASE_ROOT")
  backup_real=$(canonical_path "$BACKUP_ROOT")
  db_real=$(canonical_path "$DB_PATH")
  env_real=$(canonical_path "$ENV_FILE")
  [[ "$backup_real" != "$release_real" && "$backup_real" != "$release_real"/* ]] || die "backup_root_overlaps_release_root"
  [[ "$db_real" != "$release_real"/* ]] || die "database_path_inside_release_root"
  [[ "$env_real" != "$release_real"/* ]] || die "environment_path_inside_release_root"
}

assert_managed_roots() {
  assert_inside "$APP_ROOT" "$RELEASE_ROOT"
  assert_inside "$APP_ROOT" "$STAGING_ROOT"
  assert_inside "$APP_ROOT" "$FAILED_ROOT"
  assert_inside "$APP_ROOT" "$CURRENT_LINK"
  assert_inside "$APP_ROOT" "$PREVIOUS1_LINK"
  assert_inside "$APP_ROOT" "$PREVIOUS2_LINK"
}

acquire_lock() {
  mkdir -p "$(dirname "$LOCK_PATH")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_PATH"
    if ! flock -n 9; then
      die "deployment_lock_busy"
    fi
    lock_fd_open=1
  else
    local lock_directory="${LOCK_PATH}.d"
    if ! mkdir "$lock_directory" 2>/dev/null; then
      die "deployment_lock_busy"
    fi
    lock_directory_owned=1
  fi
}

ensure_managed_dirs() {
  mkdir -p "$RELEASE_ROOT" "$STAGING_ROOT" "$FAILED_ROOT"
  chmod 0755 "$RELEASE_ROOT"
  chmod 0700 "$STAGING_ROOT" "$FAILED_ROOT"
}

release_lock() {
  if (( lock_fd_open == 1 )); then
    flock -u 9 2>/dev/null || true
    exec 9>&-
    lock_fd_open=0
  fi
  if (( lock_directory_owned == 1 )); then
    rmdir "${LOCK_PATH}.d" 2>/dev/null || true
    lock_directory_owned=0
  fi
}

atomic_symlink() {
  local target="$1"
  local link="$2"
  local temporary="${link}.tmp.$$"
  mkdir -p "$(dirname "$link")"
  if [[ -e "$link" && ! -L "$link" ]]; then
    die "refusing_to_replace_non_symlink path=$link"
  fi
  rm -f "$temporary"
  ln -s "$target" "$temporary"
  mv -f "$temporary" "$link"
}

remove_symlink_if_present() {
  local link="$1"
  if [[ -L "$link" ]]; then
    rm -f "$link"
  elif [[ -e "$link" ]]; then
    die "refusing_to_remove_non_symlink path=$link"
  fi
}

reference_target() {
  local link="$1"
  [[ -L "$link" ]] || return 1
  local target
  target=$(canonical_existing "$link")
  assert_inside "$RELEASE_ROOT" "$target"
  [[ -d "$target" && ! -L "$target" ]] || die "reference_target_not_directory path=$link"
  [[ -f "$target/DEPLOYMENT_SUCCESS" ]] || die "reference_target_not_successful path=$link"
  printf '%s\n' "$target"
}

release_id_from_path() {
  local path="$1"
  assert_inside "$RELEASE_ROOT" "$path"
  local canonical release_id
  canonical=$(canonical_existing "$path")
  release_id=$(basename "$canonical")
  assert_release_id "$release_id"
  [[ "$canonical" == "$(canonical_existing "$RELEASE_ROOT")/$release_id" ]] || die "release_not_direct_child path=$path"
  printf '%s\n' "$release_id"
}

protected_release_paths() {
  PROTECTED_RELEASES=()
  local current_target
  current_target=$(reference_target "$CURRENT_LINK") || die "current_reference_missing"
  PROTECTED_RELEASES+=("$current_target")
  local previous_target
  if [[ -L "$PREVIOUS1_LINK" ]]; then
    previous_target=$(reference_target "$PREVIOUS1_LINK")
    PROTECTED_RELEASES+=("$previous_target")
  fi
  if [[ -L "$PREVIOUS2_LINK" ]]; then
    previous_target=$(reference_target "$PREVIOUS2_LINK")
    PROTECTED_RELEASES+=("$previous_target")
  fi
}

is_protected_release() {
  local candidate
  candidate=$(canonical_existing "$1")
  local protected
  for protected in "${PROTECTED_RELEASES[@]}"; do
    [[ "$candidate" == "$protected" ]] && return 0
  done
  return 1
}

process_references_path() {
  local candidate
  candidate=$(canonical_existing "$1")
  if [[ -n "${NATAROT_ACTIVE_RELEASE:-}" ]] && [[ -e "${NATAROT_ACTIVE_RELEASE}" ]]; then
    [[ "$(canonical_existing "$NATAROT_ACTIVE_RELEASE")" == "$candidate" ]] && return 0
  fi
  local cwd exe process_path
  for cwd in /proc/[0-9]*/cwd; do
    [[ -e "$cwd" ]] || continue
    process_path=$(readlink -f "$cwd" 2>/dev/null || true)
    [[ "$process_path" == "$candidate" || "$process_path" == "$candidate"/* ]] && return 0
  done
  for exe in /proc/[0-9]*/exe; do
    [[ -e "$exe" ]] || continue
    process_path=$(readlink -f "$exe" 2>/dev/null || true)
    [[ "$process_path" == "$candidate" || "$process_path" == "$candidate"/* ]] && return 0
  done
  return 1
}

disk_preflight() {
  local path="${1:-$APP_ROOT}"
  local extra_kib="${2:-0}"
  local minimum_percent="${3:-$MIN_FREE_PERCENT}"
  local minimum_kib="${4:-$MIN_FREE_KIB}"
  [[ -d "$path" ]] || die "disk_path_missing path=$path"
  local line filesystem_kib used_kib free_kib use_percent mount_point required_kib
  line=$(df -Pk "$path" | awk 'NR == 2 { print $2, $3, $4, $5, $6; found = 1 } END { if (!found) exit 1 }') || die "disk_probe_failed path=$path"
  read -r filesystem_kib used_kib free_kib use_percent mount_point <<< "$line"
  required_kib=$((minimum_kib + extra_kib))
  local used_percent=${use_percent%%%}
  local free_percent=$((100 - used_percent))
  log "disk_preflight free_kib=$free_kib required_kib=$required_kib free_percent=$free_percent minimum_percent=$minimum_percent use_percent=$use_percent mount=$mount_point"
  (( free_kib >= required_kib )) || die "disk_headroom_insufficient free_kib=$free_kib required_kib=$required_kib"
  (( free_percent >= minimum_percent )) || die "disk_free_percent_insufficient free_percent=$free_percent minimum_percent=$minimum_percent"
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

read_key() {
  local key="$1"
  local file="$2"
  awk -F= -v wanted="$key" '$1 == wanted { print substr($0, index($0, "=") + 1); exit }' "$file"
}

timestamp_epoch() {
  local timestamp="$1"
  date -u -d "$timestamp" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$timestamp" +%s 2>/dev/null || true
}

assert_recent_timestamp() {
  local timestamp="$1"
  local max_age_seconds="$2"
  local timestamp_epoch_value now_epoch age_seconds
  timestamp_epoch_value=$(timestamp_epoch "$timestamp")
  [[ "$timestamp_epoch_value" =~ ^[0-9]+$ ]] || die "backup_timestamp_invalid"
  now_epoch=$(date -u +%s)
  age_seconds=$((now_epoch - timestamp_epoch_value))
  (( age_seconds >= 0 && age_seconds <= max_age_seconds )) || die "verified_backup_too_old"
  printf '%s\n' "$age_seconds"
}

verify_backups() {
  phase="backup_verify"
  assert_external_state
  [[ -f "$BACKUP_STATUS_FILE" ]] || die "backup_status_missing"
  [[ -f "$BACKUP_LATEST_FILE" ]] || die "backup_latest_marker_missing"
  [[ -f "$RESTORE_STATUS_FILE" ]] || die "restore_test_status_missing"
  [[ "$(read_key status "$BACKUP_STATUS_FILE")" == success ]] || die "backup_status_not_success"
  [[ "$(read_key status "$RESTORE_STATUS_FILE")" == success ]] || die "restore_test_status_not_success"
  local backup_id archive expected actual timestamp age_seconds restore_timestamp restore_age_seconds
  backup_id=$(tr -d '[:space:]' < "$BACKUP_LATEST_FILE")
  [[ "$backup_id" =~ ^natarot-production-[A-Za-z0-9._-]+$ ]] || die "backup_latest_marker_invalid"
  [[ "$(read_key backup_id "$BACKUP_STATUS_FILE")" == "$backup_id" ]] || die "backup_latest_status_mismatch"
  archive="$BACKUP_ROOT/daily/$backup_id.tar.gz"
  [[ -f "$archive" && -f "$archive.sha256" ]] || die "verified_backup_archive_missing"
  expected=$(awk '{ print $1; exit }' "$archive.sha256")
  actual=$(hash_file "$archive")
  [[ "$expected" == "$actual" ]] || die "verified_backup_checksum_mismatch"
  timestamp=$(read_key timestamp "$BACKUP_STATUS_FILE")
  [[ -n "$timestamp" ]] || die "backup_timestamp_missing"
  age_seconds=$(assert_recent_timestamp "$timestamp" "$BACKUP_MAX_AGE_SECONDS")
  restore_timestamp=$(read_key timestamp "$RESTORE_STATUS_FILE")
  [[ -n "$restore_timestamp" ]] || die "restore_test_timestamp_missing"
  [[ "$(read_key database_integrity "$RESTORE_STATUS_FILE")" == ok ]] || die "restore_test_database_integrity_failed"
  [[ "$(read_key migration "$RESTORE_STATUS_FILE")" == pass ]] || die "restore_test_migration_failed"
  [[ "$(read_key application "$RESTORE_STATUS_FILE")" == pass ]] || die "restore_test_application_failed"
  restore_age_seconds=$(assert_recent_timestamp "$restore_timestamp" "$RESTORE_MAX_AGE_SECONDS")
  local daily_count weekly_count monthly_count
  daily_count=$(find "$BACKUP_ROOT/daily" -maxdepth 1 -type f -name '*.tar.gz' -print | wc -l | tr -d '[:space:]')
  weekly_count=$(find "$BACKUP_ROOT/weekly" -maxdepth 1 -type f -name '*.tar.gz' -print | wc -l | tr -d '[:space:]')
  monthly_count=$(find "$BACKUP_ROOT/monthly" -maxdepth 1 -type f -name '*.tar.gz' -print | wc -l | tr -d '[:space:]')
  (( daily_count >= 1 && daily_count <= 7 )) || die "daily_backup_retention_invalid"
  (( weekly_count >= 1 && weekly_count <= 4 )) || die "weekly_backup_retention_invalid"
  (( monthly_count >= 1 && monthly_count <= 3 )) || die "monthly_backup_retention_invalid"
  log "backup_verified daily=$daily_count weekly=$weekly_count monthly=$monthly_count age_seconds=$age_seconds restore_age_seconds=$restore_age_seconds"
}

run_backup() {
  phase="backup"
  if [[ "${NATAROT_TEST_SKIP_BACKUP:-}" == 1 ]]; then
    log "backup_skipped reason=test_fixture"
    return 0
  fi
  systemctl_run start --wait "$BACKUP_SERVICE"
  if [[ "${NATAROT_BACKUP_DIRECT_COMMAND:-}" == 1 ]]; then
    [[ -x "$BACKUP_COMMAND" ]] || die "backup_command_missing"
    "$BACKUP_COMMAND" >/dev/null
  fi
}

systemctl_run() {
  if [[ "${NATAROT_TEST_SKIP_SERVICE:-}" == 1 ]]; then
    return 0
  fi
  if [[ "$SYSTEMCTL" == */* ]]; then
    [[ -x "$SYSTEMCTL" ]] || die "systemctl_missing"
  else
    require_command "$SYSTEMCTL"
  fi
  "$SYSTEMCTL" "$@"
}

http_smoke() {
  local url="$1"
  if [[ "${NATAROT_TEST_SKIP_SERVICE:-}" == 1 ]]; then
    return 0
  fi
  if [[ "$CURL" == */* ]]; then
    [[ -x "$CURL" ]] || die "curl_missing"
  else
    require_command "$CURL"
  fi
  "$CURL" -fsS --max-time "$CURL_TIMEOUT_SECONDS" "$url" >/dev/null
}

production_health() {
  http_smoke "http://127.0.0.1:$PRODUCTION_PORT/api/tarot/catalog?locale=en"
  http_smoke "http://127.0.0.1:$PRODUCTION_PORT/"
  [[ "${NATAROT_PRODUCTION_SMOKE_RESULT:-pass}" == pass ]] || die "production_smoke_failed"
  if [[ -n "${NATAROT_BROWSER_SMOKE_COMMAND:-}" ]]; then
    "$NATAROT_BROWSER_SMOKE_COMMAND"
  fi
}

validate_candidate() {
  local candidate="$1"
  [[ -d "$candidate" && ! -L "$candidate" ]] || die "candidate_directory_invalid"
  local unsafe
  unsafe=$(find "$candidate" \( -type f -o -type l \) \( -name '.env' -o -name '.env.*' -o -name '*.sqlite' -o -name '*.sqlite-*' -o -iname '*private-key*' -o -iname '*private_key*' -o -iname '*secret-key*' -o -iname '*secret_key*' -o -iname 'id_rsa*' -o -iname 'id_ed25519*' -o -iname '*.pem' -o -iname '*.key' \) -print -quit)
  [[ -z "$unsafe" ]] || die "candidate_contains_persistent_or_secret_file"
  unsafe=$(find "$candidate" -path "$candidate/node_modules" -prune -o -type d \( -name 'uploads' -o -name 'user-data' -o -name 'userdata' -o -name 'secrets' -o -name 'tls' \) -print -quit)
  [[ -z "$unsafe" ]] || die "candidate_contains_persistent_state_directory"
  local link target
  while IFS= read -r -d '' link; do
    target=$(canonical_existing "$link")
    local candidate_real shared_real
    candidate_real=$(canonical_existing "$candidate")
    shared_real=$(canonical_path "$SHARED_NODE_MODULES")
    if [[ "$target" != "$candidate_real"/* && "$target" != "$shared_real" && "$target" != "$shared_real"/* ]]; then
      die "candidate_symlink_outside_allowed_roots"
    fi
  done < <(find "$candidate" -type l -print0)
  [[ -f "$candidate/dist/server/index.js" ]] || die "candidate_build_missing"
  if [[ ! -f "$candidate/node_modules/vinext/dist/cli.js" && ! -d "$SHARED_NODE_MODULES" ]]; then
    die "candidate_runtime_missing"
  fi
}

set_release_owner() {
  local path="$1"
  if [[ "${NATAROT_SKIP_OWNERSHIP:-}" == 1 ]]; then
    return 0
  fi
  require_command chown
  id "$APP_USER" >/dev/null 2>&1 || die "application_user_missing"
  chown -R "$APP_USER:$APP_GROUP" "$path"
}

write_release_marker() {
  local release_dir="$1"
  local marker="$release_dir/DEPLOYMENT_SUCCESS"
  local temporary="$marker.tmp.$$"
  {
    printf 'release_id=%s\n' "$(basename "$release_dir")"
    printf 'success_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$temporary"
  chmod 0600 "$temporary"
  mv -f "$temporary" "$marker"
}

write_revision_marker() {
  local release_dir="$1"
  local release_id="$2"
  local marker="$release_dir/DEPLOYMENT_REVISION"
  local temporary="$marker.tmp.$$"
  {
    printf 'release_id=%s\n' "$release_id"
    printf 'source=managed-release-topology\n'
  } > "$temporary"
  chmod 0600 "$temporary"
  mv -f "$temporary" "$marker"
}

cleanup_release_dirs() {
  phase="release_cleanup"
  assert_external_state
  [[ -d "$RELEASE_ROOT" && ! -L "$RELEASE_ROOT" ]] || die "release_root_invalid"
  protected_release_paths
  local candidate
  while IFS= read -r -d '' candidate; do
    [[ -d "$candidate" && ! -L "$candidate" ]] || continue
    [[ -f "$candidate/DEPLOYMENT_SUCCESS" ]] || {
      log "release_cleanup_skip reason=unknown path=$candidate"
      continue
    }
    if is_protected_release "$candidate"; then
      continue
    fi
    process_references_path "$candidate" && die "release_referenced_by_active_process"
  done < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
  local deleted=0 retained=0
  while IFS= read -r -d '' candidate; do
    [[ -d "$candidate" && ! -L "$candidate" ]] || continue
    [[ -f "$candidate/DEPLOYMENT_SUCCESS" ]] || continue
    if is_protected_release "$candidate"; then
      retained=$((retained + 1))
      continue
    fi
    assert_inside "$RELEASE_ROOT" "$candidate"
    rm -rf "$candidate"
    deleted=$((deleted + 1))
  done < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
  log "release_cleanup_complete retained=$retained deleted=$deleted"
}

cleanup_manager_staging() {
  [[ -d "$STAGING_ROOT" ]] || return 0
  local entry marker
  while IFS= read -r -d '' entry; do
    marker="$entry/.natarot-managed-staging"
    [[ -f "$marker" ]] || continue
    assert_inside "$STAGING_ROOT" "$entry"
    process_references_path "$entry" && die "staging_referenced_by_active_process"
    rm -rf "$entry"
  done < <(find "$STAGING_ROOT" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
}

cleanup_all() {
  phase="cleanup"
  acquire_lock
  trap release_lock EXIT
  disk_preflight "$APP_ROOT" 0 "$CLEANUP_MIN_FREE_PERCENT" "$CLEANUP_MIN_FREE_KIB"
  verify_backups
  cleanup_release_dirs
  cleanup_manager_staging
  printf 'cleanup_complete=true\n'
}

promote_current() {
  local release_id="$1"
  atomic_symlink "releases/$release_id" "$CURRENT_LINK"
}

rotate_references() {
  local previous1_target=""
  local previous2_target=""
  if [[ -L "$PREVIOUS1_LINK" ]]; then
    previous1_target=$(reference_target "$PREVIOUS1_LINK")
  fi
  if [[ -L "$PREVIOUS2_LINK" ]]; then
    previous2_target=$(reference_target "$PREVIOUS2_LINK")
  fi
  if [[ -n "$old_current_target" ]]; then
    local old_current_id
    old_current_id=$(release_id_from_path "$old_current_target")
    atomic_symlink "releases/$old_current_id" "$PREVIOUS1_LINK"
  fi
  if [[ -n "$previous1_target" ]]; then
    local previous1_id
    previous1_id=$(release_id_from_path "$previous1_target")
    atomic_symlink "releases/$previous1_id" "$PREVIOUS2_LINK"
  elif [[ -n "$previous2_target" ]]; then
    local previous2_id
    previous2_id=$(release_id_from_path "$previous2_target")
    atomic_symlink "releases/$previous2_id" "$PREVIOUS2_LINK"
  fi
}

rollback_promotion() {
  [[ -n "$old_current_target" ]] || return 0
  [[ -d "$old_current_target" ]] || return 0
  local old_current_id
  old_current_id=$(release_id_from_path "$old_current_target")
  atomic_symlink "releases/$old_current_id" "$CURRENT_LINK" || return 0
  systemctl_run restart "$SERVICE" || true
  http_smoke "http://127.0.0.1:$PRODUCTION_PORT/api/tarot/catalog?locale=en" || true
  log "promotion_rolled_back release_id=$old_current_id"
}

quarantine_path() {
  local source="$1"
  [[ -e "$source" ]] || return 0
  [[ -d "$source" && ! -L "$source" ]] || {
    log "quarantine_skip reason=not_directory path=$source"
    return 0
  }
  assert_inside "$APP_ROOT" "$source"
  mkdir -p "$FAILED_ROOT"
  local base destination
  base=$(basename "$source")
  destination="$FAILED_ROOT/${base}.failed.$(date -u +%Y%m%dT%H%M%SZ).$$"
  assert_inside "$FAILED_ROOT" "$destination"
  mv "$source" "$destination"
  log "quarantined_failed_artifact path=$destination"
}

stop_failed_candidate() {
  [[ -n "$candidate_release_dir" ]] || return 0
  local release_id
  release_id=$(basename "$candidate_release_dir")
  systemctl_run stop "${CANDIDATE_SERVICE_PREFIX}${release_id}.service" || true
}

quarantine_failed_candidates() {
  stop_failed_candidate
  if [[ -n "$candidate_release_dir" && -d "$candidate_release_dir" && ! -f "$candidate_release_dir/DEPLOYMENT_SUCCESS" ]]; then
    quarantine_path "$candidate_release_dir" || log "quarantine_failed path=$candidate_release_dir"
  fi
  if [[ -n "$staging_release_dir" && -d "$staging_release_dir" ]]; then
    quarantine_path "$staging_release_dir" || log "quarantine_failed path=$staging_release_dir"
  fi
}

rollback_flat_migration() {
  [[ "$migration_attempted" == 1 && "$migration_committed" == 0 ]] || return 0
  if (( migration_service_stopped == 0 )); then
    if [[ -n "$migration_service_backup" && -f "$migration_service_backup" ]]; then
      rm -f "$migration_service_backup" || true
    fi
    return 0
  fi
  phase="migration_rollback"
  systemctl_run stop "$SERVICE" || true
  if [[ -L "$CURRENT_LINK" ]]; then
    local current_target
    current_target=$(canonical_existing "$CURRENT_LINK" 2>/dev/null || true)
    if [[ -n "$migration_destination" && "$current_target" == "$(canonical_existing "$migration_destination" 2>/dev/null || true)" ]]; then
      remove_symlink_if_present "$CURRENT_LINK" || true
    fi
  fi
  local entry name
  if [[ -d "$migration_destination" ]]; then
    while IFS= read -r -d '' entry; do
      name=$(basename "$entry")
      case "$name" in
        DEPLOYMENT_SUCCESS|DEPLOYMENT_REVISION)
          rm -f "$entry"
          ;;
        *)
          mv "$entry" "$APP_ROOT/" || true
          ;;
      esac
    done < <(find "$migration_destination" -mindepth 1 -maxdepth 1 -print0 | LC_ALL=C sort -z)
    rmdir "$migration_destination" 2>/dev/null || true
  fi
  if (( migration_service_stopped == 1 )); then
    if (( migration_service_unit_updated == 1 )) && [[ -n "$migration_service_backup" && -f "$migration_service_backup" ]]; then
      copy_service_unit "$migration_service_backup" "$SERVICE_UNIT_PATH" || true
      systemctl_run daemon-reload || true
    fi
    systemctl_run start "$SERVICE" || true
  fi
  if [[ -n "$migration_service_backup" && -f "$migration_service_backup" ]]; then
    rm -f "$migration_service_backup" || true
  fi
  log "flat_migration_rolled_back"
}

on_exit() {
  local exit_code=$?
  if (( exit_code != 0 && promotion_attempted == 1 && promotion_committed == 0 )); then
    rollback_promotion || true
  fi
  if (( exit_code != 0 )); then
    quarantine_failed_candidates || true
    rollback_flat_migration || true
  fi
  release_lock || true
  exit "$exit_code"
}
trap on_exit EXIT

deploy_release() {
  local source_dir="$1"
  local release_id="$2"
  assert_release_id "$release_id"
  [[ -d "$source_dir" && ! -L "$source_dir" ]] || die "source_directory_invalid"
  assert_external_state
  acquire_lock
  local source_kib
  source_kib=$(du -xsk "$source_dir" | awk 'NR == 1 { print $1 + 0 }')
  phase="preflight"
  disk_preflight "$APP_ROOT" "$((source_kib * 2))"
  run_backup
  verify_backups
  ensure_managed_dirs
  local release_dir="$RELEASE_ROOT/$release_id"
  staging_release_dir="$STAGING_ROOT/$release_id"
  [[ ! -e "$release_dir" && ! -e "$staging_release_dir" ]] || die "release_id_already_exists"
  mkdir -p "$staging_release_dir"
  local staging_marker="$staging_release_dir/.natarot-managed-staging"
  printf 'release_id=%s\n' "$release_id" > "$staging_marker"
  cp -a "$source_dir/." "$staging_release_dir/"
  validate_candidate "$staging_release_dir"
  mv "$staging_release_dir" "$release_dir"
  staging_release_dir=""
  set_release_owner "$release_dir"
  write_revision_marker "$release_dir" "$release_id"
  candidate_release_dir="$release_dir"
  phase="candidate_health"
  systemctl_run start --wait "${CANDIDATE_SERVICE_PREFIX}${release_id}.service"
  http_smoke "http://127.0.0.1:$CANDIDATE_PORT/api/tarot/catalog?locale=en"
  systemctl_run stop "${CANDIDATE_SERVICE_PREFIX}${release_id}.service" || true
  old_current_target=$(reference_target "$CURRENT_LINK")
  phase="promotion"
  promotion_attempted=1
  promote_current "$release_id"
  systemctl_run restart "$SERVICE"
  production_health
  phase="success_mark"
  write_release_marker "$release_dir"
  rotate_references
  promotion_committed=1
  phase="post_success_cleanup"
  verify_backups
  cleanup_release_dirs
  cleanup_manager_staging
  printf 'deployment_success=true release_id=%s\n' "$release_id"
}

rollback_test() {
  local reference_name="$1"
  case "$reference_name" in
    previous-1|previous-2) ;;
    *) die "rollback_test_requires_previous_reference" ;;
  esac
  assert_external_state
  acquire_lock
  old_current_target=$(reference_target "$CURRENT_LINK")
  local rollback_target
  rollback_target=$(reference_target "$APP_ROOT/$reference_name")
  [[ "$rollback_target" != "$old_current_target" ]] || die "rollback_target_is_current"
  local rollback_id old_current_id
  rollback_id=$(release_id_from_path "$rollback_target")
  old_current_id=$(release_id_from_path "$old_current_target")
  promotion_attempted=1
  phase="rollback_test_switch"
  atomic_symlink "releases/$rollback_id" "$CURRENT_LINK"
  systemctl_run restart "$SERVICE"
  production_health
  phase="rollback_test_restore"
  atomic_symlink "releases/$old_current_id" "$CURRENT_LINK"
  systemctl_run restart "$SERVICE"
  production_health
  promotion_committed=1
  printf 'rollback_test_success=true tested=%s restored=%s\n' "$reference_name" "$old_current_id"
}

flat_entry_allowed() {
  local entry="$1"
  local name
  name=$(basename "$entry")
  if [[ -d "$entry" && ! -L "$entry" ]]; then
    case "$name" in
      .codex|.openai|.superpowers|app|build|components|db|deploy|dist|docs|drizzle|examples|hooks|lib|natarot-knowledge|node_modules|public|scripts|tests|vendor)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
  fi
  if [[ -f "$entry" ]]; then
    case "$name" in
      .gitignore|.npmrc|AGENTS.md|DEPLOYMENT_REVISION|README.md|cloudflare-env.d.ts|components.json|drizzle.config.ts|eslint.config.mjs|next.config.*|package-lock.json|package.json|postcss.config.mjs|tsconfig.json|vite.config.ts|._*)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
  fi
  return 1
}

prepare_migration_service_unit() {
  if [[ "${NATAROT_TEST_SKIP_SERVICE:-}" == 1 ]]; then
    return 0
  fi
  [[ -f "$SERVICE_UNIT_PATH" && ! -L "$SERVICE_UNIT_PATH" ]] || die "migration_service_unit_missing"
  [[ -n "$SERVICE_UNIT_SOURCE" && -f "$SERVICE_UNIT_SOURCE" && ! -L "$SERVICE_UNIT_SOURCE" ]] || die "migration_service_unit_source_required"
  grep -Fq "WorkingDirectory=$APP_ROOT" "$SERVICE_UNIT_PATH" || die "migration_requires_flat_service_unit"
  grep -Fq "WorkingDirectory=$CURRENT_LINK" "$SERVICE_UNIT_SOURCE" || die "migration_service_unit_source_not_current_topology"
  migration_service_backup="$STAGING_ROOT/.natarot-service-unit-backup.$$"
  assert_inside "$STAGING_ROOT" "$migration_service_backup"
  cp -p "$SERVICE_UNIT_PATH" "$migration_service_backup"
  chmod 0600 "$migration_service_backup"
}

copy_service_unit() {
  local source="$1"
  local destination="$2"
  if [[ "${NATAROT_TEST_SKIP_INSTALL:-}" == 1 ]]; then
    cp -p "$source" "$destination"
  else
    install -o root -g root -m 0644 "$source" "$destination"
  fi
}

install_migration_service_unit() {
  if [[ "${NATAROT_TEST_SKIP_SERVICE:-}" == 1 ]]; then
    return 0
  fi
  copy_service_unit "$SERVICE_UNIT_SOURCE" "$SERVICE_UNIT_PATH"
  migration_service_unit_updated=1
  systemctl_run daemon-reload
}

validate_flat_root() {
  local persistent
  persistent=$(find "$APP_ROOT" -xdev -type f \( -name '.env' -o -name '.env.*' -o -name '*.sqlite' -o -name '*.sqlite-*' \) -print -quit)
  [[ -z "$persistent" ]] || die "flat_root_contains_persistent_state"
  local entry
  while IFS= read -r -d '' entry; do
    case "$(basename "$entry")" in
      releases|current|previous-1|previous-2|.staging|.failed)
        continue
        ;;
    esac
    flat_entry_allowed "$entry" || die "flat_root_contains_unknown_entry path=$entry"
  done < <(find "$APP_ROOT" -mindepth 1 -maxdepth 1 -print0 | LC_ALL=C sort -z)
}

migrate_flat() {
  local release_id="$1"
  assert_release_id "$release_id"
  assert_external_state
  acquire_lock
  phase="migration_preflight"
  disk_preflight "$APP_ROOT"
  run_backup
  verify_backups
  ensure_managed_dirs
  [[ ! -L "$CURRENT_LINK" && ! -e "$CURRENT_LINK" ]] || die "flat_migration_current_reference_exists"
  local destination="$RELEASE_ROOT/$release_id"
  [[ ! -e "$destination" ]] || die "migration_release_exists"
  validate_flat_root
  migration_attempted=1
  migration_destination="$destination"
  prepare_migration_service_unit
  systemctl_run stop "$SERVICE"
  migration_service_stopped=1
  mkdir -p "$destination"
  local entry name
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    case "$name" in
        releases|current|previous-1|previous-2|.staging|.failed)
        continue
        ;;
    esac
    mv "$entry" "$destination/"
    migration_moved_entries+=("$entry")
  done < <(find "$APP_ROOT" -mindepth 1 -maxdepth 1 -print0 | LC_ALL=C sort -z)
  validate_candidate "$destination"
  set_release_owner "$destination"
  write_revision_marker "$destination" "$release_id"
  write_release_marker "$destination"
  atomic_symlink "releases/$release_id" "$CURRENT_LINK"
  install_migration_service_unit
  systemctl_run restart "$SERVICE"
  production_health
  migration_committed=1
  if [[ -n "$migration_service_backup" && -f "$migration_service_backup" ]]; then
    rm -f "$migration_service_backup"
    migration_service_backup=""
  fi
  printf 'flat_migration_success=true release_id=%s\n' "$release_id"
}

audit() {
  exec "$SCRIPT_DIR/natarot-storage-audit.sh"
}

usage() {
  cat <<'USAGE'
Usage:
  natarot-release-manager.sh audit
  natarot-release-manager.sh verify-backups
  natarot-release-manager.sh migrate-flat --release-id RELEASE_ID
  natarot-release-manager.sh deploy --source-dir DIRECTORY --release-id RELEASE_ID
  natarot-release-manager.sh rollback-test --to previous-1|previous-2
  natarot-release-manager.sh cleanup
USAGE
}

command_name="${1:-}"
shift || true
case "$command_name" in
  audit)
    (($# == 0)) || die "audit_takes_no_arguments"
    audit
    ;;
  verify-backups)
    (($# == 0)) || die "verify-backups_takes_no_arguments"
    verify_backups
    printf 'backup_policy_verified=true\n'
    ;;
  cleanup)
    (($# == 0)) || die "cleanup_takes_no_arguments"
    cleanup_all
    ;;
  migrate-flat)
    release_id=""
    while (($# > 0)); do
      case "$1" in
        --release-id)
          [[ $# -ge 2 ]] || die "release_id_missing"
          release_id="$2"
          shift 2
          ;;
        *) die "unknown_migration_argument=$1" ;;
      esac
    done
    [[ -n "$release_id" ]] || die "release_id_required"
    migrate_flat "$release_id"
    ;;
  deploy)
    source_dir=""
    release_id=""
    while (($# > 0)); do
      case "$1" in
        --source-dir)
          [[ $# -ge 2 ]] || die "source_directory_missing"
          source_dir="$2"
          shift 2
          ;;
        --release-id)
          [[ $# -ge 2 ]] || die "release_id_missing"
          release_id="$2"
          shift 2
          ;;
        *) die "unknown_deploy_argument=$1" ;;
      esac
    done
    [[ -n "$source_dir" && -n "$release_id" ]] || die "source_directory_and_release_id_required"
    deploy_release "$source_dir" "$release_id"
    ;;
  rollback-test)
    target_reference=""
    while (($# > 0)); do
      case "$1" in
        --to)
          [[ $# -ge 2 ]] || die "rollback_target_missing"
          target_reference="$2"
          shift 2
          ;;
        *) die "unknown_rollback_argument=$1" ;;
      esac
    done
    [[ -n "$target_reference" ]] || die "rollback_target_required"
    rollback_test "$target_reference"
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
