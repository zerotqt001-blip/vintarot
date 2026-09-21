import assert from "node:assert/strict";
import test from "node:test";
import {
  SePayIpnAuthError,
  SePayPayloadError,
  parseAndNormalizeGatewayIpn,
} from "../lib/commercial/sepay-adapter";
import { getSePayConfig } from "../lib/commercial/sepay-adapter";

const config = getSePayConfig({
  SEPAY_ENVIRONMENT: "sandbox",
  SEPAY_MERCHANT_ID: "MERCHANT123",
  SEPAY_SECRET_KEY: "sandbox-secret",
  SEPAY_IPN_SECRET: "ipn-secret",
  NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
});

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    timestamp: new Date(1_758_456_000_000).toISOString(),
    notification_type: "ORDER_PAID",
    order: {
      id: "provider-order-uuid-1",
      order_id: "provider-order-1",
      order_status: "CAPTURED",
      order_currency: "VND",
      order_amount: "100000.00",
      order_invoice_number: "NT-20260921-0001",
    },
    transaction: {
      id: "provider-transaction-uuid-1",
      transaction_id: "provider-transaction-1",
      transaction_type: "PAYMENT",
      transaction_status: "APPROVED",
      transaction_amount: "100000",
      transaction_currency: "VND",
    },
    ...overrides,
  });
}

test("Gateway IPN is authenticated and normalized without provider payload leakage", async () => {
  const normalized = await parseAndNormalizeGatewayIpn(payload(), new Headers({ "X-Secret-Key": "ipn-secret" }), config, { now: 1_758_456_000_000 });
  assert.deepEqual(
    {
      providerOrderId: normalized.providerOrderId,
      invoiceNumber: normalized.invoiceNumber,
      transactionId: normalized.transactionId,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      notificationType: normalized.notificationType,
      orderStatus: normalized.orderStatus,
      transactionStatus: normalized.transactionStatus,
      transactionType: normalized.transactionType,
    },
    {
      providerOrderId: "provider-order-1",
      invoiceNumber: "NT-20260921-0001",
      transactionId: "provider-transaction-1",
      amountMinor: 100000,
      currency: "VND",
      notificationType: "ORDER_PAID",
      orderStatus: "CAPTURED",
      transactionStatus: "APPROVED",
      transactionType: "PAYMENT",
    },
  );
  assert.ok(normalized.payloadHash);
  assert.equal("card_number" in normalized, false);
});

test("Gateway IPN rejects forged, malformed, and stale callbacks", async () => {
  await assert.rejects(
    () => parseAndNormalizeGatewayIpn(payload(), new Headers({ "X-Secret-Key": "wrong" }), config, { now: 1_758_456_000_000 }),
    (error: unknown) => error instanceof SePayIpnAuthError && error.code === "invalid_ipn_secret",
  );
  await assert.rejects(
    () => parseAndNormalizeGatewayIpn("{not-json", new Headers({ "X-Secret-Key": "ipn-secret" }), config, { now: 1_758_456_000_000 }),
    (error: unknown) => error instanceof SePayPayloadError && error.code === "invalid_json",
  );
  await assert.rejects(
    () => parseAndNormalizeGatewayIpn(payload({ timestamp: new Date(1_758_456_000_000 - 16 * 60_000).toISOString() }), new Headers({ "X-Secret-Key": "ipn-secret" }), config, { now: 1_758_456_000_000 }),
    (error: unknown) => error instanceof SePayPayloadError && error.code === "stale_ipn",
  );
  await assert.rejects(
    () => parseAndNormalizeGatewayIpn(payload({ transaction: { transaction_id: "provider-transaction-1", transaction_type: "REFUND", transaction_status: "APPROVED", transaction_amount: "100000", transaction_currency: "VND" } }), new Headers({ "X-Secret-Key": "ipn-secret" }), config, { now: 1_758_456_000_000 }),
    (error: unknown) => error instanceof SePayPayloadError && error.code === "invalid_transaction",
  );
});
