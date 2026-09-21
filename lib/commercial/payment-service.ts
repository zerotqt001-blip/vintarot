import type { D1Database } from "@cloudflare/workers-types";
import { fulfillOrder, getOrderById, type Order, type OrderFulfillment } from "../orders";
import type { CreditStore } from "../credits/repository";
import {
  fetchSePayJson,
  normalizeSePayOrderDetail,
  type NormalizedSePayIpn,
  type SePayConfig,
} from "./sepay-adapter";
import {
  createOrGetSePayPaymentAttempt,
  getCommercialPaymentEventByKey,
  getCommercialPaymentEventByTransaction,
  getSePayPaymentAttemptByOrder,
  getSePayPaymentAttemptByInvoice,
  recordVerifiedSePayEvent,
  updateProviderOrderHint,
  type CommercialPaymentEvent,
  type SePayPaymentAttempt,
} from "./payment-store";

export class PaymentVerificationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

export type AppliedSePayPayment = {
  eventId: string;
  order: Order;
  fulfillment: OrderFulfillment | null;
  fulfillmentErrorCode: string | null;
  duplicate: boolean;
};

export type ReconciledSePayPayment = {
  status: "PENDING" | "PAYMENT_CONFIRMED" | "FULFILLED";
  order: Order;
  eventId: string | null;
  fulfillmentErrorCode: string | null;
};

type PaymentOrderRow = {
  id: string;
  amountMinor: number;
  currency: string;
  status: Order["status"];
  paymentReference: string | null;
};

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

function providerEventKey(evidence: NormalizedSePayIpn): string {
  return `${evidence.notificationType}:${evidence.providerOrderId}:${evidence.transactionId}`;
}

function eventId(config: SePayConfig, key: string): string {
  return `payment-event:sepay:${config.environment}:${key}`;
}

function assertSupportedEvidence(evidence: NormalizedSePayIpn): void {
  if (evidence.notificationType !== "ORDER_PAID") throw new PaymentVerificationError("Only an approved payment can confirm an order", "unsupported_notification");
  if (evidence.orderStatus !== "CAPTURED" || evidence.transactionStatus !== "APPROVED" || evidence.transactionType !== "PAYMENT") {
    throw new PaymentVerificationError("Provider payment is not approved", "invalid_provider_status");
  }
  if (!Number.isSafeInteger(evidence.amountMinor) || evidence.amountMinor < 0 || evidence.currency !== "VND") {
    throw new PaymentVerificationError("Provider amount or currency is invalid", "amount_mismatch");
  }
  if (!evidence.providerOrderId.trim() || !evidence.invoiceNumber.trim() || !evidence.transactionId.trim()) {
    throw new PaymentVerificationError("Provider payment identity is incomplete", "invalid_provider_identity");
  }
}

function assertExistingEventCompatible(existing: CommercialPaymentEvent | null, expected: { orderId: string; eventKey: string; payloadHash: string }): boolean {
  if (!existing) return false;
  if (existing.orderId !== expected.orderId || existing.providerEventKey !== expected.eventKey || existing.payloadHash !== expected.payloadHash) {
    throw new PaymentVerificationError("Provider event identity conflicts with an existing payment", "provider_transaction_conflict");
  }
  if (existing.verificationStatus !== "VERIFIED") throw new PaymentVerificationError("Provider event is not verified", "provider_event_rejected");
  return true;
}

export async function createSePayPaymentAttempt(input: {
  database: D1Database;
  config: SePayConfig;
  order: Pick<Order, "id">;
  invoiceNumber: string;
  requestFingerprint: string;
  expiresAt?: number | null;
  now?: () => number;
}): Promise<SePayPaymentAttempt> {
  return createOrGetSePayPaymentAttempt(input);
}

export async function applyVerifiedSePayPayment(input: {
  database: D1Database;
  creditStore: CreditStore;
  config: SePayConfig;
  evidence: NormalizedSePayIpn;
  source?: "ipn" | "reconciliation";
  now?: () => number;
}): Promise<AppliedSePayPayment> {
  assertSupportedEvidence(input.evidence);
  const attempt = await getSePayPaymentAttemptByInvoice(input.database, input.config, input.evidence.invoiceNumber);
  if (!attempt) throw new PaymentVerificationError("Payment attempt was not found", "payment_attempt_not_found");
  if (attempt.providerOrderId && attempt.providerOrderId !== input.evidence.providerOrderId) {
    throw new PaymentVerificationError("Provider order identity conflicts with the attempt", "provider_order_conflict");
  }
  const order = await first<PaymentOrderRow>(input.database, "SELECT id, amount_minor AS amountMinor, currency, status, payment_reference AS paymentReference FROM orders WHERE id = ?", attempt.orderId);
  if (!order) throw new PaymentVerificationError("Order was not found", "order_not_found");
  if (order.amountMinor !== input.evidence.amountMinor || order.currency !== input.evidence.currency) {
    throw new PaymentVerificationError("Provider amount does not match the order", "amount_mismatch");
  }
  const paymentReference = `sepay:${input.config.environment}:${input.evidence.transactionId}`;
  if (order.status !== "PENDING" && order.paymentReference !== paymentReference) {
    throw new PaymentVerificationError("Order already has a different payment reference", "payment_reference_conflict");
  }
  const eventKey = providerEventKey(input.evidence);
  const existingByTransaction = await getCommercialPaymentEventByTransaction(input.database, input.config, input.evidence.transactionId);
  const existingByKey = await getCommercialPaymentEventByKey(input.database, input.config, eventKey);
  const duplicate = assertExistingEventCompatible(existingByTransaction ?? existingByKey, { orderId: order.id, eventKey, payloadHash: input.evidence.payloadHash });
  const id = eventId(input.config, eventKey);
  await recordVerifiedSePayEvent({
    database: input.database,
    config: input.config,
    attempt,
    evidence: input.evidence,
    eventId: id,
    source: input.source ?? "ipn",
    now: input.now,
  });
  const event = await getCommercialPaymentEventByKey(input.database, input.config, eventKey);
  if (!event || event.orderId !== order.id || event.payloadHash !== input.evidence.payloadHash) {
    throw new PaymentVerificationError("Provider event was not durably accepted", "payment_event_unavailable");
  }
  let fulfillment: OrderFulfillment | null = null;
  let fulfillmentErrorCode: string | null = null;
  try {
    const result = await fulfillOrder({ database: input.database, creditStore: input.creditStore, orderId: order.id, paymentEventId: event.id, now: input.now });
    fulfillment = result.fulfillment;
    const finalOrder = result.order;
    return { eventId: event.id, order: finalOrder, fulfillment, fulfillmentErrorCode, duplicate };
  } catch (error) {
    fulfillmentErrorCode = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "fulfillment_retryable";
  }
  const finalOrder = await getOrderById(input.database, order.id);
  if (finalOrder) return { eventId: event.id, order: finalOrder, fulfillment, fulfillmentErrorCode, duplicate };
  throw new PaymentVerificationError("Payment was confirmed but order state could not be returned", "order_state_unavailable");
}

function providerOrderIdFromList(payload: unknown, invoiceNumber: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const row = data.find((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return (typeof record.order_invoice_number === "string" ? record.order_invoice_number.trim() : "") === invoiceNumber;
  });
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const providerOrderId = record.order_id ?? record.id;
  return typeof providerOrderId === "string" && providerOrderId.trim() ? providerOrderId.trim() : null;
}

export async function reconcileSePayPayment(input: {
  database: D1Database;
  creditStore: CreditStore;
  config: SePayConfig;
  orderId: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<ReconciledSePayPayment> {
  const order = await getOrderById(input.database, input.orderId);
  if (!order) throw new PaymentVerificationError("Order was not found", "order_not_found");
  const attempt = await getSePayPaymentAttemptByOrder(input.database, input.orderId);
  if (!attempt || attempt.environment !== input.config.environment) throw new PaymentVerificationError("Payment attempt was not found", "payment_attempt_not_found");
  const fetchImpl = input.fetchImpl ?? fetch;
  let providerOrderId = attempt.providerOrderId;
  if (!providerOrderId) {
    const list = await fetchSePayJson(input.config, `/v1/order?per_page=50&page=1&q=${encodeURIComponent(attempt.invoiceNumber)}&sort=created_at%3Adesc`, fetchImpl);
    providerOrderId = providerOrderIdFromList(list, attempt.invoiceNumber);
    if (!providerOrderId) return { status: order.status === "FULFILLED" ? "FULFILLED" : order.status === "PAYMENT_CONFIRMED" ? "PAYMENT_CONFIRMED" : "PENDING", order, eventId: null, fulfillmentErrorCode: null };
  }
  await updateProviderOrderHint(input.database, { attemptId: attempt.id, providerOrderId, now: input.now });
  const detail = await fetchSePayJson(input.config, `/v1/order/detail/${encodeURIComponent(providerOrderId)}`, fetchImpl);
  const evidence = await normalizeSePayOrderDetail(detail, (input.now ?? Date.now)());
  if (!evidence) {
    const refreshed = await getOrderById(input.database, input.orderId);
    if (!refreshed) throw new PaymentVerificationError("Order state is unavailable", "order_state_unavailable");
    return { status: refreshed.status === "FULFILLED" ? "FULFILLED" : refreshed.status === "PAYMENT_CONFIRMED" ? "PAYMENT_CONFIRMED" : "PENDING", order: refreshed, eventId: null, fulfillmentErrorCode: null };
  }
  const applied = await applyVerifiedSePayPayment({ ...input, evidence, source: "reconciliation" });
  return { status: applied.order.status === "FULFILLED" ? "FULFILLED" : applied.order.status === "PAYMENT_CONFIRMED" ? "PAYMENT_CONFIRMED" : "PENDING", order: applied.order, eventId: applied.eventId, fulfillmentErrorCode: applied.fulfillmentErrorCode };
}
