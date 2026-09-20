# NaTarot External Security Research Gate

**Research date:** 2026-09-21 (Asia/Ho_Chi_Minh)
**Repository:** `zerotqt001-blip/vintarot`
**Mission branch:** `codex/natarot-security-production-readiness`
**Gate status:** complete before application/security implementation
**Default rule:** external repositories are references only unless this document explicitly says otherwise.

## Scope and comparison method

This review was required before implementing security or production-readiness changes. It compares the requested references with NaTarot's source-grounded architecture at base `60db3db7db535560feb6ff1178a975793bec26bf`:

- React/TypeScript with Vinext/Vite-compatible Next-style routing.
- API route handlers using `Request`/`Response`, Zod validation, and a shared `lib/server.ts` boundary.
- Cloudflare D1-compatible APIs and Node `node:sqlite` over the existing runtime abstraction.
- VPS deployment through Nginx and systemd, with a tracked proxy template.
- ChatGPT platform identity plus an existing bearer-style guest cookie.
- Server-only AI providers with existing timeout, retry, input-size, and sanitized-error boundaries.
- Locked Tarot Engine L5–L8, Share S1–S5, Credits/VIP, auth identity semantics, database schema/migrations, and deployment state.

The review favors the existing NaTarot capability, then a small local implementation, then a compatible established library, and finally an external service. No source code was copied from the reviewed repositories. No external runtime dependency, credential, SaaS account, or production service is introduced by this gate.

## Decision summary

### ADOPT

- **OWASP ASVS 5.0.0 as a versioned audit checklist.** Use only relevant requirements and map each finding to a concrete NaTarot route, boundary, or deployment file.
- **Redacted, repeatable scanner workflow.** Run available secret/dependency/config scanners without printing matches; preserve only paths, categories, severities, and remediation state.
- **Explicit non-cacheability for personalized responses.** This is a local application of the framework/proxy cache-safety principle and is covered by regression tests.

### ADAPT

- **Arcjet/example-nextjs's authenticated-versus-anonymous policy split** as a design idea for a future quota policy, but use existing NaTarot identity only and do not activate Arcjet.
- **Arcjet and express-rate-limit trusted-proxy guidance** as a local rule: only proxy-controlled, overwritten forwarding headers may influence client-IP policy; do not trust arbitrary client-supplied `X-Forwarded-For` or similar headers.
- **Helmet/Next.js/Nginx baseline response-header patterns** where they are already safe for NaTarot. CSP, HSTS, and Permissions-Policy remain deployment/app-inventory work rather than blind defaults.
- **Gitleaks/Trivy CI and history-scan concepts** as future repository tooling, with redacted output and pinned tool versions.

### REFERENCE ONLY

- `arcjet/arcjet-js` runtime protection SDK.
- `arcjet/example-nextjs` integration example.
- `gitleaks/gitleaks` executable and GitHub Action/pre-commit integration.
- `aquasecurity/trivy` executable and CI action.
- `helmetjs/helmet` Express middleware package.
- `express-rate-limit/express-rate-limit` Express middleware package.
- Cloudflare Workers Rate Limiting API for a future edge-topology mission.
- `vercel/next.js` release/advisory stream for framework patch monitoring.

These are useful sources of patterns and operational warnings, but none is copied into the runtime by this mission.

### REJECT for this mission

- Making NaTarot dependent on Arcjet or another hosted decision service. It requires a new production key/account, introduces an external runtime dependency and data-flow/availability question, and is outside the user-authorized safe-isolated scope.
- Adding an in-process memory limiter as if it were a production control. It would diverge across processes/instances and cannot protect the Cloudflare/VPS dual topology reliably.
- Adding a new Redis/KV/Durable Object/SQLite quota schema or migration. This crosses the database and deployment locks.
- Copying source code, rules, or a full architecture from any external repository. The license and maintenance review does not make copying necessary.
- Enforcing a guessed CSP or HSTS policy in tracked app/proxy code without a verified asset, iframe, TLS, subdomain, and rollout inventory. A broken CSP or premature HSTS can create an availability incident.

## Required references

### PROJECT: `arcjet/arcjet-js`

- **PURPOSE:** Runtime request security for JavaScript/TypeScript applications, including token-bucket/fixed/sliding-window rate limiting, bot protection, Shield WAF patterns, sensitive-information detection, prompt-injection detection, request filters, IP analysis, and AI token-budget-style protection.
- **MAINTENANCE STATUS:** Active-looking upstream monorepo at review time; the README states compatibility with LTS Node versions and the current minor TypeScript release. The `@arcjet/next` and `@arcjet/node` package versions queried during this review were `1.13.0`.
- **LICENSE:** Apache License 2.0.
- **RELEVANT NATAROT PROBLEM:** Public guest-accessible draw/reading/follow-up routes have no distributed request quota or AI-cost budget. Proxy/client-IP attribution is also security-sensitive. Prompt/PII and WAF controls are future considerations, not evidence of an exploit in the current source.
- **REUSABLE PATTERN:** Apply protection after a stable identity decision; distinguish authenticated and anonymous policies; model AI requests with a cost/request-token dimension; use explicit proxy configuration and validated client-IP selection; keep sensitive-data/WAF checks at the request boundary.
- **DIRECT DEPENDENCY NEEDED?:** No.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes for this mission. A future human-gated evaluation may compare Arcjet against a topology-native control.
- **SECURITY RISK:** New `ARCJET_KEY` credential and hosted decision path; proxy trust or fail-open/fail-closed mistakes could make quotas bypassable or block legitimate traffic. Any request-content telemetry/data flow would require a separate privacy review.
- **OPERATIONAL COST:** New account/key lifecycle, runtime network dependency, latency/error handling, service limits/pricing, monitoring, and production rollout. The example requires an Arcjet account and key.
- **RECOMMENDATION:** **REFERENCE ONLY / ADAPT later.** Keep the identity-aware policy and proxy-validation ideas. Do not add Arcjet to NaTarot now; activation is HUMAN-GATED.

Sources: [repository](https://github.com/arcjet/arcjet-js), [proxy/client-IP guidance](https://github.com/arcjet/arcjet-js#client-ip-address), [Apache-2.0 license](https://github.com/arcjet/arcjet-js/blob/main/LICENSE).

### PROJECT: `arcjet/example-nextjs`

- **PURPOSE:** Practical Next.js sample showing Arcjet signup protection, bot protection, authenticated-versus-anonymous rate limits, Shield attack protection, sensitive-information checks, and prompt-injection detection.
- **MAINTENANCE STATUS:** Active example repository at review time; GitHub showed 197 commits and no open issues in the reviewed snapshot. The README directs normal development to Arcjet's examples repository.
- **LICENSE:** Apache License 2.0.
- **RELEVANT NATAROT PROBLEM:** It demonstrates the exact product distinction NaTarot needs for future abuse controls: anonymous guests should have a tighter budget than authenticated users, and signup/API-like abuse needs route-specific controls.
- **REUSABLE PATTERN:** Use a policy table keyed by the already-established request identity, with separate anonymous/authenticated limits and route-specific budgets. Treat the example as integration evidence, not a security certification.
- **DIRECT DEPENDENCY NEEDED?:** No.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes.
- **SECURITY RISK:** The example requires an Arcjet account and key; example defaults are not a substitute for NaTarot's threat model, proxy trust, or cost limits. Copying its middleware would change NaTarot's request semantics.
- **OPERATIONAL COST:** New external credentials/service, configuration, monitoring, and account cost; no benefit until the API quota design and production topology are approved.
- **RECOMMENDATION:** **ADAPT later / REFERENCE ONLY now.** Preserve the authenticated-versus-anonymous policy idea for a future abuse-control mission; do not install or copy the sample.

Sources: [repository README](https://github.com/arcjet/example-nextjs), [license](https://github.com/arcjet/example-nextjs/blob/main/LICENSE).

### PROJECT: `gitleaks/gitleaks`

- **PURPOSE:** Detect secrets in current files, Git history, and stdin; supports Git history ranges, redacted reports, pre-commit integration, and GitHub Actions.
- **MAINTENANCE STATUS:** The upstream README explicitly says the project is feature-complete, will receive security patches only, and that the maintainer is shifting focus to Betterleaks. This is a material maintenance limitation even though the tool remains useful.
- **LICENSE:** MIT.
- **RELEVANT NATAROT PROBLEM:** Secret exposure in tracked source, ignored files accidentally added, or Git history would require rotation and incident handling. The mission forbids printing secret values.
- **REUSABLE PATTERN:** Scan both the working tree and history; use `--redact`/redacted reports; run pre-commit/CI checks; preserve only finding metadata in human-readable audit records. Treat a real match as `SECRET EXPOSURE DETECTED`, identify file/history, redact the value, classify severity, and state rotation is required.
- **DIRECT DEPENDENCY NEEDED?:** No. It is an audit/CI executable, not an application library.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes, for repository workflow.
- **SECURITY RISK:** Feature-complete status means detection rules and integrations may age; false positives and false negatives remain possible. Reports can leak the matched secret if redaction is omitted.
- **OPERATIONAL COST:** Low local/CI runtime cost; future CI requires a pinned binary/action, rule maintenance, and secure handling of reports.
- **RECOMMENDATION:** **REFERENCE ONLY / ADAPT.** Use it if already installed; do not install automatically in this mission. If the environment lacks it, use a redacted alternative scan and document the availability gap. Consider a maintained successor only in a future tooling decision.

Sources: [repository and maintenance notice](https://github.com/gitleaks/gitleaks), [MIT license](https://raw.githubusercontent.com/gitleaks/gitleaks/master/LICENSE).

### PROJECT: `aquasecurity/trivy`

- **PURPOSE:** Vulnerability, secret, filesystem/repository, license, and configuration/misconfiguration scanning. Filesystem scans cover lockfiles and plaintext secret rules; misconfiguration and license scanners can be selected explicitly.
- **MAINTENANCE STATUS:** Active upstream project at review time. The reviewed changelog contained release `0.74.0` dated 2026-08-14 and recent security/secret/misconfiguration changes.
- **LICENSE:** Apache License 2.0.
- **RELEVANT NATAROT PROBLEM:** Dependency vulnerabilities, exposed secrets, deployment/configuration drift, and future container/filesystem risk need repeatable evidence. The local `npm audit` remains the first dependency check for this Node repository.
- **REUSABLE PATTERN:** Run filesystem/repository scans with explicit scanner selection; keep secret matches redacted; enable misconfiguration/license checks deliberately; pin the scanner version in CI and separate scanner-database failures from application findings.
- **DIRECT DEPENDENCY NEEDED?:** No.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes, for future CI/tooling.
- **SECURITY RISK:** A secret report may contain the matched value; vulnerability databases can be unavailable or stale; broad scans can produce false positives and noisy policy failures.
- **OPERATIONAL COST:** Local binary/database download and CI execution time; future cache/storage and triage ownership.
- **RECOMMENDATION:** **ADAPT later / REFERENCE ONLY now.** `trivy` was not installed in the current environment, so it is not installed automatically. Use the available local checks now and record the missing scanner; add a pinned CI policy only through a separate tooling change.

Sources: [filesystem scanning](https://github.com/aquasecurity/trivy/blob/main/docs/guide/target/filesystem.md), [secret scanning](https://github.com/aquasecurity/trivy/blob/main/docs/guide/scanner/secret.md), [changelog](https://github.com/aquasecurity/trivy/blob/main/CHANGELOG.md), [Apache-2.0 license](https://raw.githubusercontent.com/aquasecurity/trivy/main/LICENSE).

### PROJECT: `OWASP/ASVS` version 5.0.0

- **PURPOSE:** A stable, versioned application-security verification standard for design, implementation, testing, and verification of web applications and services.
- **MAINTENANCE STATUS:** Stable release `5.0.0`; the upstream repository distinguishes it from its continuously changing bleeding-edge branch. The reviewed release page identifies 5.0.0 as the latest stable version.
- **LICENSE:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) for the project content.
- **RELEVANT NATAROT PROBLEM:** The mission needs an audit checklist for input/encoding, authentication, session management, access control, validation, error handling, data protection, API/resource limits, configuration, and logging without implementing irrelevant controls or making unsupported claims.
- **REUSABLE PATTERN:** Pin requirement references with the version prefix (`v5.0.0-...`), map only relevant requirements to source evidence/tests, and separate verified controls from human-gated controls.
- **DIRECT DEPENDENCY NEEDED?:** No.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes, checklist/governance only.
- **SECURITY RISK:** Treating a checklist as proof, copying large licensed content, or applying irrelevant requirements can create false confidence and documentation burden.
- **OPERATIONAL COST:** Review and maintenance effort whenever the version changes; no runtime cost.
- **RECOMMENDATION:** **ADOPT** as the audit taxonomy, with concise mappings and links rather than reproducing the standard text.

Sources: [repository and stable-version guidance](https://github.com/OWASP/ASVS), [stable release](https://github.com/OWASP/ASVS/releases), [license](https://github.com/OWASP/ASVS/blob/master/LICENSE.md), [versioned requirement data](https://github.com/OWASP/ASVS/blob/master/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json).

### PROJECT: `helmetjs/helmet` plus Next.js/Nginx equivalents

- **PURPOSE:** Helmet is low-maintenance Express middleware for security response headers such as CSP and HSTS. Next.js documents equivalent `headers` configuration for HSTS, frame protection, `nosniff`, Referrer-Policy, Permissions-Policy, and CSP; Nginx provides `add_header` for response headers.
- **MAINTENANCE STATUS:** Helmet was active at review time; the reviewed changelog listed version `8.3.0` dated 2026-07-11. Next.js and Nginx are the actual framework/proxy references for NaTarot's deployment shape.
- **LICENSE:** Helmet MIT. Next.js MIT. Nginx documentation is a project reference rather than copied source.
- **RELEVANT NATAROT PROBLEM:** The tracked Nginx template already sets `X-Content-Type-Options`, `X-Frame-Options`, and Referrer-Policy, but the source template does not prove HSTS/CSP/Permissions-Policy or TLS behavior. Personalized API responses also need explicit cache boundaries.
- **REUSABLE PATTERN:** Configure headers at the layer that owns them; use `nosniff`, frame protection, and a conservative Referrer-Policy; apply HSTS only on a verified HTTPS deployment; design CSP from the actual script/style/image/frame inventory, preferably with a tested report-only rollout before enforcement.
- **DIRECT DEPENDENCY NEEDED?:** No. NaTarot is not an Express application, and Nginx/Next configuration already owns the relevant surfaces.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes, with the already-present safe headers retained and any new header changes separately human-gated.
- **SECURITY RISK:** A guessed CSP can break React/Vinext hydration, AI/UI assets, or third-party integrations; HSTS on an HTTP-only or incompletely covered domain can make recovery difficult; duplicate headers at Nginx and app layers can conflict.
- **OPERATIONAL COST:** Low runtime cost for static headers, but high validation/rollout cost for CSP/HSTS and TLS/subdomain coverage.
- **RECOMMENDATION:** **ADAPT** the baseline guidance; **REJECT** blindly importing Helmet defaults or adding an unverified CSP/HSTS policy in this mission.

Sources: [Helmet README](https://github.com/helmetjs/helmet/blob/main/README.md), [Helmet changelog](https://github.com/helmetjs/helmet/blob/main/CHANGELOG.md), [Helmet MIT license](https://raw.githubusercontent.com/helmetjs/helmet/main/LICENSE), [Next.js header guidance](https://nextjs.org/docs/pages/api-reference/config/next-config-js/headers), [Nginx headers module](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

## Additional maintained stack-relevant references

### PROJECT: `express-rate-limit/express-rate-limit`

- **PURPOSE:** Maintained Node/TypeScript rate-limit middleware with memory and external-store interfaces, standard `RateLimit` headers, configurable key generation, IPv6 subnet handling, and explicit store-error behavior.
- **MAINTENANCE STATUS:** Active at review time; GitHub showed 940 commits, current-release security support, and npm version `8.7.0` in the research environment.
- **LICENSE:** MIT.
- **RELEVANT NATAROT PROBLEM:** It provides a concrete comparison for API quotas and exposes the operational importance of a shared store and correct proxy trust. NaTarot is not Express and does not currently have a shared quota store.
- **REUSABLE PATTERN:** Use an explicit key policy, standard rate-limit response headers, bounded IPv6/IP handling, and a deliberate fail-closed/fail-open store error policy. Never treat the default in-memory store as a multi-instance production control.
- **DIRECT DEPENDENCY NEEDED?:** No.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes.
- **SECURITY RISK:** Incorrect proxy configuration can collapse all clients onto one proxy IP or let attacker-controlled forwarding values bypass a limit; memory counters diverge across instances.
- **OPERATIONAL COST:** A reliable shared store and monitoring are required for multi-instance deployment.
- **RECOMMENDATION:** **REFERENCE ONLY / ADAPT** the design constraints. Do not add this Express middleware to Vinext/Next route handlers.

Sources: [repository README](https://github.com/express-rate-limit/express-rate-limit), [proxy troubleshooting](https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues), [MIT license](https://raw.githubusercontent.com/express-rate-limit/express-rate-limit/main/license), [security policy](https://github.com/express-rate-limit/express-rate-limit/security/policy).

### PROJECT: `vercel/next.js`

- **PURPOSE:** The upstream framework/security source for the Next-style application boundary used by NaTarot and for release/security-advisory monitoring.
- **MAINTENANCE STATUS:** Highly active; the reviewed repository showed tens of thousands of commits, current canary releases, a security policy, and ongoing advisories. The npm registry reported `next` `16.3.5` at review time; NaTarot's clean base is pinned separately in its lockfile.
- **LICENSE:** MIT.
- **RELEVANT NATAROT PROBLEM:** Framework advisories can affect RSC parsing, Server Actions, caching, proxy/header handling, and request routing even when application code is unchanged. The current audit also needs to avoid relying on implicit framework cache behavior for owner-scoped responses.
- **REUSABLE PATTERN:** Track upstream security advisories and patched versions; pin and test exact versions; explicitly set cache behavior for personalized APIs; treat inbound framework-sensitive headers as untrusted unless the trusted proxy overwrites them.
- **DIRECT DEPENDENCY NEEDED?:** Already present indirectly/through the project toolchain; no new dependency is needed by this research gate.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** No: this is an ongoing dependency/security monitoring source, not a feature implementation source.
- **SECURITY RISK:** Framework upgrades can change RSC, caching, build, or server behavior; blindly moving to a canary is unsafe. Current advisories make regular patch review mandatory.
- **OPERATIONAL COST:** Upgrade testing, lockfile review, build verification, and release coordination.
- **RECOMMENDATION:** **ADOPT** the advisory-monitoring and exact-version verification practice; do not copy canary changes or perform a broad framework upgrade in this mission.

Sources: [repository](https://github.com/vercel/next.js), [security advisories](https://github.com/vercel/next.js/security/advisories), [release stream](https://github.com/vercel/next.js/releases), [MIT license](https://raw.githubusercontent.com/vercel/next.js/canary/license.md).

### PROJECT: Cloudflare Workers Rate Limiting API / Workers SDK

- **PURPOSE:** Edge-native rate limiting that can enforce route/resource/customer-specific limits after a Worker reaches a chosen part of the request path.
- **MAINTENANCE STATUS:** Current Cloudflare documentation was updated in 2026 and requires a recent Wrangler version; it is an active platform capability rather than a library NaTarot currently binds to.
- **LICENSE:** Platform documentation/reference; no source is copied or redistributed.
- **RELEVANT NATAROT PROBLEM:** Cloudflare may be the correct place for distributed edge abuse controls if the active deployment path is confirmed to run through a Worker. This repository also contains a VPS/Nginx topology, so source alone cannot establish that the edge control protects every path.
- **REUSABLE PATTERN:** Enforce route-specific and identity/customer-specific limits at the edge, then keep an application-side cost guard as defense in depth; shard state rather than funnel all traffic through one global stateful object.
- **DIRECT DEPENDENCY NEEDED?:** No for this mission.
- **COPY CODE NEEDED?:** No.
- **ARCHITECTURE IDEA ONLY?:** Yes.
- **SECURITY RISK:** A binding or rule attached to only one topology can create a false sense of coverage; edge identity/header configuration and failover paths need live verification.
- **OPERATIONAL COST:** Cloudflare plan/binding configuration, deployment coordination, monitoring, and a human-verified failover story.
- **RECOMMENDATION:** **REFERENCE ONLY / ADAPT later** in a deployment-specific human-gated abuse-control mission. Do not add a Worker binding or schema here.

Source: [Cloudflare Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Pattern-to-NaTarot decision matrix

| Mechanism | Existing NaTarot capability | Selected action | Reason |
| --- | --- | --- | --- |
| Personalized API caching | Owner identity and route helpers already exist | **ADOPT locally** | Add explicit `Cache-Control: no-store`; no new service or semantics. |
| Authenticated vs anonymous abuse policy | `RequestIdentity` already distinguishes user/guest | **ADAPT locally, future quota** | Preserve identity; do not invent a limiter without a shared-store/topology decision. |
| Trusted proxy/client IP | Nginx forwards headers and clears ChatGPT identity headers | **ADAPT locally/document** | Validate at the proxy boundary; do not trust client-provided forwarding headers. |
| AI cost protection | AI route/input/timeout boundaries already exist | **REFERENCE + defer** | A real budget needs distributed state, policy, telemetry, and likely human approval. |
| Bot/WAF/sensitive-data/prompt-injection detection | No equivalent local service/control is proven | **REFERENCE ONLY** | Arcjet activation would add a service/key and data-flow review. |
| Secret scanning | `.gitignore` and source review exist; Gitleaks/Trivy absent | **ADAPT workflow** | Run safe available scans; record unavailable tools; never print matches. |
| Dependency scanning | `npm audit` is available | **ADOPT existing tool** | Prefer native lockfile audit before adding a scanner. |
| ASVS mapping | Existing project governance docs | **ADOPT** | Versioned audit categories improve evidence without runtime impact. |
| Security headers | Three safe headers already in Nginx template | **ADAPT / defer risky additions** | HSTS/CSP require verified TLS and asset rollout. |
| Health/readiness | No route exists at clean base | **IMPLEMENT local** | Read-only `SELECT 1`, no provider call, `no-store`, generic failure. |

## New dependencies, services, credentials, and source reuse

- **New runtime dependencies:** none selected by the external research gate.
- **New development/tooling dependencies:** none installed automatically; `gitleaks` and `trivy` were not present in the current environment at the availability check.
- **New external services:** none.
- **New production credentials:** none.
- **Copied source code:** none.
- **License concerns:** no external source is incorporated. The audit links Apache-2.0, MIT, and CC BY-SA 4.0 references for provenance; the ASVS content is referenced by version and identifier rather than reproduced.

## Reuse statement for the planned changes

- **Cache boundaries:** local equivalent informed by framework/proxy cache-safety principles; no library reused.
- **Readiness endpoint:** local equivalent using the existing runtime database boundary; no external implementation copied.
- **Dependency remediation:** native npm lockfile/audit capability and upstream advisory data; no new scanner dependency.
- **Security audit taxonomy:** ASVS 5.0.0 adopted as a versioned checklist.
- **Proxy/IP handling:** Arcjet and express-rate-limit guidance adapted as documentation/design constraints; no code copied and no new client-IP trust source introduced.
- **Rate limiting, bot/WAF, sensitive-data detection, and AI cost budgets:** researched but not activated; remain human-gated follow-up work.

## Loop closure condition

After safe implementation, the final security review must check whether the local solution is materially weak against the researched failure modes. If it is, repeat the research/compare/select/test/review loop before claiming completion. A green unit suite alone does not prove live proxy, TLS, Cloudflare, backup, rollback, or production observability readiness.
