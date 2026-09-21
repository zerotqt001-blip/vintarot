import assert from "node:assert/strict";
import test from "node:test";
import { allocateLots, eligibleLots } from "../lib/credits/allocation";
import type { CreditLot } from "../lib/credits/types";

const lots: CreditLot[] = [
  { id: "late", units: 10, availableUnits: 10, eligibleFrom: 0, expiresAt: 500, createdAt: 1 },
  { id: "soon", units: 4, availableUnits: 4, eligibleFrom: 0, expiresAt: 200, createdAt: 2 },
  { id: "same-b", units: 3, availableUnits: 3, eligibleFrom: 0, expiresAt: 300, createdAt: 20 },
  { id: "same-a", units: 3, availableUnits: 3, eligibleFrom: 0, expiresAt: 300, createdAt: 10 },
  { id: "never", units: 2, availableUnits: 2, eligibleFrom: 0, expiresAt: null, createdAt: 0 },
  { id: "not-yet", units: 9, availableUnits: 9, eligibleFrom: 600, expiresAt: 800, createdAt: 0 },
  { id: "expired", units: 9, availableUnits: 9, eligibleFrom: 0, expiresAt: 99, createdAt: 0 },
  { id: "empty", units: 9, availableUnits: 0, eligibleFrom: 0, expiresAt: 1000, createdAt: 0 },
];

test("eligibleLots filters time and availability without mutating input", () => {
  const input = lots.map((lot) => ({ ...lot }));
  assert.deepEqual(eligibleLots(input, 100).map((lot) => lot.id), ["late", "soon", "same-b", "same-a", "never"]);
  assert.deepEqual(input, lots);
});

test("allocateLots uses earliest expiry first and deterministic tie-breaking", () => {
  const allocation = allocateLots(lots, 8, 100);
  assert.deepEqual(allocation, [
    { lotId: "soon", units: 4 },
    { lotId: "same-a", units: 3 },
    { lotId: "same-b", units: 1 },
  ]);
});

test("allocateLots leaves non-expiring credits last", () => {
  assert.deepEqual(allocateLots(lots, 11, 100), [
    { lotId: "soon", units: 4 },
    { lotId: "same-a", units: 3 },
    { lotId: "same-b", units: 3 },
    { lotId: "late", units: 1 },
  ]);
  assert.deepEqual(allocateLots(lots, 22, 100).at(-1), { lotId: "never", units: 2 });
});

test("allocateLots rejects invalid or insufficient requests", () => {
  assert.throws(() => allocateLots(lots, 0, 100), /positive/i);
  assert.throws(() => allocateLots(lots, 26, 100), /insufficient/i);
});
