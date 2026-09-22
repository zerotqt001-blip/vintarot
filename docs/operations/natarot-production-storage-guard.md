# NaTarot production storage guard

Every production deployment must run the storage guard under the shared
deployment lock. The guard is deliberately separate from database backup
retention: it prunes only positively identified application release
directories and marked temporary deployment artifacts.

## Before a release switch

Run a read-only inventory and record:

- df -h for the filesystem containing /opt and /var/backups/natarot;
- the size of /opt/natarot, known rollback directories, staging and
  temporary deployment locations;
- the application release count and total application-release size;
- the database-backup size and the backup/restore status metadata;
- journald/logrotate usage.

Do not create a candidate release while free space is dangerously low. First
run a read-only inventory and review its JSON report:

~~~sh
scripts/production-release-retention.sh
~~~

The tool recognizes only direct children named natarot.rollback-* or
natarot.previous-* with a valid DEPLOYMENT_REVISION marker. Unknown
directories remain untouched.

## After health passes

The deploy/switch and cleanup operations use the same flock lock:

~~~sh
scripts/production-deploy-lock.sh -- <atomic-deploy-command>
NATAROT_RETENTION_EXECUTE=1 scripts/production-release-retention.sh
~~~

The execute step keeps the current release plus the two newest successful
rollback releases. It resolves and rechecks real paths and deployment markers
before deletion, skips symlinks and paths outside the application root, and
never touches the database, environment, uploads, TLS, Nginx, systemd or
backup-retention directories. Marked stale candidates and exact
/tmp/natarot-release-*.tar.gz artifacts are removed only when older than the
guard grace period.

The cleanup must run only after all of these pass:

- the active service is healthy;
- the local health endpoint and real production smoke checks pass;
- the current release path and its marker are confirmed;
- the previous and second-previous successful releases are present.

If a deploy fails, do not prune known-good releases. Roll back first and
remove only the inactive failed candidate after revalidation.

## Backup and logs

The production backup service is authoritative for database retention. The
installed policy is seven daily, four weekly and three monthly archives. The
storage guard reports backup retention as not touched and does not delete
database backups. The restore-test timer remains independent.

Logs remain under journald/logrotate policy. The storage guard reports log
retention as not touched; unexpectedly large logs require a separate rotation
fix, not manual deletion of active logs.
