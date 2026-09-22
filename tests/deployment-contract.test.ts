import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../deploy/systemd/natarot.service", import.meta.url), "utf8");
const backupService = readFileSync(new URL("../deploy/systemd/natarot-backup.service", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../deploy/nginx/natarot-http.conf", import.meta.url), "utf8");

test("systemd service runs the Node migration and Vinext on localhost", () => {
  assert.match(service, /User=natarot/);
  assert.match(service, /EnvironmentFile=-\/etc\/natarot\.env/);
  assert.match(service, /WorkingDirectory=\/opt\/natarot\/current/);
  assert.match(service, /ExecStartPre=.*\/opt\/natarot\/current\/scripts\/node-migrate\.mjs/);
  assert.match(service, /ExecStart=.*\/opt\/natarot\/current\/node_modules\/vinext\/dist\/cli\.js start/);
  assert.match(service, /ExecStartPre=.*scripts\/node-migrate\.mjs/);
  assert.match(service, /ExecStart=.*vinext\/dist\/cli\.js start/);
  assert.match(service, /--port 8787/);
  assert.match(service, /--hostname 127\.0\.0\.1/);
  assert.match(service, /Restart=always/);
});

test("production backup service follows the managed current release", () => {
  assert.match(backupService, /Environment=NATAROT_APP_ROOT=\/opt\/natarot\/current/);
  assert.match(backupService, /Environment=NATAROT_DB_PATH=\/var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(backupService, /ExecStart=\/usr\/local\/sbin\/natarot-backup/);
  assert.match(backupService, /ProtectSystem=full/);
});

test("Nginx proxies both public hosts with bounded requests and forwarded headers", () => {
  assert.match(nginx, /server_name\s+natarot\.com\s+www\.natarot\.com/);
  assert.match(nginx, /client_max_body_size\s+2m/);
  assert.match(nginx, /proxy_pass\s+http:\/\/127\.0\.0\.1:8787/);
  assert.match(nginx, /proxy_set_header\s+Host\s+\$host/);
  assert.match(nginx, /proxy_set_header\s+X-Real-IP\s+\$remote_addr/);
  assert.match(nginx, /proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for/);
  assert.match(nginx, /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme/);
  assert.match(nginx, /add_header\s+X-Content-Type-Options\s+nosniff/);
  assert.match(nginx, /add_header\s+X-Frame-Options\s+SAMEORIGIN/);
  assert.match(nginx, /add_header\s+Referrer-Policy\s+strict-origin-when-cross-origin/);
});
