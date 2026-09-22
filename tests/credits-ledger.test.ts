import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLedgerConservation,
  createRequestFingerprint,
  validateLedgerEntry,
  type LedgerEntryDraft,
} from "../lib/credits/ledger";

const baseEntry: LedgerEntryDraft = {
  eventType: "GRANT",
  units: 5,
  idempotencyKey: "grant:welcome",
  requestFingerprint: "request-fingerprint",
  reason: "Welcome grant",
  effectiveAt: 100,
  createdAt: 100,
};

test("ledger validation enforces event sign and required idempotency fields", () => {
  assert.doesNotThrow(() => validateLedgerEntry(baseEntry));
  assert.doesNotThrow(() => validateLedgerEntry({ ...baseEntry, eventType: "CONSUME", units: -1 }));
  assert.throws(() => validateLedgerEntry({ ...baseEntry, units: 0 }), /non-zero/i);
  assert.throws(() => validateLedgerEntry({ ...baseEntry, eventType: "CONSUME", units: 1 }), /negative/i);
  assert.throws(() => validateLedgerEntry({ ...baseEntry, idempotencyKey: "" }), /idempotency/i);
  assert.throws(() => validateLedgerEntry({ ...baseEntry, requestFingerprint: "" }), /fingerprint/i);
});

test("request fingerprint is canonical for object key order", () => {
  assert.equal(
    createRequestFingerprint({ locale: "vi", sessionId: "session-1", options: { tone: "calm", spread: 3 } }),
    createRequestFingerprint({ options: { spread: 3, tone: "calm" }, sessionId: "session-1", locale: "vi" }),
  );
  assert.notEqual(createRequestFingerprint({ amount: 1 }), createRequestFingerprint({ amount: 2 }));
});

test("ledger conservation matches available plus reserved credits", () => {
  assert.doesNotThrow(() => assertLedgerConservation({ ledgerUnits: 12, availableUnits: 7, reservedUnits: 5 }));
  assert.throws(
    () => assertLedgerConservation({ ledgerUnits: 12, availableUnits: 8, reservedUnits: 5 }),
    /conservation/i,
  );
});
