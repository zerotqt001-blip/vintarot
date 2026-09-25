import { keyringFromEnvironment, type EncryptionKeyring } from "./security/encryption";
import { runtimeEnv } from "./runtime";
import type { DriveRuntimeConfig } from "./google-drive";

function keyValue(value: string | undefined, keyId: string): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.includes(":") ? normalized : `${keyId}:${normalized}`;
}

function hasValidKeyMaterial(keyring: EncryptionKeyring): boolean {
  return Object.values(keyring.keys).every((material) => {
    if (material instanceof Uint8Array) return material.byteLength === 32;
    try {
      const normalized = material.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
      return decoded.length === 32;
    } catch {
      return false;
    }
  });
}

function encryptionKeyring(): EncryptionKeyring | null {
  const current = keyValue(runtimeEnv.NATAROT_PII_KEY_V2, "v2") ?? keyValue(runtimeEnv.NATAROT_PII_KEY_V1, "v1");
  if (!current) return null;
  const historical: Record<string, string> = {};
  const prior = keyValue(runtimeEnv.NATAROT_PII_KEY_V1, "v1");
  if (prior && prior !== current) historical.v1 = prior.slice(prior.indexOf(":") + 1);
  try {
    const keyring = keyringFromEnvironment(current, historical);
    return keyring && hasValidKeyMaterial(keyring) ? keyring : null;
  } catch {
    return null;
  }
}

function isProduction(): boolean {
  return runtimeEnv.NODE_ENV === "production" || (typeof process !== "undefined" && process.env.NODE_ENV === "production");
}

function redirectUri(request: Request): string | null {
  const configured = runtimeEnv.GOOGLE_REDIRECT_URI?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" && isProduction()) return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  if (isProduction()) return null;
  const trustedProxy = /^(1|true|yes)$/i.test(runtimeEnv.NATAROT_TRUSTED_PROXY ?? "");
  const forwardedProto = trustedProxy ? request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase() : undefined;
  const forwardedHost = trustedProxy ? request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim() : undefined;
  const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");
  const host = forwardedHost ?? new URL(request.url).host;
  if (!host || (protocol !== "https" && protocol !== "http")) return null;
  return `${protocol}://${host}/api/auth/google/callback`;
}

export function getGoogleDriveConfig(request: Request): DriveRuntimeConfig | null {
  const clientId = runtimeEnv.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = runtimeEnv.GOOGLE_CLIENT_SECRET?.trim();
  const callback = redirectUri(request);
  const encryption = encryptionKeyring();
  if (!clientId || !clientSecret || !callback || !encryption) return null;
  return { clientId, clientSecret, redirectUri: callback, encryptionKeyring: encryption, fetchImpl: fetch, now: Date.now };
}
