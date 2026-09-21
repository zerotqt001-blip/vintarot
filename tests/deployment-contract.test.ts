import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../deploy/systemd/natarot.service", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../deploy/nginx/natarot-http.conf", import.meta.url), "utf8");
const backupService = readFileSync(new URL("../deploy/systemd/natarot-backup.service", import.meta.url), "utf8");
const backupTimer = readFileSync(new URL("../deploy/systemd/natarot-backup.timer", import.meta.url), "utf8");
const restoreService = readFileSync(new URL("../deploy/systemd/natarot-restore-test.service", import.meta.url), "utf8");
const restoreTimer = readFileSync(new URL("../deploy/systemd/natarot-restore-test.timer", import.meta.url), "utf8");

test("systemd service runs the Node migration and Vinext on localhost", () => {
  assert.match(service, /User=natarot/);
  assert.match(service, /EnvironmentFile=-\/etc\/natarot\.env/);
  assert.match(service, /ExecStartPre=.*scripts\/node-migrate\.mjs/);
  assert.match(service, /ExecStart=.*vinext\/dist\/cli\.js start/);
  assert.match(service, /--port 8787/);
  assert.match(service, /--hostname 127\.0\.0\.1/);
  assert.match(service, /Restart=always/);
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

test("backup service is a locked root-owned oneshot with explicit recovery paths", () => {
  assert.match(backupService, /Type=oneshot/);
  assert.match(backupService, /User=root/);
  assert.match(backupService, /ExecStart=\/usr\/local\/sbin\/natarot-backup/);
  assert.match(backupService, /NATAROT_BACKUP_ROOT=\/var\/backups\/natarot/);
  assert.match(backupService, /NATAROT_DB_PATH=\/var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(backupService, /NATAROT_NGINX_CONFIG=\/etc\/nginx\/sites-enabled\/natarot/);
  assert.match(backupService, /UMask=0077/);
  assert.match(backupService, /ReadWritePaths=-\/var\/backups\/natarot/);
});

test("backup timer runs daily and survives a reboot", () => {
  assert.match(backupTimer, /OnCalendar=.*02:15:00 UTC/);
  assert.match(backupTimer, /Persistent=true/);
  assert.match(backupTimer, /Unit=natarot-backup\.service/);
});

test("restore test service cannot replace production and runs isolated verification", () => {
  assert.match(restoreService, /Type=oneshot/);
  assert.match(restoreService, /ExecStart=\/usr\/local\/sbin\/natarot-restore-test/);
  assert.match(restoreService, /NATAROT_PRODUCTION_DB_PATH=\/var\/lib\/natarot\/natarot\.sqlite/);
  assert.match(restoreService, /PrivateTmp=true/);
  assert.match(restoreService, /ReadWritePaths=-\/var\/backups\/natarot/);
  assert.doesNotMatch(restoreService, /systemctl restart natarot/);
});

test("restore test timer is monthly and persistent", () => {
  assert.match(restoreTimer, /OnCalendar=.*-\*-01.*04:30:00 UTC/);
  assert.match(restoreTimer, /Persistent=true/);
  assert.match(restoreTimer, /Unit=natarot-restore-test\.service/);
});
