import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAuditService } from "../lib/audit/service";
import { decryptField, encryptField, type EncryptionKeyring } from "../lib/security/encryption";
import { redactAuditMetadata } from "../lib/security/redaction";
import { requirePermission } from "../lib/admin/context";
import { createMemberAuthStore } from "../lib/member-auth";
import { createSqliteD1Database } from "../lib/sqlite-d1";
import type { AdminRole } from "../lib/admin/permissions";

const repoRoot = join(import.meta.dirname, "..");
const routePaths = [
  "app/api/admin/users/[id]/route.ts",
  "app/api/admin/users/[id]/sessions/route.ts",
  "app/api/admin/credits/route.ts",
  "app/api/admin/vip/route.ts",
  "app/api/admin/affiliate/route.ts",
];
const authenticatedBoundaryRoutes = ["app/api/affiliate/attribute/route.ts"];
const ownerReadRoutes = ["app/api/affiliate/dashboard/route.ts"];

function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of [
    "0000_vengeful_ben_urich.sql",
    "0001_dynamic_tarot.sql",
    "0002_tarot_seed.sql",
    "0003_moonlight_spread_catalog.sql",
    "0004_member_auth.sql",
    "0004_reading_payload.sql",
    "0005_natarot_share_persistence.sql",
    "0006_credits_vip.sql",
    "0007_backend_completion.sql",
  ]) sqlite.exec(readFileSync(join(repoRoot, "drizzle", migration), "utf8"));
  return { sqlite, database: createSqliteD1Database(sqlite) };
}

async function member(database: ReturnType<typeof createSqliteD1Database>, id: string, role: AdminRole) {
  await database.prepare("INSERT INTO members (id, username, email, phone, created_at, updated_at, disabled, role) VALUES (?, ?, ?, ?, ?, ?, 0, ?)")
    .bind(id, id, `${id}@example.test`, "+84912345678", 1, 1, role).run();
  return createMemberAuthStore(database, Date.now).createSession(id, false);
}

test("all privileged mutation routes enforce origin, server permission, strict input and replay keys", () => {
  for (const routePath of routePaths) {
    const route = source(routePath);
    assert.match(route, /originCheck\(request\)/, routePath);
    assert.match(route, /requirePermission\(/, routePath);
    assert.match(route, /noStoreResponse/, routePath);
    assert.match(route, /\.strict\(\)/, routePath);
    assert.match(route, /reason/, routePath);
    assert.match(route, /idempotency_key/, routePath);
    assert.doesNotMatch(route, /x-role|oai-authenticated-user|body\.owner|body\.role|body\.member_id/, routePath);
  }
  for (const routePath of authenticatedBoundaryRoutes) {
    const route = source(routePath);
    assert.match(route, /originCheck\(request\)/, routePath);
    assert.match(route, /requireMemberCreditOwner\(/, routePath);
    assert.match(route, /noStoreResponse/, routePath);
    assert.match(route, /\.strict\(\)/, routePath);
    assert.doesNotMatch(route, /x-role|oai-authenticated-user|body\.owner/, routePath);
  }
  for (const routePath of ownerReadRoutes) {
    const route = source(routePath);
    assert.match(route, /requireMemberCreditOwner\(request, database\)/, routePath);
    assert.match(route, /noStoreResponse/, routePath);
    assert.doesNotMatch(route, /request\.json\(\)|body\.member|body\.profile|searchParams/, routePath);
  }

  const privateProjections = [
    "lib/account-history.ts",
    "lib/affiliate/service.ts",
    "app/api/admin/orders/route.ts",
    "app/api/account/summary/route.ts",
    "app/api/account/history/route.ts",
  ].map(source).join("\n");
  assert.doesNotMatch(privateProjections, /SELECT[^;]*(password_hash|token_hash|reading_payload)/i);
});

test("authorization ignores spoofed role headers and re-reads disabled state", async () => {
  const fixture = database();
  const session = await member(fixture.database, "support", "SUPPORT");
  const request = new Request("https://natarot.test/api/admin/users", { headers: { cookie: `natarot_session=${session.raw}`, "x-role": "SUPER_ADMIN" } });
  const actor = await requirePermission(request, "admin.users.read", fixture.database);
  assert.equal(actor.role, "SUPPORT");
  await assert.rejects(() => requirePermission(request, "admin.credits.adjust", fixture.database), (error: unknown) => error instanceof Response && error.status === 403);
  await fixture.database.prepare("UPDATE members SET disabled=1 WHERE id='support'").run();
  await assert.rejects(() => requirePermission(request, "admin.users.read", fixture.database), (error: unknown) => error instanceof Response && error.status === 401);
  fixture.sqlite.close();
});

test("audit metadata stays bounded, redacted, and append-only even for hostile values", async () => {
  const fixture = database();
  const service = createAuditService(fixture.database, () => 1234);
  const circular: Record<string, unknown> = { status: "review" };
  circular.self = circular;
  const event = await service.append({
    actorKind: "member",
    actorId: "admin",
    action: "security.review",
    targetType: "member",
    targetId: "target",
    reason: "security review",
    idempotencyKey: "security-review-1",
    metadata: { email: "reader@example.test", authorization: "Bearer private", circular, huge: "x".repeat(40_000) },
  });
  assert.equal(event.metadata.email, "[REDACTED]");
  assert.equal(event.metadata.authorization, "[REDACTED]");
  assert.ok(JSON.stringify(event).length < 34_000);
  assert.deepEqual(redactAuditMetadata({ password_hash: "hash", nested: { phone: "+84912345678" } }), { password_hash: "[REDACTED]", nested: { phone: "[REDACTED]" } });
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count, 1);
  assert.equal("update" in service, false);
  assert.equal("delete" in service, false);
  fixture.sqlite.close();
});

test("field encryption rejects purpose swapping and malformed ciphertext without revealing plaintext", async () => {
  const keyBytes = new Uint8Array(32).fill(7);
  const key = btoa(String.fromCharCode(...keyBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const keyring: EncryptionKeyring = { currentKeyId: "v1", keys: { v1: key } };
  const ciphertext = await encryptField("private fraud note", "affiliate.fraud-note", keyring);
  assert.notEqual(ciphertext, "private fraud note");
  assert.equal(await decryptField(ciphertext, "affiliate.fraud-note", keyring), "private fraud note");
  await assert.rejects(() => decryptField(ciphertext, "audit.metadata", keyring), /Unable to decrypt field/);
  await assert.rejects(() => decryptField("natarot-pii:v1:v1:bad:bad:bad", "affiliate.fraud-note", keyring), /Unable to decrypt field/);
  assert.doesNotMatch(ciphertext, /private fraud note/);
});
