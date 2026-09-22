# NaTarot production storage guard

This is the canonical post-deploy cleanup contract for the VPS production
release tree. It applies to the current production deployment and every
future production deployment. It is separate from database-backup retention:
the application release policy is **current + two previous successful
releases**; the database backup policy remains the already-approved
`7 daily / 4 weekly / 3 monthly` policy unless operations has recorded a
newer canonical policy.

The checked-in guard is
[`scripts/prune-production-releases.sh`](../../scripts/prune-production-releases.sh).
It is path-safe, symlink-aware, lock-aware, idempotent, and refuses to delete
anything until a healthy post-deploy confirmation is explicit. It never
deletes the production database, WAL/journal files, environment/secrets,
persistent uploads, backup files, active logs, Nginx/systemd configuration, or
the active release.

## Required deployment sequence

Use one lock for the complete production deployment, including candidate
preparation, cutover, health checks, and cleanup. On the VPS, the standard
lock is `/run/lock/natarot-deploy.lock`:

```bash
exec 9>/run/lock/natarot-deploy.lock
flock -x 9
```

Before creating a candidate, record the storage baseline without deleting
anything:

```bash
NATAROT_DEPLOY_LOCK_FD=9 \
  /opt/natarot/scripts/prune-production-releases.sh --dry-run
```

The output records `DISK BEFORE`, application release count/size, backup size,
the current release, and both required rollback positions. Keep that output in
the deployment report.

Only after the service, local health endpoint, public health endpoint, and
real production browser smoke are healthy, run:

```bash
NATAROT_DEPLOY_LOCK_FD=9 \
  /opt/natarot/scripts/prune-production-releases.sh --post-deploy-confirmed
```

The guard sorts timestamped `natarot.rollback-*` directories, retains the
current release and the two newest rollback directories, and removes only
older validated release directories. It resolves real paths before every
deletion and aborts if fewer than two rollback releases would remain. A
failed or abandoned `natarot.release-*` candidate is not guessed at or
wildcard-deleted; clean one only after a separate operator audit proves that
it is inactive and not referenced by the service, rollback mechanism, or
another deployment.

## Required report fields

Every successful production deployment report must include the guard output:

```text
VPS STORAGE GUARD: PASS / FAIL
DISK BEFORE:
DISK AFTER:
SPACE RECLAIMED:
APPLICATION RELEASES BEFORE:
APPLICATION RELEASES AFTER:
CURRENT RELEASE:
ROLLBACK 1:
ROLLBACK 2:
OLD RELEASES REMOVED:
TEMP ARTIFACTS REMOVED:
DATABASE BACKUPS TOUCHED: NO
BACKUP RETENTION: PASS / FAIL
LOG RETENTION: PASS / FAIL
DEPLOY CLEANUP AUTOMATED: YES
```

If health checks fail, do not run post-deploy pruning. Preserve the known-good
release and the required backup, roll back if necessary, and remove only a
positively identified inactive failed candidate after the deployment lock is
held. If the storage guard cannot safely restore headroom without touching
protected data or backups, stop and report the storage breakdown.
