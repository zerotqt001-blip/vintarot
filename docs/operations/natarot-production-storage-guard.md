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
apply the three-release application rule to backup archives. Log growth remains
under the host's canonical `logrotate`/journald policy.

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

Before and after each deploy, record `df -h`, the storage audit, current/rollback
paths, release sizes, backup size, and the exact cleanup result. If headroom
is insufficient, remove only positively identified inactive obsolete
application releases or failed deployment artifacts before creating another
candidate; never trade away protected backups or persistent data to force a
release through.
