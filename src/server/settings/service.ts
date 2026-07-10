import "server-only";
import type { PrismaClient } from "@prisma/client";
import { env } from "@/env";
import type { RedisLike } from "@/server/ai/redis";
import { decrypt, encrypt, isCryptoConfigured } from "./crypto";

export type AiProvider = "gemini" | "kimi";
export type SettingsDb = Pick<PrismaClient, "settings" | "activityLog">;

const KEY_VERSION_REDIS = "settings:ai-keys:version";
const CATEGORY = "API_KEYS" as const;

const PROVIDERS: Record<AiProvider, { settingsKey: string; envKey: () => string | undefined }> = {
  gemini: { settingsKey: "GEMINI_API_KEY", envKey: () => env.GEMINI_API_KEY },
  kimi: { settingsKey: "KIMI_API_KEY", envKey: () => env.KIMI_API_KEY },
};

export interface KeyStatus {
  provider: AiProvider;
  configured: boolean;
  source: "db" | "env" | "none";
  maskedSuffix: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

interface StoredKey {
  ciphertext?: string;
}

async function readDbRow(db: SettingsDb, provider: AiProvider) {
  if (!isCryptoConfigured()) return null;
  return db.settings.findUnique({
    where: { category_key: { category: CATEGORY, key: PROVIDERS[provider].settingsKey } },
    include: { updater: true },
  });
}

function tryDecrypt(value: unknown): string | null {
  const ciphertext = (value as StoredKey | null)?.ciphertext;
  if (!ciphertext) return null;
  try {
    return decrypt(ciphertext);
  } catch (error) {
    // Fail-open verso env (voluto), ma logga: master key ruotata o record corrotto
    // renderebbero altrimenti la key su DB illeggibile senza alcun segnale.
    console.warn("Settings: decrypt della API key su DB fallito, fallback su env:", error);
    return null;
  }
}

export async function resolveApiKey(
  db: SettingsDb,
  provider: AiProvider,
): Promise<string | undefined> {
  const row = await readDbRow(db, provider);
  const fromDb = row ? tryDecrypt(row.value) : null;
  if (fromDb) return fromDb;
  return PROVIDERS[provider].envKey();
}

export async function setApiKey(
  db: SettingsDb,
  redis: RedisLike,
  provider: AiProvider,
  plaintext: string,
  adminUserId: string,
): Promise<void> {
  const ciphertext = encrypt(plaintext); // lancia se la cifratura non è configurata
  const key = PROVIDERS[provider].settingsKey;
  await db.settings.upsert({
    where: { category_key: { category: CATEGORY, key } },
    create: { category: CATEGORY, key, value: { ciphertext }, isEncrypted: true, updatedBy: adminUserId },
    update: { value: { ciphertext }, isEncrypted: true, updatedBy: adminUserId },
  });
  await db.activityLog.create({
    data: {
      userId: adminUserId,
      type: "SETTINGS_CHANGED",
      description: `API key ${provider} aggiornata (••••${plaintext.slice(-4)})`,
      resourceType: "settings",
      resourceId: key,
    },
  });
  await redis.incr(KEY_VERSION_REDIS);
}

export async function getStatus(db: SettingsDb, provider: AiProvider): Promise<KeyStatus> {
  const row = await readDbRow(db, provider);
  const fromDb = row ? tryDecrypt(row.value) : null;
  if (row && fromDb) {
    const updater = (row as { updater?: { firstName: string; lastName: string } }).updater;
    return {
      provider,
      configured: true,
      source: "db",
      maskedSuffix: fromDb.slice(-4),
      updatedAt: (row as { updatedAt: Date }).updatedAt,
      updatedBy: updater ? `${updater.firstName} ${updater.lastName}`.trim() : null,
    };
  }
  const envVal = PROVIDERS[provider].envKey();
  if (envVal) {
    return { provider, configured: true, source: "env", maskedSuffix: envVal.slice(-4), updatedAt: null, updatedBy: null };
  }
  return { provider, configured: false, source: "none", maskedSuffix: null, updatedAt: null, updatedBy: null };
}

export async function getKeysVersion(redis: RedisLike): Promise<number> {
  const raw = await redis.get(KEY_VERSION_REDIS);
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
}
