#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly APP_ROOT="${NATAROT_APP_ROOT:-/opt/natarot}"
readonly RELEASE_ROOT="${NATAROT_RELEASE_ROOT:-$APP_ROOT/releases}"
readonly STAGING_ROOT="${NATAROT_STAGING_ROOT:-$APP_ROOT/.staging}"
readonly FAILED_ROOT="${NATAROT_FAILED_ROOT:-$APP_ROOT/.failed}"
readonly BACKUP_ROOT="${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
readonly DB_ROOT="${NATAROT_DB_ROOT:-/var/lib/natarot}"
readonly DB_PATH="${NATAROT_DB_PATH:-$DB_ROOT/natarot.sqlite}"
readonly HISTORY_ROOT="${NATAROT_HISTORY_ROOT:-$(dirname "$APP_ROOT")}"
readonly APP_NAME="$(basename "$APP_ROOT")"
readonly LOG_ROOT="${NATAROT_LOG_ROOT:-/var/log}"
readonly CACHE_ROOT="${NATAROT_CACHE_ROOT:-/var/cache}"
readonly MIN_FREE_KIB="${NATAROT_MIN_FREE_KIB:-1048576}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'missing required command: %s\n' "$1" >&2
    exit 70
  }
}

for command_name in awk basename df du find readlink sort; do
  require_command "$command_name"
done

bytes_for() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    du -xsk "$path" 2>/dev/null | awk 'NR == 1 { print ($1 + 0) * 1024; found = 1 } END { if (!found) print 0 }'
  else
    printf '0\n'
  fi
}

emit() {
  local category="$1"
  local path="$2"
  local classification="$3"
  printf 'category=%s path=%s bytes=%s classification=%s\n' \
    "$category" "$path" "$(bytes_for "$path")" "$classification"
}

emit_optional() {
  local category="$1"
  local path="$2"
  local classification="$3"
  if [[ -e "$path" || -L "$path" ]]; then
    emit "$category" "$path" "$classification"
  else
    printf 'category=%s path=%s bytes=0 classification=missing\n' "$category" "$path"
  fi
}

filesystem_line=$(df -Pk "$APP_ROOT" | awk 'NR == 2 { print $2, $3, $4, $5, $6; found = 1 } END { if (!found) exit 1 }') || {
  printf 'unable to inspect filesystem for %s\n' "$APP_ROOT" >&2
  exit 66
}
read -r filesystem_kib used_kib free_kib use_percent mount_point <<< "$filesystem_line"
printf 'category=filesystem path=%s bytes=%s classification=capacity total_kib=%s used_kib=%s free_kib=%s use_percent=%s mount=%s min_free_kib=%s\n' \
  "$mount_point" "$((filesystem_kib * 1024))" "$filesystem_kib" "$used_kib" "$free_kib" "$use_percent" "$mount_point" "$MIN_FREE_KIB"

emit application-root "$APP_ROOT" application-root
emit application-releases "$RELEASE_ROOT" application-release-root
emit_optional application-staging "$STAGING_ROOT" deployment-staging
emit_optional application-failed "$FAILED_ROOT" failed-release-quarantine
emit database-root "$DB_ROOT" database
emit_optional database "$DB_PATH" database
emit database-backup "$BACKUP_ROOT" database-backup
emit log-root "$LOG_ROOT" application-and-system-logs
emit cache-root "$CACHE_ROOT" regenerable-cache

if [[ -d "$RELEASE_ROOT" ]]; then
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    if [[ -d "$entry" && -f "$entry/DEPLOYMENT_SUCCESS" ]]; then
      emit release "$entry" application-release
    else
      emit release "$entry" unknown
    fi
  done < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -print0 | LC_ALL=C sort -z)
fi

if [[ -d "$APP_ROOT" ]]; then
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    case "$name" in
      releases|current|previous-1|previous-2|.staging|.failed)
        continue
        ;;
      node_modules|dist|build|app|components|db|drizzle|hooks|lib|public|scripts|tests|vendor|docs|natarot-knowledge|.openai|.superpowers|.codex|DEPLOYMENT_REVISION|DEPLOYMENT_SUCCESS)
        emit application-entry "$entry" application-tree
        ;;
      *)
        emit application-entry "$entry" unknown
        ;;
    esac
  done < <(find "$APP_ROOT" -mindepth 1 -maxdepth 1 -print0 | LC_ALL=C sort -z)
fi

if [[ -d "$HISTORY_ROOT" ]]; then
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    classification="unknown"
    case "$name" in
      "$APP_NAME-deps")
        classification="application-dependency-pool"
        ;;
      "$APP_NAME-staging")
        classification="staging-environment"
        ;;
      "$APP_NAME-staging."*)
        classification="staging-history"
        ;;
      "$APP_NAME.failed."*|"$APP_NAME.candidate-failed."*)
        classification="failed-release-quarantine"
        ;;
      "$APP_NAME."*)
        if [[ -f "$entry/DEPLOYMENT_SUCCESS" ]]; then
          classification="historical-successful-application-release"
        fi
        ;;
      "$APP_NAME-"*)
        classification="unknown"
        ;;
    esac
    emit historical-entry "$entry" "$classification"
  done < <(find "$HISTORY_ROOT" -mindepth 1 -maxdepth 1 -type d \( -name "$APP_NAME.*" -o -name "$APP_NAME-*" \) -print0 | LC_ALL=C sort -z)
fi

printf 'audit_complete=true\n'
