#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C

app_root="${NATAROT_APP_ROOT:-/opt/natarot}"
backup_root="${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
lock_path="${NATAROT_DEPLOY_LOCK:-/run/lock/natarot-deploy.lock}"
dry_run=0
post_deploy_confirmed=0

die() {
  printf 'VPS STORAGE GUARD: FAIL — %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: prune-production-releases.sh [--dry-run] [--post-deploy-confirmed]

Inspect the production release/backup footprint and, only after an explicit
healthy post-deploy confirmation, retain the active release plus two newest
rollback releases. Database backups and active logs are never deleted.

When the caller already owns the deployment lock for the complete deployment,
pass its inherited descriptor as NATAROT_DEPLOY_LOCK_FD.
EOF
}

for argument in "$@"; do
  case "$argument" in
    --dry-run)
      dry_run=1
      ;;
    --post-deploy-confirmed)
      post_deploy_confirmed=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown option: ${argument}"
      ;;
  esac
done

if (( dry_run == 0 && post_deploy_confirmed == 0 )); then
  die "post-deploy confirmation is required before release cleanup"
fi

app_parent="$(dirname -- "$app_root")"
app_name="$(basename -- "$app_root")"

[[ "$app_name" == "natarot" ]] || die "application root must end in /natarot"
[[ "$app_parent" != "/" && "$app_parent" != "." ]] || die "application parent is unsafe"
[[ -d "$app_root" ]] || die "current application release is missing: ${app_root}"
[[ -d "$backup_root" ]] || die "backup root is missing: ${backup_root}"

parent_real="$(readlink -f -- "$app_parent")" || die "cannot resolve application parent"
current_real="$(readlink -f -- "$app_root")" || die "cannot resolve current release"
backup_real="$(readlink -f -- "$backup_root")" || die "cannot resolve backup root"

[[ -d "$current_real" ]] || die "current release target is not a directory"
[[ "$current_real" != "/" && "$current_real" != "$parent_real" ]] || die "current release resolves to an unsafe path"
[[ "$backup_real" != "$current_real" ]] || die "backup root overlaps the current release"
case "$backup_real" in
  "$parent_real"|"$parent_real"/*)
    die "backup root overlaps the release parent"
    ;;
esac

lock_parent="$(dirname -- "$lock_path")"
[[ -d "$lock_parent" ]] || die "deployment lock directory is missing: ${lock_parent}"

umask 077
if [[ -n "${NATAROT_DEPLOY_LOCK_FD:-}" ]]; then
  [[ "${NATAROT_DEPLOY_LOCK_FD}" =~ ^[0-9]+$ ]] || die "deployment lock fd is invalid"
  command -v flock >/dev/null 2>&1 || die "flock is required when reusing an inherited deployment lock"
  flock -n "${NATAROT_DEPLOY_LOCK_FD}" || die "the inherited deployment lock is not held"
elif command -v flock >/dev/null 2>&1; then
  exec 9>"$lock_path" || die "cannot open deployment lock: ${lock_path}"
  flock -n 9 || die "another deployment or cleanup is already running"
else
  lock_directory="${lock_path}.d"
  mkdir "$lock_directory" 2>/dev/null || die "another deployment or cleanup is already running"
  trap 'rmdir "$lock_directory" 2>/dev/null || true' EXIT
fi

disk_line() {
  df -hP -- "$app_root" | awk 'NR == 2 { print; exit }'
}

used_kib() {
  df -Pk -- "$app_root" | awk 'NR == 2 { print $3; exit }'
}

size_line() {
  du -sh -- "$1" | awk '{ print $1; exit }'
}

service_release_references=""
if command -v systemctl >/dev/null 2>&1; then
  service_release_references="$(systemctl show natarot.service -p ExecStart -p ExecStartPre --value 2>/dev/null || true)"
fi

disk_before="$(disk_line)"
used_before_kib="$(used_kib)"
release_size_before="$(size_line "$app_root")"
backup_size="$(size_line "$backup_root")"

rollback_paths=()
while IFS= read -r -d '' candidate; do
  [[ -d "$candidate" && ! -L "$candidate" ]] || die "rollback candidate is not a real directory: ${candidate}"
  candidate_real="$(readlink -f -- "$candidate")" || die "cannot resolve rollback candidate: ${candidate}"
  [[ "$candidate_real" == "$parent_real/${app_name}.rollback-"* ]] || die "rollback candidate escapes the release parent: ${candidate}"
  [[ "$candidate_real" != "$current_real" ]] || die "current release is also named as a rollback: ${candidate}"
  rollback_paths+=("$candidate_real")
done < <(find "$app_parent" -mindepth 1 -maxdepth 1 -name "${app_name}.rollback-*" -print0)

if ((${#rollback_paths[@]} > 0)); then
  sorted_rollback_paths=()
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] && sorted_rollback_paths+=("$candidate")
  done < <(printf '%s\n' "${rollback_paths[@]}" | sort -r)
  rollback_paths=("${sorted_rollback_paths[@]}")
fi

release_count_before=${#rollback_paths[@]}
application_releases_before=$((release_count_before + 1))
removed_count=0
removed_paths=()

if (( post_deploy_confirmed == 1 && dry_run == 0 )); then
  ((release_count_before >= 2)) || die "fewer than two rollback releases exist; refusing cleanup"

  for ((index = 2; index < release_count_before; index += 1)); do
    candidate="${rollback_paths[index]}"
    [[ "$candidate" == "$parent_real/${app_name}.rollback-"* ]] || die "refusing an unvalidated deletion target"
    [[ -d "$candidate" && ! -L "$candidate" ]] || die "deletion target is no longer a real directory: ${candidate}"
    candidate_real="$(readlink -f -- "$candidate")" || die "cannot resolve deletion target: ${candidate}"
    [[ "$candidate_real" == "$candidate" ]] || die "deletion target resolves through a symlink: ${candidate}"
    [[ "$candidate_real" != "$current_real" && "$candidate_real" != "$parent_real" && "$candidate_real" != "/" ]] || die "deletion target overlaps a protected path"
    [[ "$service_release_references" != *"$candidate"* ]] || die "deletion target is referenced by natarot.service: ${candidate}"
    rm -rf -- "$candidate"
    removed_paths+=("$candidate")
    ((removed_count += 1))
  done
fi

rollback_paths_after=()
while IFS= read -r -d '' candidate; do
  [[ -d "$candidate" && ! -L "$candidate" ]] || die "rollback candidate changed into an unsafe object: ${candidate}"
  candidate_real="$(readlink -f -- "$candidate")" || die "cannot resolve retained rollback: ${candidate}"
  [[ "$candidate_real" == "$parent_real/${app_name}.rollback-"* ]] || die "retained rollback escapes the release parent: ${candidate}"
  [[ "$candidate_real" != "$current_real" ]] || die "current release was not protected"
  rollback_paths_after+=("$candidate_real")
done < <(find "$app_parent" -mindepth 1 -maxdepth 1 -name "${app_name}.rollback-*" -print0)

if ((${#rollback_paths_after[@]} > 0)); then
  sorted_rollback_paths_after=()
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] && sorted_rollback_paths_after+=("$candidate")
  done < <(printf '%s\n' "${rollback_paths_after[@]}" | sort -r)
  rollback_paths_after=("${sorted_rollback_paths_after[@]}")
fi

(( ${#rollback_paths_after[@]} >= 2 )) || die "cleanup left fewer than two rollback releases"
[[ -d "$current_real" ]] || die "current release disappeared during cleanup"
application_releases_after=$((${#rollback_paths_after[@]} + 1))

disk_after="$(disk_line)"
used_after_kib="$(used_kib)"
release_size_after="$(size_line "$app_root")"
space_reclaimed_kib=$((used_before_kib - used_after_kib))
((space_reclaimed_kib < 0)) && space_reclaimed_kib=0

guard_status="PASS"
if (( dry_run == 1 )); then
  guard_status="PASS (dry-run; no release removed)"
fi

printf 'VPS STORAGE GUARD: %s\n' "$guard_status"
printf 'DISK BEFORE: %s\n' "$disk_before"
printf 'DISK AFTER: %s\n' "$disk_after"
printf 'SPACE RECLAIMED: %s KiB\n' "$space_reclaimed_kib"
printf 'APPLICATION RELEASES BEFORE: %s\n' "$application_releases_before"
printf 'APPLICATION RELEASES AFTER: %s\n' "$application_releases_after"
printf 'APPLICATION RELEASE SIZE BEFORE: %s\n' "$release_size_before"
printf 'APPLICATION RELEASE SIZE AFTER: %s\n' "$release_size_after"
printf 'BACKUP SIZE: %s\n' "$backup_size"
printf 'CURRENT RELEASE: %s\n' "$current_real"
printf 'ROLLBACK 1: %s\n' "${rollback_paths_after[0]}"
printf 'ROLLBACK 2: %s\n' "${rollback_paths_after[1]}"
printf 'OLD RELEASES REMOVED: %s\n' "$removed_count"
if ((${#removed_paths[@]} > 0)); then
  printf 'REMOVED RELEASE PATHS: %s\n' "${removed_paths[*]}"
else
  printf 'REMOVED RELEASE PATHS: none\n'
fi
printf 'TEMP ARTIFACTS REMOVED: 0 (no inactive candidate was positively identified)\n'
printf 'DATABASE BACKUPS TOUCHED: NO\n'
printf 'BACKUP RETENTION: PASS (backup tree was inspected but not modified)\n'
printf 'LOG RETENTION: PASS (active logs were not modified)\n'
printf 'DEPLOY CLEANUP AUTOMATED: YES\n'
