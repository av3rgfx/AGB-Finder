import { beforeEach, describe, expect, it, vi } from "vitest";

// Stessa master key a 32 byte usata in crypto.test.ts (Buffer.alloc(32, 1) in base64).
const VALID_KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    SETTINGS_ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=" as string | undefined,
    GEMINI_API_KEY: "env-gemini-9999" as string | undefined,
    KIMI_API_KEY: undefined as string | undefined,
  },
}));
vi.mock("@/env", () => ({ env: mockEnv }));

import { encrypt } from "./crypto";
import { getKeysVersion, getStatus, resolveApiKey, setApiKey } from "./service";

function makeDb() {
  return {
    settings: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    activityLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
}

function makeRedis() {
  return { incr: vi.fn().mockResolvedValue(1), get: vi.fn().mockResolvedValue(null) };
}

beforeEach(() => {
  mockEnv.SETTINGS_ENCRYPTION_KEY = VALID_KEY;
  mockEnv.GEMINI_API_KEY = "env-gemini-9999";
  mockEnv.KIMI_API_KEY = undefined;
});

describe("resolveApiKey", () => {
  it("preferisce la key cifrata su DB", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue({ value: { ciphertext: encrypt("db-gemini-1111") } });
    const key = await resolveApiKey(db as never, "gemini");
    expect(key).toBe("db-gemini-1111");
  });

  it("fa fallback su env quando il DB non ha la key", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue(null);
    expect(await resolveApiKey(db as never, "gemini")).toBe("env-gemini-9999");
  });

  it("ritorna undefined se non c'è né DB né env", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue(null);
    expect(await resolveApiKey(db as never, "kimi")).toBeUndefined();
  });

  it("salta il DB quando la cifratura non è configurata", async () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = undefined;
    const db = makeDb();
    expect(await resolveApiKey(db as never, "gemini")).toBe("env-gemini-9999");
    expect(db.settings.findUnique).not.toHaveBeenCalled();
  });
});

describe("setApiKey", () => {
  it("cifra, fa upsert, scrive audit SENZA plaintext e bumpa la versione", async () => {
    const db = makeDb();
    const redis = makeRedis();
    await setApiKey(db as never, redis as never, "gemini", "sk-plaintext-4242", "admin1");

    const upsertArg = db.settings.upsert.mock.calls[0]![0];
    expect(upsertArg.create.value.ciphertext).not.toContain("sk-plaintext-4242");
    expect(upsertArg.create.isEncrypted).toBe(true);
    expect(upsertArg.create.updatedBy).toBe("admin1");

    const logArg = db.activityLog.create.mock.calls[0]![0];
    expect(logArg.data.type).toBe("SETTINGS_CHANGED");
    expect(JSON.stringify(logArg.data)).not.toContain("sk-plaintext-4242");
    expect(logArg.data.description).toContain("4242"); // solo suffisso mascherato

    expect(redis.incr).toHaveBeenCalledWith("settings:ai-keys:version");
  });

  it("lancia se la cifratura non è configurata", async () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = undefined;
    const db = makeDb();
    const redis = makeRedis();
    await expect(
      setApiKey(db as never, redis as never, "gemini", "x", "admin1"),
    ).rejects.toThrow();
    expect(db.settings.upsert).not.toHaveBeenCalled();
  });
});

describe("getStatus", () => {
  it("riporta source=db con suffisso mascherato, mai il plaintext", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue({
      value: { ciphertext: encrypt("db-gemini-1111") },
      updatedAt: new Date("2026-07-10T00:00:00Z"),
      updater: { firstName: "Anna", lastName: "Bianchi" },
    });
    const status = await getStatus(db as never, "gemini");
    expect(status).toMatchObject({ configured: true, source: "db", maskedSuffix: "1111", updatedBy: "Anna Bianchi" });
  });

  it("riporta source=env quando la key è solo in env", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue(null);
    const status = await getStatus(db as never, "gemini");
    expect(status).toMatchObject({ configured: true, source: "env", maskedSuffix: "9999" });
  });

  it("riporta source=none quando non c'è nessuna key", async () => {
    const db = makeDb();
    db.settings.findUnique.mockResolvedValue(null);
    expect(await getStatus(db as never, "kimi")).toMatchObject({ configured: false, source: "none" });
  });
});

describe("getKeysVersion", () => {
  it("ritorna 0 se il contatore non esiste", async () => {
    const redis = makeRedis();
    expect(await getKeysVersion(redis as never)).toBe(0);
  });

  it("parsa il contatore Redis", async () => {
    const redis = makeRedis();
    redis.get.mockResolvedValue("7");
    expect(await getKeysVersion(redis as never)).toBe(7);
  });
});
