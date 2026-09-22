import type { D1Database } from "@cloudflare/workers-types";
import type { CreditOwner } from "../credits/types";
import type { CreditStore } from "../credits/repository";
import { createPendingOrder, getOrderForOwner } from "../orders";
import { createRequestFingerprint } from "../credits/ledger";
import {
  SePayConfigError,
  SePayIpnAuthError,
  SePayPayloadError,
  SePayProviderError,
  buildCheckoutForm,
  getSePayConfig,
  parseAndNormalizeGatewayIpn,
  sha256Hex,
  type SePayConfig,
} from "./sepay-adapter";
import {
  applyVerifiedSePayPayment,
  createSePayPaymentAttempt,
  PaymentVerificationError,
  reconcileSePayPayment,
} from "./payment-service";
import { getSePayPaymentAttemptByOrder, updateProviderOrderHint } from "./payment-store";

export type CommercialHandlerDependencies = {
  database: D1Database;
  creditStore: CreditStore;
  config: SePayConfig;
  owner: CreditOwner | null;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

type CheckoutInput = { package_version_id: string; idempotency_key: string; payment_method: "CARD" | "BANK_TRANSFER" | "NAPAS_BANK_TRANSFER" };

function parseCheckoutInput(value: unknown): CheckoutInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const packageVersionId = typeof record.package_version_id === "string" ? record.package_version_id.trim() : "";
  const idempotencyKey = typeof record.idempotency_key === "string" ? record.idempotency_key.trim() : "";
  const paymentMethod = record.payment_method === undefined ? "BANK_TRANSFER" : record.payment_method;
  if (!packageVersionId || packageVersionId.length > 160 || !idempotencyKey || idempotencyKey.length > 200) return null;
  if (paymentMethod !== "CARD" && paymentMethod !== "BANK_TRANSFER" && paymentMethod !== "NAPAS_BANK_TRANSFER") return null;
  return { package_version_id: packageVersionId, idempotency_key: idempotencyKey, payment_method: paymentMethod };
}

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function safeError(message: string, status: number): Response {
  return noStore(Response.json({ error: message }, { status }));
}

async function parseJsonBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 100_000) throw new Response("Request too large", { status: 413 });
  try {
    return JSON.parse(body);
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}

function orderSummary(order: Awaited<ReturnType<typeof createPendingOrder>>) {
  return {
    id: order.id,
    status: order.status,
    amount_minor: order.amountMinor,
    currency: order.currency,
    package: { id: order.packageId, version_id: order.packageVersionId, slug: order.packageSnapshot.slug, version: order.packageSnapshot.version },
    created_at: order.createdAt,
    payment_confirmed_at: order.paymentConfirmedAt,
    fulfilled_at: order.fulfilledAt,
  };
}

function resultOrderSummary(order: Awaited<ReturnType<typeof createPendingOrder>>) {
  return { id: order.id, status: order.status, amount_minor: order.amountMinor, currency: order.currency, created_at: order.createdAt, payment_confirmed_at: order.paymentConfirmedAt, fulfilled_at: order.fulfilledAt };
}

async function invoiceForOrder(orderId: string): Promise<string> {
  return `NT-${(await sha256Hex(orderId)).slice(0, 48).toUpperCase()}`;
}

function callbackUrl(config: SePayConfig, orderId: string, result: string): string {
  const url = new URL("/api/commercial/return", config.publicOrigin);
  url.searchParams.set("natarot_order_id", orderId);
  url.searchParams.set("result", result);
  return url.toString();
}

export async function handleCommercialCheckout(request: Request, input: CommercialHandlerDependencies): Promise<Response> {
  if (!input.owner) return safeError("Member authentication is required.", 401);
  const parsed = parseCheckoutInput(await parseJsonBody(request));
  if (!parsed) return safeError("Invalid checkout request.", 400);
  const now = input.now ?? Date.now;
  const order = await createPendingOrder({
    database: input.database,
    creditStore: input.creditStore,
    owner: input.owner,
    packageVersionId: parsed.package_version_id,
    idempotencyKey: parsed.idempotency_key,
    now,
  });
  const invoiceNumber = await invoiceForOrder(order.id);
  const attempt = await createSePayPaymentAttempt({ database: input.database, config: input.config, order, invoiceNumber, requestFingerprint: createRequestFingerprint({ orderId: order.id, orderFingerprint: order.requestFingerprint }), now });
  const checkout = await buildCheckoutForm({
    config: input.config,
    amountMinor: order.amountMinor,
    orderDescription: `NaTarot ${order.packageSnapshot.slug} v${order.packageSnapshot.version}`,
    invoiceNumber: attempt.invoiceNumber,
    customerId: input.owner.ownerId,
    paymentMethod: parsed.payment_method,
    successUrl: callbackUrl(input.config, order.id, "success"),
    errorUrl: callbackUrl(input.config, order.id, "error"),
    cancelUrl: callbackUrl(input.config, order.id, "cancel"),
  });
  return noStore(Response.json({ order: orderSummary(order), checkout }, { status: 201 }));
}

export async function handleSePayIpn(request: Request, input: CommercialHandlerDependencies): Promise<Response> {
  let evidence;
  try {
    evidence = await parseAndNormalizeGatewayIpn(await request.text(), request.headers, input.config, { now: (input.now ?? Date.now)() });
  } catch (error) {
    if (error instanceof SePayIpnAuthError) return safeError("Invalid payment notification.", 401);
    if (error instanceof SePayPayloadError) return safeError("Invalid payment notification.", 400);
    throw error;
  }
  try {
    const result = await applyVerifiedSePayPayment({ database: input.database, creditStore: input.creditStore, config: input.config, evidence, source: "ipn", now: input.now });
    return noStore(Response.json({ ok: true, status: result.order.status, retryable: Boolean(result.fulfillmentErrorCode) }));
  } catch (error) {
    if (error instanceof PaymentVerificationError) return safeError("Payment notification was not accepted.", 422);
    if (error instanceof SePayProviderError) return safeError("Payment notification is temporarily unavailable.", 503);
    throw error;
  }
}

function providerHint(url: URL, internalOrderId: string): string | null {
  const candidate = url.searchParams.get("sepay_order_id") ?? url.searchParams.get("provider_order_id") ?? (url.searchParams.get("order_id") !== internalOrderId ? url.searchParams.get("order_id") : null);
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return /^[A-Za-z0-9._:-]{1,160}$/.test(trimmed) ? trimmed : null;
}

export async function handleCommercialReturn(request: Request, input: CommercialHandlerDependencies): Promise<Response> {
  if (!input.owner) return safeError("Member authentication is required.", 401);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("natarot_order_id")?.trim() ?? "";
  if (!orderId) return safeError("Order not found.", 400);
  const order = await getOrderForOwner(input.database, input.owner, orderId);
  if (!order) return safeError("Order not found.", 404);
  const attempt = await getSePayPaymentAttemptByOrder(input.database, order.id);
  const hint = providerHint(url, order.id);
  if (attempt && hint) await updateProviderOrderHint(input.database, { attemptId: attempt.id, providerOrderId: hint, now: input.now });
  return noStore(Response.json({ display_only: true, result: url.searchParams.get("result") ?? "unknown", order: resultOrderSummary(order) }));
}

function orderIdFromReconcilePath(request: Request): string | null {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/api\/commercial\/orders\/(.+)\/reconcile$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleCommercialReconcile(request: Request, input: CommercialHandlerDependencies): Promise<Response> {
  if (!input.owner) return safeError("Member authentication is required.", 401);
  const orderId = orderIdFromReconcilePath(request);
  if (!orderId) return safeError("Order not found.", 404);
  const ownedOrder = await getOrderForOwner(input.database, input.owner, orderId);
  if (!ownedOrder) return safeError("Order not found.", 404);
  const result = await reconcileSePayPayment({ database: input.database, creditStore: input.creditStore, config: input.config, orderId, fetchImpl: input.fetchImpl, now: input.now });
  return noStore(Response.json({ status: result.status, order: resultOrderSummary(result.order), retryable: Boolean(result.fulfillmentErrorCode) }));
}

export function readSePayConfigOrResponse(environment: Record<string, unknown>): SePayConfig | Response {
  try {
    return getSePayConfig(environment);
  } catch (error) {
    if (error instanceof SePayConfigError) return safeError("Payment service is not configured.", 503);
    throw error;
  }
}
