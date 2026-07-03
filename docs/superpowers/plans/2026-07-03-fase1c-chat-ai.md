# Fase 1c — Chat AI (Assistente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assistente chat per agenti UFP sul catalogo AGB con tool-use (RAG), più attivazione del ramo vettoriale della ricerca ibrida (embedding batch dei prodotti).

**Architecture:** Tutte le chiamate AI passano dall'unico modulo `AIGateway` (rate limit + circuit breaker su Redis + fallback Gemini→Kimi, solo `fetch`, nessun SDK). `ChatService` orchestra il loop tool-use (cap 5 round) e persiste i messaggi via Prisma. Il batch embedding è uno script tsx idempotente che scrive i vettori tramite il RAGEngine (unico modulo raw SQL). UI: split pane 60/40 su `/assistente`.

**Tech Stack:** Next.js 15 · tRPC v11 · Prisma 6 + pgvector · ioredis (unica dipendenza nuova) · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-fase1c-chat-ai-design.md`

## Global Constraints

- TypeScript strict; tutte le API via tRPC; tutte le query via Prisma; **raw SQL solo nel RAGEngine** (`src/server/ai/rag.ts`).
- **Nessun SDK provider**: solo `fetch` (pattern `GeminiEmbeddingService`). Unica nuova dipendenza: **`ioredis`**.
- **NIENTE BullMQ** (regola emendata dalla spec): ogni chiamata AI passa da `AIGateway` (`src/server/ai/gateway.ts`); nessuna chiamata provider fuori da `src/server/ai/`.
- Niente streaming: risposta completa. Cap **5 round** di tool-use per turno.
- Rate limit **20 msg/min per utente** → `TOO_MANY_REQUESTS`. Breaker per provider: **5 fallimenti/60s → open 30s** (TTL scaduto = half-open). Stato **solo su Redis** (mai in-memory).
- Timeout chat **30s** + **1 retry con jitter solo su 429/5xx**; timeout embedding query **3s** → su errore `null` (la ricerca degrada al testuale, mai errore).
- Embedding: `gemini-embedding-001`, `EMBEDDING_DIM = 768`, L2-normalizzato; batch ≤ **100** testi/richiesta; `RETRIEVAL_DOCUMENT` per i prodotti, `RETRIEVAL_QUERY` per le query. Pesi ricerca ibrida: 0.4 testo / 0.6 vettore (già nel RAGEngine).
- UI **in italiano**; codici prodotto in font monospace; messaggi errore utente in italiano.
- TDD: test prima, un commit per task. Gates: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- Env: `GEMINI_API_KEY`/`KIMI_API_KEY` opzionali (già in `src/env.ts`); senza key la chat risponde «Assistente non configurato» e la ricerca resta testuale.

---

### Task 0: Bootstrap ambiente + dipendenza ioredis

**Files:**
- Modify: `package.json` (dipendenza `ioredis`, script `embed:products`)

**Interfaces:**
- Produces: pacchetto `ioredis` installato; `pnpm test` funzionante nel container.

- [ ] **Step 1: Setup engine Prisma e dipendenze**

```bash
cd /home/user/AGB-Finder
bash scripts/setup-prisma-engines.sh
pnpm install
pnpm add ioredis
set -a; source .env; set +a
pnpm db:generate
```

Expected: install ok, `prisma generate` ok (engine via curl, non downloader).

- [ ] **Step 2: Aggiungi lo script embed:products a package.json**

In `package.json`, sotto `"import:agb"`:

```json
    "import:agb": "tsx scripts/import-agb.ts",
    "embed:products": "tsx scripts/embed-products.ts",
```

- [ ] **Step 3: Verifica che la suite esistente sia verde**

Run: `pnpm test`
Expected: 86 passed (integrazione skippata senza `INTEGRATION_DATABASE_URL`).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): ioredis + script embed:products (Fase 1c)"
```

---

### Task 1: RedisLike + FakeRedis + CircuitBreaker

**Files:**
- Create: `src/server/ai/redis.ts`
- Create: `src/test/fake-redis.ts`
- Create: `src/server/ai/breaker.ts`
- Test: `src/server/ai/breaker.test.ts`

**Interfaces:**
- Produces:
  - `interface RedisLike { incr(key): Promise<number>; expire(key, seconds): Promise<unknown>; set(key, value, ex: "EX", seconds): Promise<unknown>; get(key): Promise<string | null>; del(...keys): Promise<unknown> }` (in `redis.ts`)
  - `getRedis(): RedisLike` (singleton ioredis lazy)
  - `class FakeRedis implements RedisLike` con `advance(seconds: number)` per i TTL (in `src/test/fake-redis.ts`)
  - `class CircuitBreaker { constructor(redis: RedisLike, opts?: BreakerOptions); isOpen(provider: string): Promise<boolean>; recordFailure(provider): Promise<void>; recordSuccess(provider): Promise<void> }` — default `{ failureThreshold: 5, failWindowSec: 60, openSec: 30 }`

- [ ] **Step 1: Scrivi redis.ts e FakeRedis (infrastruttura test, nessun test proprio)**

`src/server/ai/redis.ts`:

```ts
import "server-only";
import Redis from "ioredis";
import { env } from "@/env";

/** Sottoinsieme minimo di ioredis usato da breaker e rate limiter (iniettabile nei test). */
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  set(key: string, value: string, ex: "EX", seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<unknown>;
}

let client: Redis | null = null;

/** Client Redis condiviso, lazy: nessuna connessione finché non parte un comando. */
export function getRedis(): RedisLike {
  client ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
  return client;
}
```

`src/test/fake-redis.ts`:

```ts
import type { RedisLike } from "@/server/ai/redis";

/** Redis in-memory con clock controllabile: advance() fa scadere i TTL. */
export class FakeRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private now = 0;

  advance(seconds: number): void {
    this.now += seconds * 1000;
  }

  private live(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  incr(key: string): Promise<number> {
    const entry = this.live(key);
    const next = entry ? Number(entry.value) + 1 : 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return Promise.resolve(next);
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = this.now + seconds * 1000;
    return Promise.resolve(1);
  }

  set(key: string, value: string, _ex: "EX", seconds: number): Promise<string> {
    this.store.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return Promise.resolve("OK");
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (this.store.delete(key)) removed += 1;
    return Promise.resolve(removed);
  }
}
```

- [ ] **Step 2: Scrivi i test del breaker (falliranno: breaker.ts non esiste)**

`src/server/ai/breaker.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { CircuitBreaker } from "./breaker";

let redis: FakeRedis;
let breaker: CircuitBreaker;

beforeEach(() => {
  redis = new FakeRedis();
  breaker = new CircuitBreaker(redis);
});

describe("CircuitBreaker", () => {
  it("resta chiuso sotto la soglia di fallimenti", async () => {
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("apre al quinto fallimento nella finestra", async () => {
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(true);
  });

  it("half-open: dopo 30s il breaker non risulta più aperto (probe ammesso)", async () => {
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    redis.advance(31);
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("un successo azzera il contatore fallimenti", async () => {
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    await breaker.recordSuccess("gemini");
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("la finestra fallimenti scade da sola (TTL 60s)", async () => {
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    redis.advance(61);
    await breaker.recordFailure("gemini"); // riparte da 1
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("i provider hanno stato indipendente", async () => {
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("kimi")).toBe(false);
  });
});
```

- [ ] **Step 3: Verifica che falliscano**

Run: `pnpm vitest run src/server/ai/breaker.test.ts`
Expected: FAIL (`Cannot find module './breaker'`).

- [ ] **Step 4: Implementa breaker.ts**

```ts
import type { RedisLike } from "./redis";

export interface BreakerOptions {
  failureThreshold: number;
  failWindowSec: number;
  openSec: number;
}

const DEFAULTS: BreakerOptions = { failureThreshold: 5, failWindowSec: 60, openSec: 30 };

/**
 * Circuit breaker distribuito per provider AI. Stato SOLO su Redis: le lambda
 * Vercel non condividono memoria. TTL della chiave open scaduto = half-open
 * (la prima chiamata successiva fa da probe).
 */
export class CircuitBreaker {
  constructor(
    private readonly redis: RedisLike,
    private readonly opts: BreakerOptions = DEFAULTS,
  ) {}

  async isOpen(provider: string): Promise<boolean> {
    return (await this.redis.get(`cb:${provider}:open`)) !== null;
  }

  async recordFailure(provider: string): Promise<void> {
    const failures = await this.redis.incr(`cb:${provider}:fail`);
    if (failures === 1) await this.redis.expire(`cb:${provider}:fail`, this.opts.failWindowSec);
    if (failures >= this.opts.failureThreshold) {
      await this.redis.set(`cb:${provider}:open`, "1", "EX", this.opts.openSec);
      await this.redis.del(`cb:${provider}:fail`);
    }
  }

  async recordSuccess(provider: string): Promise<void> {
    await this.redis.del(`cb:${provider}:fail`);
  }
}
```

- [ ] **Step 5: Verifica verde + commit**

Run: `pnpm vitest run src/server/ai/breaker.test.ts` → PASS (6 test).

```bash
git add src/server/ai/redis.ts src/test/fake-redis.ts src/server/ai/breaker.ts src/server/ai/breaker.test.ts
git commit -m "feat(ai): circuit breaker distribuito su Redis + FakeRedis di test"
```

---

### Task 2: RateLimiter (finestra fissa su Redis)

**Files:**
- Create: `src/server/ai/ratelimit.ts`
- Test: `src/server/ai/ratelimit.test.ts`

**Interfaces:**
- Consumes: `RedisLike` (Task 1)
- Produces: `class RateLimiter { constructor(redis: RedisLike, nowMs?: () => number); consume(key: string, limit: number, windowSec: number): Promise<boolean> }` — `true` = ammesso.

- [ ] **Step 1: Test (falliranno)**

`src/server/ai/ratelimit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { RateLimiter } from "./ratelimit";

describe("RateLimiter", () => {
  it("ammette fino al limite nella finestra", async () => {
    const limiter = new RateLimiter(new FakeRedis(), () => 0);
    for (let i = 0; i < 20; i++) expect(await limiter.consume("user:u1", 20, 60)).toBe(true);
  });

  it("blocca la richiesta oltre il limite", async () => {
    const limiter = new RateLimiter(new FakeRedis(), () => 0);
    for (let i = 0; i < 20; i++) await limiter.consume("user:u1", 20, 60);
    expect(await limiter.consume("user:u1", 20, 60)).toBe(false);
  });

  it("la finestra successiva riparte da zero", async () => {
    let now = 0;
    const limiter = new RateLimiter(new FakeRedis(), () => now);
    for (let i = 0; i < 21; i++) await limiter.consume("user:u1", 20, 60);
    now = 61_000; // finestra successiva
    expect(await limiter.consume("user:u1", 20, 60)).toBe(true);
  });

  it("chiavi diverse hanno budget indipendenti", async () => {
    const limiter = new RateLimiter(new FakeRedis(), () => 0);
    for (let i = 0; i < 21; i++) await limiter.consume("user:u1", 20, 60);
    expect(await limiter.consume("user:u2", 20, 60)).toBe(true);
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/ai/ratelimit.test.ts`

- [ ] **Step 3: Implementa ratelimit.ts**

```ts
import type { RedisLike } from "./redis";

/**
 * Rate limiter a finestra fissa: chiave per finestra, il TTL pulisce da solo.
 * Sliding window è YAGNI per 20 msg/min.
 */
export class RateLimiter {
  constructor(
    private readonly redis: RedisLike,
    private readonly nowMs: () => number = Date.now,
  ) {}

  /** true = richiesta ammessa; false = limite superato. */
  async consume(key: string, limit: number, windowSec: number): Promise<boolean> {
    const window = Math.floor(this.nowMs() / (windowSec * 1000));
    const redisKey = `rl:${key}:${window}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, windowSec);
    return count <= limit;
  }
}
```

- [ ] **Step 4: Verifica PASS + commit**

```bash
git add src/server/ai/ratelimit.ts src/server/ai/ratelimit.test.ts
git commit -m "feat(ai): rate limiter a finestra fissa su Redis"
```

---

### Task 3: Errori tipizzati + tipi ChatProvider + GeminiChatProvider

**Files:**
- Create: `src/server/ai/errors.ts`
- Create: `src/server/ai/providers/types.ts`
- Create: `src/server/ai/providers/gemini.ts`
- Test: `src/server/ai/providers/gemini.test.ts`

**Interfaces:**
- Produces (`errors.ts`):
  - `class RateLimitedError extends Error` — msg «Troppe richieste, riprova tra poco.»
  - `class AINotConfiguredError extends Error` — msg «Assistente non configurato.»
  - `class AIUnavailableError extends Error` — msg «Assistente momentaneamente non disponibile.»
  - `class ProviderHttpError extends Error { provider: string; status: number }`
- Produces (`types.ts`):
  - `interface ToolCall { id: string; name: string; arguments: Record<string, unknown> }`
  - `interface ToolDeclaration { name: string; description: string; parameters: Record<string, unknown> }`
  - `type ChatMessage = { role: "system"; content: string } | { role: "user"; content: string } | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] } | { role: "tool"; toolCallId: string; toolName: string; content: string }` (content del tool = output JSON stringificato)
  - `interface ChatResult { text: string | null; toolCalls: ToolCall[]; modelUsed: string; tokensUsed: number | null }`
  - `interface ChatProvider { readonly name: string; chat(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): Promise<ChatResult> }`
- Produces (`gemini.ts`): `class GeminiChatProvider implements ChatProvider { constructor(apiKey: string, model: string, fetchImpl?: typeof fetch) }` — `name = "gemini"`.

- [ ] **Step 1: Scrivi errors.ts e types.ts (soli tipi/costanti: coperti dai test dei consumer)**

`src/server/ai/errors.ts`:

```ts
/** Errori tipizzati del layer AI: il router li traduce in TRPCError; i messaggi sono già in italiano. */
export class RateLimitedError extends Error {
  constructor() {
    super("Troppe richieste, riprova tra poco.");
    this.name = "RateLimitedError";
  }
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("Assistente non configurato.");
    this.name = "AINotConfiguredError";
  }
}

export class AIUnavailableError extends Error {
  constructor() {
    super("Assistente momentaneamente non disponibile.");
    this.name = "AIUnavailableError";
  }
}

/** Risposta HTTP non-2xx da un provider; lo status guida retry (429/5xx) e fallback. */
export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
  ) {
    super(`${provider}: HTTP ${status}`);
    this.name = "ProviderHttpError";
  }
}
```

`src/server/ai/providers/types.ts`:

```ts
/** Chiamata tool richiesta dal modello. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Dichiarazione tool: JSON Schema dei parametri (formato comune Gemini/OpenAI). */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Messaggio del transcript, indipendente dal provider. Il content del tool è l'output JSON stringificato. */
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface ChatResult {
  text: string | null;
  toolCalls: ToolCall[];
  modelUsed: string;
  tokensUsed: number | null;
}

/** Solo costruzione richiesta + parsing risposta: la resilienza sta nel gateway. */
export interface ChatProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): Promise<ChatResult>;
}
```

- [ ] **Step 2: Test GeminiChatProvider (falliranno)**

`src/server/ai/providers/gemini.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { ProviderHttpError } from "../errors";
import { GeminiChatProvider } from "./gemini";
import type { ChatMessage, ToolDeclaration } from "./types";

const TOOLS: ToolDeclaration[] = [
  { name: "search_products", description: "cerca", parameters: { type: "object", properties: {} } },
];

function fetchReturning(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(payload),
  });
}

const signal = new AbortController().signal;

describe("GeminiChatProvider — richiesta", () => {
  it("mappa system/user/assistant/tool nel formato generateContent", async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchImpl as never);
    const messages: ChatMessage[] = [
      { role: "system", content: "istruzioni" },
      { role: "user", content: "ciao" },
      { role: "assistant", content: null, toolCalls: [{ id: "call_0", name: "search_products", arguments: { query: "x" } }] },
      { role: "tool", toolCallId: "call_0", toolName: "search_products", content: '{"total":0}' },
    ];
    await provider.chat(messages, TOOLS, signal);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("models/gemini-2.5-flash:generateContent");
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": "key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toBe("istruzioni");
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "ciao" }] });
    expect(body.contents[1].parts[0].functionCall).toEqual({ name: "search_products", args: { query: "x" } });
    expect(body.contents[2].parts[0].functionResponse).toEqual({
      name: "search_products",
      response: { result: { total: 0 } },
    });
    expect(body.tools[0].functionDeclarations).toEqual(TOOLS);
  });

  it("omette tools quando la lista è vuota", async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
    const provider = new GeminiChatProvider("key", "m", fetchImpl as never);
    await provider.chat([{ role: "user", content: "ciao" }], [], signal);
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.tools).toBeUndefined();
  });
});

describe("GeminiChatProvider — risposta", () => {
  it("estrae testo e usage", async () => {
    const fetchImpl = fetchReturning({
      candidates: [{ content: { parts: [{ text: "risposta" }] } }],
      usageMetadata: { totalTokenCount: 42 },
    });
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], [], signal);
    expect(result).toEqual({ text: "risposta", toolCalls: [], modelUsed: "gemini-2.5-flash", tokensUsed: 42 });
  });

  it("estrae le functionCall come toolCalls con id sintetici", async () => {
    const fetchImpl = fetchReturning({
      candidates: [{ content: { parts: [{ functionCall: { name: "search_products", args: { query: "cerniera" } } }] } }],
    });
    const provider = new GeminiChatProvider("key", "m", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], TOOLS, signal);
    expect(result.text).toBeNull();
    expect(result.toolCalls).toEqual([{ id: "call_0", name: "search_products", arguments: { query: "cerniera" } }]);
  });

  it("HTTP non-2xx → ProviderHttpError con status", async () => {
    const provider = new GeminiChatProvider("key", "m", fetchReturning({}, 429) as never);
    await expect(provider.chat([{ role: "user", content: "x" }], [], signal)).rejects.toMatchObject({
      name: "ProviderHttpError",
      provider: "gemini",
      status: 429,
    });
    expect(new ProviderHttpError("gemini", 429).status).toBe(429);
  });
});
```

- [ ] **Step 3: Verifica FAIL** — `pnpm vitest run src/server/ai/providers/gemini.test.ts`

- [ ] **Step 4: Implementa gemini.ts**

```ts
import { ProviderHttpError } from "../errors";
import type { ChatMessage, ChatProvider, ChatResult, ToolCall, ToolDeclaration } from "./types";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function toGeminiRequest(messages: ChatMessage[], tools: ToolDeclaration[]) {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => ({ text: m.content }));
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? [])
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      contents.push({ role: "model", parts });
    } else {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.toolName,
              response: { result: JSON.parse(message.content) as unknown },
            },
          },
        ],
      });
    }
  }
  return {
    ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
    contents,
    ...(tools.length > 0 ? { tools: [{ functionDeclarations: tools }] } : {}),
  };
}

export class GeminiChatProvider implements ChatProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async chat(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    signal: AbortSignal,
  ): Promise<ChatResult> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(toGeminiRequest(messages, tools)),
        signal,
      },
    );
    if (!response.ok) throw new ProviderHttpError(this.name, response.status);
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("") || null;
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall)
      .map((p, index) => ({
        id: `call_${index}`,
        name: p.functionCall!.name,
        arguments: p.functionCall!.args ?? {},
      }));
    return {
      text,
      toolCalls,
      modelUsed: this.model,
      tokensUsed: payload.usageMetadata?.totalTokenCount ?? null,
    };
  }
}
```

- [ ] **Step 5: Verifica PASS + commit**

```bash
git add src/server/ai/errors.ts src/server/ai/providers/
git commit -m "feat(ai): errori tipizzati, contratto ChatProvider e provider Gemini"
```

---

### Task 4: KimiChatProvider (Moonshot, OpenAI-compatible)

**Files:**
- Create: `src/server/ai/providers/kimi.ts`
- Test: `src/server/ai/providers/kimi.test.ts`

**Interfaces:**
- Consumes: `ChatProvider`, `ChatMessage`, `ToolDeclaration`, `ChatResult`, `ToolCall` (Task 3); `ProviderHttpError`.
- Produces: `class KimiChatProvider implements ChatProvider { constructor(apiKey: string, model: string, fetchImpl?: typeof fetch) }` — `name = "kimi"`, endpoint `https://api.moonshot.ai/v1/chat/completions`.

- [ ] **Step 1: Test (falliranno)**

`src/server/ai/providers/kimi.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { KimiChatProvider } from "./kimi";
import type { ChatMessage, ToolDeclaration } from "./types";

const TOOLS: ToolDeclaration[] = [
  { name: "search_products", description: "cerca", parameters: { type: "object", properties: {} } },
];

function fetchReturning(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(payload),
  });
}

const signal = new AbortController().signal;

describe("KimiChatProvider", () => {
  it("mappa i messaggi nel formato OpenAI (tool_calls e role tool)", async () => {
    const fetchImpl = fetchReturning({ choices: [{ message: { content: "ok" } }] });
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchImpl as never);
    const messages: ChatMessage[] = [
      { role: "system", content: "istruzioni" },
      { role: "user", content: "ciao" },
      { role: "assistant", content: null, toolCalls: [{ id: "c1", name: "search_products", arguments: { query: "x" } }] },
      { role: "tool", toolCallId: "c1", toolName: "search_products", content: '{"total":0}' },
    ];
    await provider.chat(messages, TOOLS, signal);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("kimi-k2.6");
    expect(body.messages[0]).toEqual({ role: "system", content: "istruzioni" });
    expect(body.messages[2].tool_calls[0]).toEqual({
      id: "c1",
      type: "function",
      function: { name: "search_products", arguments: '{"query":"x"}' },
    });
    expect(body.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: '{"total":0}' });
    expect(body.tools[0]).toEqual({ type: "function", function: TOOLS[0] });
  });

  it("estrae testo, tool_calls (argomenti JSON) e usage", async () => {
    const fetchImpl = fetchReturning({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: "c9", function: { name: "search_products", arguments: '{"query":"cerniera"}' } }],
          },
        },
      ],
      usage: { total_tokens: 17 },
    });
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], TOOLS, signal);
    expect(result.toolCalls).toEqual([{ id: "c9", name: "search_products", arguments: { query: "cerniera" } }]);
    expect(result.text).toBeNull();
    expect(result.tokensUsed).toBe(17);
    expect(result.modelUsed).toBe("kimi-k2.6");
  });

  it("argomenti tool con JSON invalido → oggetto vuoto (il modello riformulerà)", async () => {
    const fetchImpl = fetchReturning({
      choices: [{ message: { tool_calls: [{ id: "c1", function: { name: "t", arguments: "{rotto" } }] } }],
    });
    const provider = new KimiChatProvider("key", "m", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "x" }], TOOLS, signal);
    expect(result.toolCalls[0]!.arguments).toEqual({});
  });

  it("HTTP non-2xx → ProviderHttpError", async () => {
    const provider = new KimiChatProvider("key", "m", fetchReturning({}, 503) as never);
    await expect(provider.chat([{ role: "user", content: "x" }], [], signal)).rejects.toMatchObject({
      provider: "kimi",
      status: 503,
    });
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/ai/providers/kimi.test.ts`

- [ ] **Step 3: Implementa kimi.ts**

```ts
import { ProviderHttpError } from "../errors";
import type { ChatMessage, ChatProvider, ChatResult, ToolCall, ToolDeclaration } from "./types";

type KimiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

function toKimiMessages(messages: ChatMessage[]): KimiMessage[] {
  return messages.map((message): KimiMessage => {
    if (message.role === "assistant") {
      const toolCalls = (message.toolCalls ?? []).map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      }));
      return {
        role: "assistant",
        content: message.content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };
    }
    if (message.role === "tool")
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    return { role: message.role, content: message.content };
  });
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class KimiChatProvider implements ChatProvider {
  readonly name = "kimi";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async chat(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    signal: AbortSignal,
  ): Promise<ChatResult> {
    const response = await this.fetchImpl("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: toKimiMessages(messages),
        ...(tools.length > 0
          ? { tools: tools.map((tool) => ({ type: "function", function: tool })) }
          : {}),
      }),
      signal,
    });
    if (!response.ok) throw new ProviderHttpError(this.name, response.status);
    const payload = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
      usage?: { total_tokens?: number };
    };
    const message = payload.choices?.[0]?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call, index) => ({
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? "",
      arguments: parseArguments(call.function?.arguments),
    }));
    return {
      text: message?.content ?? null,
      toolCalls,
      modelUsed: this.model,
      tokensUsed: payload.usage?.total_tokens ?? null,
    };
  }
}
```

- [ ] **Step 4: Verifica PASS + commit**

```bash
git add src/server/ai/providers/kimi.ts src/server/ai/providers/kimi.test.ts
git commit -m "feat(ai): provider Kimi (Moonshot, API OpenAI-compatible)"
```

---

### Task 5: AIGateway (catena rate limit → breaker → retry → fallback)

**Files:**
- Create: `src/server/ai/gateway.ts`
- Test: `src/server/ai/gateway.test.ts`

**Interfaces:**
- Consumes: `CircuitBreaker` (Task 1), `RateLimiter` (Task 2), `ChatProvider`/`ChatResult` (Task 3), `EmbeddingService`/`GeminiEmbeddingService` (esistenti), errori (Task 3), `getRedis` (Task 1).
- Produces:
  - `interface GatewayDeps { providers: ChatProvider[]; breaker: CircuitBreaker; limiter: RateLimiter; queryEmbeddings?: EmbeddingService; timeoutMs?: number; sleep?: (ms: number) => Promise<void> }`
  - `class AIGateway { constructor(deps: GatewayDeps); chat(messages, tools, opts: { userId: string }): Promise<ChatResult>; embedQuery(text: string): Promise<number[] | null>; queryEmbeddings(): EmbeddingService | undefined }`
  - `getAIGateway(): AIGateway` — singleton di produzione costruito dalle env (provider solo se la key esiste).
  - Costanti: `USER_RPM = 20`, `PROVIDER_RPM = 15` (budget prudenziale free-tier), finestra 60s.
  - `queryEmbeddings()` ritorna un adapter `EmbeddingService` che lancia se `embedQuery` dà `null` (il RAGEngine lo cattura e degrada — Task 6).

- [ ] **Step 1: Test (falliranno)**

`src/server/ai/gateway.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { CircuitBreaker } from "./breaker";
import { RateLimiter } from "./ratelimit";
import { ProviderHttpError } from "./errors";
import { AIGateway } from "./gateway";
import type { ChatProvider, ChatResult } from "./providers/types";

const OK: ChatResult = { text: "ok", toolCalls: [], modelUsed: "m", tokensUsed: 1 };

function provider(name: string, impl: () => Promise<ChatResult>): ChatProvider & { chat: ReturnType<typeof vi.fn> } {
  return { name, chat: vi.fn(impl) } as never;
}

let redis: FakeRedis;

function gateway(providers: ChatProvider[], overrides: Partial<ConstructorParameters<typeof AIGateway>[0]> = {}) {
  return new AIGateway({
    providers,
    breaker: new CircuitBreaker(redis),
    limiter: new RateLimiter(redis, () => 0),
    sleep: () => Promise.resolve(),
    ...overrides,
  });
}

beforeEach(() => {
  redis = new FakeRedis();
});

describe("AIGateway.chat", () => {
  it("senza provider configurati → AINotConfiguredError", async () => {
    await expect(gateway([]).chat([], [], { userId: "u1" })).rejects.toMatchObject({
      name: "AINotConfiguredError",
    });
  });

  it("oltre 20 msg/min per utente → RateLimitedError", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    const gw = gateway([gemini]);
    for (let i = 0; i < 20; i++) await gw.chat([], [], { userId: "u1" });
    await expect(gw.chat([], [], { userId: "u1" })).rejects.toMatchObject({ name: "RateLimitedError" });
  });

  it("primo provider ok → risponde e registra il successo", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    const result = await gateway([gemini]).chat([], [], { userId: "u1" });
    expect(result).toEqual(OK);
    expect(gemini.chat).toHaveBeenCalledTimes(1);
  });

  it("429 → 1 retry sullo stesso provider, poi fallback", async () => {
    const gemini = provider("gemini", () => Promise.reject(new ProviderHttpError("gemini", 429)));
    const kimi = provider("kimi", () => Promise.resolve(OK));
    const result = await gateway([gemini, kimi]).chat([], [], { userId: "u1" });
    expect(result).toEqual(OK);
    expect(gemini.chat).toHaveBeenCalledTimes(2); // 1 + 1 retry
    expect(kimi.chat).toHaveBeenCalledTimes(1);
  });

  it("errore non ritentabile (es. 400) → niente retry, fallback diretto", async () => {
    const gemini = provider("gemini", () => Promise.reject(new ProviderHttpError("gemini", 400)));
    const kimi = provider("kimi", () => Promise.resolve(OK));
    await gateway([gemini, kimi]).chat([], [], { userId: "u1" });
    expect(gemini.chat).toHaveBeenCalledTimes(1);
  });

  it("breaker aperto → salta il provider senza chiamarlo", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    const kimi = provider("kimi", () => Promise.resolve(OK));
    const breaker = new CircuitBreaker(redis);
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    await gateway([gemini, kimi], { breaker }).chat([], [], { userId: "u1" });
    expect(gemini.chat).not.toHaveBeenCalled();
    expect(kimi.chat).toHaveBeenCalledTimes(1);
  });

  it("tutti i provider giù → AIUnavailableError e fallimenti registrati", async () => {
    const gemini = provider("gemini", () => Promise.reject(new ProviderHttpError("gemini", 500)));
    const kimi = provider("kimi", () => Promise.reject(new ProviderHttpError("kimi", 500)));
    const gw = gateway([gemini, kimi]);
    await expect(gw.chat([], [], { userId: "u1" })).rejects.toMatchObject({ name: "AIUnavailableError" });
    expect(await redis.get("cb:gemini:fail")).toBe("1");
    expect(await redis.get("cb:kimi:fail")).toBe("1");
  });
});

describe("AIGateway.embedQuery", () => {
  it("senza servizio embedding → null", async () => {
    expect(await gateway([]).embedQuery("cerniera")).toBeNull();
  });

  it("errore del servizio → null (degrado silenzioso)", async () => {
    const gw = gateway([], {
      queryEmbeddings: { generate: () => Promise.reject(new Error("giù")) },
    });
    expect(await gw.embedQuery("cerniera")).toBeNull();
  });

  it("successo → vettore", async () => {
    const gw = gateway([], { queryEmbeddings: { generate: () => Promise.resolve([1, 0]) } });
    expect(await gw.embedQuery("cerniera")).toEqual([1, 0]);
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/ai/gateway.test.ts`

- [ ] **Step 3: Implementa gateway.ts**

```ts
import "server-only";
import { env } from "@/env";
import { CircuitBreaker } from "./breaker";
import { RateLimiter } from "./ratelimit";
import { getRedis } from "./redis";
import { GeminiEmbeddingService, type EmbeddingService } from "./embedding";
import { AINotConfiguredError, AIUnavailableError, ProviderHttpError, RateLimitedError } from "./errors";
import { GeminiChatProvider } from "./providers/gemini";
import { KimiChatProvider } from "./providers/kimi";
import type { ChatMessage, ChatProvider, ChatResult, ToolDeclaration } from "./providers/types";

export interface GatewayDeps {
  providers: ChatProvider[];
  breaker: CircuitBreaker;
  limiter: RateLimiter;
  queryEmbeddings?: EmbeddingService;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const USER_RPM = 20;
const PROVIDER_RPM = 15; // budget prudenziale free-tier, condiviso tra gli utenti
const WINDOW_SEC = 60;
const DEFAULT_TIMEOUT_MS = 30_000;

function isRetriable(error: unknown): boolean {
  return error instanceof ProviderHttpError && (error.status === 429 || error.status >= 500);
}

/** Adapter EmbeddingService → embedQuery: lancia su null, il RAGEngine cattura e degrada. */
class QueryEmbeddings implements EmbeddingService {
  constructor(private readonly gateway: AIGateway) {}

  async generate(text: string): Promise<number[]> {
    const vector = await this.gateway.embedQuery(text);
    if (!vector) throw new Error("Embedding query non disponibile");
    return vector;
  }
}

/**
 * UNICO punto di uscita verso i provider AI (regola di progetto, come il
 * RAGEngine per il raw SQL): rate limit per utente e per provider, circuit
 * breaker distribuito, timeout 30s, 1 retry con jitter su 429/5xx, fallback
 * Gemini→Kimi. Qualunque errore di un provider fa scattare il fallback.
 */
export class AIGateway {
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: GatewayDeps) {
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    opts: { userId: string },
  ): Promise<ChatResult> {
    if (this.deps.providers.length === 0) throw new AINotConfiguredError();
    if (!(await this.deps.limiter.consume(`user:${opts.userId}`, USER_RPM, WINDOW_SEC)))
      throw new RateLimitedError();

    for (const provider of this.deps.providers) {
      if (await this.deps.breaker.isOpen(provider.name)) continue;
      if (!(await this.deps.limiter.consume(`provider:${provider.name}`, PROVIDER_RPM, WINDOW_SEC)))
        continue;
      try {
        const result = await this.callWithRetry(provider, messages, tools);
        await this.deps.breaker.recordSuccess(provider.name);
        return result;
      } catch (error) {
        console.warn(`AIGateway: provider ${provider.name} fallito`, error);
        await this.deps.breaker.recordFailure(provider.name);
      }
    }
    throw new AIUnavailableError();
  }

  /** Embedding della query di ricerca: null su qualunque errore → degrado al ramo testuale. */
  async embedQuery(text: string): Promise<number[] | null> {
    if (!this.deps.queryEmbeddings) return null;
    try {
      return await this.deps.queryEmbeddings.generate(text);
    } catch (error) {
      console.warn("AIGateway.embedQuery fallito, degrado al testuale:", error);
      return null;
    }
  }

  /** EmbeddingService per il RAGEngine, o undefined se Gemini non è configurato. */
  queryEmbeddings(): EmbeddingService | undefined {
    return this.deps.queryEmbeddings ? new QueryEmbeddings(this) : undefined;
  }

  private async callWithRetry(
    provider: ChatProvider,
    messages: ChatMessage[],
    tools: ToolDeclaration[],
  ): Promise<ChatResult> {
    try {
      return await provider.chat(messages, tools, AbortSignal.timeout(this.timeoutMs));
    } catch (error) {
      if (!isRetriable(error)) throw error;
      await this.sleep(200 + Math.random() * 400); // jitter
      return provider.chat(messages, tools, AbortSignal.timeout(this.timeoutMs));
    }
  }
}

let singleton: AIGateway | null = null;

/** Gateway di produzione: provider costruiti dalle env (solo quelli con la key). */
export function getAIGateway(): AIGateway {
  if (singleton) return singleton;
  const redis = getRedis();
  const providers: ChatProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push(new GeminiChatProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL));
  if (env.KIMI_API_KEY) providers.push(new KimiChatProvider(env.KIMI_API_KEY, env.KIMI_MODEL));
  const queryEmbeddings = env.GEMINI_API_KEY
    ? new GeminiEmbeddingService(env.GEMINI_API_KEY, "RETRIEVAL_QUERY", (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
      )
    : undefined;
  singleton = new AIGateway({
    providers,
    breaker: new CircuitBreaker(redis),
    limiter: new RateLimiter(redis),
    queryEmbeddings,
  });
  return singleton;
}
```

- [ ] **Step 4: Verifica PASS + suite completa + commit**

Run: `pnpm vitest run src/server/ai/` → tutti PASS.

```bash
git add src/server/ai/gateway.ts src/server/ai/gateway.test.ts
git commit -m "feat(ai): AIGateway — rate limit, breaker, retry con jitter, fallback Gemini→Kimi"
```

---

### Task 6: RAGEngine — degrado embedding + lettura/scrittura vettori

**Files:**
- Modify: `src/server/ai/rag.ts`
- Test: `src/server/ai/rag.test.ts` (aggiunte), `src/server/ai/rag.integration.test.ts` (aggiunte)

**Interfaces:**
- Consumes: `EmbeddingService` (esistente).
- Produces (in aggiunta all'esistente):
  - `interface UnembeddedProduct { id: string; name: string; shortDescription: string | null; specifications: Record<string, unknown> | null }`
  - `RAGEngine.listUnembedded(limit: number): Promise<UnembeddedProduct[]>`
  - `RAGEngine.storeEmbeddings(items: { id: string; embedding: number[] }[]): Promise<void>`
  - `RAGEngine.search` non propaga MAI errori dell'EmbeddingService (degrada al testuale).
  - `RagDb` diventa `Pick<PrismaClient, "$queryRaw" | "$executeRaw">`.
  - `rag.ts` perde `import "server-only"` (riusato dallo script tsx `embed-products`, stesso pattern dei moduli catalog).

- [ ] **Step 1: Aggiungi i test (falliranno)**

In `src/server/ai/rag.test.ts` aggiungi in fondo (il fake `db` esistente va esteso: sostituisci `const db = { $queryRaw: queryRaw } as never;` con:

```ts
const executeRaw = vi.fn();
const db = { $queryRaw: queryRaw, $executeRaw: executeRaw } as never;
```

e nel `beforeEach` aggiungi `executeRaw.mockReset();` dentro il body — attenzione al bug noto: body con graffe, mai arrow senza graffe):

```ts
describe("RAGEngine — degrado su embedding fallito", () => {
  it("se l'EmbeddingService lancia, usa il solo ramo testuale senza propagare", async () => {
    const broken = { generate: () => Promise.reject(new Error("Gemini giù")) };
    const result = await new RAGEngine(db, broken).search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).not.toContain("<=>");
    expect(result.hits).toEqual([hit]);
  });
});

describe("RAGEngine — embedding dei prodotti (batch)", () => {
  it("listUnembedded seleziona solo prodotti senza embedding", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([]);
    await new RAGEngine(db).listUnembedded(100);
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("embedding IS NULL");
    expect(query.values).toContain(100);
  });

  it("storeEmbeddings esegue un UPDATE parametrizzato per prodotto", async () => {
    executeRaw.mockResolvedValue(1);
    await new RAGEngine(db).storeEmbeddings([
      { id: "p1", embedding: [0.1, 0.2] },
      { id: "p2", embedding: [0.3, 0.4] },
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const update = sqlOf(executeRaw.mock.calls[0]!);
    expect(update.sql).toContain("UPDATE products SET embedding");
    expect(update.values).toContain("[0.1,0.2]");
    expect(update.values).toContain("p1");
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/ai/rag.test.ts`

- [ ] **Step 3: Modifica rag.ts**

1. Rimuovi la riga `import "server-only";` e aggiorna il commento di testa del modulo aggiungendo: `// NB: niente "server-only": il modulo è riusato dallo script tsx embed-products (stesso pattern di src/server/catalog/*).`
2. `type RagDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;`
3. In `search`, sostituisci la riga `const embedding = this.embeddings ? await this.embeddings.generate(query) : null;` con:

```ts
    let embedding: number[] | null = null;
    if (this.embeddings) {
      try {
        embedding = await this.embeddings.generate(query);
      } catch {
        embedding = null; // embedding giù → la ricerca degrada al solo ramo testuale
      }
    }
```

4. Aggiungi in fondo alla classe:

```ts
  /** Prodotti ancora senza embedding: lo script batch pagina su questa query (checkpoint gratuito). */
  listUnembedded(limit: number): Promise<UnembeddedProduct[]> {
    return this.db.$queryRaw<UnembeddedProduct[]>(Prisma.sql`
      SELECT p.id, p.name, p.short_description AS "shortDescription", p.specifications
      FROM products p
      WHERE p.embedding IS NULL
      ORDER BY p.agb_code ASC
      LIMIT ${limit}`);
  }

  /** Unico punto di scrittura dei vettori (L2-normalizzati, EMBEDDING_DIM). */
  async storeEmbeddings(items: { id: string; embedding: number[] }[]): Promise<void> {
    for (const item of items) {
      await this.db.$executeRaw(Prisma.sql`
        UPDATE products SET embedding = ${`[${item.embedding.join(",")}]`}::vector
        WHERE id = ${item.id}`);
    }
  }
```

e l'interfaccia a livello di modulo, vicino agli altri tipi:

```ts
export interface UnembeddedProduct {
  id: string;
  name: string;
  shortDescription: string | null;
  specifications: Record<string, unknown> | null;
}
```

- [ ] **Step 4: Aggiungi il test di integrazione del ramo vettoriale**

In `src/server/ai/rag.integration.test.ts`, aggiungi `FakeEmbeddingService` all'import da `./embedding` e in fondo al `describe` esistente:

```ts
  it("storeEmbeddings + ricerca ibrida: il ramo vettoriale contribuisce al ranking", async () => {
    const fake = new FakeEmbeddingService();
    const unembedded = await engine.listUnembedded(100);
    expect(unembedded.length).toBeGreaterThan(0);
    const items = await Promise.all(
      unembedded.map(async (p) => ({ id: p.id, embedding: await fake.generate(p.name) })),
    );
    await engine.storeEmbeddings(items);
    expect((await engine.listUnembedded(100)).length).toBe(0);

    const hybrid = new RAGEngine(db, fake);
    const result = await hybrid.search("cerniera");
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.some((h) => h.vectorScore > 0)).toBe(true);
  });
```

- [ ] **Step 5: Verifica PASS + commit**

Run: `pnpm vitest run src/server/ai/rag.test.ts` → PASS (l'integrazione resta skippata senza `INTEGRATION_DATABASE_URL`; se il DB Docker è su, esegui anche `INTEGRATION_DATABASE_URL=<url> pnpm vitest run src/server/ai/rag.integration.test.ts`).

```bash
git add src/server/ai/rag.ts src/server/ai/rag.test.ts src/server/ai/rag.integration.test.ts
git commit -m "feat(rag): scrittura/lettura embedding prodotti + degrado su embedding fallito"
```

---

### Task 7: GeminiEmbeddingService.generateBatch + testo prodotto

**Files:**
- Modify: `src/server/ai/embedding.ts`
- Create: `src/server/ai/product-text.ts`
- Test: `src/server/ai/embedding.test.ts` (aggiunte), `src/server/ai/product-text.test.ts`

**Interfaces:**
- Consumes: `UnembeddedProduct` (Task 6), `EMBEDDING_DIM`/`EMBEDDING_MODEL` (esistenti).
- Produces:
  - `class HttpStatusError extends Error { status: number }` (in `embedding.ts`; `generate` e `generateBatch` la lanciano su HTTP non-2xx — lo script fa backoff su 429/5xx)
  - `GeminiEmbeddingService.generateBatch(texts: string[]): Promise<number[][]>` — ≤100 testi, `batchEmbedContents`, vettori L2-normalizzati.
  - `embeddingText(p: UnembeddedProduct): string` (in `product-text.ts`) — `name · shortDescription · materiale/dimensione/finitura`.
  - `embedding.ts` perde `import "server-only"` (riusato dallo script tsx).

- [ ] **Step 1: Test (falliranno)**

In `src/server/ai/embedding.test.ts` aggiungi (adatta gli import esistenti: servono `GeminiEmbeddingService`, `HttpStatusError`, `EMBEDDING_DIM` da `@/server/constants/embedding`):

```ts
describe("GeminiEmbeddingService.generateBatch", () => {
  const vector = Array.from({ length: EMBEDDING_DIM }, () => 0.5);

  function fetchReturning(payload: unknown, status = 200) {
    return vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(payload) });
  }

  it("una richiesta batchEmbedContents con taskType e dimensioni", async () => {
    const fetchImpl = fetchReturning({ embeddings: [{ values: vector }, { values: vector }] });
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", fetchImpl as never);
    const result = await service.generateBatch(["a", "b"]);
    expect(result).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain(":batchEmbedContents");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toMatchObject({
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIM,
      content: { parts: [{ text: "a" }] },
    });
  });

  it("normalizza L2 ogni vettore del batch", async () => {
    const service = new GeminiEmbeddingService(
      "key",
      "RETRIEVAL_DOCUMENT",
      fetchReturning({ embeddings: [{ values: vector }] }) as never,
    );
    const [first] = await service.generateBatch(["a"]);
    const norm = Math.sqrt(first!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("rifiuta più di 100 testi", async () => {
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", vi.fn() as never);
    await expect(service.generateBatch(Array.from({ length: 101 }, () => "x"))).rejects.toThrow(/100/);
  });

  it("batch vuoto → [] senza chiamate", async () => {
    const fetchImpl = vi.fn();
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", fetchImpl as never);
    expect(await service.generateBatch([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("HTTP 429 → HttpStatusError con status (per il backoff dello script)", async () => {
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", fetchReturning({}, 429) as never);
    await expect(service.generateBatch(["a"])).rejects.toMatchObject({ status: 429 });
  });

  it("conteggio embeddings diverso dai testi → errore", async () => {
    const service = new GeminiEmbeddingService(
      "key",
      "RETRIEVAL_DOCUMENT",
      fetchReturning({ embeddings: [{ values: vector }] }) as never,
    );
    await expect(service.generateBatch(["a", "b"])).rejects.toThrow(/incompleto/i);
  });
});
```

`src/server/ai/product-text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { embeddingText } from "./product-text";

describe("embeddingText", () => {
  it("compone nome, shortDescription e specifiche note", () => {
    expect(
      embeddingText({
        id: "p1",
        name: "COMPACT Nichelato opaco DX",
        shortDescription: "Cerniere · Per porte a filo · ACCIAIO",
        specifications: { materiale: "ACCIAIO", dimensione: "60 mm", finitura: "Nichelato", colonne: {} },
      }),
    ).toBe("COMPACT Nichelato opaco DX · Cerniere · Per porte a filo · ACCIAIO · ACCIAIO · 60 mm · Nichelato");
  });

  it("ignora campi mancanti o non-stringa", () => {
    expect(
      embeddingText({ id: "p1", name: "X", shortDescription: null, specifications: { materiale: 3 } }),
    ).toBe("X");
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/ai/embedding.test.ts src/server/ai/product-text.test.ts`

- [ ] **Step 3: Implementa**

In `embedding.ts`:
1. Rimuovi `import "server-only";` con commento: `// NB: niente "server-only": riusato dallo script tsx embed-products.`
2. Aggiorna il commento della classe (non è più "NON cablato": ora è cablata dal gateway per le query e dallo script per il batch).
3. Aggiungi la classe errore e usala anche in `generate` (stesso messaggio di prima):

```ts
/** HTTP non-2xx dall'API embedding: lo status guida il backoff dello script batch. */
export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}
```

In `generate`, sostituisci `throw new Error(...)` HTTP con `throw new HttpStatusError(\`Gemini embedContent fallito: HTTP ${response.status}\`, response.status);`

4. Aggiungi il metodo alla classe `GeminiEmbeddingService`:

```ts
  /** Embedding batch: ≤100 testi per richiesta batchEmbedContents, vettori L2-normalizzati. */
  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > 100) throw new Error("Massimo 100 testi per batchEmbedContents");
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            taskType: this.taskType,
            outputDimensionality: EMBEDDING_DIM,
          })),
        }),
      },
    );
    if (!response.ok)
      throw new HttpStatusError(
        `Gemini batchEmbedContents fallito: HTTP ${response.status}`,
        response.status,
      );
    const payload = (await response.json()) as { embeddings?: { values?: number[] }[] };
    const embeddings = payload.embeddings ?? [];
    if (embeddings.length !== texts.length)
      throw new Error(`Batch incompleto: attesi ${texts.length} embedding, ricevuti ${embeddings.length}`);
    return embeddings.map((entry) => {
      const values = entry.values ?? [];
      if (values.length !== EMBEDDING_DIM)
        throw new Error(`Embedding non valido: attese ${EMBEDDING_DIM} dimensioni, ricevute ${values.length}`);
      return l2Normalize(values);
    });
  }
```

`src/server/ai/product-text.ts`:

```ts
import type { UnembeddedProduct } from "./rag";

const SPEC_KEYS = ["materiale", "dimensione", "finitura"] as const;

/** Testo da embeddare per un prodotto: nome + shortDescription + specifiche chiave. */
export function embeddingText(product: UnembeddedProduct): string {
  const spec = product.specifications ?? {};
  const extras = SPEC_KEYS.map((key) => spec[key]).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [product.name, product.shortDescription, ...extras]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
```

- [ ] **Step 4: Verifica PASS (incluse le vecchie asserzioni di embedding.test.ts) + commit**

Run: `pnpm vitest run src/server/ai/` → PASS.

```bash
git add src/server/ai/embedding.ts src/server/ai/embedding.test.ts src/server/ai/product-text.ts src/server/ai/product-text.test.ts
git commit -m "feat(ai): generateBatch per gli embedding prodotto + composizione testo"
```

---

### Task 8: Script batch `scripts/embed-products.ts`

**Files:**
- Create: `scripts/embed-products.ts`

**Interfaces:**
- Consumes: `RAGEngine.listUnembedded/storeEmbeddings` (Task 6), `GeminiEmbeddingService.generateBatch` + `HttpStatusError` (Task 7), `embeddingText` (Task 7).
- Produces: `pnpm embed:products` — idempotente e riavviabile (pagina su `embedding IS NULL`), backoff esponenziale su 429/5xx. La logica è tutta in moduli già testati: lo script è solo il loop (stesso pattern di `import-agb.ts`, senza test proprio).

- [ ] **Step 1: Scrivi lo script**

```ts
// Embedding batch del catalogo: pnpm embed:products
// Idempotente e riavviabile: pagina su WHERE embedding IS NULL, quindi ogni run
// riparte da dove si era fermato e dopo un re-import calcola solo i nuovi.
import { PrismaClient } from "@prisma/client";
import { GeminiEmbeddingService, HttpStatusError } from "../src/server/ai/embedding";
import { embeddingText } from "../src/server/ai/product-text";
import { RAGEngine } from "../src/server/ai/rag";

const BATCH_SIZE = 100; // limite batchEmbedContents
const MAX_ATTEMPTS = 5;

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let delayMs = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retriable =
        error instanceof HttpStatusError && (error.status === 429 || error.status >= 500);
      if (!retriable || attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`  Tentativo ${attempt} fallito (${error.message}), retry tra ${delayMs}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY mancante: aggiungila a .env prima di lanciare l'embedding.");
    process.exit(1);
  }
  const db = new PrismaClient();
  const engine = new RAGEngine(db);
  const service = new GeminiEmbeddingService(apiKey, "RETRIEVAL_DOCUMENT");
  let done = 0;
  try {
    for (;;) {
      const batch = await engine.listUnembedded(BATCH_SIZE);
      if (batch.length === 0) break;
      const vectors = await withBackoff(() => service.generateBatch(batch.map(embeddingText)));
      await engine.storeEmbeddings(batch.map((product, i) => ({ id: product.id, embedding: vectors[i]! })));
      done += batch.length;
      console.log(`✓ ${done} prodotti embeddati…`);
    }
    console.log(done === 0 ? "Niente da fare: tutti i prodotti hanno già l'embedding." : `Completato: ${done} embedding generati.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Verifica il comportamento senza key (exit 1 con messaggio)**

Run: `set -a; source .env; set +a; GEMINI_API_KEY= pnpm embed:products || echo "exit=$?"`
Expected: messaggio «GEMINI_API_KEY mancante…» e `exit=1`.

- [ ] **Step 3: Gates parziali + commit**

Run: `pnpm typecheck && pnpm lint` → verdi.

```bash
git add scripts/embed-products.ts
git commit -m "feat(ai): script idempotente embed:products (batch 100, backoff 429/5xx)"
```

---

### Task 9: Tool della chat (`search_products`, `get_product_by_code`)

**Files:**
- Create: `src/server/chat/tools.ts`
- Test: `src/server/chat/tools.test.ts`

**Interfaces:**
- Consumes: `RAGEngine` (Task 6), `EmbeddingService`, `ToolDeclaration` (Task 3).
- Produces:
  - `TOOL_DECLARATIONS: ToolDeclaration[]` (i due tool)
  - `type ToolDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "product">`
  - `interface ToolExecution { output: unknown; productIds: string[] }`
  - `executeTool(db: ToolDb, name: string, args: Record<string, unknown>, embeddings?: EmbeddingService): Promise<ToolExecution>` — MAI lancia per input invalidi: ritorna `{ output: { error } }` così il modello può riformulare.

- [ ] **Step 1: Test (falliranno)**

`src/server/chat/tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOOL_DECLARATIONS, executeTool, type ToolDb } from "./tools";

const queryRaw = vi.fn();
const executeRaw = vi.fn();
const findUnique = vi.fn();
const db = { $queryRaw: queryRaw, $executeRaw: executeRaw, product: { findUnique } } as unknown as ToolDb;

const hit = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: "Cerniere · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 0,
  categoryId: "c1",
  categoryName: "Cerniere",
  textScore: 0.6,
  vectorScore: 0,
  score: 0.6,
};

beforeEach(() => {
  queryRaw.mockReset();
  executeRaw.mockReset();
  findUnique.mockReset();
});

describe("TOOL_DECLARATIONS", () => {
  it("dichiara i due tool con query/agbCode obbligatori", () => {
    expect(TOOL_DECLARATIONS.map((t) => t.name)).toEqual(["search_products", "get_product_by_code"]);
    expect(TOOL_DECLARATIONS[0]!.parameters).toMatchObject({ required: ["query"] });
    expect(TOOL_DECLARATIONS[1]!.parameters).toMatchObject({ required: ["agbCode"] });
  });
});

describe("executeTool — search_products", () => {
  it("cerca via RAGEngine e ritorna risultati compatti + productIds", async () => {
    queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);
    const execution = await executeTool(db, "search_products", { query: "cerniera" });
    expect(execution.productIds).toEqual(["p1"]);
    expect(execution.output).toMatchObject({
      total: 1,
      results: [{ agbCode: "E10073.10.16", name: "COMPACT DX", price: 51.59, category: "Cerniere" }],
    });
  });

  it("argomenti invalidi → output d'errore, nessuna query", async () => {
    const execution = await executeTool(db, "search_products", { query: "" });
    expect(execution.productIds).toEqual([]);
    expect(execution.output).toMatchObject({ error: expect.stringContaining("non valid") });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("limit oltre 10 → output d'errore (il modello riformula)", async () => {
    const execution = await executeTool(db, "search_products", { query: "x", limit: 50 });
    expect(execution.output).toMatchObject({ error: expect.any(String) });
  });
});

describe("executeTool — get_product_by_code", () => {
  it("trovato → scheda con specifiche e productIds", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      agbCode: "B00590.15.03",
      name: "Serratura",
      shortDescription: null,
      basePrice: { toString: () => "10.5" },
      priceUnit: "EUR",
      isAvailable: true,
      stockQuantity: 3,
      specifications: { materiale: "ACCIAIO" },
      category: { name: "Serrature" },
    });
    const execution = await executeTool(db, "get_product_by_code", { agbCode: "B00590.15.03" });
    expect(execution.productIds).toEqual(["p1"]);
    expect(execution.output).toMatchObject({ agbCode: "B00590.15.03", price: 10.5, category: "Serrature" });
  });

  it("non trovato → output d'errore, productIds vuoto", async () => {
    findUnique.mockResolvedValue(null);
    const execution = await executeTool(db, "get_product_by_code", { agbCode: "X999" });
    expect(execution.productIds).toEqual([]);
    expect(execution.output).toMatchObject({ error: expect.stringContaining("X999") });
  });
});

describe("executeTool — tool sconosciuto", () => {
  it("ritorna un errore parlante", async () => {
    const execution = await executeTool(db, "boh", {});
    expect(execution.output).toMatchObject({ error: expect.stringContaining("boh") });
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/chat/tools.test.ts`

- [ ] **Step 3: Implementa tools.ts**

```ts
import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { EmbeddingService } from "@/server/ai/embedding";
import { RAGEngine } from "@/server/ai/rag";
import type { ToolDeclaration } from "@/server/ai/providers/types";

export type ToolDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "product">;

export interface ToolExecution {
  /** JSON-serializzabile: torna al modello come functionResponse/tool message. */
  output: unknown;
  /** Prodotti citati, per referencedProductIds del messaggio ASSISTANT. */
  productIds: string[];
}

export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: "search_products",
    description:
      "Cerca prodotti nel catalogo AGB per nome, descrizione, categoria o prefisso del codice. Ritorna i migliori risultati ordinati per pertinenza.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termini di ricerca in italiano o prefisso codice AGB" },
        limit: { type: "integer", minimum: 1, maximum: 10, description: "Numero massimo di risultati (default 5)" },
        material: { type: "string", description: "Filtro materiale, es. ACCIAIO, ZAMA" },
        priceMax: { type: "number", description: "Prezzo massimo in EUR" },
        inStockOnly: { type: "boolean", description: "Solo prodotti disponibili" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_by_code",
    description: "Recupera la scheda completa di un prodotto dato il codice AGB esatto.",
    parameters: {
      type: "object",
      properties: {
        agbCode: { type: "string", description: "Codice AGB esatto, es. B00590.15.03" },
      },
      required: ["agbCode"],
    },
  },
];

const searchArgs = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(10).default(5),
  material: z.string().min(1).max(50).optional(),
  priceMax: z.number().nonnegative().optional(),
  inStockOnly: z.boolean().optional(),
});

const codeArgs = z.object({ agbCode: z.string().trim().min(1).max(20) });

function invalidArgs(error: z.ZodError): ToolExecution {
  const details = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { output: { error: `Argomenti non validi — ${details}` }, productIds: [] };
}

/** Esegue un tool. MAI lancia per input errati: l'errore torna al modello, che può riformulare. */
export async function executeTool(
  db: ToolDb,
  name: string,
  args: Record<string, unknown>,
  embeddings?: EmbeddingService,
): Promise<ToolExecution> {
  if (name === "search_products") {
    const parsed = searchArgs.safeParse(args);
    if (!parsed.success) return invalidArgs(parsed.error);
    const { query, limit, ...filters } = parsed.data;
    const result = await new RAGEngine(db, embeddings).search(query, filters, { limit });
    return {
      output: {
        total: result.total,
        results: result.hits.map((hit) => ({
          agbCode: hit.agbCode,
          name: hit.name,
          shortDescription: hit.shortDescription,
          price: hit.basePrice,
          available: hit.isAvailable,
          category: hit.categoryName,
        })),
      },
      productIds: result.hits.map((hit) => hit.id),
    };
  }

  if (name === "get_product_by_code") {
    const parsed = codeArgs.safeParse(args);
    if (!parsed.success) return invalidArgs(parsed.error);
    const product = await db.product.findUnique({
      where: { agbCode: parsed.data.agbCode },
      include: { category: true },
    });
    if (!product)
      return { output: { error: `Nessun prodotto con codice ${parsed.data.agbCode}` }, productIds: [] };
    return {
      output: {
        agbCode: product.agbCode,
        name: product.name,
        shortDescription: product.shortDescription,
        price: Number(product.basePrice),
        priceUnit: product.priceUnit,
        available: product.isAvailable,
        stock: product.stockQuantity,
        category: product.category.name,
        specifications: product.specifications,
      },
      productIds: [product.id],
    };
  }

  return { output: { error: `Tool sconosciuto: ${name}` }, productIds: [] };
}
```

- [ ] **Step 4: Verifica PASS + commit**

```bash
git add src/server/chat/
git commit -m "feat(chat): tool search_products e get_product_by_code (RAG read-only)"
```

---

### Task 10: ChatService (loop tool-use + persistenza)

**Files:**
- Create: `src/server/chat/service.ts`
- Test: `src/server/chat/service.test.ts`

**Interfaces:**
- Consumes: `AIGateway.chat/queryEmbeddings` (Task 5), `TOOL_DECLARATIONS`/`executeTool`/`ToolDb` (Task 9), enum Prisma `MessageRole`/`MessageStatus`.
- Produces:
  - `type ChatDb = ToolDb & Pick<PrismaClient, "message">`
  - `SYSTEM_PROMPT: string` (italiano)
  - `class ChatService { constructor(db: ChatDb, gateway: AIGateway); send(opts: { conversationId: string; agentId: string; content: string }): Promise<{ assistantMessageId: string }>; retry(opts: { conversationId: string; agentId: string }): Promise<{ assistantMessageId: string }> }`
  - Regole: persiste USER prima della chiamata AI; un messaggio TOOL per esecuzione; ASSISTANT finale con `modelUsed/tokensUsed/latencyMs/referencedProductIds`; su errore ASSISTANT `status: ERROR` + `errorMessage` (ECCETTO `RateLimitedError`, che viene rilanciata: il router la mappa su `TOO_MANY_REQUESTS`); `retry` cancella gli ASSISTANT ERROR e rigenera; al round 5 forza la risposta senza tool; la storia per il modello usa solo USER/ASSISTANT `SENT`.

- [ ] **Step 1: Test (falliranno)**

`src/server/chat/service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatResult } from "@/server/ai/providers/types";
import { ChatService, SYSTEM_PROMPT, type ChatDb } from "./service";

const messageCreate = vi.fn();
const messageFindMany = vi.fn();
const messageDeleteMany = vi.fn();
const queryRaw = vi.fn();
const findUnique = vi.fn();

const db = {
  $queryRaw: queryRaw,
  $executeRaw: vi.fn(),
  product: { findUnique },
  message: { create: messageCreate, findMany: messageFindMany, deleteMany: messageDeleteMany },
} as unknown as ChatDb;

const chat = vi.fn();
const gateway = { chat, queryEmbeddings: () => undefined } as never;

function textResult(text: string): ChatResult {
  return { text, toolCalls: [], modelUsed: "gemini-2.5-flash", tokensUsed: 10 };
}

const hit = {
  id: "p1", agbCode: "E10073.10.16", name: "COMPACT DX", shortDescription: null,
  basePrice: 51.59, priceUnit: "EUR", isAvailable: true, stockQuantity: 0,
  categoryId: "c1", categoryName: "Cerniere", textScore: 1, vectorScore: 0, score: 1,
};

beforeEach(() => {
  messageCreate.mockReset();
  messageCreate.mockImplementation(({ data }) => Promise.resolve({ id: "m_" + data.role, ...data }));
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  messageDeleteMany.mockReset();
  messageDeleteMany.mockResolvedValue({ count: 0 });
  queryRaw.mockReset();
  findUnique.mockReset();
  chat.mockReset();
});

describe("ChatService.send — risposta diretta", () => {
  it("persiste USER prima della chiamata AI, poi ASSISTANT con metadati", async () => {
    chat.mockResolvedValueOnce(textResult("Ciao!"));
    const service = new ChatService(db, gateway);
    const result = await service.send({ conversationId: "c1", agentId: "a1", content: "Ciao" });

    expect(messageCreate.mock.calls[0]![0].data).toMatchObject({ conversationId: "c1", role: "USER", content: "Ciao" });
    const assistant = messageCreate.mock.calls[1]![0].data;
    expect(assistant).toMatchObject({
      role: "ASSISTANT", content: "Ciao!", modelUsed: "gemini-2.5-flash", tokensUsed: 10, referencedProductIds: [],
    });
    expect(assistant.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.assistantMessageId).toBe("m_ASSISTANT");
    // il transcript parte dal system prompt
    expect(chat.mock.calls[0]![0][0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
  });
});

describe("ChatService.send — round tool", () => {
  it("esegue il tool, persiste il messaggio TOOL e propaga referencedProductIds", async () => {
    chat
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: "call_0", name: "search_products", arguments: { query: "cerniera" } }],
        modelUsed: "gemini-2.5-flash",
        tokensUsed: 5,
      })
      .mockResolvedValueOnce(textResult("Trovate cerniere E10073.10.16"));
    queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);

    const service = new ChatService(db, gateway);
    await service.send({ conversationId: "c1", agentId: "a1", content: "cerniere?" });

    const toolMessage = messageCreate.mock.calls[1]![0].data;
    expect(toolMessage).toMatchObject({
      role: "TOOL", toolName: "search_products", toolInput: { query: "cerniera" },
    });
    const assistant = messageCreate.mock.calls[2]![0].data;
    expect(assistant.referencedProductIds).toEqual(["p1"]);
    expect(assistant.tokensUsed).toBe(15); // somma dei round
    // il secondo round riceve il risultato tool nel transcript
    const secondTranscript = chat.mock.calls[1]![0];
    expect(secondTranscript.at(-1)).toMatchObject({ role: "tool", toolName: "search_products" });
  });

  it("al round 5 forza la risposta finale senza tool", async () => {
    chat.mockImplementation((_m: unknown, tools: unknown[]) =>
      Promise.resolve(
        tools.length > 0
          ? { text: null, toolCalls: [{ id: "x", name: "get_product_by_code", arguments: { agbCode: "B1" } }], modelUsed: "m", tokensUsed: 1 }
          : textResult("basta tool"),
      ),
    );
    findUnique.mockResolvedValue(null);
    const service = new ChatService(db, gateway);
    await service.send({ conversationId: "c1", agentId: "a1", content: "x" });
    expect(chat).toHaveBeenCalledTimes(6); // 5 round con tool + 1 forzato senza
    expect(chat.mock.calls[5]![1]).toEqual([]); // ultimo giro: niente tool
  });
});

describe("ChatService — errori", () => {
  it("fallimento AI → ASSISTANT status ERROR con errorMessage", async () => {
    chat.mockRejectedValueOnce(new Error("Assistente momentaneamente non disponibile."));
    const service = new ChatService(db, gateway);
    const result = await service.send({ conversationId: "c1", agentId: "a1", content: "x" });
    const assistant = messageCreate.mock.calls[1]![0].data;
    expect(assistant).toMatchObject({
      role: "ASSISTANT", status: "ERROR",
      errorMessage: "Assistente momentaneamente non disponibile.",
    });
    expect(result.assistantMessageId).toBe("m_ASSISTANT");
  });

  it("RateLimitedError viene rilanciata (il router la mappa su TOO_MANY_REQUESTS)", async () => {
    chat.mockRejectedValueOnce(new RateLimitedError());
    const service = new ChatService(db, gateway);
    await expect(service.send({ conversationId: "c1", agentId: "a1", content: "x" })).rejects.toMatchObject({
      name: "RateLimitedError",
    });
    expect(messageCreate).toHaveBeenCalledTimes(1); // solo il messaggio USER
  });
});

describe("ChatService.retry", () => {
  it("cancella gli ASSISTANT in ERROR e rigenera dalla storia", async () => {
    messageFindMany.mockResolvedValue([
      { role: "USER", content: "cerniere?" },
    ]);
    chat.mockResolvedValueOnce(textResult("Riprovato ok"));
    const service = new ChatService(db, gateway);
    await service.retry({ conversationId: "c1", agentId: "a1" });
    expect(messageDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: "c1", role: "ASSISTANT", status: "ERROR" },
    });
    // storia: system + user (nessun nuovo messaggio USER)
    expect(chat.mock.calls[0]![0]).toEqual([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "cerniere?" },
    ]);
    expect(messageCreate.mock.calls[0]![0].data.role).toBe("ASSISTANT");
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/chat/service.test.ts`

- [ ] **Step 3: Implementa service.ts**

```ts
import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AIGateway } from "@/server/ai/gateway";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatMessage } from "@/server/ai/providers/types";
import { TOOL_DECLARATIONS, executeTool, type ToolDb } from "./tools";

export type ChatDb = ToolDb & Pick<PrismaClient, "message">;

const MAX_TOOL_ROUNDS = 5;

export const SYSTEM_PROMPT = `Sei l'assistente tecnico-commerciale di Utensilferramenta Pistoiese per il catalogo ferramenta AGB. Rispondi in italiano agli agenti di vendita.
Regole:
- Usa SEMPRE i tool per cercare i prodotti: non inventare mai codici, prezzi o specifiche.
- Cita sempre il codice AGB dei prodotti di cui parli.
- Se non trovi nulla, dillo chiaramente e suggerisci come riformulare la ricerca.
- Non trattare generazione kit o argomenti fuori dal catalogo AGB.`;

export interface SendResult {
  assistantMessageId: string;
}

/**
 * Orchestrazione di un turno di chat: persiste il messaggio USER prima della
 * chiamata AI, esegue il loop tool-use (cap MAX_TOOL_ROUNDS, poi forza la
 * risposta senza tool) e persiste TOOL + ASSISTANT con i metadati.
 */
export class ChatService {
  constructor(
    private readonly db: ChatDb,
    private readonly gateway: AIGateway,
  ) {}

  async send(opts: { conversationId: string; agentId: string; content: string }): Promise<SendResult> {
    await this.db.message.create({
      data: { conversationId: opts.conversationId, role: "USER", content: opts.content },
    });
    return this.generate(opts.conversationId, opts.agentId);
  }

  /** «Riprova»: elimina gli ASSISTANT in errore e rigenera senza duplicare il messaggio utente. */
  async retry(opts: { conversationId: string; agentId: string }): Promise<SendResult> {
    await this.db.message.deleteMany({
      where: { conversationId: opts.conversationId, role: "ASSISTANT", status: "ERROR" },
    });
    return this.generate(opts.conversationId, opts.agentId);
  }

  private async generate(conversationId: string, agentId: string): Promise<SendResult> {
    const startedAt = Date.now();
    const transcript: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(await this.loadHistory(conversationId)),
    ];
    const productIds = new Set<string>();
    let tokens = 0;

    try {
      for (let round = 0; ; round++) {
        const useTools = round < MAX_TOOL_ROUNDS;
        const result = await this.gateway.chat(transcript, useTools ? TOOL_DECLARATIONS : [], {
          userId: agentId,
        });
        tokens += result.tokensUsed ?? 0;

        if (result.toolCalls.length === 0 || !useTools) {
          const assistant = await this.db.message.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: result.text ?? "",
              modelUsed: result.modelUsed,
              tokensUsed: tokens,
              latencyMs: Date.now() - startedAt,
              referencedProductIds: [...productIds],
            },
          });
          return { assistantMessageId: assistant.id };
        }

        transcript.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          const execution = await executeTool(
            this.db,
            call.name,
            call.arguments,
            this.gateway.queryEmbeddings(),
          );
          for (const id of execution.productIds) productIds.add(id);
          await this.db.message.create({
            data: {
              conversationId,
              role: "TOOL",
              content: `Tool ${call.name}`,
              toolName: call.name,
              toolInput: call.arguments as Prisma.InputJsonValue,
              toolOutput: execution.output as Prisma.InputJsonValue,
            },
          });
          transcript.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify(execution.output),
          });
        }
      }
    } catch (error) {
      if (error instanceof RateLimitedError) throw error; // il router la mappa su TOO_MANY_REQUESTS
      const assistant = await this.db.message.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: "",
          status: "ERROR",
          errorMessage: error instanceof Error ? error.message : "Errore sconosciuto",
          latencyMs: Date.now() - startedAt,
        },
      });
      return { assistantMessageId: assistant.id };
    }
  }

  /** Storia per il modello: solo USER/ASSISTANT inviati (i round tool restano nel DB, non nel prompt). */
  private async loadHistory(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.db.message.findMany({
      where: { conversationId, role: { in: ["USER", "ASSISTANT"] }, status: "SENT" },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    return rows.map((row) =>
      row.role === "USER"
        ? ({ role: "user", content: row.content } as const)
        : ({ role: "assistant", content: row.content } as const),
    );
  }
}
```

- [ ] **Step 4: Verifica PASS + commit**

```bash
git add src/server/chat/service.ts src/server/chat/service.test.ts
git commit -m "feat(chat): ChatService — loop tool-use con cap, persistenza e flusso errori"
```

---

### Task 11: Router chat + wiring (root, maxDuration, ricerca ibrida attiva)

**Files:**
- Create: `src/server/api/routers/chat.ts`
- Modify: `src/server/api/root.ts`
- Modify: `src/app/api/trpc/[trpc]/route.ts` (`export const maxDuration = 120`)
- Modify: `src/server/api/routers/product.ts` (embedding della query via gateway)
- Test: `src/server/api/routers/chat.test.ts`

**Interfaces:**
- Consumes: `ChatService` (Task 10), `getAIGateway` (Task 5), `RateLimitedError`, `agentProcedure`.
- Produces (tutte `agentProcedure`, ownership su `agentId`):
  - `chat.create() → { id, title }` + ActivityLog `CONVERSATION_CREATED`
  - `chat.list({ limit? }) → { id, title, updatedAt }[]` (solo ACTIVE proprie, per updatedAt desc)
  - `chat.get({ conversationId }) → { conversation: { id, title }, messages: Message[] (USER/ASSISTANT), products: ProductSummary[] }` — `ProductSummary = { id, agbCode, name, shortDescription, basePrice: number, priceUnit, isAvailable, stockQuantity }`
  - `chat.send({ conversationId, content }) → { assistantMessageId }` + titolo dal primo messaggio (60 char) + ActivityLog `CONVERSATION_MESSAGE`; `RateLimitedError → TOO_MANY_REQUESTS`
  - `chat.retry({ conversationId }) → { assistantMessageId }`
  - `chat.archive({ conversationId }) → { ok: true }`

- [ ] **Step 1: Test (falliranno)**

`src/server/api/routers/chat.test.ts` (pattern di `product.test.ts`; senza key in env il gateway reale non è configurato → `send` persiste un ASSISTANT ERROR «Assistente non configurato.» — il test lo sfrutta, niente mock del gateway):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { chatRouter } from "./chat";

const appRouter = createTRPCRouter({ chat: chatRouter });

const conversationCreate = vi.fn();
const conversationFindFirst = vi.fn();
const conversationFindMany = vi.fn();
const conversationUpdate = vi.fn();
const messageCreate = vi.fn();
const messageFindMany = vi.fn();
const messageDeleteMany = vi.fn();
const productFindMany = vi.fn();
const activityCreate = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      conversation: {
        create: conversationCreate,
        findFirst: conversationFindFirst,
        findMany: conversationFindMany,
        update: conversationUpdate,
      },
      message: { create: messageCreate, findMany: messageFindMany, deleteMany: messageDeleteMany },
      product: { findMany: productFindMany, findUnique: vi.fn() },
      activityLog: { create: activityCreate },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const ownConversation = { id: "c1", agentId: "agent1", title: "Nuova Conversazione", status: "ACTIVE" };

beforeEach(() => {
  conversationCreate.mockReset();
  conversationFindFirst.mockReset();
  conversationFindMany.mockReset();
  conversationUpdate.mockReset();
  conversationUpdate.mockResolvedValue({});
  messageCreate.mockReset();
  messageCreate.mockImplementation(({ data }) => Promise.resolve({ id: "m1", ...data }));
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  messageDeleteMany.mockReset();
  messageDeleteMany.mockResolvedValue({ count: 0 });
  productFindMany.mockReset();
  activityCreate.mockReset();
  activityCreate.mockResolvedValue({});
});

describe("RBAC e ownership", () => {
  it("send senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.chat.send({ conversationId: "c1", content: "ciao" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("conversazione di un altro agente → NOT_FOUND", async () => {
    conversationFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.get({ conversationId: "altrui" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent1" }) }),
    );
  });
});

describe("chat.create", () => {
  it("crea la conversazione e logga CONVERSATION_CREATED", async () => {
    conversationCreate.mockResolvedValue({ id: "c9", title: "Nuova Conversazione" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const created = await caller.chat.create();
    expect(created).toEqual({ id: "c9", title: "Nuova Conversazione" });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CONVERSATION_CREATED", userId: "agent1" }),
    });
  });
});

describe("chat.send", () => {
  it("titola la conversazione col primo messaggio e logga CONVERSATION_MESSAGE", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.chat.send({ conversationId: "c1", content: "Cerco cerniere" });
    expect(result.assistantMessageId).toBe("m1");
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: "Cerco cerniere" } }),
    );
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CONVERSATION_MESSAGE" }),
    });
    // senza key configurate il gateway non è configurato → ASSISTANT ERROR persistito
    const assistant = messageCreate.mock.calls.at(-1)![0].data;
    expect(assistant).toMatchObject({ role: "ASSISTANT", status: "ERROR", errorMessage: "Assistente non configurato." });
  });

  it("valida il contenuto (vuoto → BAD_REQUEST)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.send({ conversationId: "c1", content: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("chat.get", () => {
  it("ritorna messaggi USER/ASSISTANT e le schede dei prodotti citati", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    messageFindMany.mockResolvedValue([
      { id: "m1", role: "USER", content: "ciao", referencedProductIds: [] },
      { id: "m2", role: "ASSISTANT", content: "ecco", referencedProductIds: ["p1"] },
    ]);
    productFindMany.mockResolvedValue([
      { id: "p1", agbCode: "B1", name: "X", shortDescription: null, basePrice: { toString: () => "2.5" }, priceUnit: "EUR", isAvailable: true, stockQuantity: 0 },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const thread = await caller.chat.get({ conversationId: "c1" });
    expect(thread.messages).toHaveLength(2);
    expect(thread.products[0]).toMatchObject({ id: "p1", basePrice: 2.5 });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["p1"] } } }),
    );
  });
});

describe("chat.archive", () => {
  it("archivia la conversazione propria", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.chat.archive({ conversationId: "c1" });
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ARCHIVED" },
    });
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/server/api/routers/chat.test.ts`

- [ ] **Step 3: Implementa chat.ts**

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { getAIGateway } from "@/server/ai/gateway";
import { RateLimitedError } from "@/server/ai/errors";
import { ChatService } from "@/server/chat/service";

const PRODUCT_SUMMARY = {
  id: true,
  agbCode: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  priceUnit: true,
  isAvailable: true,
  stockQuantity: true,
} as const;

const DEFAULT_TITLE = "Nuova Conversazione";

/** Ownership: la conversazione deve appartenere all'agente (e non essere DELETED). */
async function ownConversation(ctx: TRPCContext & { session: NonNullable<TRPCContext["session"]> }, conversationId: string) {
  const conversation = await ctx.db.conversation.findFirst({
    where: { id: conversationId, agentId: ctx.session.user.id, status: { not: "DELETED" } },
  });
  if (!conversation)
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversazione non trovata." });
  return conversation;
}

function mapRateLimit(error: unknown): never {
  if (error instanceof RateLimitedError)
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
  throw error;
}

export const chatRouter = createTRPCRouter({
  create: agentProcedure.mutation(async ({ ctx }) => {
    const conversation = await ctx.db.conversation.create({
      data: { agentId: ctx.session.user.id },
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "CONVERSATION_CREATED",
        description: "Nuova conversazione con l'assistente",
        resourceType: "conversation",
        resourceId: conversation.id,
      },
    });
    return { id: conversation.id, title: conversation.title };
  }),

  list: agentProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.conversation.findMany({
        where: { agentId: ctx.session.user.id, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: input?.limit ?? 20,
        select: { id: true, title: true, updatedAt: true },
      }),
    ),

  get: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      const messages = await ctx.db.message.findMany({
        where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "asc" },
      });
      const productIds = [...new Set(messages.flatMap((m) => m.referencedProductIds))];
      const products =
        productIds.length === 0
          ? []
          : await ctx.db.product.findMany({
              where: { id: { in: productIds } },
              select: PRODUCT_SUMMARY,
            });
      return {
        conversation: { id: conversation.id, title: conversation.title },
        messages,
        products: products.map((p) => ({ ...p, basePrice: Number(p.basePrice) })),
      };
    }),

  send: agentProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        content: z.string().trim().min(1, "Scrivi un messaggio").max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      // Titolo dal primo messaggio; l'update tocca comunque updatedAt (ordinamento di list).
      await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: conversation.title === DEFAULT_TITLE ? { title: input.content.slice(0, 60) } : {},
      });
      const service = new ChatService(ctx.db, getAIGateway());
      const result = await service
        .send({ conversationId: conversation.id, agentId: ctx.session.user.id, content: input.content })
        .catch(mapRateLimit);
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "CONVERSATION_MESSAGE",
          description: "Messaggio all'assistente",
          resourceType: "conversation",
          resourceId: conversation.id,
        },
      });
      return result;
    }),

  retry: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      const service = new ChatService(ctx.db, getAIGateway());
      return service
        .retry({ conversationId: conversation.id, agentId: ctx.session.user.id })
        .catch(mapRateLimit);
    }),

  archive: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ownConversation(ctx, input.conversationId);
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { status: "ARCHIVED" },
      });
      return { ok: true };
    }),
});
```

- [ ] **Step 4: Wiring**

`src/server/api/root.ts` — aggiungi:

```ts
import { chatRouter } from "@/server/api/routers/chat";
// … dentro appRouter:
  chat: chatRouter,
```

`src/app/api/trpc/[trpc]/route.ts` — aggiungi sotto gli import:

```ts
// Il loop tool-use può superare i 10s di default delle function Vercel.
export const maxDuration = 120;
```

`src/server/api/routers/product.ts` — attiva il ramo vettoriale nella ricerca Archivio:

```ts
import { getAIGateway } from "@/server/ai/gateway";
// … in search, sostituisci:
//   const engine = new RAGEngine(ctx.db);
// con:
    const engine = new RAGEngine(ctx.db, getAIGateway().queryEmbeddings());
```

- [ ] **Step 5: Verifica PASS (inclusi i test product esistenti) + commit**

Run: `pnpm vitest run src/server/api` → PASS. Poi `pnpm typecheck` → verde.

```bash
git add src/server/api/ src/app/api/trpc/
git commit -m "feat(chat): router tRPC chat (create/list/get/send/retry/archive) + ricerca ibrida attiva"
```

---

### Task 12: Componenti UI chat (bubble, panel prodotti, input)

**Files:**
- Create: `src/components/chat/message-bubble.tsx`
- Create: `src/components/chat/product-panel.tsx`
- Create: `src/components/chat/chat-input.tsx`
- Modify: `src/app/globals.css` (keyframe fade-in + slide-up 100ms)
- Test: `src/components/chat/message-bubble.test.tsx`, `src/components/chat/product-panel.test.tsx`

**Interfaces:**
- Consumes: `CopyCodeButton` (esistente), `formatPrice` (esistente), `cn` (esistente).
- Produces:
  - `MessageBubble({ role: "USER" | "ASSISTANT", content: string, status?: string, errorMessage?: string | null, onRetry?: () => void, retrying?: boolean })` — codici AGB nel testo resi in `<code>` monospace; stato ERROR con bottone «Riprova».
  - `ChatProductSummary = { id: string; agbCode: string; name: string; shortDescription: string | null; basePrice: number; priceUnit: string; isAvailable: boolean; stockQuantity: number }` (esportato da `product-panel.tsx`)
  - `ProductPanel({ products: ChatProductSummary[] })` — stato vuoto dedicato; card con codice mono + copia, nome, prezzo, disponibilità, link `/archivio/{id}`.
  - `ChatInput({ onSend: (content: string) => void, disabled: boolean })` — Enter invia, Shift+Enter va a capo, max 4000.

Nota esecuzione: sviluppo UI con **/impeccable** (regola utente) — stile DESIGN.md: utente a destra su N100 (`bg-surface-sunken`), assistente a sinistra con `bg-brand-light` e bordo sinistro brand 3px, motion 100ms.

- [ ] **Step 1: Test (falliranno)**

`src/components/chat/message-bubble.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MessageBubble } from "./message-bubble";

afterEach(cleanup);

describe("MessageBubble", () => {
  it("messaggio utente allineato a destra", () => {
    render(<MessageBubble role="USER" content="ciao" />);
    const bubble = screen.getByText("ciao").closest("[data-role]");
    expect(bubble?.getAttribute("data-role")).toBe("USER");
  });

  it("i codici AGB nel testo sono resi in monospace", () => {
    render(<MessageBubble role="ASSISTANT" content="Ti consiglio la E10073.10.16 per l'anta." />);
    const code = screen.getByText("E10073.10.16");
    expect(code.tagName).toBe("CODE");
  });

  it("stato ERROR: mostra il messaggio d'errore e Riprova chiama onRetry", () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble
        role="ASSISTANT"
        content=""
        status="ERROR"
        errorMessage="Assistente momentaneamente non disponibile."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("momentaneamente non disponibile");
    fireEvent.click(screen.getByRole("button", { name: /riprova/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

`src/components/chat/product-panel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ProductPanel } from "./product-panel";

afterEach(cleanup);

const product = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: "Cerniere · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 4,
};

describe("ProductPanel", () => {
  it("stato vuoto dedicato senza prodotti", () => {
    render(<ProductPanel products={[]} />);
    expect(screen.getByText(/nessun prodotto citato/i)).toBeTruthy();
  });

  it("card prodotto con codice, prezzo e link al dettaglio Archivio", () => {
    render(<ProductPanel products={[product]} />);
    expect(screen.getByText("E10073.10.16")).toBeTruthy();
    expect(screen.getByText("COMPACT DX").closest("a")?.getAttribute("href")).toBe("/archivio/p1");
    expect(screen.getByText(/51,59/)).toBeTruthy();
    expect(screen.getByText(/disponibile/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verifica FAIL** — `pnpm vitest run src/components/chat`

- [ ] **Step 3: Implementa i componenti**

`src/app/globals.css` — aggiungi in fondo:

```css
/* Chat: fade-in + slide-up 100ms (DESIGN.md — Motion) */
@keyframes chat-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-chat-in {
  animation: chat-in 100ms ease-out;
}
```

`src/components/chat/message-bubble.tsx`:

```tsx
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Codici AGB nel testo (es. B00590.15.03, A50122): resi in monospace. */
const AGB_CODE = /\b([A-Z]\d{4,5}(?:\.[0-9A-Z]{2,3})*)\b/g;

function renderContent(content: string) {
  const parts = content.split(AGB_CODE);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded bg-black/[0.06] px-1 font-mono text-[0.92em]">
        {part}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export interface MessageBubbleProps {
  role: "USER" | "ASSISTANT";
  content: string;
  status?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export function MessageBubble({ role, content, status, errorMessage, onRetry, retrying }: MessageBubbleProps) {
  if (status === "ERROR") {
    return (
      <div data-role={role} className="animate-chat-in flex justify-start">
        <div role="alert" className="max-w-[85%] rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-ink">
          <p>{errorMessage ?? "Si è verificato un errore."}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
            >
              <RotateCcw className="size-3" aria-hidden />
              Riprova
            </button>
          )}
        </div>
      </div>
    );
  }

  const isUser = role === "USER";
  return (
    <div data-role={role} className={cn("animate-chat-in flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-relaxed text-ink",
          isUser ? "bg-surface-sunken" : "border-l-[3px] border-brand bg-brand-light",
        )}
      >
        {renderContent(content)}
      </div>
    </div>
  );
}
```

`src/components/chat/product-panel.tsx`:

```tsx
import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { CopyCodeButton } from "@/components/product/copy-code-button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChatProductSummary {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  isAvailable: boolean;
  stockQuantity: number;
}

/** Pannello destro (40%): schede dei prodotti citati dall'assistente. */
export function ProductPanel({ products }: { products: ChatProductSummary[] }) {
  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <PackageSearch className="size-8 text-ink-subtle" aria-hidden />
        <p className="text-sm text-ink-subtle">
          Nessun prodotto citato.
          <br />
          Le schede dei prodotti consigliati dall&apos;assistente appariranno qui.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3 overflow-y-auto p-4">
      {products.map((product) => (
        <li key={product.id} className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <CopyCodeButton code={product.agbCode} />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                product.isAvailable ? "bg-success/10 text-success" : "bg-error/10 text-error",
              )}
            >
              {product.isAvailable ? "Disponibile" : "Non disponibile"}
            </span>
          </div>
          <Link
            href={`/archivio/${product.id}`}
            className="mt-2 block font-medium text-ink hover:text-brand"
          >
            {product.name}
          </Link>
          {product.shortDescription && (
            <p className="mt-0.5 text-xs text-ink-subtle">{product.shortDescription}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</p>
        </li>
      ))}
    </ul>
  );
}
```

`src/components/chat/chat-input.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SendHorizonal } from "lucide-react";

const MAX_LENGTH = 4000;

export function ChatInput({ onSend, disabled }: { onSend: (content: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");

  const submit = () => {
    const content = value.trim();
    if (!content || disabled) return;
    onSend(content);
    setValue("");
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label="Messaggio per l'assistente"
        placeholder="Chiedi all'assistente… (Invio per inviare)"
        rows={2}
        maxLength={MAX_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="flex-1 resize-none rounded border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        aria-label="Invia messaggio"
        className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
      >
        <SendHorizonal className="size-4" aria-hidden />
        Invia
      </button>
    </form>
  );
}
```

Nota: verifica i token Tailwind effettivi in `tailwind.config.ts` (`line`, `error`, `success`, `brand-light`…) e allineali a quelli reali del progetto se differiscono.

- [ ] **Step 4: Verifica PASS + commit**

Run: `pnpm vitest run src/components/chat` → PASS.

```bash
git add src/components/chat/ src/app/globals.css
git commit -m "feat(ui): componenti chat — bubble con codici mono, pannello prodotti, input"
```

---

### Task 13: Pagina /assistente + client split-pane + nav

**Files:**
- Create: `src/app/(dashboard)/assistente/page.tsx`
- Create: `src/app/(dashboard)/assistente/assistente-client.tsx`
- Modify: `src/components/layout/sidebar.tsx` (voce «Assistente» → `/assistente`)
- Modify: `src/components/layout/sidebar.test.tsx` (label aggiornata)

**Interfaces:**
- Consumes: `api.chat.*` (Task 11), `MessageBubble`/`ProductPanel`/`ChatInput` (Task 12).
- Produces: pagina `/assistente` (accesso AGENT via tRPC; shell come `/archivio`): split pane 60/40, dropdown conversazioni recenti + «Nuova conversazione», stato vuoto con 3 prompt d'esempio, indicatore «Sta scrivendo…», errori inline con «Riprova».

- [ ] **Step 1: Aggiorna il test della sidebar (fallirà)**

In `src/components/layout/sidebar.test.tsx` sostituisci `"Chat AI"` con `"Assistente"` nella lista di label attese.

Run: `pnpm vitest run src/components/layout/sidebar.test.tsx` → FAIL.

- [ ] **Step 2: Aggiorna la sidebar**

In `src/components/layout/sidebar.tsx` sostituisci la voce:

```ts
  { href: "/assistente", label: "Assistente", icon: MessageSquare },
```

Run: `pnpm vitest run src/components/layout/sidebar.test.tsx` → PASS.

- [ ] **Step 3: Crea pagina e client**

`src/app/(dashboard)/assistente/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AssistenteClient } from "./assistente-client";

export const metadata: Metadata = { title: "Assistente — UFPtrade" };

export default function AssistentePage() {
  return <AssistenteClient />;
}
```

`src/app/(dashboard)/assistente/assistente-client.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Archive } from "lucide-react";
import { api } from "@/trpc/react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ProductPanel } from "@/components/chat/product-panel";
import { ChatInput } from "@/components/chat/chat-input";

const EXAMPLE_PROMPTS = [
  "Cerniere per anta ribalta in acciaio",
  "Che cremonesi ARTECH avete sotto i 30 €?",
  "Dammi la scheda del codice B00590.15.03",
];

export function AssistenteClient() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const utils = api.useUtils();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = api.chat.list.useQuery();
  const thread = api.chat.get.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: conversationId !== null },
  );

  const invalidate = () => {
    void utils.chat.get.invalidate();
    void utils.chat.list.invalidate();
  };
  const create = api.chat.create.useMutation();
  const send = api.chat.send.useMutation({ onSettled: invalidate });
  const retry = api.chat.retry.useMutation({ onSettled: invalidate });
  const archive = api.chat.archive.useMutation({
    onSuccess: () => {
      setConversationId(null);
      void utils.chat.list.invalidate();
    },
  });

  const messages = thread.data?.messages ?? [];
  const products = thread.data?.products ?? [];
  const busy = send.isPending || retry.isPending || create.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  const handleSend = async (content: string) => {
    let id = conversationId;
    if (!id) {
      id = (await create.mutateAsync()).id;
      setConversationId(id);
    }
    send.mutate({ conversationId: id, content });
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-7xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Assistente</h1>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="conversazioni">
            Conversazioni recenti
          </label>
          <select
            id="conversazioni"
            value={conversationId ?? ""}
            onChange={(event) => setConversationId(event.target.value || null)}
            className="max-w-64 rounded border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="">Conversazioni recenti…</option>
            {(conversations.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {conversationId && (
            <button
              type="button"
              onClick={() => archive.mutate({ conversationId })}
              className="inline-flex items-center gap-1.5 rounded border border-line-strong px-3 py-2 text-sm text-ink-subtle transition-colors hover:bg-surface-sunken"
            >
              <Archive className="size-4" aria-hidden />
              Archivia
            </button>
          )}
          <button
            type="button"
            onClick={() => setConversationId(null)}
            className="inline-flex items-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Nuova conversazione
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[3fr_2fr]">
        {/* Colonna chat (60%) */}
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !busy ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-ink-subtle">
                  Chiedi all&apos;assistente informazioni sui prodotti del catalogo AGB.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      className="rounded border border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:border-brand hover:text-brand"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    role={message.role === "USER" ? "USER" : "ASSISTANT"}
                    content={message.content}
                    status={message.status}
                    errorMessage={message.errorMessage}
                    onRetry={
                      conversationId ? () => retry.mutate({ conversationId }) : undefined
                    }
                    retrying={retry.isPending}
                  />
                ))}
                {busy && send.variables?.content && (
                  <MessageBubble role="USER" content={send.variables.content} />
                )}
                {busy && (
                  <p className="animate-pulse text-sm text-ink-subtle" role="status">
                    Sta scrivendo…
                  </p>
                )}
                {send.isError && conversationId && (
                  <MessageBubble
                    role="ASSISTANT"
                    content=""
                    status="ERROR"
                    errorMessage={send.error.message}
                    onRetry={() => retry.mutate({ conversationId })}
                    retrying={retry.isPending}
                  />
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>
          <ChatInput onSend={(content) => void handleSend(content)} disabled={busy} />
        </div>

        {/* Pannello prodotti (40%) */}
        <aside className="hidden min-h-0 border-l border-line bg-surface-sunken/40 lg:block">
          <ProductPanel products={products} />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Gates + verifica browser + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → tutti verdi.

Con il DB su (`bash scripts/dev-bootstrap.sh`) e `pnpm dev`: login, vai su `/assistente`, verifica con Playwright/browser: stato vuoto con 3 prompt, invio messaggio (senza key → bolla errore «Assistente non configurato.» con Riprova), dropdown conversazioni, pannello vuoto dedicato. Rifinisci lo split-pane con **/impeccable** se qualcosa stona.

```bash
git add src/app/\(dashboard\)/assistente/ src/components/layout/
git commit -m "feat(ui): pagina Assistente — split pane 60/40, conversazioni, stati vuoto/errore"
```

---

### Task 14: Aggiornamento CLAUDE.md (regola AIGateway) + gates finali

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Emenda la regola BullMQ**

In `CLAUDE.md`, sezione «DECISIONI ARCHITETTURALI», sostituisci la riga:

```
- **Ogni chiamata AI via BullMQ** (rate limit + circuit breaker) — Fase ≥1c.
```

con:

```
- **Ogni chiamata AI passa dall'unico modulo `AIGateway`**
  (`src/server/ai/gateway.ts`): rate limit + circuit breaker con stato su Redis
  + fallback Gemini→Kimi. Nessuna chiamata provider fuori da `src/server/ai/`.
  Batch = script tsx idempotenti (`pnpm embed:products`). NIENTE BullMQ (verdetto
  LLM Council 2026-07-02: worker persistente impossibile su Vercel, anti-pattern
  su Upstash); per job asincroni durevoli futuri: Upstash QStash.
```

e aggiorna la sezione «STATO» segnando la 1c in corso/completata secondo il punto raggiunto.

- [ ] **Step 2: Gates completi**

Run (separati, MAI `lint | tail` in catena `&&`):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: tutti verdi (test: ~86 esistenti + i nuovi di 1c).

- [ ] **Step 3: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: regola AIGateway al posto di BullMQ (Fase 1c)"
git push -u origin claude/handoff-review-48kkhi
```

---

### Task 15: Verifica end-to-end con key reali (richiede l'utente)

**Files:** nessuno (verifica manuale + eventuali fix).

**Prerequisiti:** `GEMINI_API_KEY` (e idealmente `KIMI_API_KEY`) in `.env` locale — **fornite dall'utente, mai committate**. DB Docker su con catalogo importato (PDF dal link registrato in CLAUDE.md, regola file esterni).

- [ ] **Step 1: Catalogo + embedding reali**

```bash
bash scripts/dev-bootstrap.sh
set -a; source .env; set +a
pnpm import:agb <listino.pdf>   # se il DB è vuoto
pnpm embed:products              # ~62 richieste batch
```

Expected: `Completato: 6191 embedding generati.` Secondo run: «Niente da fare».

- [ ] **Step 2: Ricerca ibrida reale**

Su `/archivio` confronta un paio di query concettuali (es. «chiusura per finestra a vasistas»): con embedding attivi i risultati devono restare sensati e `vectorScore > 0` nei log/risultati; una query col prefisso codice deve continuare a mettere i codici davanti.

- [ ] **Step 3: Conversazione reale con tool-use**

Su `/assistente`: «Cerco cerniere per anta ribalta in acciaio, budget 60 €» → risposta in italiano con codici citati, schede nel pannello destro, messaggi TOOL a DB. Verifica «sta scrivendo…», retry su errore simulato (key errata temporanea), rate limit (21 invii rapidi → messaggio «Troppe richieste…»).

- [ ] **Step 4: Aggiorna handoff.md e chiudi**

Aggiorna `handoff.md` (stato 1c, numeri embedding, eventuali delta) e committa. Push finale.

---

## Self-review (fatta in scrittura piano)

- **Copertura spec:** breaker+ratelimit (T1-2) · gateway con retry/fallback/embedQuery (T5) · provider Gemini/Kimi solo fetch (T3-4) · ChatService loop cap 5 + persistenza + referencedProductIds + ActivityLog (T10-11) · router 5 procedure + ownership (T11) · embedding batch idempotente ≤100 con backoff (T6-8) · ricerca ibrida attiva con degrado (T6, T11) · UI split 60/40, dropdown, stati, motion (T12-13) · errori italiani tipizzati (T3, T10, T11) · CLAUDE.md emendato (T14) · e2e con key reali (T15). `maxDuration = 120` (T11).
- **Delta consapevoli vs spec:** niente messaggio ASSISTANT ERROR per il rate limit (si mappa su TOO_MANY_REQUESTS e la UI mostra il banner con Riprova — più semplice, stesso esito); `retry` è una procedura dedicata (la spec la implica con «Riprova»); budget per-provider fissato a 15 RPM (la spec non dava il numero).
- **Tipi coerenti:** `RedisLike` (T1) usato da T2/T5; `ChatMessage/ChatResult/ToolDeclaration` (T3) usati da T4/T5/T10; `ToolDb ⊂ ChatDb` (T9/T10); `UnembeddedProduct` (T6) usato da T7/T8; `ChatProductSummary` (T12) = select `PRODUCT_SUMMARY` (T11) con `basePrice: number`.
