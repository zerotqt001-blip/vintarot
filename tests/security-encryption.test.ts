import assert from "node:assert/strict";
import test from "node:test";
import { decryptField, encryptField, type EncryptionKeyring } from "../lib/security/encryption";
import { redactAuditMetadata } from "../lib/security/redaction";

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function keyring(currentKeyId = "key-current"): EncryptionKeyring {
  return {
    currentKeyId,
    keys: {
      "key-current": encode(new Uint8Array(32).fill(7)),
      "key-old": encode(new Uint8Array(32).fill(3)),
    },
  };
}

test("AES-GCM fields round-trip with a versioned key and purpose", async () => {
  const ciphertext = await encryptField("bounded private note", "affiliate.fraud-note", keyring());
  assert.match(ciphertext, /^natarot-pii:v1:key-current:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(await decryptField(ciphertext, "affiliate.fraud-note", keyring()), "bounded private note");
});

test("AES-GCM rejects tampering, wrong purposes, and missing historical keys", async () => {
  const ciphertext = await encryptField("keep private", "audit.note", keyring());
  const parts = ciphertext.split(":");
  parts[parts.length - 1] = `${parts[parts.length - 1]}A`;
  await assert.rejects(() => decryptField(parts.join(":"), "audit.note", keyring()), /Unable to decrypt field/);
  await assert.rejects(() => decryptField(ciphertext, "other.note", keyring()), /Unable to decrypt field/);

  const oldCiphertext = await encryptField("historical", "affiliate.fraud-note", { currentKeyId: "key-old", keys: keyring().keys });
  await assert.rejects(
    () => decryptField(oldCiphertext, "affiliate.fraud-note", { currentKeyId: "key-current", keys: { "key-current": keyring().keys["key-current"] } }),
    /Unable to decrypt field/,
  );
  assert.equal(
    await decryptField(oldCiphertext, "affiliate.fraud-note", keyring()),
    "historical",
  );
});

test("encryption validates bounded input and key material without exposing it", async () => {
  await assert.rejects(() => encryptField("", "purpose", keyring()), /Invalid encryption input/);
  await assert.rejects(() => encryptField("value", "", keyring()), /Invalid encryption input/);
  await assert.rejects(() => encryptField("x".repeat(20001), "purpose", keyring()), /Invalid encryption input/);
  await assert.rejects(
    () => encryptField("value", "purpose", { currentKeyId: "bad", keys: { bad: encode(new Uint8Array(16)) } }),
    /Invalid encryption key/,
  );
});

test("audit metadata redaction is recursive, bounded, and non-throwing", () => {
  const circular: Record<string, unknown> = { safe: "ok", password: "do-not-store", nested: { email: "reader@example.test", question: "private" } };
  circular.self = circular;
  const redacted = redactAuditMetadata({
    password_hash: "secret-hash",
    authorization: "bearer-value",
    referral_code: "raw-code",
    phone: "+84000000000",
    details: { question: "private question", safe: "visible" },
    circular,
    huge: "x".repeat(5000),
  });
  const encoded = JSON.stringify(redacted);
  assert.ok(encoded.length <= 32768);
  assert.doesNotMatch(encoded, /secret-hash|bearer-value|raw-code|private question|reader@example\.test/);
  assert.equal((redacted.details as Record<string, unknown>).question, "[REDACTED]");
  assert.equal((redacted.details as Record<string, unknown>).safe, "visible");
  assert.equal(redactAuditMetadata(null).value, null);
});
