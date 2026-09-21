const SANDBOX_CHECKOUT_ACTION = "https://pay-sandbox.sepay.vn/v1/checkout/init";
const PRODUCTION_CHECKOUT_ACTION = "https://pay.sepay.vn/v1/checkout/init";
const SANDBOX_REST_BASE = "https://pgapi-sandbox.sepay.vn";
const PRODUCTION_REST_BASE = "https://pgapi.sepay.vn";
const DEFAULT_IPN_SKEW_MS = 15 * 60 * 1000;
const MAX_IPN_BODY_BYTES = 100_000;

export type SePayEnvironment = "sandbox" | "production";
export type SePayPaymentMethod = "CARD" | "BANK_TRANSFER" | "NAPAS_BANK_TRANSFER";

export type SePayConfig = {
  environment: SePayEnvironment;
  merchantId: string;
  secretKey: string;
  ipnSecret: string;
  publicOrigin: string;
  checkoutAction: string;
  restBaseUrl: string;
  ipnTimestampSkewMs: number;
};

export type CheckoutForm = {
  action: string;
  method: "POST";
  fields: Record<string, string>;
};

export type CheckoutFormInput = {
  config: SePayConfig;
  amountMinor: number;
  orderDescription: string;
  invoiceNumber: string;
  customerId?: string;
  paymentMethod: SePayPaymentMethod;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
};

export type NormalizedSePayIpn = {
  providerOrderId: string;
  invoiceNumber: string;
  transactionId: string;
  notificationType: "ORDER_PAID" | "TRANSACTION_VOID";
  orderStatus: string;
  transactionStatus: string;
  transactionType: string;
  amountMinor: number;
  currency: "VND";
  payloadHash: string;
  providerTimestampMs: number;
};

export class SePayConfigError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "SePayConfigError";
  }
}

export class SePayIpnAuthError extends Error {
  constructor(message: string, readonly code = "invalid_ipn_secret") {
    super(message);
    this.name = "SePayIpnAuthError";
  }
}

export class SePayPayloadError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "SePayPayloadError";
  }
}

export class SePayProviderError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) {
    super(message);
    this.name = "SePayProviderError";
  }
}

function requiredString(environment: Record<string, unknown>, key: string, code: string): string {
  const value = typeof environment[key] === "string" ? environment[key].trim() : "";
  if (!value) throw new SePayConfigError(`SePay configuration is missing ${key}`, code);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    if (typeof record[key] === "number" && Number.isFinite(record[key])) return String(record[key]);
  }
  return "";
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Utf8(value: string): string {
  return base64(new TextEncoder().encode(value));
}

async function hmacSha256Base64(secret: string, value: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64(new Uint8Array(signature));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function getSePayConfig(environment: Record<string, unknown>): SePayConfig {
  const selected = requiredString(environment, "SEPAY_ENVIRONMENT", "missing_environment").toLowerCase();
  if (selected !== "sandbox" && selected !== "production") throw new SePayConfigError("SePay environment is invalid", "invalid_environment");
  const merchantId = requiredString(environment, "SEPAY_MERCHANT_ID", "missing_merchant_id");
  const secretKey = requiredString(environment, "SEPAY_SECRET_KEY", "missing_secret_key");
  const ipnSecret = requiredString(environment, "SEPAY_IPN_SECRET", "missing_ipn_secret");
  const publicOrigin = requiredString(environment, "NATAROT_PUBLIC_ORIGIN", "missing_public_origin").replace(/\/$/, "");
  let origin: URL;
  try {
    origin = new URL(publicOrigin);
  } catch {
    throw new SePayConfigError("NaTarot public origin is invalid", "invalid_public_origin");
  }
  if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") {
    throw new SePayConfigError("NaTarot public origin must use HTTPS", "insecure_public_origin");
  }
  if (selected === "production" && /(^|\.)staging\./i.test(origin.hostname)) {
    throw new SePayConfigError("Production SePay cannot use the staging origin", "production_origin_mismatch");
  }
  return {
    environment: selected,
    merchantId,
    secretKey,
    ipnSecret,
    publicOrigin,
    checkoutAction: selected === "sandbox" ? SANDBOX_CHECKOUT_ACTION : PRODUCTION_CHECKOUT_ACTION,
    restBaseUrl: selected === "sandbox" ? SANDBOX_REST_BASE : PRODUCTION_REST_BASE,
    ipnTimestampSkewMs: DEFAULT_IPN_SKEW_MS,
  };
}

export function normalizeVndAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d+(?:\.00?)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function validateUrl(value: string, field: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("insecure");
    return url.toString();
  } catch {
    throw new SePayPayloadError(`Checkout ${field} is invalid`, "invalid_checkout_url");
  }
}

export async function buildCheckoutForm(input: CheckoutFormInput): Promise<CheckoutForm> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) throw new SePayPayloadError("Checkout amount is invalid", "invalid_amount");
  if (!input.invoiceNumber.trim() || input.invoiceNumber.length > 64) throw new SePayPayloadError("Checkout invoice is invalid", "invalid_invoice");
  if (!input.orderDescription.trim() || input.orderDescription.length > 255 || /[\r\n]/.test(input.orderDescription)) throw new SePayPayloadError("Checkout description is invalid", "invalid_description");
  const fieldsWithoutSignature: Record<string, string> = {
    order_amount: String(input.amountMinor),
    merchant: input.config.merchantId,
    currency: "VND",
    operation: "PURCHASE",
    order_description: input.orderDescription,
    order_invoice_number: input.invoiceNumber,
    customer_id: input.customerId?.trim() ?? "",
    payment_method: input.paymentMethod,
    success_url: validateUrl(input.successUrl, "success URL"),
    error_url: validateUrl(input.errorUrl, "error URL"),
    cancel_url: validateUrl(input.cancelUrl, "cancel URL"),
  };
  const signingString = [
    "order_amount",
    "merchant",
    "currency",
    "operation",
    "order_description",
    "order_invoice_number",
    "customer_id",
    "payment_method",
    "success_url",
    "error_url",
    "cancel_url",
  ].map((field) => `${field}=${fieldsWithoutSignature[field]}`).join(",");
  return {
    action: input.config.checkoutAction,
    method: "POST",
    fields: { ...fieldsWithoutSignature, signature: await hmacSha256Base64(input.config.secretKey, signingString) },
  };
}

function timestampToMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1_000_000_000_000 ? value * 1000 : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? (numeric < 1_000_000_000_000 ? numeric * 1000 : numeric) : null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export type ParseIpnOptions = { now?: number; maxSkewMs?: number };

export async function parseAndNormalizeGatewayIpn(
  rawBody: string,
  headers: Headers,
  config: SePayConfig,
  options: ParseIpnOptions = {},
): Promise<NormalizedSePayIpn> {
  if (new TextEncoder().encode(rawBody).byteLength > MAX_IPN_BODY_BYTES) throw new SePayPayloadError("IPN body is too large", "body_too_large");
  const providedSecret = headers.get("x-secret-key") ?? "";
  if (!providedSecret || !constantTimeEqual(providedSecret, config.ipnSecret)) throw new SePayIpnAuthError("IPN authentication failed");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new SePayPayloadError("IPN body is not valid JSON", "invalid_json");
  }
  if (!isPlainRecord(parsed)) throw new SePayPayloadError("IPN body shape is invalid", "invalid_payload");
  const timestamp = timestampToMs(parsed.timestamp);
  if (timestamp === null) throw new SePayPayloadError("IPN timestamp is invalid", "invalid_timestamp");
  const now = options.now ?? Date.now();
  const maxSkew = options.maxSkewMs ?? config.ipnTimestampSkewMs;
  if (Math.abs(now - timestamp) > maxSkew) throw new SePayPayloadError("IPN timestamp is stale", "stale_ipn");
  const notificationType = readString(parsed, ["notification_type"]);
  if (notificationType !== "ORDER_PAID" && notificationType !== "TRANSACTION_VOID") throw new SePayPayloadError("IPN notification type is unsupported", "invalid_notification_type");
  const order = isPlainRecord(parsed.order) ? parsed.order : null;
  const transaction = isPlainRecord(parsed.transaction) ? parsed.transaction : null;
  if (!order || !transaction) throw new SePayPayloadError("IPN order or transaction is missing", "invalid_payload");
  const providerOrderId = readString(order, ["order_id", "id"]);
  const invoiceNumber = readString(order, ["order_invoice_number", "invoice_number"]);
  const transactionId = readString(transaction, ["transaction_id", "id"]);
  const orderStatus = readString(order, ["order_status", "status"]).toUpperCase();
  const transactionStatus = readString(transaction, ["transaction_status", "status"]).toUpperCase();
  const transactionType = readString(transaction, ["transaction_type", "type"]).toUpperCase();
  const orderCurrency = readString(order, ["order_currency", "currency"]).toUpperCase();
  const transactionCurrency = readString(transaction, ["transaction_currency", "currency"]).toUpperCase();
  const amountMinor = normalizeVndAmount(readString(order, ["order_amount", "amount"]));
  const transactionAmount = normalizeVndAmount(readString(transaction, ["transaction_amount", "amount"]));
  if (!providerOrderId || !invoiceNumber || !transactionId || !orderStatus || !transactionStatus || !transactionType || amountMinor === null || transactionAmount === null) {
    throw new SePayPayloadError("IPN required payment fields are missing", "invalid_payload");
  }
  if (orderCurrency !== "VND" || transactionCurrency !== "VND" || amountMinor !== transactionAmount) throw new SePayPayloadError("IPN amount or currency is invalid", "amount_mismatch");
  if (notificationType === "ORDER_PAID" && (orderStatus !== "CAPTURED" || transactionStatus !== "APPROVED" || transactionType !== "PAYMENT")) {
    throw new SePayPayloadError("IPN transaction is not an approved payment", "invalid_transaction");
  }
  return {
    providerOrderId,
    invoiceNumber,
    transactionId,
    notificationType,
    orderStatus,
    transactionStatus,
    transactionType,
    amountMinor,
    currency: "VND",
    payloadHash: await sha256Hex(rawBody),
    providerTimestampMs: timestamp,
  };
}

export async function normalizeSePayOrderDetail(payload: unknown, now = Date.now()): Promise<NormalizedSePayIpn | null> {
  if (!isPlainRecord(payload)) throw new SePayPayloadError("SePay order detail shape is invalid", "invalid_provider_detail");
  const data = isPlainRecord(payload.data) ? payload.data : payload;
  const order = isPlainRecord(data.order) ? data.order : data;
  const providerOrderId = readString(order, ["order_id", "id"]);
  const invoiceNumber = readString(order, ["order_invoice_number", "invoice_number"]);
  const orderStatus = readString(order, ["order_status", "status"]).toUpperCase();
  const orderCurrency = readString(order, ["order_currency", "currency"]).toUpperCase();
  const amountMinor = normalizeVndAmount(readString(order, ["order_amount", "amount"]));
  if (!providerOrderId || !invoiceNumber || !orderStatus || amountMinor === null || orderCurrency !== "VND") {
    throw new SePayPayloadError("SePay order detail is incomplete", "invalid_provider_detail");
  }
  const transactions = Array.isArray(order.transactions)
    ? order.transactions.filter(isPlainRecord)
    : Array.isArray(data.transactions) ? data.transactions.filter(isPlainRecord) : [];
  const approvedPayment = transactions.find((transaction) => readString(transaction, ["transaction_type", "type"]).toUpperCase() === "PAYMENT" && readString(transaction, ["transaction_status", "status"]).toUpperCase() === "APPROVED");
  if (orderStatus !== "CAPTURED" || !approvedPayment) return null;
  const transactionId = readString(approvedPayment, ["transaction_id", "id"]);
  const transactionType = readString(approvedPayment, ["transaction_type", "type"]).toUpperCase();
  const transactionStatus = readString(approvedPayment, ["transaction_status", "status"]).toUpperCase();
  const transactionCurrency = readString(approvedPayment, ["transaction_currency", "currency"]).toUpperCase();
  const transactionAmount = normalizeVndAmount(readString(approvedPayment, ["transaction_amount", "amount"]));
  if (!transactionId || transactionAmount === null || transactionCurrency !== "VND" || transactionAmount !== amountMinor) {
    throw new SePayPayloadError("SePay order detail amount or transaction is invalid", "amount_mismatch");
  }
  return {
    providerOrderId,
    invoiceNumber,
    transactionId,
    notificationType: "ORDER_PAID",
    orderStatus,
    transactionStatus,
    transactionType,
    amountMinor,
    currency: "VND",
    payloadHash: await sha256Hex(JSON.stringify(payload)),
    providerTimestampMs: now,
  };
}

export function buildBasicAuthHeader(config: SePayConfig): string {
  return `Basic ${base64Utf8(`${config.merchantId}:${config.secretKey}`)}`;
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, dispose: () => clearTimeout(timeout) };
}

export async function fetchSePayJson(
  config: SePayConfig,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const timeout = withTimeout(10_000);
  try {
    const response = await fetchImpl(`${config.restBaseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: buildBasicAuthHeader(config) },
      signal: timeout.signal,
    });
    if (!response.ok) throw new SePayProviderError("SePay order lookup failed", "provider_lookup_failed", response.status);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_IPN_BODY_BYTES) throw new SePayProviderError("SePay response is too large", "provider_response_too_large");
    try {
      return JSON.parse(text);
    } catch {
      throw new SePayProviderError("SePay response is invalid", "provider_invalid_json");
    }
  } catch (error) {
    if (error instanceof SePayProviderError) throw error;
    throw new SePayProviderError("SePay order lookup is unavailable", "provider_unavailable");
  } finally {
    timeout.dispose();
  }
}
