#!/usr/bin/env bash

set -Eeuo pipefail

lock_path="${NATAROT_DEPLOY_LOCK_PATH:-/run/lock/natarot-deploy.lock}"
node_bin="${NATAROT_NODE_BIN:-/usr/local/bin/node}"
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"

mkdir -p "$(dirname "$lock_path")"
exec 9>"$lock_path"
if ! flock -n 9; then
  printf 'deployment lock is busy: %s\n' "$lock_path" >&2
  exit 75
fi

arguments=(
  "$script_dir/production-release-retention.mjs"
  --root "${NATAROT_RELEASE_ROOT:-/opt}"
  --active "${NATAROT_ACTIVE_RELEASE:-/opt/natarot}"
  --backup-root "${NATAROT_BACKUP_ROOT:-/var/backups/natarot}"
  --temp-root "${NATAROT_DEPLOY_TEMP_ROOT:-/tmp}"
)

if [[ "${NATAROT_RETENTION_EXECUTE:-0}" == "1" ]]; then
  arguments+=(--execute --cleanup-temp)
fi

exec "$node_bin" "${arguments[@]}" "$@"
