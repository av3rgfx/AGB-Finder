import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/env";

/** La cifratura richiede SETTINGS_ENCRYPTION_KEY (32 byte, base64). */
export class SettingsCryptoUnavailableError extends Error {
  constructor() {
    super(
      "Cifratura impostazioni non configurata (SETTINGS_ENCRYPTION_KEY assente o non valida)",
    );
    this.name = "SettingsCryptoUnavailableError";
  }
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function masterKey(): Buffer | null {
  const raw = env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function isCryptoConfigured(): boolean {
  return masterKey() !== null;
}

export function encrypt(plaintext: string): string {
  const key = masterKey();
  if (!key) throw new SettingsCryptoUnavailableError();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = masterKey();
  if (!key) throw new SettingsCryptoUnavailableError();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
