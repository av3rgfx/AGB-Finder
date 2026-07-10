# Gestione in-app delle API key AI (ADMIN) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere agli ADMIN di aggiornare/ruotare dall'app le API key AI (Gemini/Kimi), cifrate su DB con fallback su env, senza redeploy Vercel.

**Architecture:** Modulo di cifratura AES-256-GCM (`node:crypto`) → service che risolve le key DB-prima-poi-env e le persiste cifrate con audit → `getAIGateway()` diventa async e ricostruisce il singleton quando cambia un version-stamp su Redis → router tRPC `adminProcedure` con test-connection obbligatorio → pagina `/impostazioni` admin-only.

**Tech Stack:** Next.js 15 (App Router), tRPC v11, Prisma 6 (Postgres/Neon), ioredis (Upstash), Better Auth (RBAC ADMIN), Vitest, `node:crypto`.

## Global Constraints

- TypeScript strict sempre. Nessun `any` implicito.
- Tutte le API via **tRPC** (mai `fetch` diretto dal client).
- Tutte le query via **Prisma**. Nessun raw SQL in questa feature.
- Moduli server-only sotto `src/server/` marcati con `import "server-only";`.
- **Nessuna chiamata a provider AI fuori da `src/server/ai/`** (il test-connection vive lì).
- UI **in italiano**; codici/segreti mascherati in **font monospace**.
- Master key: `SETTINGS_ENCRYPTION_KEY` **opzionale** in env (dev/CI senza attriti); mai loggata; distinta per ambiente.
- Audit su `ActivityLog` **senza mai** il valore in chiaro della key.
- Scope: solo `gemini` e `kimi`.
- Commit frequenti, un commit per task. Gate: `pnpm typecheck` · `pnpm lint` · `pnpm test`.

---

## File Structure

**Nuovi:**
- `src/server/settings/crypto.ts` — cifratura/decifratura AES-256-GCM + `SettingsCryptoUnavailableError`.
- `src/server/settings/crypto.test.ts`
- `src/server/settings/service.ts` — `resolveApiKey`, `setApiKey`, `getStatus`, `getKeysVersion`, tipi.
- `src/server/settings/service.test.ts`
- `src/server/ai/test-connection.ts` — `testProviderKey` (ping a un provider con una key data).
- `src/server/ai/test-connection.test.ts`
- `src/server/api/routers/settings.ts` — `settingsRouter` (`aiKeys.status/testConnection/set`).
- `src/server/api/routers/settings.test.ts`
- `src/app/(dashboard)/impostazioni/page.tsx` — pagina server admin-only.
- `src/app/(dashboard)/impostazioni/impostazioni-client.tsx` — UI client (tRPC).

**Modificati:**
- `src/env.ts` — aggiunta `SETTINGS_ENCRYPTION_KEY`.
- `src/server/ai/gateway.ts` — `getAIGateway()` async + invalidazione via version-stamp.
- `src/server/ai/gateway.test.ts` — nuovi test invalidazione (append).
- `src/server/api/routers/chat.ts:105,129` — `await getAIGateway()`.
- `src/server/api/routers/product.ts:37` — `(await getAIGateway()).queryEmbeddings()`.
- `src/server/api/root.ts` — montaggio `settings: settingsRouter`.

**Invariati:** `prisma/schema.prisma` (il modello `Settings` è già adeguato: `@@unique([category, key])`, `value Json`, `isEncrypted`, `updatedBy`).

---

### Task 1: Cifratura AES-256-GCM + env

**Files:**
- Create: `src/server/settings/crypto.ts`
- Test: `src/server/settings/crypto.test.ts`
- Modify: `src/env.ts` (aggiunta variabile)

**Interfaces:**
- Produces:
  - `class SettingsCryptoUnavailableError extends Error`
  - `function isCryptoConfigured(): boolean`
  - `function encrypt(plaintext: string): string` — ritorna `base64(iv[12] | authTag[16] | ciphertext)`; lancia `SettingsCryptoUnavailableError` se la master key manca.
  - `function decrypt(payload: string): string` — inverso; lancia su master key mancante o auth tag non valido.

- [ ] **Step 1: Aggiungere la master key allo schema env**

In `src/env.ts`, nell'oggetto dello schema server (accanto a `GEMINI_API_KEY`), aggiungere:

```ts
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),
```

- [ ] **Step 2: Scrivere il test che fallisce**

Create `src/server/settings/crypto.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";

// Master key mutabile: 32 byte in base64 (Buffer.alloc(32, 1)).
const VALID_KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const mockEnv: { SETTINGS_ENCRYPTION_KEY: string | undefined } = {
  SETTINGS_ENCRYPTION_KEY: VALID_KEY,
};
vi.mock("@/env", () => ({ env: mockEnv }));

import { decrypt, encrypt, isCryptoConfigured, SettingsCryptoUnavailableError } from "./crypto";

afterEach(() => {
  mockEnv.SETTINGS_ENCRYPTION_KEY = VALID_KEY;
});

describe("settings crypto", () => {
  it("fa il roundtrip encrypt→decrypt", () => {
    const plaintext = "sk-super-secret-1234";
    const payload = encrypt(plaintext);
    expect(payload).not.toContain(plaintext);
    expect(decrypt(payload)).toBe(plaintext);
  });

  it("usa un IV diverso per ogni cifratura (payload diversi)", () => {
    expect(encrypt("stessa-key")).not.toBe(encrypt("stessa-key"));
  });

  it("lancia se il ciphertext è manomesso", () => {
    const payload = encrypt("integcustomer");
    const tampered = Buffer.from(payload, "base64");
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered.toString("base64"))).toThrow();
  });

  it("segnala cifratura non configurata quando manca la master key", () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = undefined;
    expect(isCryptoConfigured()).toBe(false);
    expect(() => encrypt("x")).toThrow(SettingsCryptoUnavailableError);
    expect(() => decrypt("x")).toThrow(SettingsCryptoUnavailableError);
  });

  it("segnala non configurata se la master key non è di 32 byte", () => {
    mockEnv.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(isCryptoConfigured()).toBe(false);
  });
});
```

> Nota: `vi` è globale (config Vitest del progetto). Se in questo file risultasse non definito, aggiungere `import { vi } from "vitest";`.

- [ ] **Step 3: Eseguire il test — deve fallire**

Run: `pnpm test src/server/settings/crypto.test.ts`
Expected: FAIL (`Cannot find module './crypto'`).

- [ ] **Step 4: Implementare il modulo**

Create `src/server/settings/crypto.ts`:

```ts
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
```

- [ ] **Step 5: Eseguire i test — devono passare**

Run: `pnpm test src/server/settings/crypto.test.ts`
Expected: PASS (5 test).

- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/settings/crypto.ts src/server/settings/crypto.test.ts src/env.ts
git commit -m "feat(settings): cifratura AES-256-GCM per le API key + env SETTINGS_ENCRYPTION_KEY"
```

---

### Task 2: Settings service (resolve/set/status + version-stamp)

**Files:**
- Create: `src/server/settings/service.ts`
- Test: `src/server/settings/service.test.ts`

**Interfaces:**
- Consumes (Task 1): `encrypt`, `decrypt`, `isCryptoConfigured` da `./crypto`; `RedisLike` da `@/server/ai/redis`.
- Produces:
  - `type AiProvider = "gemini" | "kimi"`
  - `type SettingsDb = Pick<PrismaClient, "settings" | "activityLog">`
  - `interface KeyStatus { provider: AiProvider; configured: boolean; source: "db" | "env" | "none"; maskedSuffix: string | null; updatedAt: Date | null; updatedBy: string | null; }`
  - `function resolveApiKey(db: SettingsDb, provider: AiProvider): Promise<string | undefined>`
  - `function setApiKey(db: SettingsDb, redis: RedisLike, provider: AiProvider, plaintext: string, adminUserId: string): Promise<void>`
  - `function getStatus(db: SettingsDb, provider: AiProvider): Promise<KeyStatus>`
  - `function getKeysVersion(redis: RedisLike): Promise<number>`

- [ ] **Step 1: Scrivere i test che falliscono**

Create `src/server/settings/service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const mockEnv = {
  SETTINGS_ENCRYPTION_KEY: VALID_KEY as string | undefined,
  GEMINI_API_KEY: "env-gemini-9999" as string | undefined,
  KIMI_API_KEY: undefined as string | undefined,
};
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

    const upsertArg = db.settings.upsert.mock.calls[0][0];
    expect(upsertArg.create.value.ciphertext).not.toContain("sk-plaintext-4242");
    expect(upsertArg.create.isEncrypted).toBe(true);
    expect(upsertArg.create.updatedBy).toBe("admin1");

    const logArg = db.activityLog.create.mock.calls[0][0];
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
```

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `pnpm test src/server/settings/service.test.ts`
Expected: FAIL (`Cannot find module './service'`).

- [ ] **Step 3: Implementare il service**

Create `src/server/settings/service.ts`:

```ts
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
  } catch {
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
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `pnpm test src/server/settings/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/settings/service.ts src/server/settings/service.test.ts
git commit -m "feat(settings): service risoluzione/scrittura API key con audit e version-stamp"
```

---

### Task 3: `getAIGateway()` async + invalidazione + call-site

**Files:**
- Modify: `src/server/ai/gateway.ts:129-151`
- Modify: `src/server/api/routers/chat.ts:105,129`
- Modify: `src/server/api/routers/product.ts:37`
- Test: `src/server/ai/gateway.test.ts` (append)

**Interfaces:**
- Consumes (Task 2): `resolveApiKey`, `getKeysVersion` da `@/server/settings/service`; `db` da `@/server/db`; `RedisLike` da `./redis`.
- Produces: `function getAIGateway(): Promise<AIGateway>` (era sincrona → ora **async**).

- [ ] **Step 1: Scrivere i test di invalidazione che falliscono**

Append a `src/server/ai/gateway.test.ts` (in cima al file, insieme agli altri import/mocks; se il file ha già dei `vi.mock`, aggiungere questi accanto):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const resolveApiKey = vi.fn();
const getKeysVersion = vi.fn();
vi.mock("@/server/settings/service", () => ({ resolveApiKey, getKeysVersion }));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("./redis", () => ({ getRedis: () => ({}) }));

describe("getAIGateway invalidation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("ricostruisce il singleton quando cambia il version-stamp", async () => {
    vi.useFakeTimers();
    resolveApiKey.mockResolvedValue("key-1");
    getKeysVersion.mockResolvedValue(0);
    const mod = await import("./gateway");

    const first = await mod.getAIGateway();
    resolveApiKey.mockResolvedValue("key-2");
    getKeysVersion.mockResolvedValue(1);
    vi.advanceTimersByTime(31_000);
    const second = await mod.getAIGateway();

    expect(second).not.toBe(first);
  });

  it("riusa il singleton quando la versione non cambia (dopo il TTL)", async () => {
    vi.useFakeTimers();
    resolveApiKey.mockResolvedValue("key-1");
    getKeysVersion.mockResolvedValue(0);
    const mod = await import("./gateway");

    const first = await mod.getAIGateway();
    vi.advanceTimersByTime(31_000);
    const second = await mod.getAIGateway();

    expect(second).toBe(first);
  });
});
```

> Se il file di test esistente costruisce `AIGateway` senza questi mock, spostare i nuovi `vi.mock` in un file separato `src/server/ai/gateway.invalidation.test.ts` per non interferire con i test esistenti. Preferire il file separato se ci sono dubbi.

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `pnpm test src/server/ai/gateway`
Expected: FAIL (`getAIGateway` non è async / non usa i mock).

- [ ] **Step 3: Riscrivere `getAIGateway`**

In `src/server/ai/gateway.ts`, aggiungere gli import in cima:

```ts
import { db } from "@/server/db";
import { getKeysVersion, resolveApiKey } from "@/server/settings/service";
import type { RedisLike } from "./redis";
```

Sostituire il blocco `let singleton ... return singleton;` (righe ~129-151) con:

```ts
let singleton: AIGateway | null = null;
let cachedVersion = -1;
let checkedAt = 0;
const VERSION_TTL_MS = 30_000;

async function buildGateway(redis: RedisLike): Promise<AIGateway> {
  const geminiKey = await resolveApiKey(db, "gemini");
  const kimiKey = await resolveApiKey(db, "kimi");
  const providers: ChatProvider[] = [];
  if (geminiKey) providers.push(new GeminiChatProvider(geminiKey, env.GEMINI_MODEL));
  if (kimiKey) providers.push(new KimiChatProvider(kimiKey, env.KIMI_MODEL));
  const queryEmbeddings = geminiKey
    ? new GeminiEmbeddingService(geminiKey, "RETRIEVAL_QUERY", (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
      )
    : undefined;
  return new AIGateway({
    providers,
    breaker: new CircuitBreaker(redis),
    limiter: new RateLimiter(redis),
    queryEmbeddings,
  });
}

/**
 * Gateway di produzione: le key sono risolte DB-prima-poi-env dal settings service.
 * Il singleton viene ricostruito quando cambia il version-stamp su Redis (rilettura
 * al più ogni VERSION_TTL_MS), così una rotazione key da /impostazioni ha effetto
 * senza redeploy. Disallineamento massimo tra istanze serverless = VERSION_TTL_MS.
 */
export async function getAIGateway(): Promise<AIGateway> {
  const now = Date.now();
  if (singleton && now - checkedAt < VERSION_TTL_MS) return singleton;
  const redis = getRedis();
  const version = await getKeysVersion(redis);
  checkedAt = now;
  if (singleton && version === cachedVersion) return singleton;
  cachedVersion = version;
  singleton = await buildGateway(redis);
  return singleton;
}
```

> `getRedis()` ritorna `RedisLike`; passarlo a `CircuitBreaker`/`RateLimiter` come prima.

- [ ] **Step 4: Aggiornare i call-site**

In `src/server/api/routers/chat.ts` (righe ~105 e ~129), sostituire entrambe le occorrenze:

```ts
const service = new ChatService(ctx.db, await getAIGateway());
```

In `src/server/api/routers/product.ts` (riga ~37):

```ts
const engine = new RAGEngine(ctx.db, (await getAIGateway()).queryEmbeddings());
```

- [ ] **Step 5: Eseguire i test — devono passare**

Run: `pnpm test src/server/ai/gateway`
Expected: PASS (compresi i due nuovi test di invalidazione).

- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/ai/gateway.ts src/server/ai/gateway.test.ts src/server/ai/gateway.invalidation.test.ts src/server/api/routers/chat.ts src/server/api/routers/product.ts
git commit -m "feat(ai): getAIGateway async con invalidazione via version-stamp Redis"
```

> Il `git add` del file `gateway.invalidation.test.ts` fallisce silenziosamente se non è stato creato: rimuoverlo dal comando se i test sono rimasti in `gateway.test.ts`.

---

### Task 4: Helper test-connection (dentro `src/server/ai/`)

**Files:**
- Create: `src/server/ai/test-connection.ts`
- Test: `src/server/ai/test-connection.test.ts`

**Interfaces:**
- Consumes: `GeminiChatProvider`, `KimiChatProvider`; `env.GEMINI_MODEL`, `env.KIMI_MODEL`; `type AiProvider` da `@/server/settings/service`.
- Produces:
  - `interface TestConnectionResult { ok: boolean; latencyMs?: number; error?: string; }`
  - `function testProviderKey(provider: AiProvider, apiKey: string): Promise<TestConnectionResult>`

- [ ] **Step 1: Scrivere i test che falliscono**

Create `src/server/ai/test-connection.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.fn();
vi.mock("./providers/gemini", () => ({
  GeminiChatProvider: vi.fn(() => ({ name: "gemini", chat: chatMock })),
}));
vi.mock("./providers/kimi", () => ({
  KimiChatProvider: vi.fn(() => ({ name: "kimi", chat: chatMock })),
}));
vi.mock("@/env", () => ({ env: { GEMINI_MODEL: "m", KIMI_MODEL: "m" } }));

import { testProviderKey } from "./test-connection";

beforeEach(() => chatMock.mockReset());

describe("testProviderKey", () => {
  it("ritorna ok con latenza quando la chat riesce", async () => {
    chatMock.mockResolvedValue({ text: "pong", toolCalls: [], modelUsed: "m", tokensUsed: null });
    const result = await testProviderKey("gemini", "sk-good");
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("ritorna ok:false con il messaggio d'errore quando la chat fallisce", async () => {
    chatMock.mockRejectedValue(new Error("401 Unauthorized"));
    const result = await testProviderKey("kimi", "sk-bad");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });
});
```

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `pnpm test src/server/ai/test-connection.test.ts`
Expected: FAIL (`Cannot find module './test-connection'`).

- [ ] **Step 3: Implementare l'helper**

Create `src/server/ai/test-connection.ts`:

```ts
import "server-only";
import { env } from "@/env";
import type { AiProvider } from "@/server/settings/service";
import { GeminiChatProvider } from "./providers/gemini";
import { KimiChatProvider } from "./providers/kimi";
import type { ChatProvider } from "./providers/types";

const PING_TIMEOUT_MS = 8_000;

export interface TestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Ping minimo a un provider con una key data. Nessuna persistenza. */
export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
): Promise<TestConnectionResult> {
  const client: ChatProvider =
    provider === "gemini"
      ? new GeminiChatProvider(apiKey, env.GEMINI_MODEL)
      : new KimiChatProvider(apiKey, env.KIMI_MODEL);
  const started = Date.now();
  try {
    await client.chat([{ role: "user", content: "ping" }], [], AbortSignal.timeout(PING_TIMEOUT_MS));
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Errore sconosciuto" };
  }
}
```

- [ ] **Step 4: Eseguire i test — devono passare**

Run: `pnpm test src/server/ai/test-connection.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/ai/test-connection.ts src/server/ai/test-connection.test.ts
git commit -m "feat(ai): helper testProviderKey per la verifica delle API key"
```

---

### Task 5: Router tRPC `settings` + montaggio

**Files:**
- Create: `src/server/api/routers/settings.ts`
- Test: `src/server/api/routers/settings.test.ts`
- Modify: `src/server/api/root.ts`

**Interfaces:**
- Consumes: `adminProcedure`, `createTRPCRouter` da `@/server/api/trpc`; `getRedis` da `@/server/ai/redis`; `testProviderKey` (Task 4); `getStatus`, `resolveApiKey`, `setApiKey`, `type AiProvider` (Task 2).
- Produces: `settingsRouter` con `aiKeys.status` (query), `aiKeys.testConnection` (mutation), `aiKeys.set` (mutation). Montato come `settings` nel root router.

- [ ] **Step 1: Scrivere i test che falliscono**

Create `src/server/api/routers/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";

const testProviderKey = vi.fn();
const setApiKey = vi.fn().mockResolvedValue(undefined);
const getStatus = vi.fn().mockResolvedValue({ provider: "gemini", configured: true, source: "db", maskedSuffix: "1111", updatedAt: null, updatedBy: null });
const resolveApiKey = vi.fn();
vi.mock("@/server/ai/test-connection", () => ({ testProviderKey }));
vi.mock("@/server/settings/service", () => ({ setApiKey, getStatus, resolveApiKey }));
vi.mock("@/server/ai/redis", () => ({ getRedis: () => ({}) }));

import { settingsRouter } from "./settings";

const appRouter = createTRPCRouter({ settings: settingsRouter });
const makeCtx = (session: unknown): TRPCContext => ({
  db: {} as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
});
const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };
const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  testProviderKey.mockReset();
  setApiKey.mockClear();
});

describe("settings.aiKeys authorization", () => {
  it("nega un AGENT con FORBIDDEN", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.settings.aiKeys.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("settings.aiKeys.set", () => {
  it("rifiuta con BAD_REQUEST se il test di connessione fallisce (non persiste)", async () => {
    testProviderKey.mockResolvedValue({ ok: false, error: "401 Unauthorized" });
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.settings.aiKeys.set({ provider: "gemini", apiKey: "sk-bad" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it("persiste la key quando il test riesce", async () => {
    testProviderKey.mockResolvedValue({ ok: true, latencyMs: 12 });
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await caller.settings.aiKeys.set({ provider: "gemini", apiKey: "sk-good" });
    expect(setApiKey).toHaveBeenCalledWith(expect.anything(), expect.anything(), "gemini", "sk-good", "admin1");
  });
});
```

- [ ] **Step 2: Eseguire i test — devono fallire**

Run: `pnpm test src/server/api/routers/settings.test.ts`
Expected: FAIL (`Cannot find module './settings'`).

- [ ] **Step 3: Implementare il router**

Create `src/server/api/routers/settings.ts`:

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { getRedis } from "@/server/ai/redis";
import { testProviderKey } from "@/server/ai/test-connection";
import { getStatus, resolveApiKey, setApiKey, type AiProvider } from "@/server/settings/service";

const providerSchema = z.enum(["gemini", "kimi"]);
const ALL_PROVIDERS: AiProvider[] = ["gemini", "kimi"];

export const settingsRouter = createTRPCRouter({
  aiKeys: createTRPCRouter({
    status: adminProcedure.query(({ ctx }) =>
      Promise.all(ALL_PROVIDERS.map((provider) => getStatus(ctx.db, provider))),
    ),

    testConnection: adminProcedure
      .input(z.object({ provider: providerSchema, apiKey: z.string().min(1).optional() }))
      .mutation(async ({ ctx, input }) => {
        const key = input.apiKey ?? (await resolveApiKey(ctx.db, input.provider));
        if (!key) return { ok: false as const, error: "Nessuna key configurata per questo provider" };
        return testProviderKey(input.provider, key);
      }),

    set: adminProcedure
      .input(z.object({ provider: providerSchema, apiKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const result = await testProviderKey(input.provider, input.apiKey);
        if (!result.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "Test di connessione fallito" });
        }
        await setApiKey(ctx.db, getRedis(), input.provider, input.apiKey, ctx.session.user.id);
        return getStatus(ctx.db, input.provider);
      }),
  }),
});
```

- [ ] **Step 4: Montare il router nel root**

In `src/server/api/root.ts`, aggiungere l'import e la voce:

```ts
import { settingsRouter } from "@/server/api/routers/settings";
```

e dentro `createTRPCRouter({ ... })`:

```ts
  settings: settingsRouter,
```

- [ ] **Step 5: Eseguire i test — devono passare**

Run: `pnpm test src/server/api/routers/settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/api/routers/settings.ts src/server/api/routers/settings.test.ts src/server/api/root.ts
git commit -m "feat(api): router settings.aiKeys (status/testConnection/set) admin-only"
```

---

### Task 6: UI `/impostazioni` (admin-only)

**Files:**
- Create: `src/app/(dashboard)/impostazioni/page.tsx`
- Create: `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`

**Interfaces:**
- Consumes: `settings.aiKeys.status/testConnection/set` via il client tRPC (`@/trpc/react`); `auth` per la guardia di ruolo.

> Nota: verificare il nome esatto dell'hook client tRPC nel progetto (es. `api` esportato da `@/trpc/react`). Usare lo stesso pattern delle altre pagine `(dashboard)` (`assistente-client.tsx`, `richieste-client.tsx`). Applicare la skill `/impeccable` per la rifinitura visiva prima del commit.

- [ ] **Step 1: Pagina server con guardia ADMIN**

Create `src/app/(dashboard)/impostazioni/page.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ImpostazioniClient } from "./impostazioni-client";

export default async function ImpostazioniPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Impostazioni · API key AI</h1>
      <ImpostazioniClient />
    </div>
  );
}
```

- [ ] **Step 2: Client con card per provider**

Create `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`. Adattare il nome dell'hook (`api`/`trpc`) a quello usato dalle altre `*-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

type Provider = "gemini" | "kimi";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "gemini", label: "Gemini (Google)" },
  { id: "kimi", label: "Kimi (Moonshot)" },
];

export function ImpostazioniClient() {
  const status = api.settings.aiKeys.status.useQuery();
  return (
    <div className="space-y-4">
      {status.isLoading && <p className="text-sm text-muted-foreground">Caricamento…</p>}
      {PROVIDERS.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          current={status.data?.find((s) => s.provider === provider.id)}
          onSaved={() => status.refetch()}
        />
      ))}
    </div>
  );
}

type KeyStatus = {
  provider: Provider;
  configured: boolean;
  source: "db" | "env" | "none";
  maskedSuffix: string | null;
  updatedAt: string | Date | null;
  updatedBy: string | null;
};

function ProviderCard({
  provider,
  current,
  onSaved,
}: {
  provider: { id: Provider; label: string };
  current: KeyStatus | undefined;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [tested, setTested] = useState<null | { ok: boolean; error?: string }>(null);

  const test = api.settings.aiKeys.testConnection.useMutation();
  const save = api.settings.aiKeys.set.useMutation({
    onSuccess: () => {
      setApiKey("");
      setTested(null);
      onSaved();
    },
  });

  const sourceLabel =
    current?.source === "db"
      ? "configurata (DB)"
      : current?.source === "env"
        ? "configurata (env)"
        : "mancante";

  return (
    <section className="rounded-lg border border-border bg-surface-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{provider.label}</h2>
        <span className="text-sm text-muted-foreground">
          {sourceLabel}
          {current?.maskedSuffix && (
            <span className="ml-2 font-mono">••••{current.maskedSuffix}</span>
          )}
        </span>
      </div>
      {current?.updatedBy && current?.updatedAt && (
        <p className="mb-3 text-xs text-muted-foreground">
          Ultima modifica: {new Date(current.updatedAt).toLocaleString("it-IT")} da {current.updatedBy}
        </p>
      )}

      <input
        type="password"
        autoComplete="off"
        placeholder="Nuova API key…"
        value={apiKey}
        onChange={(event) => {
          setApiKey(event.target.value);
          setTested(null);
        }}
        className="mb-3 w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!apiKey || test.isPending}
          onClick={async () => {
            const result = await test.mutateAsync({ provider: provider.id, apiKey });
            setTested(result);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {test.isPending ? "Test in corso…" : "Testa connessione"}
        </button>
        <button
          type="button"
          disabled={!tested?.ok || save.isPending}
          onClick={() => save.mutate({ provider: provider.id, apiKey })}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Salvataggio…" : "Salva"}
        </button>
      </div>

      {tested && (
        <p className={`mt-2 text-sm ${tested.ok ? "text-green-600" : "text-red-600"}`}>
          {tested.ok ? "Connessione riuscita ✓" : `Test fallito: ${tested.error ?? "errore"}`}
        </p>
      )}
      {save.error && <p className="mt-2 text-sm text-red-600">{save.error.message}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Verifica manuale (build + smoke)**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: build OK. Avviare l'app (`bash scripts/dev-bootstrap.sh` se serve il DB) e verificare come ADMIN: la pagina `/impostazioni` mostra le due card con lo stato corretto; come AGENT: redirect a `/dashboard`.

- [ ] **Step 4: Rifinitura /impeccable**

Applicare la skill `/impeccable` alla pagina (allineamento, spaziatura, stati vuoti/errore, contrasto, classi coerenti col design system esistente — verificare che `surface-card`, `border`, `primary` esistano nel tema; altrimenti usare le classi realmente presenti nelle altre `*-client.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/impostazioni/page.tsx" "src/app/(dashboard)/impostazioni/impostazioni-client.tsx"
git commit -m "feat(ui): pagina /impostazioni admin per la gestione delle API key AI"
```

---

## Self-Review (autore del piano)

**Copertura spec:**
- §1 Cifratura → Task 1 ✓
- §2 Env → Task 1 (Step 1) ✓
- §3 Service (resolve/set/status + version-stamp) → Task 2 ✓
- §4 Invalidazione singleton + call-site → Task 3 ✓
- §5 Router tRPC (status/testConnection/set) → Task 5; helper test-connection nel modulo AI → Task 4 ✓
- §6 UI → Task 6 ✓
- Sicurezza: audit senza plaintext (Task 2, test dedicato); RBAC admin (Task 5, test); master key opzionale/fallback (Task 2, test) ✓
- Testing TDD: ogni task ha test-prima ✓

**Note di coerenza tipi:** `AiProvider` definito in Task 2 e riusato in Task 4/5; `resolveApiKey/getKeysVersion/setApiKey/getStatus` con firme identiche fra definizione (Task 2) e consumo (Task 3/5); `getAIGateway` reso `Promise<AIGateway>` e tutti i call-site aggiornati con `await` (Task 3).

**Punti di attenzione per l'esecutore (verificare, non assumere):**
1. Nome dell'hook client tRPC (`api` vs `trpc`) e classi del design system in Task 6 — allinearsi alle `*-client.tsx` esistenti.
2. Se `gateway.test.ts` esistente costruisce `AIGateway` senza i mock di `@/server/db`/`service`, mettere i test di invalidazione in `gateway.invalidation.test.ts` separato.
3. Il compound unique di Prisma per `Settings` è esposto come `category_key` (da `@@unique([category, key])`): confermare il nome generato dal client Prisma; se diverso, adeguare `where`.
