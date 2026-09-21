import type { D1Database } from "@cloudflare/workers-types";
import { createRequestFingerprint } from "./credits/ledger";
import { CreditIdempotencyError, type CreditStore } from "./credits/repository";
import type { CreditOwner } from "./credits/types";
import { activateEntitlement } from "./entitlements";
import { getActivePackageVersion } from "./packages/catalog";
import type { PackageBenefitSnapshot, PackageVersion } from "./packages/types";

export type OrderStatus = "PENDING" | "PAYMENT_CONFIRMED" | "FULFILLED" | "CANCELLED" | "REFUNDED";

export class OrderError extends Error {
  constructor(message: string, readonly code = "order_error") {
    super(message);
    this.name = "OrderError";
  }
}

export type Order = {
  id: string;
  accountId: string;
  owner: CreditOwner;
  packageId: string;
  packageVersionId: string;
  packageSnapshot: PackageVersion;
  amountMinor: number;
  currency: string;
  status: OrderStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  paymentReference: string | null;
  createdAt: number;
  paymentConfirmedAt: number | null;
  fulfilledAt: number | null;
  cancelledAt: number | null;
  refundedAt: number | null;
};

export type OrderFulfillment = {
  id: string;
  orderId: string;
  fulfillmentKey: string;
  resultSnapshot: string;
  createdAt: number;
};

export type CreatePendingOrderInput = {
  database: D1Database;
  creditStore: CreditStore;
  owner: CreditOwner;
  packageVersionId: string;
  idempotencyKey: string;
  now?: () => number;
};

type OrderRow = Omit<Order, "owner" | "packageSnapshot"> & {
  ownerKind: CreditOwner["kind"];
  ownerId: string;
  packageSnapshot: string;
};

type FulfillmentRow = OrderFulfillment;

function parsePackageSnapshot(value: string): PackageVersion {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "id" in parsed && "benefitSnapshot" in parsed) {
      return parsed as PackageVersion;
    }
  } catch {
    // The snapshot is immutable data; malformed rows are rejected below.
  }
  throw new OrderError("Order package snapshot is invalid", "invalid_snapshot");
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    accountId: row.accountId,
    owner: { kind: row.ownerKind, ownerId: row.ownerId },
    packageId: row.packageId,
    packageVersionId: row.packageVersionId,
    packageSnapshot: parsePackageSnapshot(row.packageSnapshot),
    amountMinor: Number(row.amountMinor),
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    paymentReference: row.paymentReference,
    createdAt: Number(row.createdAt),
    paymentConfirmedAt: row.paymentConfirmedAt === null ? null : Number(row.paymentConfirmedAt),
    fulfilledAt: row.fulfilledAt === null ? null : Number(row.fulfilledAt),
    cancelledAt: row.cancelledAt === null ? null : Number(row.cancelledAt),
    refundedAt: row.refundedAt === null ? null : Number(row.refundedAt),
  };
}

async function first<T>(database: D1Database, statement: string, ...values: unknown[]): Promise<T | null> {
  return (await database.prepare(statement).bind(...values).first<T>()) || null;
}

const orderSelect = `SELECT o.id, o.account_id AS accountId, a.owner_kind AS ownerKind, a.owner_id AS ownerId,
  o.package_id AS packageId, o.package_version_id AS packageVersionId, o.package_snapshot AS packageSnapshot,
  o.amount_minor AS amountMinor, o.currency, o.status, o.idempotency_key AS idempotencyKey,
  o.request_fingerprint AS requestFingerprint, o.payment_reference AS paymentReference, o.created_at AS createdAt,
  o.payment_confirmed_at AS paymentConfirmedAt, o.fulfilled_at AS fulfilledAt, o.cancelled_at AS cancelledAt, o.refunded_at AS refundedAt
  FROM orders o JOIN credit_accounts a ON a.id = o.account_id`;

async function getOrderById(database: D1Database, orderId: string): Promise<Order | null> {
  const row = await first<OrderRow>(database, `${orderSelect} WHERE o.id = ?`, orderId);
  return row ? mapOrder(row) : null;
}

async function getFulfillment(database: D1Database, orderId: string): Promise<OrderFulfillment | null> {
  return first<FulfillmentRow>(database, "SELECT id, order_id AS orderId, fulfillment_key AS fulfillmentKey, result_snapshot AS resultSnapshot, created_at AS createdAt FROM order_fulfillments WHERE order_id = ?", orderId);
}

export async function createPendingOrder(input: CreatePendingOrderInput): Promise<Order> {
  if (!input.idempotencyKey.trim()) throw new OrderError("Order idempotency key is required", "invalid_idempotency_key");
  const now = input.now ?? Date.now;
  const timestamp = now();
  const packageVersion = await getActivePackageVersion(input.database, input.packageVersionId, timestamp);
  if (!packageVersion) throw new OrderError("Selected package version is not active", "package_unavailable");
  const account = await input.creditStore.ensureAccount(input.owner);
  const requestFingerprint = createRequestFingerprint({ packageVersionId: input.packageVersionId, idempotencyKey: input.idempotencyKey });
  const orderId = `order:${account.id}:${input.idempotencyKey}`;
  const packageSnapshot = createRequestFingerprint(packageVersion);
  await input.database.batch([
    input.database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, account.id),
    input.database.prepare("INSERT OR IGNORE INTO orders (id, account_id, package_id, package_version_id, package_snapshot, amount_minor, currency, status, idempotency_key, request_fingerprint, payment_reference, created_at, payment_confirmed_at, fulfilled_at, cancelled_at, refunded_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, NULL, ?, NULL, NULL, NULL, NULL)")
      .bind(orderId, account.id, packageVersion.packageId, packageVersion.id, packageSnapshot, packageVersion.amountMinor, packageVersion.currency, input.idempotencyKey, requestFingerprint, timestamp),
  ]);
  const order = await getOrderForOwner(input.database, input.owner, orderId);
  if (!order) throw new OrderError("Order was not persisted", "order_unavailable");
  if (order.requestFingerprint !== requestFingerprint) throw new CreditIdempotencyError(`Order key ${input.idempotencyKey} already belongs to a different request`);
  return order;
}

export async function getOrderForOwner(database: D1Database, owner: CreditOwner, orderId: string): Promise<Order | null> {
  const row = await first<OrderRow>(database, `${orderSelect} WHERE o.id = ? AND a.owner_kind = ? AND a.owner_id = ?`, orderId, owner.kind, owner.ownerId);
  return row ? mapOrder(row) : null;
}

export async function recordVerifiedPayment(database: D1Database, input: { orderId: string; paymentReference: string; verifiedAt?: number }): Promise<Order> {
  if (!input.paymentReference.trim()) throw new OrderError("Verified payment reference is required", "invalid_payment_reference");
  const existing = await getOrderById(database, input.orderId);
  if (!existing) throw new OrderError("Order not found", "order_not_found");
  if (existing.status === "PAYMENT_CONFIRMED" || existing.status === "FULFILLED") {
    if (existing.paymentReference !== input.paymentReference) throw new CreditIdempotencyError("Payment reference conflicts with the order");
    return existing;
  }
  if (existing.status !== "PENDING") throw new OrderError(`Order cannot confirm payment from ${existing.status}`, "order_state");
  const timestamp = input.verifiedAt ?? Date.now();
  await database.prepare("UPDATE orders SET status = 'PAYMENT_CONFIRMED', payment_reference = ?, payment_confirmed_at = ? WHERE id = ? AND status = 'PENDING'")
    .bind(input.paymentReference, timestamp, input.orderId)
    .run();
  const order = await getOrderById(database, input.orderId);
  if (!order) throw new OrderError("Order disappeared after payment confirmation", "order_unavailable");
  if (order.paymentReference !== input.paymentReference) throw new CreditIdempotencyError("Payment reference conflicts with the order");
  return order;
}

export async function fulfillOrder(input: { database: D1Database; creditStore: CreditStore; orderId: string; now?: () => number }): Promise<{ order: Order; fulfillment: OrderFulfillment }> {
  const now = input.now ?? Date.now;
  const existing = await getOrderById(input.database, input.orderId);
  if (!existing) throw new OrderError("Order not found", "order_not_found");
  if (existing.status === "FULFILLED") {
    const fulfillment = await getFulfillment(input.database, input.orderId);
    if (!fulfillment) throw new OrderError("Fulfilled order has no fulfillment record", "fulfillment_missing");
    return { order: existing, fulfillment };
  }
  if (existing.status !== "PAYMENT_CONFIRMED") throw new OrderError("Order requires verified payment before fulfillment", "payment_required");
  const timestamp = now();
  const benefitTimestamp = existing.paymentConfirmedAt ?? timestamp;
  const packageSnapshot = existing.packageSnapshot;
  const benefits = packageSnapshot.benefitSnapshot as PackageBenefitSnapshot;
  const grant = packageSnapshot.creditUnits > 0
    ? await input.creditStore.grantCredits({
      owner: existing.owner,
      source: "PURCHASE",
      units: packageSnapshot.creditUnits,
      grantKey: `order:${existing.id}:credits`,
      eligibleFrom: benefitTimestamp,
      expiresAt: benefits.credits?.expiresInSeconds ? benefitTimestamp + benefits.credits.expiresInSeconds * 1000 : null,
      sourceType: "ORDER",
      sourceId: existing.id,
      policyVersion: packageSnapshot.policyVersion,
      policySnapshot: benefits,
      reason: `Fulfillment for ${existing.id}`,
    })
    : null;
  const vipDuration = packageSnapshot.vipDurationSeconds ?? benefits.vip?.durationSeconds ?? null;
  const entitlement = vipDuration && vipDuration > 0 && benefits.vip
    ? await activateEntitlement(input.database, {
      owner: existing.owner,
      entitlementType: "VIP",
      benefitVersion: benefits.vip.benefitVersion,
      startsAt: benefitTimestamp,
      endsAt: benefitTimestamp + vipDuration * 1000,
      sourceType: "ORDER",
      sourceId: existing.id,
      grantKey: `order:${existing.id}:vip`,
      benefitSnapshot: benefits.vip,
      now: timestamp,
    })
    : null;
  const fulfillmentKey = `order:${existing.id}:fulfilled:v1`;
  const resultSnapshot = createRequestFingerprint({
    orderId: existing.id,
    grantId: grant?.id ?? null,
    entitlementId: entitlement?.id ?? null,
    packageVersionId: existing.packageVersionId,
  });
  const fulfillmentId = `fulfillment:${existing.id}`;
  const eventKey = `order:${existing.id}:fulfilled`;
  await input.database.batch([
    input.database.prepare("UPDATE credit_accounts SET mutation_version = mutation_version + 1, updated_at = ? WHERE id = ?").bind(timestamp, existing.accountId),
    input.database.prepare("INSERT OR IGNORE INTO order_fulfillments (id, order_id, fulfillment_key, result_snapshot, created_at) VALUES (?, ?, ?, ?, ?)").bind(fulfillmentId, existing.id, fulfillmentKey, resultSnapshot, timestamp),
    input.database.prepare("INSERT OR IGNORE INTO commercial_events (id, event_type, aggregate_type, aggregate_id, payload, idempotency_key, created_at) VALUES (?, 'ORDER_FULFILLED', 'ORDER', ?, ?, ?, ?)").bind(`event:${eventKey}`, existing.id, resultSnapshot, eventKey, timestamp),
    input.database.prepare("UPDATE orders SET status = 'FULFILLED', fulfilled_at = ? WHERE id = ? AND status = 'PAYMENT_CONFIRMED'").bind(timestamp, existing.id),
  ]);
  const order = await getOrderById(input.database, existing.id);
  const fulfillment = await getFulfillment(input.database, existing.id);
  if (!order || !fulfillment) throw new OrderError("Order fulfillment was not persisted", "fulfillment_unavailable");
  return { order, fulfillment };
}
