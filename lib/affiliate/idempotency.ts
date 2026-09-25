import { digestToken } from "../member-auth";

export type AffiliateLedgerMutationKind = "eligibility" | "reversal" | "adjustment";

export function scopedAffiliateLedgerIdempotencyKeys(
  entryType: AffiliateLedgerMutationKind,
  conversionId: string,
  normalizedKey: string,
): { key: string; previousScopedKey: string; legacyKey: string } {
  return {
    key: `affiliate:v2:${entryType}:${conversionId.length}:${conversionId}:${normalizedKey.length}:${normalizedKey}`,
    previousScopedKey: `affiliate:${entryType}:${conversionId}:${normalizedKey}`,
    legacyKey: `affiliate:${entryType}:${normalizedKey}`,
  };
}

export async function affiliateAdjustmentAuditIdempotencyKey(conversionId: string, idempotencyKey: string): Promise<string> {
  const digest = await digestToken(JSON.stringify({ conversionId, idempotencyKey }));
  return `admin.affiliate.adjust:${digest}`;
}
