# NaTarot Staging Environment V1 Design

## Status

Approved for implementation on `codex/natarot-staging-v1`.

## Goal

Provide a real, isolated public HTTPS staging destination for NaTarot without
changing production, production data, production secrets, or the SePay
implementation. The destination must be ready to host a future callback at
`https://staging.natarot.com/api/commercial/sepay/ipn` after the parent SePay
mission creates that route.

## Source and delivery boundary

- Application source base: `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` from
  `codex/natarot-integration-v1`.
- Commercial architecture reference: `ea5da48a50644e2fbbee888a8385043765fb5c00`.
- Delivery branch: `codex/natarot-staging-v1`.
- Production remains `natarot.com` and continues to use `natarot.service`.
- No SePay route, SePay secret, Credits/VIP schema, Affiliate behavior, or
  production deployment is included.

## Architecture

The staging runtime shares the existing VPS host but has independent mutable
boundaries:

```text
staging.natarot.com
  -> Nginx staging virtual host
  -> 127.0.0.1:8788
  -> natarot-staging.service
  -> /opt/natarot-staging
  -> /var/lib/natarot-staging/natarot.sqlite
```

The production path remains separate:

```text
natarot.com / www.natarot.com
  -> existing Nginx production virtual host
  -> 127.0.0.1:8787
  -> natarot.service
  -> /opt/natarot
  -> /var/lib/natarot/natarot.sqlite
```

### Service and filesystem isolation

- Service identity: `natarot-staging`.
- Application directory: `/opt/natarot-staging`.
- Listener: `127.0.0.1:8788` only.
- Database: `/var/lib/natarot-staging/natarot.sqlite`.
- Environment file: `/etc/natarot-staging.env`.
- Logs: systemd journal under the distinct `natarot-staging` unit identifier.
- The service uses a separate state directory and restrictive `UMask=0077`.
- The unit sets `NATAROT_DB_PATH` to the staging path as a second guard against
  an accidentally incomplete environment file.
- No staging configuration may contain the production database path, port,
  service name, application directory, or production environment file.

The deployment runbook creates the service user and directories explicitly,
installs the built release without `.env*`, databases, backups, Git metadata,
or logs, and creates the staging environment file outside Git. Provider
credentials are absent for this bootstrap.

### Database lifecycle

The existing `scripts/node-migrate.mjs` runner applies the checked-in SQL
files in sorted historical order, including both `0004_member_auth.sql` and
`0004_reading_payload.sql`, followed by `0005_natarot_share_persistence.sql`.
The runner records each filename in the database-local migration table and is
rerunnable. It runs only against the new staging SQLite path. No migration
file is renumbered or changed and no Credits/VIP migration is introduced.

Only synthetic fixtures may be inserted. Production customer rows, D1 exports,
production SQLite files and production backups must never be copied.

### HTTP, HTTPS and indexing

- DNS record: `A staging 42.96.5.114` at BKNS.
- HTTP redirects to HTTPS for `staging.natarot.com`.
- Certbot provisions a certificate covering only `staging.natarot.com`.
- The final Nginx server block proxies only that host to port `8788`.
- The staging host sends `X-Robots-Tag: noindex, nofollow` while remaining
  reachable without authentication for future provider callbacks.
- Forwarded protocol/host headers are set explicitly so the existing trusted
  proxy boundary can validate browser origins and secure guest cookies.
- The public callback path is reserved by the runtime but is not claimed as
  implemented until SePay adds `POST /api/commercial/sepay/ipn`.

### Health and application behavior

The exact source base already contains `GET /api/health`. It performs only
`SELECT 1`, returns `Cache-Control: no-store`, and exposes `{ status: "ok" }`
or a generic 503 `{ status: "error" }`. No health change is needed in this
mission. The existing Tarot, auth/F-001, guest ownership, and share S1-S6
contracts remain authoritative.

DeepSeek remains unconfigured in staging. Validation must therefore exercise
the safe provider-unavailable response instead of copying or requesting a
production provider secret. SePay is not configured or called.

## Repository artifacts

The implementation adds:

- A staging systemd unit with the independent user, directory, environment,
  database path, port, restart policy, migration preflight, and hardening
  contract.
- A final TLS-capable staging Nginx virtual-host template plus a documented
  HTTP-only bootstrap step for certificate issuance.
- An operations runbook covering DNS, deployment, migrations, environment
  separation, logs, rollback, restart testing, smoke tests, and the SSH/DNS
  human gates.
- Contract tests that reject accidental production path/port/service reuse and
  verify the staging reverse-proxy/security requirements.
- A project-state checkpoint that distinguishes repository implementation from
  public deployment verification.

No application route, database migration, AI prompt, auth boundary, share
contract, production template, or production state is changed.

## Validation and rollback

Repository gates are the full tracked test suite, typecheck, production build,
`git diff --check`, targeted lint for the new files, and a secret/path scan.
The deployment runbook adds public DNS, TLS, health, homepage, Room, guest,
auth/F-001, Tarot no-provider, share/revocation, mobile, restart persistence,
filesystem exposure, and production health checks.

Staging rollback disables only `natarot-staging.service` and removes or restores
only the staging Nginx/DNS artifacts. Production is never stopped or restarted.
If Nginx configuration is shared, `nginx -t` must pass before a graceful reload
and both production and staging HTTPS endpoints must be checked afterward.

## Human gates

The already authenticated BKNS session may create only the single staging A
record. VPS deployment requires an existing authorized non-root SSH account,
SSH agent/key, or provider console. Passwords, private keys, OTPs, and secrets
must not be pasted into chat or committed. If VPS access is unavailable, the
repository artifacts may be completed and pushed, but public runtime
implementation remains blocked with the exact required access reported.
