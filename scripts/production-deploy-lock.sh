#!/usr/bin/env bash

set -Eeuo pipefail

lock_path="${NATAROT_DEPLOY_LOCK_PATH:-/run/lock/natarot-deploy.lock}"
if [[ "${1:-}" != "--" || "$#" -lt 2 ]]; then
  printf '%s\n' 'usage: production-deploy-lock.sh -- command [args...]' >&2
  exit 64
fi
shift

mkdir -p "$(dirname "$lock_path")"
exec 9>"$lock_path"
if ! flock -n 9; then
  printf 'deployment lock is busy: %s\n' "$lock_path" >&2
  exit 75
fi

exec "$@"
