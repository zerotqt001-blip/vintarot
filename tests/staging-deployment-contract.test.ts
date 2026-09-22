import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../deploy/systemd/natarot-staging.service", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../deploy/nginx/natarot-staging-bootstrap.conf", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../deploy/nginx/natarot-staging.conf", import.meta.url), "utf8");

test("staging systemd service is isolated from production", () => {
  assert.match(service, /User=natarot-staging/);
  assert.match(service, /Group=natarot-staging/);
  assert.match(service, /WorkingDirectory=\/opt\/natarot-staging/);
  assert.match(service, /EnvironmentFile=-\/etc\/natarot-staging\.env/);
  assert.match(service, /NATAROT_DB_PATH=\/var\/lib\/natarot-staging\/natarot\.sqlite/);
  assert.match(service, /NATAROT_PUBLIC_ORIGIN=https:\/\/staging\.natarot\.com/);
  assert.match(service, /NATAROT_TRUSTED_PROXY=1/);
  assert.match(service, /StateDirectory=natarot-staging/);
  assert.match(service, /ExecStartPre=.*\/opt\/natarot-staging\/scripts\/node-migrate\.mjs/);
  assert.match(service, /ExecStart=.*--port 8788/);
  assert.match(service, /--hostname 127\.0\.0\.1/);
  assert.match(service, /Restart=always/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.doesNotMatch(service, /natarot\.service/);
  assert.doesNotMatch(service, /127\.0\.0\.1:8787/);
  assert.doesNotMatch(service, /\/opt\/natarot(?:\/|$)/m);
  assert.doesNotMatch(service, /\/var\/lib\/natarot\/natarot\.sqlite/);
  assert.doesNotMatch(service, /\/etc\/natarot\.env(?:\b|$)/);
});

test("bootstrap Nginx host exposes only staging over the staging port", () => {
  assert.match(bootstrap, /server_name\s+staging\.natarot\.com/);
  assert.match(bootstrap, /proxy_pass\s+http:\/\/127\.0\.0\.1:8788/);
  assert.match(bootstrap, /proxy_set_header\s+Host\s+\$host/);
  assert.match(bootstrap, /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme/);
  assert.match(bootstrap, /X-Robots-Tag\s+"noindex, nofollow"/);
  assert.doesNotMatch(bootstrap, /server_name\s+natarot\.com/);
  assert.doesNotMatch(bootstrap, /127\.0\.0\.1:8787/);
});

test("final Nginx host redirects HTTP and terminates TLS for staging only", () => {
  assert.match(nginx, /listen 80/);
  assert.match(nginx, /return 301 https:\/\/\$host\$request_uri/);
  assert.match(nginx, /listen 443 ssl/);
  assert.match(nginx, /server_name\s+staging\.natarot\.com/);
  assert.match(nginx, /ssl_certificate\s+\/etc\/letsencrypt\/live\/staging\.natarot\.com\/fullchain\.pem/);
  assert.match(nginx, /ssl_certificate_key\s+\/etc\/letsencrypt\/live\/staging\.natarot\.com\/privkey\.pem/);
  assert.match(nginx, /proxy_pass\s+http:\/\/127\.0\.0\.1:8788/);
  assert.match(nginx, /proxy_set_header\s+oai-authenticated-user-id\s+""/);
  assert.match(nginx, /add_header\s+X-Content-Type-Options\s+nosniff/);
  assert.match(nginx, /add_header\s+X-Frame-Options\s+SAMEORIGIN/);
  assert.match(nginx, /add_header\s+Referrer-Policy\s+strict-origin-when-cross-origin/);
  assert.match(nginx, /add_header\s+X-Robots-Tag\s+"noindex, nofollow"/);
  assert.doesNotMatch(nginx, /server_name\s+natarot\.com/);
  assert.doesNotMatch(nginx, /127\.0\.0\.1:8787/);
});

test("staging health route exposes no runtime configuration", () => {
  const health = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /Response\.json\(\{ status: "ok" \}\)/);
  assert.doesNotMatch(health, /process\.env|runtimeEnv|NATAROT_|SECRET|TOKEN|PASSWORD/i);
});
