# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Whenever reopening or moving a checkout, run `node <plugin-root>/scripts/configure-execution-profile.mjs` before project commands. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

On managed Linux, use `sites-preview start` only for requested browser QA. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

Member authentication uses the `natarot_session` HttpOnly cookie. The product links guests to `/auth?return_to=<same-origin-path>`; member registration, sign-in, password recovery, Google account completion and account controls are served under `/auth` and call the local `/api/auth/*` routes. Guest readings and rooms remain available without a member session.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `lib/member-page.ts` resolves a member session only in server components and projects the safe shell identity
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Member authentication

Server components call `getPageMember()` from `lib/member-page.ts`; it reads the Next cookie store and delegates session validation to `getMemberFromCookieHeader()`. Keep those imports out of Client Components. Cookie-dependent pages export `dynamic = "force-dynamic"`.

Members are the durable owner for personal records. The browser receives only the display name, email and username needed by the current private surface; phone numbers stay on the account screen and are never included in public room, card or invitation copy.

Configure these server-only values outside Git. Never expose their values in browser code, committed files or logs:

```text
NATAROT_DB_PATH=/path/to/natarot.sqlite
RESEND_API_KEY=replace-with-server-secret
NATAROT_EMAIL_FROM=NaTarot <hello@example.test>
GOOGLE_CLIENT_ID=replace-with-server-client-id
GOOGLE_CLIENT_SECRET=replace-with-server-secret
GOOGLE_REDIRECT_URI=https://example.test/api/auth/google/callback
NATAROT_TRUSTED_PROXY=true
```

The included Nginx config overwrites `X-Forwarded-For`, `X-Real-IP` and `X-Forwarded-Proto` with the direct client/proxy values, so its deployment should use `NATAROT_TRUSTED_PROXY=true`. Keep it `false` for a directly exposed Node process or any ingress that preserves client-supplied forwarding headers; in that mode those headers are ignored for auth rate limits and cookie security.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## AI Tarot readings

The canonical endpoint is `POST /api/tarot/reading`. The older `POST /api/tarot/interpret` route is a compatibility alias. The server validates the stored session, retrieves only the drawn cards and their positions, assembles the selected Knowledge Base V5.0 context, calls the explicitly selected provider, validates the structured reading, and persists provider metadata. It does not send the full knowledge base or silently substitute the old local template when a provider is unavailable.

Use this placeholder-only block as the server/Cloudflare environment checklist:

```text
TAROT_AI_PROVIDER=openai
OPENAI_API_KEY=replace-with-server-secret
OPENAI_TAROT_MODEL=replace-with-supported-model
GEMINI_API_KEY=replace-with-server-secret
GEMINI_TAROT_MODEL=replace-with-supported-model
DEEPSEEK_API_KEY=replace-with-server-secret
DEEPSEEK_TAROT_MODEL=replace-with-supported-model
```

Set `TAROT_AI_PROVIDER` to `openai`, `gemini`, or `deepseek`; only the selected provider's key/model pair is required. All provider keys are server-side secrets. Never copy these values into client code, browser storage, committed files, logs, or public responses. Without a configured provider, the Room keeps the spread and shows a safe retry/unavailable state; it does not claim that a local fallback is an AI reading.

The documentation and implementation can be checked locally without real provider credentials:

```sh
npx tsx --test tests/tarot-documentation.test.ts
npx tsx --test tests/tarot-ai.test.ts tests/tarot-interpretation.test.ts tests/tarot-reading-context.test.ts tests/tarot-reading-service.test.ts tests/tarot-api-contract.test.ts tests/tarot-draw.test.ts tests/tarot-catalog.test.ts tests/tarot-seed.test.ts tests/tarot-room.test.ts
npx tsc --noEmit
npm run build
npm run lint
```

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
