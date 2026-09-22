import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { redactAuditMetadata } from "../security/redaction";
import type { AuditAppendInput, AuditEvent, AuditListFilter } from "./types";

function safeString(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : undefined;
}

function projection(row: Record<string, unknown>): AuditEvent {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.metadata_json ?? "{}"));
    metadata = redactAuditMetadata(parsed);
  } catch {
    metadata = { _redaction_failed: true };
  }
  return {
    id: String(row.id),
    actorKind: String(row.actor_kind) as AuditEvent["actorKind"],
    actorId: String(row.actor_id),
    action: String(row.action),
    targetType: row.target_type == null ? null : String(row.target_type),
    targetId: row.target_id == null ? null : String(row.target_id),
    reason: String(row.reason),
    idempotencyKey: String(row.idempotency_key),
    outcome: String(row.outcome) as AuditEvent["outcome"],
    metadata,
    createdAt: Number(row.created_at),
  };
}

async function byIdempotency(database: D1Database, idempotencyKey: string): Promise<AuditEvent | null> {
  const row = await database.prepare("SELECT id, actor_kind, actor_id, action, target_type, target_id, reason, idempotency_key, outcome, metadata_json, created_at FROM audit_events WHERE idempotency_key = ? LIMIT 1").bind(idempotencyKey).first<Record<string, unknown>>();
  return row ? projection(row) : null;
}

export function prepareAuditInsert(
  database: D1Database,
  input: AuditAppendInput,
  createdAt = Date.now(),
  options: { ignoreExisting?: boolean; guardSql?: string; guardValues?: unknown[] } = {},
): D1PreparedStatement {
  const actorId = safeString(input.actorId, 160);
  const action = safeString(input.action, 160);
  const reason = safeString(input.reason, 500);
  const idempotencyKey = safeString(input.idempotencyKey, 200);
  if (!actorId || !action || !reason || !idempotencyKey || !["member", "system"].includes(input.actorKind)) throw new Error("Invalid audit event");
  const targetType = safeString(input.targetType, 120);
  const targetId = safeString(input.targetId, 160);
  const outcome = input.outcome ?? "SUCCESS";
  if (!["SUCCESS", "DENIED", "FAILURE"].includes(outcome)) throw new Error("Invalid audit event");
  const metadataJson = JSON.stringify(redactAuditMetadata(input.metadata ?? {}));
  const id = safeString(input.id, 160) ?? globalThis.crypto.randomUUID();
  const insert = options.ignoreExisting === false ? "INSERT" : "INSERT OR IGNORE";
  const values = [id, input.actorKind, actorId, action, targetType ?? null, targetId ?? null, reason, idempotencyKey, outcome, metadataJson, createdAt];
  const statement = options.guardSql
    ? `${insert} INTO audit_events (id, actor_kind, actor_id, action, target_type, target_id, reason, idempotency_key, outcome, metadata_json, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${options.guardSql}`
    : `${insert} INTO audit_events (id, actor_kind, actor_id, action, target_type, target_id, reason, idempotency_key, outcome, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  return database.prepare(statement).bind(...values, ...(options.guardValues ?? []));
}

export function createAuditService(database: D1Database, now: () => number = () => Date.now()) {
  return {
    redactMetadata: redactAuditMetadata,
    async append(input: AuditAppendInput): Promise<AuditEvent> {
      const idempotencyKey = safeString(input.idempotencyKey, 200);
      if (!idempotencyKey) throw new Error("Invalid audit event");
      await prepareAuditInsert(database, input, now()).run();
      const existing = await byIdempotency(database, idempotencyKey);
      if (!existing) throw new Error("Audit event was not recorded");
      return existing;
    },
    async list(filter: AuditListFilter = {}): Promise<AuditEvent[]> {
      const limit = Math.max(1, Math.min(50, Math.trunc(filter.limit ?? 50)));
      const clauses: string[] = [];
      const values: Array<string | number> = [];
      if (filter.actorId) {
        clauses.push("actor_id = ?");
        values.push(filter.actorId);
      }
      if (filter.targetType) {
        clauses.push("target_type = ?");
        values.push(filter.targetType);
      }
      if (filter.targetId) {
        clauses.push("target_id = ?");
        values.push(filter.targetId);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await database.prepare(`SELECT id, actor_kind, actor_id, action, target_type, target_id, reason, idempotency_key, outcome, metadata_json, created_at FROM audit_events ${where} ORDER BY created_at DESC, id DESC LIMIT ?`).bind(...values, limit).all<Record<string, unknown>>();
      return result.results.map(projection);
    },
  };
}
