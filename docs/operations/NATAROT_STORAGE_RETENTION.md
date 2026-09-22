# NaTarot VPS storage retention operations

This runbook covers the production application-release topology only. It does not rotate credentials, copy the production database, delete staging history, or classify arbitrary `/opt` trees as disposable.

The production layout is:

~~~text
/opt/natarot/current    -> releases/<active-release>
/opt/natarot/previous-1 -> releases/<previous-release>
/opt/natarot/previous-2 -> releases/<older-release>
/opt/natarot/releases/<release-id>/
/opt/natarot/.staging/
/opt/natarot/.failed/
~~~

The database, environment file, backups, and OS configuration remain outside releases:

~~~text
/var/lib/natarot/natarot.sqlite
/etc/natarot.env
/var/backups/natarot/
~~~

## SSH and read-only audit

Use the existing local SSH alias. Do not print `/etc/natarot.env`, private keys, database contents, or application logs containing user data.

~~~bash
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-storage-audit'
ssh -o BatchMode=yes natarot-vps 'df -h / /opt /var/lib /var/backups; systemctl show natarot.service -p MainPID -p WorkingDirectory -p ExecStart --no-pager'
ssh -o BatchMode=yes natarot-vps 'find /opt -mindepth 1 -maxdepth 1 -type d -name "natarot*" -printf "%f\\n" | sort'
~~~

The audit is read-only. Every release is disposable only when it is below the managed release root, has `DEPLOYMENT_SUCCESS`, is outside `current`/`previous-1`/`previous-2`, and has no active process cwd or executable reference. Historical `/opt/natarot.*` trees, `/opt/natarot-staging*`, failed trees, and unknown paths remain protected until separately classified.

Stop before mutation when the audit finds an unexpected database, environment file, upload/user-data directory, outside-root symlink, active process in a release that would be removed, or less than the configured absolute free-space floor.

## Backup gate

The existing backup service remains the only database-backup writer. Run it and then validate its status before stopping production or moving application files:

~~~bash
ssh -o BatchMode=yes natarot-vps 'systemctl start --wait natarot-backup.service'
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager verify-backups'
ssh -o BatchMode=yes natarot-vps 'systemctl show natarot-backup.timer -p ActiveState -p Unit --no-pager'
~~~

The verifier requires a successful status, matching archive/checksum sidecar, recent backup timestamp, successful restore-test status, and archive counts within the existing 7 daily / 4 weekly / 3 monthly policy. Release cleanup never traverses `/var/backups/natarot`.
## Install the reviewed release tooling

Run these commands only after the read-only audit and backup gate pass. The source files contain no secrets. During the flat migration, keep the existing flat production unit in place; the migration command installs the reviewed `current`-based unit only after the files and `current` reference are ready, and restores the recorded flat unit automatically on failure.

~~~bash
scp deploy/release/natarot-storage-audit.sh deploy/release/natarot-release-manager.sh natarot-vps:/usr/local/sbin/
scp deploy/systemd/natarot.service deploy/systemd/natarot-candidate@.service deploy/systemd/journald-natarot-retention.conf natarot-vps:/tmp/
ssh -o BatchMode=yes natarot-vps 'install -o root -g root -m 0750 /usr/local/sbin/natarot-storage-audit.sh /usr/local/sbin/natarot-storage-audit && install -o root -g root -m 0750 /usr/local/sbin/natarot-release-manager.sh /usr/local/sbin/natarot-release-manager && install -o root -g root -m 0644 /tmp/natarot-candidate@.service /etc/systemd/system/natarot-candidate@.service && install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d && install -o root -g root -m 0644 /tmp/journald-natarot-retention.conf /etc/systemd/journald.conf.d/natarot-retention.conf && systemctl daemon-reload'
~~~

Inspect the installed files before restarting production:

~~~bash
ssh -o BatchMode=yes natarot-vps 'systemd-analyze verify /etc/systemd/system/natarot.service /etc/systemd/system/natarot-candidate@.service; systemd-analyze cat-config systemd/journald.conf'
~~~

The candidate binds only to 127.0.0.1:8878; production remains on 127.0.0.1:8787. The candidate uses /etc/natarot.env and the external database configuration, and never runs the production migration pre-start.

## One-time flat-layout migration

The migration moves the existing application entries on the same filesystem. It does not copy the database or environment. The manager stops production only after the backup gate, validates the flat-root allowlist, creates a successful release marker, creates current, reloads systemd, restarts production, and checks the catalog and home endpoints.

~~~bash
ssh -o BatchMode=yes natarot-vps 'NATAROT_SERVICE_UNIT_SOURCE=/tmp/natarot.service /usr/local/sbin/natarot-release-manager migrate-flat --release-id flat-YYYYMMDDTHHMMSSZ'
~~~

NATAROT_MIN_FREE_PERCENT=0 is an emergency migration override for the audited VPS baseline when the filesystem is below 10% free. It is valid only for the no-copy, same-filesystem migration after the absolute 1 GiB floor and backup gate pass. Normal deployments retain the default 10% free-space requirement and add candidate-size headroom.

Verify the result without printing configuration values:

~~~bash
ssh -o BatchMode=yes natarot-vps 'readlink -f /opt/natarot/current; readlink -f /opt/natarot/previous-1 2>/dev/null || true; readlink -f /opt/natarot/previous-2 2>/dev/null || true; systemctl is-active natarot.service; systemctl show natarot.service -p MainPID -p WorkingDirectory --no-pager'
ssh -o BatchMode=yes natarot-vps 'curl -fsS --max-time 15 http://127.0.0.1:8787/api/tarot/catalog?locale=en >/dev/null && curl -fsS --max-time 15 http://127.0.0.1:8787/ >/dev/null'
ssh -o BatchMode=yes natarot-vps 'curl -fsS --max-time 15 https://natarot.com/api/tarot/catalog?locale=en >/dev/null && curl -fsS --max-time 15 https://natarot.com/ >/dev/null'
~~~

If migration or health checks fail, stop and use the recorded service-unit backup and the manager flat-migration rollback path. Do not delete the former flat tree or historical /opt/natarot.* trees during this step.
## Normal candidate deployment

Place a reviewed build at an explicit, manager-owned incoming path and ensure it contains the built server entrypoint and runtime dependencies. The manager rejects environment files, SQLite/WAL/SHM files, private-key material, persistent-state directories, outside-root symlinks, and existing release IDs.

~~~bash
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager deploy --source-dir /opt/natarot/.incoming/RELEASE_ID --release-id RELEASE_ID'
~~~

The sequence is locked and fail-closed: backup, disk preflight, staging validation, candidate service on port 8878, candidate smoke, atomic promotion, production restart, catalog/home/browser smoke, success marker, reference rotation, and only then cleanup. A failed candidate is quarantined under /opt/natarot/.failed; a failed production promotion restores the prior current target and does not clean releases.

## Retention and cleanup

Run cleanup only after a successful migration/deployment marker and a fresh backup verification:

~~~bash
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager verify-backups'
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager cleanup'
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-storage-audit'
~~~

Cleanup removes only successful release directories outside the three resolved references and manager-owned staging entries with the manager marker. It preserves the database/WAL/SHM files, environment, backups, staging environment, current and rollback references, active process paths, dependency pools, and unknown directories. It never applies the three-release rule to backups or /opt/natarot-staging.

## Rollback test

After at least one protected rollback reference exists, test it and automatically restore the intended current release:

~~~bash
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager rollback-test --to previous-1'
~~~

The manager holds the deployment lock, switches only to a validated protected reference, restarts production, checks catalog/home/browser health, switches back, and checks health again. It does not delete or rotate references during this test. If either health check fails, it restores the original current target and stops for operator review.

## Logs, caches, and staging

Install the journald drop-in, then inspect the effective policy before reloading journald:

~~~bash
ssh -o BatchMode=yes natarot-vps 'systemd-analyze cat-config systemd/journald.conf; journalctl --disk-usage; logrotate -d /etc/logrotate.d/nginx'
~~~

The drop-in bounds journald to SystemMaxUse=256M, RuntimeMaxUse=128M, SystemKeepFree=1G, and MaxRetentionSec=14day. Nginx keeps its existing /etc/logrotate.d/nginx policy; do not install a competing rule. Cache paths and the separate staging environment are audited but are not automatically deleted by this V1 manager.

## Final evidence checklist

Record command outputs as status metadata only—counts, paths, timestamps, service state, and health result—not secrets or user data:

~~~bash
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-storage-audit'
ssh -o BatchMode=yes natarot-vps 'systemctl is-active natarot.service; systemctl show natarot.service -p MainPID -p WorkingDirectory --no-pager'
ssh -o BatchMode=yes natarot-vps '/usr/local/sbin/natarot-release-manager verify-backups'
ssh -o BatchMode=yes natarot-vps 'find /opt/natarot/releases -mindepth 1 -maxdepth 1 -type d -printf "%f\\n" | sort'
ssh -o BatchMode=yes natarot-vps 'curl -fsS --max-time 15 https://natarot.com/api/tarot/catalog?locale=en >/dev/null && curl -fsS --max-time 15 https://natarot.com/ >/dev/null'
~~~

If any command reports an unknown path, an outside-root reference, a failed backup/restore test, insufficient headroom, a failed health check, or an active process reference, stop before cleanup and preserve the evidence for classification.
