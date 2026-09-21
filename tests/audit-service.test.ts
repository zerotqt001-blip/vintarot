import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createAuditService } from "../lib/audit/service";
import { createSqliteD1Database } from "../lib/sqlite-d1";

const repoRoot = join(import.meta.dirname, "..");

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

test("audit append/list redacts metadata and duplicate idempotency is stable", async () => {
  const fixture = database();
  const service = createAuditService(fixture.database, () => 1234);
  const first = await service.append({
    actorKind: "member",
    actorId: "member-a",
    action: "member.status.changed",
    targetType: "member",
    targetId: "member-b",
    reason: "support review",
    idempotencyKey: "audit-status-member-b-1",
    metadata: {
      status: "disabled",
      email: "reader@example.test",
      session_token: "raw-token",
      nested: { reading_payload: "private" },
    },
  });
  const duplicate = await service.append({
    actorKind: "member",
    actorId: "member-a",
    action: "member.status.changed",
    targetType: "member",
    targetId: "member-b",
    reason: "support review",
    idempotencyKey: "audit-status-member-b-1",
    metadata: { status: "disabled" },
  });
  assert.equal(duplicate.id, first.id);
  assert.equal((fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count, 1);

  const listed = await service.list({ actorId: "member-a" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].actorId, "member-a");
  assert.equal((listed[0].metadata as Record<string, unknown>).email, "[REDACTED]");
  assert.doesNotMatch(JSON.stringify(listed), /reader@example\.test|raw-token|private/);
  assert.equal("update" in service, false);
  assert.equal("delete" in service, false);
  fixture.sqlite.close();
});

test("audit append rejects unbounded or missing mutation reasons", async () => {
  const fixture = database();
  const service = createAuditService(fixture.database, () => 1234);
  await assert.rejects(
    () => service.append({ actorKind: "system", actorId: "system", action: "test", reason: "", idempotencyKey: "audit-empty-reason" }),
    /Invalid audit event/,
  );
  await assert.rejects(
    () => service.append({ actorKind: "system", actorId: "system", action: "test", reason: "x".repeat(501), idempotencyKey: "audit-long-reason" }),
    /Invalid audit event/,
  );
  fixture.sqlite.close();
});
