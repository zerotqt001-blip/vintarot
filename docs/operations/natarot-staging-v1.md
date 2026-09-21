# NaTarot Staging Environment V1 Operations Runbook

This runbook operates only the isolated staging target. It must not restart,
stop, migrate, replace, or reconfigure `natarot.service`, `/opt/natarot`,
`/var/lib/natarot/natarot.sqlite`, `/etc/natarot.env`,
`natarot.com`, or `www.natarot.com`.

## Fixed topology

| Boundary | Staging value |
| --- | --- |
| Source | `f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` |
| Branch | `codex/natarot-staging-v1` |
| Hostname | `staging.natarot.com` |
| DNS | `A staging 42.96.5.114` |
| Service | `natarot-staging.service` |
| Linux identity | `natarot-staging:natarot-staging` |
| Application | `/opt/natarot-staging` |
| Listener | `127.0.0.1:8788` |
| Database | `/var/lib/natarot-staging/natarot.sqlite` |
| Environment | `/etc/natarot-staging.env` |
| Public origin | `https://staging.natarot.com` |

Staging has no provider, SePay, payment, Google, Resend, or production secret
configuration during this bootstrap. The checked-in migration chain is the
only schema input, and all runtime rows must be synthetic.

## 1. Preflight and DNS

Run from the staging worktree and confirm the source before packaging:

```bash
git status --short --branch
git rev-parse HEAD
git show -s --format='%H %s' HEAD
```

The expected commit is
`f5452a35d7b4bbc9884e52d0890c4f5e9c39e9fe` before staging commits are added.

The only DNS mutation for this mission is the BKNS record:

```text
Type: A
Host/Name: staging
Value: 42.96.5.114
TTL: 300 seconds
```

Verify the record through BKNS and public resolvers:

```bash
dig +short staging.natarot.com A
dig +short @1.1.1.1 staging.natarot.com A
dig +short @8.8.8.8 staging.natarot.com A
```

Every resolver must return `42.96.5.114`. Do not change apex, `www`, TXT,
MX, NS, or any unrelated record.

## 2. Authorized VPS access

Use an existing authorized non-root SSH account, SSH agent/key, or provider
console. Do not brute-force, guess passwords, enable root login, weaken SSH,
or alter the firewall to obtain access.

```bash
ssh -p 26266 <authorized-user>@42.96.5.114
```

The username is intentionally a local operator value and must not be written
into this repository. If there is no authorized access, stop at this gate and
report:

```text
SSH HOST: 42.96.5.114
REQUIRED: authorized SSH username/key or approved provider-console access path
```

Never paste a private key, password, OTP, or secret into chat.

## 3. Create the staging runtime boundary

On the VPS, create the service identity only if it does not already exist:

```bash
if ! id -u natarot-staging >/dev/null 2>&1; then
  sudo useradd --system --home-dir /opt/natarot-staging --shell /usr/sbin/nologin natarot-staging
fi
sudo install -d -o natarot-staging -g natarot-staging -m 0750 /opt/natarot-staging
sudo install -d -o natarot-staging -g natarot-staging -m 0700 /var/lib/natarot-staging
```

Install only a secret-free environment file. The systemd unit pins the
database path, trusted-proxy flag, and staging public origin independently:

```bash
sudo sh -c 'umask 077; printf "%s\\n" "NODE_ENV=production" > /etc/natarot-staging.env'
sudo chown root:natarot-staging /etc/natarot-staging.env
sudo chmod 0640 /etc/natarot-staging.env
```

Build locally and package only the tracked release inputs. The package must
exclude `.git`, `.env*`, `*.sqlite`, `*.sqlite-*`, `*.log`, backups, local
Wrangler state, browser data, credentials, and previous build archives. Do not
copy the production database or production release directory.

```bash
npm run build
```

Inspect the archive listing and secret scan before transfer. The final
artifact must contain `dist`, `drizzle`, `scripts`, `public`, application
source, `package.json`, the lockfile, and the staging deployment files, but no
runtime data or secret file.

Transfer the artifact through the already authorized SSH path and extract it
into `/opt/natarot-staging`. Install dependencies without copying the local
`node_modules` tree when the target requires a clean install:

```bash
sudo npm ci --prefix /opt/natarot-staging --no-audit --no-fund
sudo chown -R natarot-staging:natarot-staging /opt/natarot-staging
```

Install the staging unit and bootstrap Nginx host from the checked-in files:

```bash
sudo install -m 0644 /opt/natarot-staging/deploy/systemd/natarot-staging.service /etc/systemd/system/natarot-staging.service
sudo install -m 0644 /opt/natarot-staging/deploy/nginx/natarot-staging-bootstrap.conf /etc/nginx/sites-available/natarot-staging
sudo ln -sfn /etc/nginx/sites-available/natarot-staging /etc/nginx/sites-enabled/natarot-staging
sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable --now natarot-staging.service
```

The unit's `ExecStartPre` runs the real `scripts/node-migrate.mjs` against
`/var/lib/natarot-staging/natarot.sqlite`. Check only metadata/counts and
integrity; never print customer rows or environment values:

```bash
sudo systemctl status natarot-staging.service --no-pager
sudo journalctl -u natarot-staging.service --no-pager -n 80
sudo stat -c '%U:%G %a %n' /var/lib/natarot-staging /var/lib/natarot-staging/natarot.sqlite
```

## 4. TLS and final Nginx host

The bootstrap host is HTTP-only so the certificate challenge can reach the
VPS. After DNS resolves to `42.96.5.114`, issue a certificate for staging
only:

```bash
sudo certbot certonly --nginx -d staging.natarot.com --non-interactive --agree-tos --register-unsafely-without-email
```

Install the final TLS host, validate, and reload gracefully:

```bash
sudo install -m 0644 /opt/natarot-staging/deploy/nginx/natarot-staging.conf /etc/nginx/sites-available/natarot-staging
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certificates
```

The certificate must contain `staging.natarot.com`, be valid at the current
time, and have no browser warning. Do not alter the production certificate or
upstream. If a shared Nginx reload is needed, verify both production and
staging endpoints remain active before and after the reload.

## 5. Staging smoke checks

Run these checks without logging response bodies that may contain user data:

```bash
curl -fsSI http://staging.natarot.com/
curl -fsSI https://staging.natarot.com/
curl -fsS https://staging.natarot.com/api/health
curl -fsSI 'https://staging.natarot.com/room?ritual=1'
curl -fsSI 'https://staging.natarot.com/api/tarot/catalog?locale=vi'
```

Expected results:

- HTTP redirects to HTTPS.
- HTTPS homepage, Room, catalog, and health are reachable.
- `/api/health` returns `200`, `Cache-Control: no-store`, and exactly
  `{"status":"ok"}` when the database is ready.
- Responses include `X-Robots-Tag: noindex, nofollow`.
- No response contains an `.env` value, database path, provider key, session
  token, or stack trace.

Exercise the guest boundary with a fresh temporary cookie jar and synthetic
questions only. The flow must create a guest cookie, draw/read a synthetic
session, and keep its room/journal rows owner-scoped. A Tarot reading request
without provider configuration must return the existing safe 503 response;
never substitute a local or unlabeled AI result.

Exercise member and F-001 behavior through the existing auth/security suites
and, at the proxy boundary, send a synthetic `oai-authenticated-user-id`
header. Nginx must clear that untrusted header and the application must retain
its existing trusted identity boundary.

Exercise share S1-S6 with synthetic reading data: create one share, resolve
the opaque public token, verify the public allowlist/noindex behavior, revoke
it, and verify the public route closes. Do not use a production token or
customer reading.

Check mobile/basic responsiveness in a normal browser viewport and verify
that the staging origin is used for share URLs rather than `natarot.com`.

## 6. Restart, isolation and security checks

Verify persistence across a staging-only restart:

```bash
curl -fsS https://staging.natarot.com/api/health
sudo systemctl restart natarot-staging.service
sudo systemctl is-active --quiet natarot-staging.service
curl -fsS https://staging.natarot.com/api/health
```

Verify production remains healthy without restarting it:

```bash
curl -fsSI https://natarot.com/
curl -fsSI https://www.natarot.com/
sudo systemctl is-active --quiet natarot.service
```

Verify the following are not publicly readable: `/.env`, `/.env.local`,
`/.git/HEAD`, `/var/lib/natarot-staging/natarot.sqlite`, backup names, source
maps containing secrets, and debug endpoints. Check the service unit and
directory owners to confirm staging paths are writable only by the staging
identity. Confirm no process, database, environment file, or reverse-proxy
setting points at production state.

## 7. Future SePay callback boundary

The host capability is reserved as:

```text
https://staging.natarot.com/api/commercial/sepay/ipn
```

This mission does not create or test that route. Do not register an IPN, copy a
SePay secret, enable real payments, or claim the endpoint works until the
parent SePay implementation creates and deploys it.

## 8. Rollback

If staging fails, stop only its unit and restore only its Nginx file:

```bash
sudo systemctl disable --now natarot-staging.service
sudo rm -f /etc/nginx/sites-enabled/natarot-staging
sudo nginx -t
sudo systemctl reload nginx
```

Keep `/var/lib/natarot-staging` for diagnosis unless deletion is explicitly
authorized. Do not touch `natarot.service`, production Nginx upstreams,
production database, production environment, or production DNS.
