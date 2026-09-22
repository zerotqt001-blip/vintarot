const VERSION = "v1";
const PREFIX = "natarot-pii";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_PLAINTEXT_BYTES = 16_384;
const MAX_PURPOSE_LENGTH = 128;

export type EncryptionKeyMaterial = string | Uint8Array;

export interface EncryptionKeyring {
  currentKeyId: string;
  keys: Record<string, EncryptionKeyMaterial>;
}

export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldEncryptionError";
  }
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new FieldEncryptionError("Invalid encryption key");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new FieldEncryptionError("Invalid encryption key");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function keyBytes(material: EncryptionKeyMaterial): Uint8Array {
  const bytes = typeof material === "string" ? decodeBase64Url(material) : new Uint8Array(material);
  if (bytes.length !== KEY_BYTES) throw new FieldEncryptionError("Invalid encryption key");
  return bytes;
}

function validateInput(plaintext: string, purpose: string): Uint8Array {
  if (typeof plaintext !== "string" || typeof purpose !== "string" || purpose.length < 1 || purpose.length > MAX_PURPOSE_LENGTH) {
    throw new FieldEncryptionError("Invalid encryption input");
  }
  const encoded = new TextEncoder().encode(plaintext);
  if (encoded.length < 1 || encoded.length > MAX_PLAINTEXT_BYTES) throw new FieldEncryptionError("Invalid encryption input");
  return encoded;
}

function keyId(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) throw new FieldEncryptionError("Invalid encryption key");
  return value;
}

async function importKey(material: EncryptionKeyMaterial, usages: KeyUsage[]): Promise<CryptoKey> {
  const bytes = keyBytes(material);
  return globalThis.crypto.subtle.importKey("raw", asArrayBuffer(bytes), { name: "AES-GCM" }, false, usages);
}

export async function encryptField(plaintext: string, purpose: string, keyring: EncryptionKeyring): Promise<string> {
  const data = validateInput(plaintext, purpose);
  const currentId = keyId(keyring.currentKeyId);
  const material = keyring.keys[currentId];
  if (!material) throw new FieldEncryptionError("Invalid encryption key");
  const iv = new Uint8Array(IV_BYTES);
  globalThis.crypto.getRandomValues(iv);
  try {
    const key = await importKey(material, ["encrypt"]);
    const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asArrayBuffer(iv), additionalData: asArrayBuffer(new TextEncoder().encode(purpose)), tagLength: TAG_BYTES * 8 },
      key,
      asArrayBuffer(data),
    ));
    const body = encrypted.slice(0, -TAG_BYTES);
    const tag = encrypted.slice(-TAG_BYTES);
    return `${PREFIX}:${VERSION}:${currentId}:${encodeBase64Url(iv)}:${encodeBase64Url(tag)}:${encodeBase64Url(body)}`;
  } catch (error) {
    if (error instanceof FieldEncryptionError) throw error;
    throw new FieldEncryptionError("Unable to encrypt field");
  }
}

export async function decryptField(ciphertext: string, purpose: string, keyring: EncryptionKeyring): Promise<string> {
  if (typeof ciphertext !== "string" || typeof purpose !== "string" || purpose.length < 1 || purpose.length > MAX_PURPOSE_LENGTH) {
    throw new FieldEncryptionError("Invalid encryption input");
  }
  const parts = ciphertext.split(":");
  if (parts.length !== 6 || parts[0] !== PREFIX || parts[1] !== VERSION) throw new FieldEncryptionError("Unable to decrypt field");
  const [, , encodedKeyId, encodedIv, encodedTag, encodedBody] = parts;
  try {
    const material = keyring.keys[encodedKeyId];
    if (!material) throw new FieldEncryptionError("Unable to decrypt field");
    const iv = decodeBase64Url(encodedIv);
    const tag = decodeBase64Url(encodedTag);
    const body = decodeBase64Url(encodedBody);
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || body.length < 1 || body.length > MAX_PLAINTEXT_BYTES) {
      throw new FieldEncryptionError("Unable to decrypt field");
    }
    const combined = new Uint8Array(body.length + tag.length);
    combined.set(body);
    combined.set(tag, body.length);
    const key = await importKey(material, ["decrypt"]);
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(iv), additionalData: asArrayBuffer(new TextEncoder().encode(purpose)), tagLength: TAG_BYTES * 8 },
      key,
      asArrayBuffer(combined),
    );
    const value = new TextDecoder().decode(plaintext);
    if (new TextEncoder().encode(value).length > MAX_PLAINTEXT_BYTES) throw new FieldEncryptionError("Unable to decrypt field");
    return value;
  } catch (error) {
    if (error instanceof FieldEncryptionError && error.message === "Unable to decrypt field") throw error;
    throw new FieldEncryptionError("Unable to decrypt field");
  }
}

export function keyringFromEnvironment(currentValue: string | undefined, historical: Record<string, string> = {}): EncryptionKeyring | null {
  if (!currentValue?.trim()) return null;
  const separator = currentValue.indexOf(":");
  const currentKeyId = separator > 0 ? currentValue.slice(0, separator) : "v1";
  const encodedKey = separator > 0 ? currentValue.slice(separator + 1) : currentValue;
  return { currentKeyId, keys: { ...historical, [currentKeyId]: encodedKey } };
}
