export type AuditActorKind = "member" | "system";
export type AuditOutcome = "SUCCESS" | "DENIED" | "FAILURE";

export interface AuditAppendInput {
  id?: string;
  actorKind: AuditActorKind;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason: string;
  idempotencyKey: string;
  outcome?: AuditOutcome;
  metadata?: unknown;
}

export interface AuditEvent {
  id: string;
  actorKind: AuditActorKind;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  idempotencyKey: string;
  outcome: AuditOutcome;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface AuditListFilter {
  actorId?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
}
