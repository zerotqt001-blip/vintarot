import type { CreditLedgerEventType } from "./types";

export type LedgerEntryDraft = {
  eventType: CreditLedgerEventType;
  units: number;
  idempotencyKey: string;
  requestFingerprint: string;
  reason: string;
  effectiveAt: number;
  createdAt: number;
  grantId?: string | null;
  reservationId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
};

export class LedgerInvariantError extends Error {
  readonly code = "ledger_invariant";

  constructor(message: string) {
    super(message);
    this.name = "LedgerInvariantError";
  }
}

const positiveEvents = new Set<CreditLedgerEventType>(["GRANT", "REFUND"]);
const negativeEvents = new Set<CreditLedgerEventType>(["CONSUME", "EXPIRATION"]);

export function validateLedgerEntry(entry: LedgerEntryDraft): void {
  if (!Number.isSafeInteger(entry.units) || entry.units === 0) {
    throw new LedgerInvariantError("Ledger units must be a non-zero safe integer");
  }
  if (positiveEvents.has(entry.eventType) && entry.units < 0) {
    throw new LedgerInvariantError(`${entry.eventType} ledger units must be positive`);
  }
  if (negativeEvents.has(entry.eventType) && entry.units > 0) {
    throw new LedgerInvariantError(`${entry.eventType} ledger units must be negative`);
  }
  if (!entry.idempotencyKey.trim()) {
    throw new LedgerInvariantError("Ledger idempotency key is required");
  }
  if (!entry.requestFingerprint.trim()) {
    throw new LedgerInvariantError("Ledger request fingerprint is required");
  }
  if (!entry.reason.trim()) {
    throw new LedgerInvariantError("Ledger reason is required");
  }
  if (!Number.isSafeInteger(entry.effectiveAt) || !Number.isSafeInteger(entry.createdAt)) {
    throw new LedgerInvariantError("Ledger timestamps must be safe integers");
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function createRequestFingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function assertLedgerConservation(input: {
  ledgerUnits: number;
  availableUnits: number;
  reservedUnits: number;
}): void {
  if (!Number.isSafeInteger(input.ledgerUnits) || !Number.isSafeInteger(input.availableUnits) || !Number.isSafeInteger(input.reservedUnits)) {
    throw new LedgerInvariantError("Credit conservation values must be safe integers");
  }
  if (input.availableUnits < 0 || input.reservedUnits < 0) {
    throw new LedgerInvariantError("Credit conservation values cannot be negative");
  }
  if (input.ledgerUnits !== input.availableUnits + input.reservedUnits) {
    throw new LedgerInvariantError(
      `Credit conservation mismatch: ledger=${input.ledgerUnits}, available=${input.availableUnits}, reserved=${input.reservedUnits}`,
    );
  }
}
