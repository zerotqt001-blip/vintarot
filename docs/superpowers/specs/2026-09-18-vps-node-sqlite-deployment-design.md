# NaTarot VPS Node + SQLite deployment design

## Status

Design proposal for review. This document must be approved before implementation begins.

## Goal

Make the NaTarot site run as a complete standalone website on the existing BKNS VPS at `42.96.5.114`, while keeping the current Sites/D1 deployment available as a rollback target. The VPS deployment must serve the existing Moonlight-inspired NaTarot UI, Tarot catalog/draw/session flows, guest-owned rooms and journal records, and a safe unavailable response when no AI provider is configured.

## Context and constraints

- The VPS is already running Ubuntu 24.04.4 LTS with 2 vCPU, 2 GB RAM, 30 GB disk, Node 22.14.0, Nginx, and SSH on port `26266`. Reinstalling the OS is unnecessary.
- The Node/Vinext production server serves `/`, `/guidebook`, and `/room`, but API requests currently fail because server modules import the Cloudflare-only `cloudflare:workers` scheme.
- The Wrangler/Miniflare path fails with `MiniflareCoreError [ERR_RUNTIME_FAILURE]` and `kj/table.c++:49: failed: inserted row already exists in table` even for a trivial worker, so it is not a reliable VPS runtime.
- The current Sites deployment uses Cloudflare D1 and must remain unchanged for rollback. Cloudflare-specific behavior must not be removed from that path.
- No D1 export credential or approved data-export process is available. Existing D1 user rows therefore cannot be copied automatically into the new VPS database.
- No AI provider secret is authorized for this deployment. Provider keys must remain out of the repository, archive, logs, browser, and chat. Reading generation must return the existing safe configuration/unavailable response until a provider is separately configured in `/etc/natarot.env`.

## Chosen architecture

```text
Browser
  -> natarot.com / www.natarot.com
  -> Nginx :80/:443
  -> systemd natarot.service
  -> Vinext Node server 127.0.0.1:8787
      -> platform bridge
          -> Cloudflare Sites: D1 binding (existing path)
          -> VPS: /var/lib/natarot/natarot.sqlite
      -> optional server-side Tarot AI provider
```

The VPS uses the existing Vinext Node production server rather than Wrangler. Nginx terminates HTTPS and proxies only to localhost. The Node process runs as the unprivileged `natarot` user under systemd. SQLite lives outside the application checkout so deployments cannot overwrite runtime data and Git cannot collect the database.

### Platform bridge

Add one runtime boundary used by API routes:

1. Detect the standalone Node runtime without importing `cloudflare:workers` at module evaluation time.
2. In Node, open a single `node:sqlite` `DatabaseSync` connection at a configurable path, defaulting to `/var/lib/natarot/natarot.sqlite`.
3. Expose a small D1-shaped async facade with the operations already used by the repository and routes: `prepare`, `bind`, `all`, `first`, `run`, and `batch`. `run()` must expose `meta.changes` because room revision updates depend on it.
4. In Cloudflare, lazily resolve the existing `cloudflare:workers` environment and return the real D1 binding. The Node process must never evaluate the Cloudflare module.
5. Preserve the repository SQL and its ownership checks. The adapter is a compatibility boundary, not a second query implementation.

The SQLite connection will enable foreign keys, WAL mode, and a bounded busy timeout. Initialization must be idempotent and fail closed if the database directory is not writable.

### Schema and seed lifecycle

The VPS bootstrap runs the checked-in migrations in order (`0000` through `0003`) and the existing idempotent Tarot seed/catalog data. A small migration runner records applied migration names in a local metadata table, executes each migration once inside the same database, and can be rerun safely after a deployment. The runner must preserve the current relationship-position compatibility behavior and pass the existing migration tests.

The runtime database directory is `/var/lib/natarot`, owned by `natarot:natarot`, with restrictive permissions. A later operations pass may add an application-level backup command; it is not a prerequisite for the first cutover. D1 data is not silently guessed, scraped, or copied.

### Identity and standalone behavior

Cloudflare-authenticated requests continue to use the current ChatGPT user headers. On the VPS, where those headers are absent, the server creates or reuses the existing `vintarot_guest` HttpOnly, `SameSite=Lax`, `Secure` cookie and maps that guest ID to the owner fields used by rooms and records. Responses that create a guest identity must return `Set-Cookie` without exposing the identifier in page content or logs.

The Tarot session/draw/reading ownership model remains the existing user-or-guest model. Room and record routes will use the same request identity boundary so a standalone visitor can keep a room and journal without a ChatGPT account. ChatGPT sign-in remains an optional Cloudflare-specific capability; the VPS must not present a broken sign-in flow as a prerequisite for basic guest use.

### AI provider boundary

`/etc/natarot.env` is the only VPS location for optional provider configuration. The deployment starts without provider credentials. If a selected provider key/model pair is absent, `POST /api/tarot/reading` returns the current safe 503 configuration response and never falls back to an unlabelled local “AI” result. If the user later supplies a provider, it will be added directly to the VPS secret file and verified without committing or printing it.

## Operational rollout

1. Add the runtime bridge, guest request identity, migration runner, and Node-specific tests.
2. Run the migration/seed command on the VPS, verify row counts and foreign-key integrity, then restart `natarot.service`.
3. Configure Nginx for `natarot.com` and `www.natarot.com` with a localhost reverse proxy and security headers appropriate to this app. Obtain a certificate covering both names using the DNS/HTTP challenge flow after the names point at the VPS.
4. Verify the site against the VPS IP before DNS cutover using a host override. Keep the Sites records available until the full smoke test passes.
5. Change the BKNS DNS records so the apex and `www` resolve to the VPS. Preserve existing validation TXT records and do not delete the Sites deployment.
6. Verify DNS, HTTPS, canonical host behavior, static assets, guest cookie persistence, catalog, draw, session, room create/update, journal save/list, and the safe no-provider reading response from both the apex and `www` host.
7. If the smoke test fails, restore the previous A/CNAME targets while leaving the VPS and its SQLite file intact for diagnosis.

The OS firewall will be configured only after confirming the SSH session remains reachable: allow TCP `26266`, `80`, and `443`; deny unsolicited traffic otherwise. No password or token is stored in this document or in Git.

## Verification and acceptance criteria

### Automated checks

- A fresh temporary SQLite database can apply all migrations and seed data twice without errors.
- The D1-shaped SQLite adapter passes catalog, draw, session ownership, reading persistence, room optimistic revision, and records CRUD tests.
- Node production build and typecheck pass without any static `cloudflare:workers` import in the Node-loaded API path.
- Existing Tarot, migration, guest, and route contract tests remain green.
- `git diff --check` passes and staged files contain no secrets, `.env` files, runtime databases, build output, or deployment archives.

### VPS smoke checks

- `natarot.service` is active and restarts after a process failure.
- Nginx returns the homepage and proxies API requests to Node.
- `GET /api/tarot/catalog?locale=vi` returns 200 with seeded categories/templates/positions.
- A guest `POST /api/tarot/draw` returns 201 and a `Set-Cookie`; the returned session can be read by the same guest through `GET /api/tarot/session`.
- Room create/update and journal save/list work with the guest cookie and do not leak another guest's rows.
- Reading without a configured provider returns the safe 503 contract rather than a runtime error or 500.
- HTTPS works for `natarot.com` and `www.natarot.com`, and static assets/API calls remain same-origin.
- The Sites/D1 URL remains available as a rollback reference throughout the migration.

## Alternatives considered

- **Keep Wrangler/Miniflare on the VPS:** rejected because the runtime fails before the application can serve requests, including a minimal worker.
- **Run Vinext Node without a storage bridge:** rejected because the UI works but every D1-backed API route fails on `cloudflare:workers` imports.
- **Move data to an external database now:** deferred because no database service or credentials were requested; it would add cost and a second migration surface.
- **Copy all D1 data automatically:** rejected because no authorized export credentials/process exist and guessing at user data would be unsafe.

## Explicit non-goals for this cutover

- Replacing the existing Sites/D1 deployment.
- Migrating historical D1 user data without an explicit export/import approval and source credentials.
- Enabling ChatGPT Sign-In on the standalone VPS.
- Adding payment, video, email, or public booking integrations.
- Configuring an AI provider without the user supplying and approving the server-side secret/model.
