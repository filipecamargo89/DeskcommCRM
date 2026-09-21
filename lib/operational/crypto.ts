import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;

let cachedKey: Buffer | null = null;

function getOperationalKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = env.ZION_OPERATIONAL_AES_KEY;

  if (!raw) {
    throw new Error("ZION_OPERATIONAL_AES_KEY não configurada.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ZION_OPERATIONAL_AES_KEY deve ter exatamente 32 bytes (lido: ${key.length}).`,
    );
  }

  cachedKey = key;
  return key;
}

export interface OperationalEncryptedValue {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export function encryptOperationalValue(
  plaintext: string,
): OperationalEncryptedValue {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Valor inválido para criptografia operacional.");
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getOperationalKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  if (tag.length !== TAG_LENGTH_BYTES) {
    throw new Error(`Tamanho inesperado da tag GCM: ${tag.length}`);
  }

  return { ciphertext, iv, tag };
}

export function decryptOperationalValue(input: {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getOperationalKey(),
    input.iv,
  );

  decipher.setAuthTag(input.tag);

  return Buffer.concat([
    decipher.update(input.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function operationalBufferToBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}

export function operationalByteaToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  if (typeof value === "string") {
    const hex = value.startsWith(String.fromCharCode(92) + "x") ? value.slice(2) : value;
    return Buffer.from(hex, "hex");
  }

  throw new Error("Formato bytea inesperado.");
}
