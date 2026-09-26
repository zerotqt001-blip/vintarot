import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, lstatSync, rmSync } from "node:fs";
import { open, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { decryptField, encryptField, type EncryptionKeyring } from "../security/encryption";

const MAGIC = Buffer.from("NTRBKUP1", "ascii");
const HEADER_LENGTH_BYTES = 4;
const TAG_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const MAX_HEADER_BYTES = 32 * 1024;
export const OFFSITE_BACKUP_KEY_PURPOSE = "natarot.offsite-backup.key.v1";

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export class BackupCryptoError extends Error {
  constructor(readonly code: "invalid_input" | "source_checksum_mismatch" | "invalid_envelope" | "decryption_failed" | "encryption_failed") {
    const message = code === "source_checksum_mismatch"
      ? "The local backup checksum does not match."
      : code === "invalid_envelope"
        ? "The encrypted backup file is invalid."
        : code === "decryption_failed"
          ? "The encrypted backup could not be authenticated."
          : code === "encryption_failed"
            ? "The backup could not be encrypted."
            : "The backup encryption request is invalid.";
    super(message);
    this.name = "BackupCryptoError";
  }
}

type BackupHeader = {
  version: 1;
  algorithm: "AES-256-GCM";
  backupId: string;
  sourceSha256: string;
  sourceBytes: number;
  iv: string;
  wrappedKey: string;
};

export type EncryptedBackupMetadata = {
  version: 1;
  backupId: string;
  sourceSha256: string;
  encryptedSha256: string;
  sourceBytes: number;
  encryptedBytes: number;
};

export type DecryptedBackupMetadata = {
  version: 1;
  backupId: string;
  sourceSha256: string;
  sourceBytes: number;
};

function validBackupId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function validSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function secureRegularFile(path: string): void {
  try {
    if (!lstatSync(path).isFile()) throw new BackupCryptoError("invalid_input");
  } catch (error) {
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("invalid_input");
  }
}

async function hashRegularFile(path: string): Promise<{ sha256: string; bytes: number }> {
  secureRegularFile(path);
  const digest = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(path)) {
      digest.update(chunk as Uint8Array);
      bytes += (chunk as Uint8Array).byteLength;
    }
  } catch {
    throw new BackupCryptoError("invalid_input");
  }
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new BackupCryptoError("invalid_input");
  return { sha256: digest.digest("hex"), bytes };
}

function makeAuthenticatedHeader(header: BackupHeader): { body: Buffer; aad: Buffer } {
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  if (headerBytes.byteLength < 2 || headerBytes.byteLength > MAX_HEADER_BYTES) throw new BackupCryptoError("invalid_input");
  const length = Buffer.alloc(HEADER_LENGTH_BYTES);
  length.writeUInt32BE(headerBytes.byteLength);
  const aad = Buffer.concat([MAGIC, length, headerBytes]);
  return { body: aad, aad };
}

export async function encryptBackupArchive(input: {
  sourcePath: string;
  destinationPath: string;
  backupId: string;
  keyring: EncryptionKeyring;
  expectedSourceSha256?: string;
}): Promise<EncryptedBackupMetadata> {
  if (!input.sourcePath || !input.destinationPath || input.sourcePath === input.destinationPath || !validBackupId(input.backupId)
    || (input.expectedSourceSha256 !== undefined && !validSha256(input.expectedSourceSha256))) {
    throw new BackupCryptoError("invalid_input");
  }
  const source = await hashRegularFile(input.sourcePath);
  if (input.expectedSourceSha256 && source.sha256.toLowerCase() !== input.expectedSourceSha256.toLowerCase()) {
    throw new BackupCryptoError("source_checksum_mismatch");
  }

  const dataKey = randomBytes(KEY_LENGTH_BYTES);
  const iv = randomBytes(IV_LENGTH_BYTES);
  let wrappedKey: string;
  try {
    wrappedKey = await encryptField(toBase64Url(dataKey), OFFSITE_BACKUP_KEY_PURPOSE, input.keyring);
  } catch {
    throw new BackupCryptoError("encryption_failed");
  }
  const header: BackupHeader = {
    version: 1,
    algorithm: "AES-256-GCM",
    backupId: input.backupId,
    sourceSha256: source.sha256,
    sourceBytes: source.bytes,
    iv: toBase64Url(iv),
    wrappedKey,
  };
  const authenticated = makeAuthenticatedHeader(header);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  cipher.setAAD(authenticated.aad);
  const sourceDigest = createHash("sha256");
  let sourceBytes = 0;

  const encryptedChunks = async function* (): AsyncGenerator<Buffer> {
    yield authenticated.body;
    for await (const chunk of createReadStream(input.sourcePath)) {
      const bytes = Buffer.from(chunk as Uint8Array);
      sourceDigest.update(bytes);
      sourceBytes += bytes.byteLength;
      const encrypted = cipher.update(bytes);
      if (encrypted.byteLength) yield encrypted;
    }
    const currentHash = sourceDigest.digest("hex");
    if (currentHash !== source.sha256 || sourceBytes !== source.bytes) throw new BackupCryptoError("source_checksum_mismatch");
    const final = cipher.final();
    if (final.byteLength) yield final;
    yield cipher.getAuthTag();
  };

  try {
    await pipeline(
      Readable.from(encryptedChunks()),
      createWriteStream(input.destinationPath, { flags: "wx", mode: 0o600 }),
    );
  } catch (error) {
    rmSync(input.destinationPath, { force: true });
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("encryption_failed");
  }

  const encrypted = await hashRegularFile(input.destinationPath);
  return {
    version: 1,
    backupId: input.backupId,
    sourceSha256: source.sha256,
    encryptedSha256: encrypted.sha256,
    sourceBytes: source.bytes,
    encryptedBytes: encrypted.bytes,
  };
}

async function readExactly(handle: Awaited<ReturnType<typeof open>>, length: number, position: number): Promise<Buffer> {
  const bytes = Buffer.alloc(length);
  const result = await handle.read(bytes, 0, length, position);
  if (result.bytesRead !== length) throw new BackupCryptoError("invalid_envelope");
  return bytes;
}

async function readHeader(sourcePath: string): Promise<{ header: BackupHeader; aad: Buffer; ciphertextStart: number; ciphertextBytes: number; tag: Buffer }> {
  secureRegularFile(sourcePath);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(sourcePath, "r");
    const file = await stat(sourcePath);
    if (file.size < MAGIC.byteLength + HEADER_LENGTH_BYTES + TAG_LENGTH_BYTES) throw new BackupCryptoError("invalid_envelope");
    const magic = await readExactly(handle, MAGIC.byteLength, 0);
    if (magic.byteLength !== MAGIC.byteLength || !magic.every((byte, index) => byte === MAGIC[index])) throw new BackupCryptoError("invalid_envelope");
    const lengthBytes = await readExactly(handle, HEADER_LENGTH_BYTES, MAGIC.byteLength);
    const headerLength = (((lengthBytes[0]! << 24) | (lengthBytes[1]! << 16) | (lengthBytes[2]! << 8) | lengthBytes[3]!) >>> 0);
    if (headerLength < 2 || headerLength > MAX_HEADER_BYTES) throw new BackupCryptoError("invalid_envelope");
    const headerBytes = await readExactly(handle, headerLength, MAGIC.byteLength + HEADER_LENGTH_BYTES);
    let header: BackupHeader;
    try {
      header = JSON.parse(new TextDecoder().decode(headerBytes)) as BackupHeader;
    } catch {
      throw new BackupCryptoError("invalid_envelope");
    }
    if (header.version !== 1 || header.algorithm !== "AES-256-GCM" || !validBackupId(header.backupId)
      || !validSha256(header.sourceSha256) || !Number.isSafeInteger(header.sourceBytes) || header.sourceBytes < 1
      || typeof header.iv !== "string" || typeof header.wrappedKey !== "string") {
      throw new BackupCryptoError("invalid_envelope");
    }
    const iv = Buffer.from(header.iv, "base64url");
    if (iv.byteLength !== IV_LENGTH_BYTES) throw new BackupCryptoError("invalid_envelope");
    const ciphertextStart = MAGIC.byteLength + HEADER_LENGTH_BYTES + headerLength;
    const ciphertextBytes = file.size - ciphertextStart - TAG_LENGTH_BYTES;
    if (ciphertextBytes < 0) throw new BackupCryptoError("invalid_envelope");
    const tag = await readExactly(handle, TAG_LENGTH_BYTES, file.size - TAG_LENGTH_BYTES);
    return {
      header,
      aad: Buffer.concat([magic, lengthBytes, headerBytes]),
      ciphertextStart,
      ciphertextBytes,
      tag,
    };
  } catch (error) {
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("invalid_envelope");
  } finally {
    await handle?.close();
  }
}

export async function decryptBackupArchive(input: {
  sourcePath: string;
  destinationPath: string;
  keyring: EncryptionKeyring;
  expectedSourceSha256?: string;
}): Promise<DecryptedBackupMetadata> {
  if (!input.sourcePath || !input.destinationPath || input.sourcePath === input.destinationPath
    || (input.expectedSourceSha256 !== undefined && !validSha256(input.expectedSourceSha256))) {
    throw new BackupCryptoError("invalid_input");
  }
  const envelope = await readHeader(input.sourcePath);
  if (input.expectedSourceSha256 && envelope.header.sourceSha256.toLowerCase() !== input.expectedSourceSha256.toLowerCase()) {
    throw new BackupCryptoError("source_checksum_mismatch");
  }

  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(await decryptField(envelope.header.wrappedKey, OFFSITE_BACKUP_KEY_PURPOSE, input.keyring), "base64url");
  } catch {
    throw new BackupCryptoError("decryption_failed");
  }
  if (keyBytes.byteLength !== KEY_LENGTH_BYTES) throw new BackupCryptoError("decryption_failed");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes, Buffer.from(envelope.header.iv, "base64url"));
  decipher.setAAD(envelope.aad);
  decipher.setAuthTag(envelope.tag);
  const digest = createHash("sha256");
  let sourceBytes = 0;
  const ciphertextEnd = envelope.ciphertextStart + envelope.ciphertextBytes - 1;

  const decryptedChunks = async function* (): AsyncGenerator<Buffer> {
    if (envelope.ciphertextBytes > 0) {
      for await (const chunk of createReadStream(input.sourcePath, { start: envelope.ciphertextStart, end: ciphertextEnd })) {
        const plaintext = decipher.update(chunk as Uint8Array);
        if (plaintext.byteLength) {
          digest.update(plaintext);
          sourceBytes += plaintext.byteLength;
          yield plaintext;
        }
      }
    }
    let final: Buffer;
    try {
      final = decipher.final();
    } catch {
      throw new BackupCryptoError("decryption_failed");
    }
    if (final.byteLength) {
      digest.update(final);
      sourceBytes += final.byteLength;
      yield final;
    }
    const actualSourceSha = digest.digest("hex");
    if (actualSourceSha !== envelope.header.sourceSha256 || sourceBytes !== envelope.header.sourceBytes) {
      throw new BackupCryptoError("source_checksum_mismatch");
    }
  };

  try {
    await pipeline(
      Readable.from(decryptedChunks()),
      createWriteStream(input.destinationPath, { flags: "wx", mode: 0o600 }),
    );
  } catch (error) {
    rmSync(input.destinationPath, { force: true });
    if (error instanceof BackupCryptoError) throw error;
    throw new BackupCryptoError("decryption_failed");
  }

  return {
    version: 1,
    backupId: envelope.header.backupId,
    sourceSha256: envelope.header.sourceSha256,
    sourceBytes: sourceBytes,
  };
}
