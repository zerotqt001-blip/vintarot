import type { CreditAllocation, CreditLot } from "./types";

export class CreditAllocationError extends Error {
  readonly code = "insufficient";

  constructor(message: string) {
    super(message);
    this.name = "CreditAllocationError";
  }
}

export function eligibleLots(lots: readonly CreditLot[], now: number): CreditLot[] {
  return lots
    .filter((lot) => lot.availableUnits > 0)
    .filter((lot) => lot.eligibleFrom <= now)
    .filter((lot) => lot.expiresAt === null || lot.expiresAt > now)
    .map((lot) => ({ ...lot }));
}

function compareLots(left: CreditLot, right: CreditLot): number {
  if (left.expiresAt === null && right.expiresAt !== null) return 1;
  if (left.expiresAt !== null && right.expiresAt === null) return -1;
  if (left.expiresAt !== null && right.expiresAt !== null && left.expiresAt !== right.expiresAt) {
    return left.expiresAt - right.expiresAt;
  }
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.id.localeCompare(right.id);
}

export function allocateLots(lots: readonly CreditLot[], units: number, now: number): CreditAllocation[] {
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new CreditAllocationError("Credit allocation units must be a positive integer");
  }

  const orderedLots = eligibleLots(lots, now).sort(compareLots);
  const availableUnits = orderedLots.reduce((sum, lot) => sum + lot.availableUnits, 0);
  if (availableUnits < units) {
    throw new CreditAllocationError(`Insufficient credits: requested ${units}, available ${availableUnits}`);
  }

  let remaining = units;
  const allocation: CreditAllocation[] = [];
  for (const lot of orderedLots) {
    if (remaining === 0) break;
    const held = Math.min(remaining, lot.availableUnits);
    allocation.push({ lotId: lot.id, units: held });
    remaining -= held;
  }
  return allocation;
}
