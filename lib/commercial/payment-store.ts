import type { D1Database } from "@cloudflare/workers-types";
import type { Order } from "../orders";
import type { SePayConfig, NormalizedSePayIpn } from "./sepay-adapter";

export type PaymentAttemptStatus = "PENDING" | "VERIFIED" | "FULFILLED" | "VOIDED" | "CANCELLED";

export type SePayPaymentAttempt = {
  id: string;
  orderId: string;
  provider: "sepay";
  environment: SePayConfig["environment"];
  invoiceNumber: string;
  requestFingerprint: string;
  status: PaymentAttemptStatus;
  providerOrderId: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type CommercialPaymentEvent = {
  id: string;
  orderId: string | null;
  provider: "sepay";
  environment: SePayConfig["environment"];
  providerEventKey: string;
  providerOrderId: string;
  providerInvoiceNumber: string;
  providerTransactionId: string;
  notificationType: NormalizedSePayIpn["notificationType"];
  providerOrderStatus: string;
  providerTransactionStatus: string;
  providerTransactionType: string;
  amountMinor: number;
  currency: "VND";
  source: "ipn" | "reconciliation";
  payloadHash: string;
  verificationStatus: "VERIFIED" | "REJECTED" | "VOIDED";
  rejectionCode: string | null;
  receivedAt: number;
  verifiedAt: number | null;
  createdAt: number;
};

export class PaymentStoreError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "PaymentStoreError";
  }
}

type AttemptRow = {
  id: string;
  orderId: string;
  provider: "sepay";
  environment: SePayConfig["environment"];
  invoiceNumber: string;
  requestFingerprint: string;
  status: PaymentAttemptStatus;
  providerOrderId: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type EventRow = {
  id: string;
  orderId: string | null;
  provider: "sepay";
  environment: SePayConfig["environment"];
  providerEventKey: string;
  providerOrderId: string;
  providerInvoiceNumber: string;
  providerTransactionId: string;
  notificationType: NormalizedSePayIpn["notificationType"];
  providerOrderStatus: string;
  providerTransactionStatus: string;
  providerTransactionType: string;
  amountMinor: number;
  currency: "VND";
  source: "ipn" | "reconciliation";
  payloadHash: string;
  verificationStatus: "VERIFIED" | "REJECTED" | "VOIDED";
  rejectionCode: string | null;
  receivedAt: number;
  verifiedAt: number | null;
  createdAt: number;
};

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

function mapAttempt(row: AttemptRow): SePayPaymentAttempt {
  return { ...row, provider: "sepay", status: row.status, createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt), expiresAt: row.expiresAt === null ? null : Number(row.expiresAt) };
}

function mapEvent(row: EventRow): CommercialPaymentEvent {
  return { ...row, provider: "sepay", amountMinor: Number(row.amountMinor), receivedAt: Number(row.receivedAt), verifiedAt: row.verifiedAt === null ? null : Number(row.verifiedAt), createdAt: Number(row.createdAt) };
}

export async function createOrGetSePayPaymentAttempt(input: {
  database: D1Database;
  config: SePayConfig;
  order: Pick<Order, "id">;
  invoiceNumber: string;
  requestFingerprint: string;
  expiresAt?: number | null;
  now?: () => number;
}): Promise<SePayPaymentAttempt> {
  const invoiceNumber = input.invoiceNumber.trim();
  if (!invoiceNumber) throw new PaymentStoreError("Payment invoice is required", "invalid_invoice");
  if (!input.requestFingerprint.trim()) throw new PaymentStoreError("Payment request fingerprint is required", "invalid_request_fingerprint");
  const timestamp = (input.now ?? Date.now)();
  await input.database.prepare("INSERT OR IGNORE INTO commercial_payment_attempts (id, order_id, provider, environment, invoice_number, request_fingerprint, status, provider_order_id, expires_at, created_at, updated_at) VALUES (?, ?, 'sepay', ?, ?, ?, 'PENDING', NULL, ?, ?, ?)")
    .bind(`payment-attempt:${input.order.id}`, input.order.id, input.config.environment, invoiceNumber, input.requestFingerprint, input.expiresAt ?? null, timestamp, timestamp)
    .run();
  const row = await first<AttemptRow>(input.database, "SELECT id, order_id AS orderId, provider, environment, invoice_number AS invoiceNumber, request_fingerprint AS requestFingerprint, status, provider_order_id AS providerOrderId, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM commercial_payment_attempts WHERE order_id = ?", input.order.id);
  if (!row) throw new PaymentStoreError("Payment attempt was not persisted", "payment_attempt_unavailable");
  const attempt = mapAttempt(row);
  if (attempt.requestFingerprint !== input.requestFingerprint || attempt.invoiceNumber !== invoiceNumber || attempt.environment !== input.config.environment) {
    throw new PaymentStoreError("Payment attempt conflicts with the existing order", "payment_attempt_conflict");
  }
  return attempt;
}

export async function getSePayPaymentAttemptByInvoice(database: D1Database, config: SePayConfig, invoiceNumber: string): Promise<SePayPaymentAttempt | null> {
  const row = await first<AttemptRow>(database, "SELECT id, order_id AS orderId, provider, environment, invoice_number AS invoiceNumber, request_fingerprint AS requestFingerprint, status, provider_order_id AS providerOrderId, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM commercial_payment_attempts WHERE provider = 'sepay' AND environment = ? AND invoice_number = ?", config.environment, invoiceNumber);
  return row ? mapAttempt(row) : null;
}

export async function getSePayPaymentAttemptByOrder(database: D1Database, orderId: string): Promise<SePayPaymentAttempt | null> {
  const row = await first<AttemptRow>(database, "SELECT id, order_id AS orderId, provider, environment, invoice_number AS invoiceNumber, request_fingerprint AS requestFingerprint, status, provider_order_id AS providerOrderId, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM commercial_payment_attempts WHERE order_id = ?", orderId);
  return row ? mapAttempt(row) : null;
}

export async function updateProviderOrderHint(database: D1Database, input: { attemptId: string; providerOrderId: string; now?: () => number }): Promise<void> {
  if (!input.providerOrderId.trim()) return;
  await database.prepare("UPDATE commercial_payment_attempts SET provider_order_id = COALESCE(provider_order_id, ?), updated_at = ? WHERE id = ?")
    .bind(input.providerOrderId.trim(), (input.now ?? Date.now)(), input.attemptId)
    .run();
}

export async function getCommercialPaymentEventByKey(database: D1Database, config: SePayConfig, providerEventKey: string): Promise<CommercialPaymentEvent | null> {
  const row = await first<EventRow>(database, "SELECT id, order_id AS orderId, provider, environment, provider_event_key AS providerEventKey, provider_order_id AS providerOrderId, provider_invoice_number AS providerInvoiceNumber, provider_transaction_id AS providerTransactionId, notification_type AS notificationType, provider_order_status AS providerOrderStatus, provider_transaction_status AS providerTransactionStatus, provider_transaction_type AS providerTransactionType, amount_minor AS amountMinor, currency, source, payload_hash AS payloadHash, verification_status AS verificationStatus, rejection_code AS rejectionCode, received_at AS receivedAt, verified_at AS verifiedAt, created_at AS createdAt FROM commercial_payment_events WHERE provider = 'sepay' AND environment = ? AND provider_event_key = ?", config.environment, providerEventKey);
  return row ? mapEvent(row) : null;
}

export async function getCommercialPaymentEventByTransaction(database: D1Database, config: SePayConfig, transactionId: string): Promise<CommercialPaymentEvent | null> {
  const row = await first<EventRow>(database, "SELECT id, order_id AS orderId, provider, environment, provider_event_key AS providerEventKey, provider_order_id AS providerOrderId, provider_invoice_number AS providerInvoiceNumber, provider_transaction_id AS providerTransactionId, notification_type AS notificationType, provider_order_status AS providerOrderStatus, provider_transaction_status AS providerTransactionStatus, provider_transaction_type AS providerTransactionType, amount_minor AS amountMinor, currency, source, payload_hash AS payloadHash, verification_status AS verificationStatus, rejection_code AS rejectionCode, received_at AS receivedAt, verified_at AS verifiedAt, created_at AS createdAt FROM commercial_payment_events WHERE provider = 'sepay' AND environment = ? AND provider_transaction_id = ?", config.environment, transactionId);
  return row ? mapEvent(row) : null;
}

export async function recordVerifiedSePayEvent(input: {
  database: D1Database;
  config: SePayConfig;
  attempt: SePayPaymentAttempt;
  evidence: NormalizedSePayIpn;
  eventId: string;
  source: "ipn" | "reconciliation";
  now?: () => number;
}): Promise<void> {
  const timestamp = (input.now ?? Date.now)();
  const providerEventKey = `${input.evidence.notificationType}:${input.evidence.providerOrderId}:${input.evidence.transactionId}`;
  const paymentReference = `sepay:${input.config.environment}:${input.evidence.transactionId}`;
  await input.database.batch([
    input.database.prepare(`INSERT OR IGNORE INTO commercial_payment_events
      (id, order_id, provider, environment, provider_event_key, provider_order_id, provider_invoice_number, provider_transaction_id, notification_type, provider_order_status, provider_transaction_status, provider_transaction_type, amount_minor, currency, source, payload_hash, verification_status, rejection_code, received_at, verified_at, created_at)
      SELECT ?, o.id, 'sepay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', NULL, ?, ?, ?
      FROM orders o
      WHERE o.id = ? AND (o.status = 'PENDING' OR o.payment_reference = ?)`)
      .bind(input.eventId, input.config.environment, providerEventKey, input.evidence.providerOrderId, input.evidence.invoiceNumber, input.evidence.transactionId, input.evidence.notificationType, input.evidence.orderStatus, input.evidence.transactionStatus, input.evidence.transactionType, input.evidence.amountMinor, input.evidence.currency, input.source, input.evidence.payloadHash, timestamp, timestamp, timestamp, input.attempt.orderId, paymentReference),
    input.database.prepare("UPDATE commercial_payment_attempts SET provider_order_id = COALESCE(provider_order_id, ?), status = CASE WHEN status = 'FULFILLED' THEN status ELSE 'VERIFIED' END, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM commercial_payment_events WHERE id = ? AND order_id = ?)")
      .bind(input.evidence.providerOrderId, timestamp, input.attempt.id, input.eventId, input.attempt.orderId),
    input.database.prepare("UPDATE orders SET status = 'PAYMENT_CONFIRMED', payment_reference = ?, payment_confirmed_at = ? WHERE id = ? AND status = 'PENDING'")
      .bind(paymentReference, timestamp, input.attempt.orderId),
  ]);
}
