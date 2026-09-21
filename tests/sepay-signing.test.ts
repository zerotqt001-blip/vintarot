import assert from "node:assert/strict";
import test from "node:test";
import {
  SePayConfigError,
  buildCheckoutForm,
  getSePayConfig,
  normalizeVndAmount,
} from "../lib/commercial/sepay-adapter";

const config = getSePayConfig({
  SEPAY_ENVIRONMENT: "sandbox",
  SEPAY_MERCHANT_ID: "MERCHANT123",
  SEPAY_SECRET_KEY: "sandbox-secret",
  SEPAY_IPN_SECRET: "ipn-secret",
  NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
});

test("SePay checkout form uses the documented ordered HMAC fields", async () => {
  const form = await buildCheckoutForm({
    config,
    amountMinor: 100000,
    orderDescription: "NaTarot Sandbox",
    invoiceNumber: "NT-20260921-0001",
    customerId: "member-1",
    paymentMethod: "BANK_TRANSFER",
    successUrl: "https://staging.natarot.com/api/commercial/return?result=success",
    errorUrl: "https://staging.natarot.com/api/commercial/return?result=error",
    cancelUrl: "https://staging.natarot.com/api/commercial/return?result=cancel",
  });

  assert.equal(form.action, "https://pay-sandbox.sepay.vn/v1/checkout/init");
  assert.deepEqual(form.fields, {
    merchant: "MERCHANT123",
    currency: "VND",
    order_amount: "100000",
    operation: "PURCHASE",
    order_description: "NaTarot Sandbox",
    order_invoice_number: "NT-20260921-0001",
    customer_id: "member-1",
    payment_method: "BANK_TRANSFER",
    success_url: "https://staging.natarot.com/api/commercial/return?result=success",
    error_url: "https://staging.natarot.com/api/commercial/return?result=error",
    cancel_url: "https://staging.natarot.com/api/commercial/return?result=cancel",
    signature: "9mJH897IS8iLk5h4vwYOq1iuCMRcD14726ZaSHLwhow=",
  });
});

test("VND amount normalization rejects fractional and unsafe representations", () => {
  assert.equal(normalizeVndAmount("100000"), 100000);
  assert.equal(normalizeVndAmount("100000.00"), 100000);
  assert.equal(normalizeVndAmount(100000), 100000);
  assert.equal(normalizeVndAmount("100000.50"), null);
  assert.equal(normalizeVndAmount("1e5"), null);
  assert.equal(normalizeVndAmount("1,000"), null);
  assert.equal(normalizeVndAmount("-1"), null);
  assert.equal(normalizeVndAmount(Number.MAX_SAFE_INTEGER + 1), null);
});

test("SePay config fails closed for missing server-only values and production drift", () => {
  assert.throws(
    () => getSePayConfig({
      SEPAY_ENVIRONMENT: "sandbox",
      SEPAY_MERCHANT_ID: "MERCHANT123",
      SEPAY_SECRET_KEY: "sandbox-secret",
      NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
    }),
    (error: unknown) => error instanceof SePayConfigError && error.code === "missing_ipn_secret",
  );
  assert.throws(
    () => getSePayConfig({
      SEPAY_ENVIRONMENT: "production",
      SEPAY_MERCHANT_ID: "MERCHANT123",
      SEPAY_SECRET_KEY: "production-secret",
      SEPAY_IPN_SECRET: "ipn-secret",
      NATAROT_PUBLIC_ORIGIN: "https://staging.natarot.com",
    }),
    (error: unknown) => error instanceof SePayConfigError && error.code === "production_origin_mismatch",
  );
});
