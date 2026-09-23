# NaTarot production release and storage guard

NaTarot production releases use a managed release topology. The active service
must run from `/opt/natarot/current`, which is a symlink to one successful
release under `/opt/natarot/releases/<release-id>`. `/opt/natarot/previous-1`
and `/opt/natarot/previous-2` are the only protected rollback references.
`/opt/natarot/.staging` and `/opt/natarot/.failed` are reserved for the release
manager's serialized candidate and failure handling.

## Required workflow

Every production deployment runs under `/run/lock/natarot-deploy.lock` through
the installed `/usr/local/sbin/natarot-release-manager`. Before a release is
copied, the manager checks filesystem headroom (at least 1 GiB and 10% free by
default), verifies the latest checksum-checked backup and restore-test status,
and rejects candidates containing environment files, databases, logs, private
keys or persistent upload/data directories. Candidate and production health
probes use bounded retries so a normal Vinext listener warm-up cannot turn a
healthy release into a false rollback.

After a successful health-gated promotion, cleanup retains exactly the current
release and the two protected rollback releases. It removes only successful
release directories outside those references and managed staging directories
that carry the manager marker. Failed or incomplete candidates are quarantined
until they are proven inactive. The manager resolves paths and checks active
processes before deletion; it never removes the database, WAL/journal files,
environment/secrets, persistent uploads, Nginx/systemd configuration, or
database backup retention sets.

Database backups remain a separate retention domain. The manager verifies the
installed policy and current `latest-success`/restore-test records; it does not
apply the three-release application rule to backup archives. The observed
canonical policy is seven daily, one weekly, and one monthly archive. Log
growth remains under the host's canonical `logrotate`/journald policy.

The first migration from the historical flat tree must be run once with the
versioned current-topology unit as its source:

```sh
NATAROT_SERVICE_UNIT_SOURCE=/path/to/deploy/systemd/natarot.service \
  /usr/local/sbin/natarot-release-manager migrate-flat --release-id RELEASE_ID
```

Normal releases use:

```sh
/usr/local/sbin/natarot-release-manager deploy \
  --source-dir /path/to/verified-candidate \
  --release-id RELEASE_ID
```

Before and after each deploy, record `df -h`, the storage audit, current and
rollback paths, release sizes, backup size, and the exact cleanup result. If
headroom is insufficient, remove only positively identified inactive obsolete
application releases or failed deployment artifacts before creating another
candidate; never trade away protected backups or persistent data to force a
release through.

## Versioned guard helpers

The repository includes a read-only audit and post-success guard for local or
host-installed deployment tooling:

```sh
npm run deploy:production:storage-audit
npm run deploy:production:storage-cleanup
```

The retention wrapper shares the same deployment lock and can be used by a
release adapter that supplies the verified release markers:

```sh
scripts/production-deploy-lock.sh -- <atomic-deploy-command>
NATAROT_RETENTION_EXECUTE=1 scripts/production-release-retention.sh
```

The helpers resolve `/opt/natarot/current`, `previous-1`, and `previous-2`
before any deletion, retain the current release plus two newest successful
rollback releases, skip symlinks and unknown paths, and remove only explicitly
recognized inactive artifacts. They never touch database backups, WAL files,
environment/secrets, persistent data, TLS, Nginx, systemd, or active logs.

## Deployment report contract

Each successful deployment records disk before/after, reclaimed space, release
counts and paths before/after, deleted releases, temporary artifacts removed,
database backups touched (`NO` for application cleanup), backup and log
retention checks, and whether cleanup was automated. Rollback verification must
confirm that all three managed references resolve to distinct healthy releases
before a cleanup step is allowed to delete anything.
