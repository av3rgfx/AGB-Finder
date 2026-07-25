# Chat Assistente professionale (streaming + mobile-first) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riscrivere la chat dell'assistente in un prodotto professionale: streaming SSE token-by-token con STOP e stati tool, Gemini-only, mobile-first, gestione conversazioni, rendering markdown, prodotti inline, persistenza URL.

**Architecture:** Route Handler dedicato `/api/chat/stream` (SSE, Better Auth) che consuma `ChatService.generateStream()` (tool-loop → eventi) → `AIGateway.chatStream()` (guardie, no fallback) → `GeminiChatProvider.chatStream()` (`:streamGenerateContent?alt=sse`). Conversazioni via tRPC. Client: hook `useChatStream` (unica deroga "no fetch") + UI a due zone (rail conversazioni + chat).

**Tech Stack:** Next 15 (App Router), React 19, TypeScript strict, tRPC v11, Prisma 6, Tailwind 3, Vitest. Nuove dep: `react-markdown`, `remark-gfm`, `eventsource-parser`.

**Spec:** `docs/superpowers/specs/2026-07-24-chat-streaming-design.md`

## Global Constraints

- TypeScript **strict** sempre. UI **in italiano**. Codici prodotto in **font-mono** (JetBrains Mono).
- Tutte le API dal client via **tRPC** — UNICA eccezione: il route handler `/api/chat/stream` letto dall'hook `useChatStream` (deroga documentata, incapsulata lì).
- Tutte le query via **Prisma**; raw SQL solo in `RAGEngine`.
- **Mobile-first**: ogni componente responsive, verificato a **≤375px** e desktop prima di dirlo concluso.
- Nessuna chiamata provider AI fuori da `src/server/ai/`. `AIGateway` unico punto d'uscita.
- **Gemini-only** (nessun Kimi/Moonshot residuo).
- Gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` verdi + verifica browser.
- **Zero migrazioni Prisma, zero azioni ops DB** (riuso campi esistenti).
- Prima di comandi prisma/tsx: `set -a; source .env; set +a`. pnpm 10.

---

## File Structure

**Backend — AI/streaming**
- `src/server/ai/providers/types.ts` (modify) — `ProviderChunk` + `chatStream` su `ChatProvider`.
- `src/server/ai/providers/sse.ts` (create) — `sseEvents(body)`: bridge ReadableStream→AsyncGenerator di payload SSE.
- `src/server/ai/providers/gemini.ts` (modify) — `chatStream()`.
- `src/server/ai/providers/kimi.ts` (**delete**), `kimi.test.ts` (**delete**).
- `src/server/ai/gateway.ts` (modify) — `chatStream()`, Gemini-only in `buildGateway`.
- `src/server/ai/test-connection.ts` (modify) — togliere ramo Kimi.
- `src/server/chat/events.ts` (create) — tipo `ChatEvent` + `toolLabel()`.
- `src/server/chat/products.ts` (create) — `CHAT_PRODUCT_SELECT` + `resolveChatProducts(db, ids)` (DRY tra router e service).
- `src/server/chat/service.ts` (modify) — `generateStream()`, nuovo `SYSTEM_PROMPT`, via `send`/`retry`.
- `src/app/api/chat/stream/route.ts` (create) — SSE handler.

**Backend — conversazioni (tRPC)**
- `src/server/api/routers/chat.ts` (modify) — via `send`/`retry`; add `rename`/`delete`; `list` con `search`; `get` per-messaggio.

**Backend — settings/env (Kimi removal)**
- `src/env.ts`, `.env.example`, `src/server/settings/service.ts`(+test), `src/server/api/routers/settings.ts`, `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`.

**Frontend**
- `src/lib/chat/group-conversations.ts` (create, pure) + test.
- `src/lib/chat/scroll.ts` (create, pure: `isNearBottom`) + test.
- `src/hooks/use-chat-stream.ts` (create) — deroga fetch/SSE.
- `src/components/chat/markdown-message.tsx` (create) — react-markdown + renderer.
- `src/components/chat/code-block.tsx` (create) — code-block + copia.
- `src/components/chat/message-turn.tsx` (create) — bolla utente + blocco AI full-width + azioni.
- `src/components/chat/inline-products.tsx` (create) — chip «N prodotti» + card inline.
- `src/components/chat/tool-status.tsx` (create) — chip stato tool.
- `src/components/chat/error-banner.tsx` (create) — errore recoverable + countdown.
- `src/components/chat/composer.tsx` (create) — textarea auto-grow + Invia/STOP.
- `src/components/chat/conversations-panel.tsx` (create) — ricerca + gruppi + ⋯.
- `src/components/chat/scroll-to-bottom.tsx` (create).
- `src/app/(dashboard)/assistente/assistente-client.tsx` (rewrite).
- **Delete** dopo il rewrite: `src/components/chat/message-bubble.tsx`, `chat-input.tsx`, `product-panel.tsx`.

**Docs**: `CLAUDE.md`, `handoff.md`.

---

## Task 1: Rimozione Kimi (Gemini-only)

**Files:**
- Delete: `src/server/ai/providers/kimi.ts`, `src/server/ai/providers/kimi.test.ts`
- Modify: `src/server/ai/gateway.ts:16,138-146`, `src/server/ai/test-connection.ts`, `src/env.ts`, `.env.example`, `src/server/settings/service.ts`(+`service.test.ts`), `src/server/api/routers/settings.ts`, `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`
- Test: `src/server/ai/gateway.test.ts`

**Interfaces:**
- Produces: `buildGateway` costruisce `providers = [GeminiChatProvider]` (0 o 1 elemento). `resolveApiKey(db, provider)` accetta solo `"gemini"`.

- [ ] **Step 1: Grep della superficie residua**

Run: `git grep -niE 'kimi|moonshot' -- src | grep -v node_modules`
Annota ogni riga: sarà tutta rimossa (eccetto eventuali commenti storici che si aggiornano).

- [ ] **Step 2: Aggiorna il test del gateway (fallisce)**

In `src/server/ai/gateway.test.ts` rimuovi ogni scenario Kimi/fallback e aggiungi:

```ts
it("costruisce solo Gemini quando la key esiste", async () => {
  // usa i mock esistenti del file per resolveApiKey/redis
  const gw = await buildGatewayForTest({ geminiKey: "g" }); // helper già presente o inline
  expect(gw.providerNames()).toEqual(["gemini"]);
});
```

Se `providerNames()` non esiste, aggiungilo al gateway (Step 4). Adegua i mock esistenti del file rimuovendo `resolveApiKey(..., "kimi")`.

- [ ] **Step 3: Run test → FAIL**

Run: `set -a; source .env; set +a; pnpm test src/server/ai/gateway.test.ts`
Expected: FAIL (`providerNames` non definito o build ancora con Kimi).

- [ ] **Step 4: Rimuovi Kimi dal gateway**

In `src/server/ai/gateway.ts`: elimina l'import `KimiChatProvider`; in `buildGateway` togli `const kimiKey = ...` e il push di Kimi:

```ts
async function buildGateway(redis: RedisLike): Promise<AIGateway> {
  const geminiKey = await resolveApiKey(db, "gemini");
  const providers: ChatProvider[] = [];
  if (geminiKey) providers.push(new GeminiChatProvider(geminiKey, env.GEMINI_MODEL));
  const queryEmbeddings = geminiKey
    ? new GeminiEmbeddingService(geminiKey, "RETRIEVAL_QUERY", (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
      )
    : undefined;
  return new AIGateway({ providers, breaker: new CircuitBreaker(redis), limiter: new RateLimiter(redis), queryEmbeddings });
}
```

Aggiungi al `class AIGateway` un accessor di test:

```ts
providerNames(): string[] { return this.deps.providers.map((p) => p.name); }
```

- [ ] **Step 5: Elimina i file Kimi + riferimenti**

```bash
git rm src/server/ai/providers/kimi.ts src/server/ai/providers/kimi.test.ts
```

- In `src/env.ts` e `.env.example`: rimuovi `KIMI_MODEL` e `MOONSHOT_API_KEY` (o equivalenti).
- In `src/server/settings/service.ts`: nel tipo provider di `resolveApiKey`/enum settings togli `"kimi"`; adegua `service.test.ts`.
- In `src/server/api/routers/settings.ts` e `impostazioni-client.tsx`: togli il campo/opzione key Kimi.
- In `src/server/ai/test-connection.ts`(+test): togli il ramo Kimi.

- [ ] **Step 6: Run gate → PASS**

Run: `set -a; source .env; set +a; pnpm test src/server/ai src/server/settings && pnpm typecheck`
Expected: PASS. Poi `git grep -niE 'kimi|moonshot' -- src` → **0 risultati** (in `src/`).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -S -m "refactor(ai): rimuovi provider Kimi, Gemini-only (dead code, kit deterministico)"
```

---

## Task 2: Streaming del provider Gemini (SSE)

**Files:**
- Create: `src/server/ai/providers/sse.ts`, `src/server/ai/providers/sse.test.ts`, `src/server/ai/providers/gemini-stream.test.ts`
- Modify: `src/server/ai/providers/types.ts`, `src/server/ai/providers/gemini.ts`
- Dep: `pnpm add eventsource-parser`

**Interfaces:**
- Produces:
  - `type ProviderChunk = { type: "text-delta"; text: string } | { type: "tool-call"; call: ToolCall } | { type: "usage"; tokens: number }`
  - `ChatProvider.chatStream(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): AsyncGenerator<ProviderChunk>`
  - `sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string>` (payload della riga `data:`)

- [ ] **Step 1: Installa eventsource-parser**

Run: `pnpm add eventsource-parser`
Expected: aggiunto a `dependencies`.

- [ ] **Step 2: Test di `sseEvents` (fallisce)**

Create `src/server/ai/providers/sse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sseEvents } from "./sse";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  });
}

describe("sseEvents", () => {
  it("emette i payload data: completi", async () => {
    const out: string[] = [];
    for await (const e of sseEvents(streamFrom(["data: a\n\n", "data: b\n\n"]))) out.push(e);
    expect(out).toEqual(["a", "b"]);
  });

  it("ricompone un frame spezzato tra due chunk", async () => {
    const out: string[] = [];
    for await (const e of sseEvents(streamFrom(['data: {"x":1', '}\n\n']))) out.push(e);
    expect(out).toEqual(['{"x":1}']);
  });

  it("gestisce UTF-8 multibyte a cavallo dei chunk", async () => {
    const enc = new TextEncoder();
    const bytes = enc.encode("data: à\n\n"); // 'à' = 2 byte
    const s = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); },
    });
    const out: string[] = [];
    for await (const e of sseEvents(s)) out.push(e);
    expect(out).toEqual(["à"]);
  });
});
```

- [ ] **Step 3: Run → FAIL**

Run: `pnpm test src/server/ai/providers/sse.test.ts`
Expected: FAIL (`sseEvents` non esiste).

- [ ] **Step 4: Implementa `sseEvents`**

Create `src/server/ai/providers/sse.ts`:

```ts
import { createParser } from "eventsource-parser";

/** Trasforma un ReadableStream SSE nel flusso dei payload `data:` completi (frame-safe). */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const queue: string[] = [];
  const parser = createParser({ onEvent: (event) => queue.push(event.data) });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) parser.feed(decoder.decode(value, { stream: true }));
      while (queue.length) yield queue.shift()!;
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 5: Run → PASS**

Run: `pnpm test src/server/ai/providers/sse.test.ts`
Expected: PASS.

- [ ] **Step 6: Estendi l'interfaccia provider**

In `src/server/ai/providers/types.ts` aggiungi:

```ts
export type ProviderChunk =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; call: ToolCall }
  | { type: "usage"; tokens: number };

export interface ChatProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): Promise<ChatResult>;
  chatStream(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): AsyncGenerator<ProviderChunk>;
}
```

- [ ] **Step 7: Test di `GeminiChatProvider.chatStream` (fallisce)**

Create `src/server/ai/providers/gemini-stream.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { GeminiChatProvider } from "./gemini";
import type { ProviderChunk } from "./types";

function sseResponse(events: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); c.close(); },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("GeminiChatProvider.chatStream", () => {
  it("emette text-delta in ordine, tool-call e usage", async () => {
    const fakeFetch = async () => sseResponse([
      { candidates: [{ content: { parts: [{ text: "Ciao " }] } }] },
      { candidates: [{ content: { parts: [{ text: "mondo" }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: "search_products", args: { query: "x" } } }] } }] },
      { usageMetadata: { totalTokenCount: 42 } },
    ]);
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    const out: ProviderChunk[] = [];
    for await (const c of p.chatStream([{ role: "user", content: "hi" }], [], AbortSignal.timeout(1000))) out.push(c);
    expect(out).toEqual([
      { type: "text-delta", text: "Ciao " },
      { type: "text-delta", text: "mondo" },
      { type: "tool-call", call: { id: "call_0", name: "search_products", arguments: { query: "x" } } },
      { type: "usage", tokens: 42 },
    ]);
  });

  it("lancia ProviderHttpError su status non-ok", async () => {
    const fakeFetch = async () => new Response("nope", { status: 429 });
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    await expect(async () => { for await (const _ of p.chatStream([], [], AbortSignal.timeout(1000))) void _; })
      .rejects.toMatchObject({ status: 429 });
  });
});
```

- [ ] **Step 8: Run → FAIL** (`chatStream` non esiste). `pnpm test src/server/ai/providers/gemini-stream.test.ts`

- [ ] **Step 9: Implementa `GeminiChatProvider.chatStream`**

In `src/server/ai/providers/gemini.ts` (riusa `toGeminiRequest`, `GeminiPart`), aggiungi il metodo e l'import di `sseEvents`/`ProviderChunk`:

```ts
async *chatStream(
  messages: ChatMessage[],
  tools: ToolDeclaration[],
  signal: AbortSignal,
): AsyncGenerator<ProviderChunk> {
  const response = await this.fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(toGeminiRequest(messages, tools)),
      signal,
    },
  );
  if (!response.ok) throw new ProviderHttpError(this.name, response.status);
  if (!response.body) throw new ProviderHttpError(this.name, 502);
  let toolIndex = 0;
  for await (const data of sseEvents(response.body)) {
    const payload = JSON.parse(data) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    for (const part of payload.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) yield { type: "text-delta", text: part.text };
      if (part.functionCall)
        yield { type: "tool-call", call: { id: `call_${toolIndex++}`, name: part.functionCall.name, arguments: part.functionCall.args ?? {} } };
    }
    if (payload.usageMetadata?.totalTokenCount != null)
      yield { type: "usage", tokens: payload.usageMetadata.totalTokenCount };
  }
}
```

- [ ] **Step 10: Run → PASS** e typecheck. `pnpm test src/server/ai/providers && pnpm typecheck`

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -S -m "feat(ai): streaming SSE del provider Gemini + parser frame-safe"
```

---

## Task 3: `AIGateway.chatStream`

**Files:**
- Modify: `src/server/ai/gateway.ts`
- Test: `src/server/ai/gateway.test.ts`

**Interfaces:**
- Produces: `AIGateway.chatStream(messages, tools, opts: { userId: string; signal?: AbortSignal }): AsyncGenerator<ProviderChunk>`. Applica: rate-limit utente+provider, breaker per-Gemini, timeout combinato col signal client. **Nessun fallback, nessun retry server-side** (il client ri-tenta pre-primo-token).

- [ ] **Step 1: Test (fallisce)**

Aggiungi a `src/server/ai/gateway.test.ts` (usando i mock esistenti di limiter/breaker/provider — crea un provider fake con `chatStream`):

```ts
it("chatStream: rate-limit utente superato → RateLimitedError", async () => {
  const gw = new AIGateway({ providers: [fakeStreamProvider([])], breaker: okBreaker(), limiter: denyUser(), });
  await expect(async () => { for await (const _ of gw.chatStream([], [], { userId: "u" })) void _; })
    .rejects.toBeInstanceOf(RateLimitedError);
});

it("chatStream: breaker aperto → AIUnavailableError", async () => {
  const gw = new AIGateway({ providers: [fakeStreamProvider([])], breaker: openBreaker(), limiter: allow() });
  await expect(async () => { for await (const _ of gw.chatStream([], [], { userId: "u" })) void _; })
    .rejects.toBeInstanceOf(AIUnavailableError);
});

it("chatStream: inoltra i chunk e registra successo", async () => {
  const breaker = spyBreaker();
  const gw = new AIGateway({ providers: [fakeStreamProvider([{ type: "text-delta", text: "hi" }])], breaker, limiter: allow() });
  const out = []; for await (const c of gw.chatStream([], [], { userId: "u" })) out.push(c);
  expect(out).toEqual([{ type: "text-delta", text: "hi" }]);
  expect(breaker.recordSuccess).toHaveBeenCalledWith("gemini");
});
```

`fakeStreamProvider(chunks)` = `{ name: "gemini", chat: async()=>({...}), async *chatStream(){ for (const c of chunks) yield c; } }`.

- [ ] **Step 2: Run → FAIL.** `set -a; source .env; set +a; pnpm test src/server/ai/gateway.test.ts`

- [ ] **Step 3: Implementa**

In `src/server/ai/gateway.ts`:

```ts
async *chatStream(
  messages: ChatMessage[],
  tools: ToolDeclaration[],
  opts: { userId: string; signal?: AbortSignal },
): AsyncGenerator<ProviderChunk> {
  if (this.deps.providers.length === 0) throw new AINotConfiguredError();
  if (!(await this.deps.limiter.consume(`user:${opts.userId}`, USER_RPM, WINDOW_SEC))) throw new RateLimitedError();
  const provider = this.deps.providers[0];
  if (await this.deps.breaker.isOpen(provider.name)) throw new AIUnavailableError();
  if (!(await this.deps.limiter.consume(`provider:${provider.name}`, PROVIDER_RPM, WINDOW_SEC))) throw new RateLimitedError();
  const timeout = AbortSignal.timeout(this.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  try {
    for await (const chunk of provider.chatStream(messages, tools, signal)) yield chunk;
    await this.deps.breaker.recordSuccess(provider.name);
  } catch (error) {
    await this.deps.breaker.recordFailure(provider.name);
    throw error;
  }
}
```

Aggiungi `import type { ProviderChunk } ...`.

- [ ] **Step 4: Run → PASS.** `pnpm test src/server/ai/gateway.test.ts && pnpm typecheck`

- [ ] **Step 5: Commit** `git commit -S -am "feat(ai): AIGateway.chatStream (guardie, no fallback/retry)"`

---

## Task 4: `ChatService.generateStream` + eventi + system prompt

**Files:**
- Create: `src/server/chat/events.ts`, `src/server/chat/products.ts`
- Modify: `src/server/chat/service.ts`
- Test: `src/server/chat/service-stream.test.ts`

**Interfaces:**
- Produces:
  - `src/server/chat/events.ts`:
    ```ts
    export type ChatEvent =
      | { type: "tool"; phase: "start" | "end"; tool: string; label: string; count?: number }
      | { type: "delta"; text: string }
      | { type: "done"; messageId: string; products: ChatProductSummary[]; tokens: number }
      | { type: "error"; recoverable: boolean; retryAfter?: number; message: string };
    export function toolLabel(name: string): string; // "search_products" → "Sto cercando nel catalogo…"
    ```
  - `src/server/chat/products.ts`: `CHAT_PRODUCT_SELECT` (Prisma select) · `type ChatProductSummary` · `resolveChatProducts(db, ids: string[]): Promise<ChatProductSummary[]>`.
  - `ChatService.generateStream(conversationId: string, agentId: string, signal: AbortSignal): AsyncGenerator<ChatEvent>`
  - `ChatService.persistUserMessage(conversationId, content)` e `deleteLastAssistant(conversationId)` (helper per il route).
- Consumes: `AIGateway.chatStream` (Task 3), `executeTool`/`TOOL_DECLARATIONS` (invariati).

- [ ] **Step 1: `products.ts` (DRY del select prodotti)**

Create `src/server/chat/products.ts`:

```ts
import "server-only";
import type { PrismaClient } from "@prisma/client";

export const CHAT_PRODUCT_SELECT = {
  id: true, agbCode: true, name: true, shortDescription: true,
  basePrice: true, priceUnit: true, isAvailable: true, stockQuantity: true, listinoPage: true,
} as const;

export interface ChatProductSummary {
  id: string; agbCode: string; name: string; shortDescription: string | null;
  basePrice: number; priceUnit: string; isAvailable: boolean; stockQuantity: number; listinoPage: number | null;
}

export async function resolveChatProducts(
  db: Pick<PrismaClient, "product">, ids: string[],
): Promise<ChatProductSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: CHAT_PRODUCT_SELECT });
  return rows.map((p) => ({ ...p, basePrice: Number(p.basePrice) }));
}
```

- [ ] **Step 2: `events.ts` + test di `toolLabel`**

Create `src/server/chat/events.ts`:

```ts
import type { ChatProductSummary } from "./products";

export type ChatEvent =
  | { type: "tool"; phase: "start" | "end"; tool: string; label: string; count?: number }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; products: ChatProductSummary[]; tokens: number }
  | { type: "error"; recoverable: boolean; retryAfter?: number; message: string };

const LABELS: Record<string, string> = {
  search_products: "Sto cercando nel catalogo…",
  get_product_by_code: "Sto recuperando la scheda…",
};
export function toolLabel(name: string): string {
  return LABELS[name] ?? "Sto consultando il catalogo…";
}
```

Create `src/server/chat/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toolLabel } from "./events";
describe("toolLabel", () => {
  it("mappa i tool noti", () => { expect(toolLabel("search_products")).toBe("Sto cercando nel catalogo…"); });
  it("fallback per tool ignoti", () => { expect(toolLabel("boh")).toBe("Sto consultando il catalogo…"); });
});
```

- [ ] **Step 3: Test di `generateStream` (fallisce)**

Create `src/server/chat/service-stream.test.ts`. Usa un gateway fake con `chatStream` scriptabile per round e un `db` fake (message.create/findMany, product.findMany, conversation.update). Verifica il caso "un round tool poi risposta":

```ts
import { describe, it, expect, vi } from "vitest";
import { ChatService } from "./service";
import type { ChatEvent } from "./events";

it("un round tool → eventi tool + delta + done", async () => {
  const gateway = {
    queryEmbeddings: () => undefined,
    chatStream: vi.fn()
      // round 0: chiede il tool
      .mockImplementationOnce(async function* () { yield { type: "tool-call", call: { id: "c0", name: "search_products", arguments: { query: "x" } } }; })
      // round 1: risposta finale
      .mockImplementationOnce(async function* () { yield { type: "text-delta", text: "Ecco " }; yield { type: "text-delta", text: "A50107.03" }; yield { type: "usage", tokens: 10 }; }),
  };
  const created: any[] = [];
  const db = fakeDb({ onCreate: (d) => created.push(d), products: [{ id: "p1", /* CHAT_PRODUCT_SELECT fields */ }] });
  // executeTool andrà mockato per restituire { output:{...}, productIds:["p1"] } — vedi helper del test
  const svc = new ChatService(db as any, gateway as any);
  const out: ChatEvent[] = [];
  for await (const e of svc.generateStream("conv1", "agent1", AbortSignal.timeout(2000))) out.push(e);

  expect(out.filter((e) => e.type === "tool")).toHaveLength(2); // start+end
  expect(out.filter((e) => e.type === "delta").map((e: any) => e.text).join("")).toBe("Ecco A50107.03");
  const done = out.find((e) => e.type === "done") as any;
  expect(done.messageId).toBeTruthy();
  expect(created.some((c) => c.role === "ASSISTANT" && c.content === "Ecco A50107.03" && c.status === "SENT")).toBe(true);
});
```

(Il test mocka `executeTool` via `vi.mock("./tools")` restituendo `{ output: { total: 1 }, productIds: ["p1"] }`.)

- [ ] **Step 4: Run → FAIL.** `pnpm test src/server/chat/service-stream.test.ts`

- [ ] **Step 5: Riscrivi `service.ts`**

Sostituisci `SYSTEM_PROMPT` (ultima regola) con l'abilitazione markdown:

```ts
export const SYSTEM_PROMPT = `Sei l'assistente tecnico-commerciale di Utensilferramenta Pistoiese per il catalogo ferramenta AGB. Rispondi in italiano agli agenti di vendita.
Regole:
- Usa SEMPRE i tool per cercare i prodotti: non inventare mai codici, prezzi o specifiche.
- Cita sempre il codice AGB dei prodotti di cui parli.
- Se una ricerca dà 0 risultati, riprova SUBITO nello stesso turno con termini più generali o senza filtri: non annunciare mai che farai un'altra ricerca, falla e basta. Rispondi solo quando hai risultati definitivi.
- Se non trovi nulla neanche senza filtri, dillo chiaramente e suggerisci come riformulare.
- Non trattare generazione kit o argomenti fuori dal catalogo AGB.
- Formatta con markdown conciso: elenchi puntati per più prodotti, **grassetto** per evidenziare, tabelle solo quando confronti più valori. Tieni le risposte brevi.`;
```

Aggiungi la costante e rimuovi `send`/`retry`/`generate`, sostituendoli con:

```ts
import type { ChatEvent } from "./events";
import { toolLabel } from "./events";
import { resolveChatProducts } from "./products";

const STREAM_MAX_TOOL_ROUNDS = 3;

// dentro class ChatService:

async persistUserMessage(conversationId: string, content: string): Promise<void> {
  await this.db.message.create({ data: { conversationId, role: "USER", content } });
}

/** «Rigenera»: elimina l'ultimo blocco ASSISTANT (l'ultimo per createdAt) prima di ristreammare. */
async deleteLastAssistant(conversationId: string): Promise<void> {
  const last = await this.db.message.findFirst({
    where: { conversationId, role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, select: { id: true },
  });
  if (last) await this.db.message.delete({ where: { id: last.id } });
}

async *generateStream(conversationId: string, agentId: string, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const startedAt = Date.now();
  const transcript: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...(await this.loadHistory(conversationId))];
  const productIds = new Set<string>();
  let tokens = 0;
  let finalText = "";
  let modelUsed = "";
  let persisted = false;
  let errored: { message: string; recoverable: boolean; retryAfter?: number } | null = null;

  try {
    for (let round = 0; ; round++) {
      const useTools = round < STREAM_MAX_TOOL_ROUNDS;
      const roundToolCalls: ToolCall[] = [];
      let roundText = "";
      for await (const chunk of this.gateway.chatStream(transcript, useTools ? TOOL_DECLARATIONS : [], { userId: agentId, signal })) {
        if (chunk.type === "text-delta") { roundText += chunk.text; finalText += chunk.text; yield { type: "delta", text: chunk.text }; }
        else if (chunk.type === "tool-call") roundToolCalls.push(chunk.call);
        else if (chunk.type === "usage") tokens += chunk.tokens;
      }
      if (roundToolCalls.length === 0 || !useTools) break; // risposta finale
      transcript.push({ role: "assistant", content: roundText || null, toolCalls: roundToolCalls });
      for (const call of roundToolCalls) {
        yield { type: "tool", phase: "start", tool: call.name, label: toolLabel(call.name) };
        const execution = await executeTool(this.db, call.name, call.arguments, this.gateway.queryEmbeddings());
        for (const id of execution.productIds) productIds.add(id);
        await this.db.message.create({ data: { conversationId, role: "TOOL", content: `Tool ${call.name}`, toolName: call.name, toolInput: call.arguments as Prisma.InputJsonValue, toolOutput: execution.output as Prisma.InputJsonValue } });
        yield { type: "tool", phase: "end", tool: call.name, label: toolLabel(call.name), count: execution.productIds.length };
        transcript.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: JSON.stringify(execution.output) });
      }
      if (signal.aborted) break;
    }
  } catch (error) {
    if (error instanceof RateLimitedError && finalText.length === 0) {
      // pre-primo-token: nessuna riga ASSISTANT, il client ri-tenta
      yield { type: "error", recoverable: true, retryAfter: 20, message: "Assistente momentaneamente occupato" };
      return;
    }
    errored = { message: error instanceof Error ? error.message : "Errore sconosciuto", recoverable: false };
  } finally {
    if (!persisted && (finalText.length > 0 || errored)) {
      const assistant = await this.db.message.create({
        data: {
          conversationId, role: "ASSISTANT", content: finalText,
          status: errored && finalText.length === 0 ? "ERROR" : "SENT",
          errorMessage: errored && finalText.length === 0 ? errored.message : null,
          modelUsed: modelUsed || null, tokensUsed: tokens, latencyMs: Date.now() - startedAt,
          referencedProductIds: [...productIds],
        },
      });
      await this.touchConversation(conversationId);
      persisted = true;
      // NB: gli eventi terminali sotto vengono emessi solo se il consumer è ancora in ascolto.
      if (errored && finalText.length === 0) {
        yield { type: "error", recoverable: false, message: errored.message };
      } else {
        const products = await resolveChatProducts(this.db, [...productIds]);
        yield { type: "done", messageId: assistant.id, products, tokens };
      }
    }
  }
}

private async touchConversation(conversationId: string): Promise<void> {
  await this.db.conversation.update({ where: { id: conversationId }, data: {} }); // bump updatedAt
}
```

> `ChatDb` va esteso con `conversation` e `product` (per `touchConversation`/`resolveChatProducts`): `export type ChatDb = ToolDb & Pick<PrismaClient, "message" | "conversation" | "product">;`

- [ ] **Step 6: Run → PASS.** `pnpm test src/server/chat && pnpm typecheck`

- [ ] **Step 7: Commit** `git commit -S -am "feat(chat): generateStream (eventi tool/delta/done/error) + prompt markdown"`

---

## Task 5: Route Handler `/api/chat/stream`

**Files:**
- Create: `src/app/api/chat/stream/route.ts`, `src/server/chat/stream-encode.ts` (+ test)
- Consumes: `ChatService` (Task 4), `getAIGateway`, `auth`, `db`.

**Interfaces:**
- `POST /api/chat/stream` body `{ conversationId: string; content?: string; mode: "send" | "regenerate" }`. Risposta `text/event-stream`, ogni evento `data: <json ChatEvent>\n\n`. 401 se non autenticato, 404 se non proprietario.
- Produces: `encodeSSE(event: ChatEvent): string`.

- [ ] **Step 1: Test di `encodeSSE`**

Create `src/server/chat/stream-encode.ts`:
```ts
import type { ChatEvent } from "./events";
export function encodeSSE(event: ChatEvent): string { return `data: ${JSON.stringify(event)}\n\n`; }
```
Create `stream-encode.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { encodeSSE } from "./stream-encode";
it("serializza un evento come frame SSE", () => {
  expect(encodeSSE({ type: "delta", text: "ciao" })).toBe('data: {"type":"delta","text":"ciao"}\n\n');
});
```
Run → PASS.

- [ ] **Step 2: Implementa il route handler**

Create `src/app/api/chat/stream/route.ts`:

```ts
import { z } from "zod";
import { auth } from "@/server/auth/config";
import { db } from "@/server/db";
import { getAIGateway } from "@/server/ai/gateway";
import { ChatService } from "@/server/chat/service";
import { encodeSSE } from "@/server/chat/stream-encode";
import { RateLimitedError } from "@/server/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000).optional(),
  mode: z.enum(["send", "regenerate"]),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Bad Request", { status: 400 });
  const { conversationId, content, mode } = parsed.data;

  const owned = await db.conversation.findFirst({
    where: { id: conversationId, agentId: session.user.id, status: { not: "DELETED" } },
    select: { id: true, title: true },
  });
  if (!owned) return new Response("Not Found", { status: 404 });

  const service = new ChatService(db, await getAIGateway());

  if (mode === "send") {
    if (!content) return new Response("Bad Request", { status: 400 });
    await service.persistUserMessage(conversationId, content);
    if (owned.title === "Nuova Conversazione") {
      await db.conversation.update({ where: { id: conversationId }, data: { title: content.slice(0, 60) } });
    }
  } else {
    await service.deleteLastAssistant(conversationId);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of service.generateStream(conversationId, session.user.id, req.signal)) {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        }
      } catch (error) {
        const message = error instanceof RateLimitedError ? "Assistente momentaneamente occupato" : "Errore imprevisto";
        const recoverable = error instanceof RateLimitedError;
        controller.enqueue(encoder.encode(encodeSSE({ type: "error", recoverable, message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 3: Typecheck + build check** `pnpm typecheck` → PASS.

- [ ] **Step 4: Commit** `git commit -S -am "feat(chat): route handler SSE /api/chat/stream (auth, ownership, mode send/regenerate)"`

---

## Task 6: Router conversazioni (rename/delete/list-search/get per-messaggio)

**Files:**
- Modify: `src/server/api/routers/chat.ts`
- Test: `src/server/api/routers/chat.test.ts` (se esiste; altrimenti crea test mirati sui nuovi input schema)

**Interfaces:**
- Produces: `chat.rename`, `chat.delete`, `chat.list({ search? })`, `chat.get` con `messages[].products`. **Rimosse** `chat.send`, `chat.retry`.

- [ ] **Step 1: Test dei nuovi comportamenti (fallisce)**

Aggiungi test che invocano le procedure con un caller mock (pattern del file esistente) per: `rename` aggiorna il titolo; `delete` imposta `status:"DELETED"`; `list` con `search` filtra per titolo; `get` restituisce `products` per messaggio ASSISTANT. (Se il repo non ha già test router, scrivi un test minimale con `appRouter.createCaller` + db mock.)

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Modifica `chat.ts`**

- Rimuovi le procedure `send` e `retry` (e `mapRateLimit`/import `ChatService` se non più usati altrove nel file).
- Estendi `PRODUCT_SUMMARY` importando `CHAT_PRODUCT_SELECT` da `@/server/chat/products` (DRY) o aggiungi `listinoPage: true`.
- `list`:

```ts
list: agentProcedure
  .input(z.object({ limit: z.number().int().min(1).max(50).default(20), search: z.string().trim().optional() }).optional())
  .query(async ({ ctx, input }) => {
    return ctx.db.conversation.findMany({
      where: {
        agentId: ctx.session.user.id, status: "ACTIVE",
        ...(input?.search ? { title: { contains: input.search, mode: "insensitive" as const } } : {}),
      },
      orderBy: { updatedAt: "desc" }, take: input?.limit ?? 20,
      select: { id: true, title: true, updatedAt: true },
    });
  }),
```

- `rename` / `delete`:

```ts
rename: agentProcedure
  .input(z.object({ conversationId: z.string().min(1), title: z.string().trim().min(1).max(80) }))
  .mutation(async ({ ctx, input }) => {
    await ownConversation(ctx, input.conversationId);
    await ctx.db.conversation.update({ where: { id: input.conversationId }, data: { title: input.title } });
    return { ok: true };
  }),

delete: agentProcedure
  .input(z.object({ conversationId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    await ownConversation(ctx, input.conversationId);
    await ctx.db.conversation.update({ where: { id: input.conversationId }, data: { status: "DELETED" } });
    return { ok: true };
  }),
```

- `get`: dopo aver caricato i messaggi, risolvi i prodotti **per messaggio**:

```ts
const products = await resolveChatProducts(ctx.db, [...new Set(messages.flatMap((m) => m.referencedProductIds))]);
const byId = new Map(products.map((p) => [p.id, p]));
const messagesOut = messages.map((m) => ({
  ...m,
  products: m.referencedProductIds.map((id) => byId.get(id)).filter((p): p is ChatProductSummary => Boolean(p)),
}));
return { conversation: { id: conv.id, title: conv.title }, messages: messagesOut };
```

(assicurati che `message.findMany` selezioni `referencedProductIds`, `id`, `role`, `content`, `status`, `errorMessage`, `createdAt`.)

- [ ] **Step 4: Run → PASS** + typecheck. `pnpm test src/server/api && pnpm typecheck`

- [ ] **Step 5: Commit** `git commit -S -am "feat(chat): rename/delete/list-search + get prodotti per-messaggio; via send/retry"`

---

## Task 7: Helper puri UI (raggruppo per data · near-bottom)

**Files:**
- Create: `src/lib/chat/group-conversations.ts`(+test), `src/lib/chat/scroll.ts`(+test)

**Interfaces:**
- Produces:
  - `groupConversations(items: {id;title;updatedAt:Date}[], now: Date): { label: string; items: T[] }[]` con label `"Oggi" | "Ieri" | "Ultimi 7 giorni" | "Più vecchie"`, gruppi vuoti omessi, ordine stabile.
  - `isNearBottom(el: { scrollTop; scrollHeight; clientHeight }, thresholdPx = 120): boolean`.

- [ ] **Step 1: Test `groupConversations` (fallisce)**

```ts
import { describe, it, expect } from "vitest";
import { groupConversations } from "./group-conversations";
const now = new Date("2026-07-24T12:00:00Z");
it("assegna i gruppi per data", () => {
  const g = groupConversations([
    { id: "a", title: "A", updatedAt: new Date("2026-07-24T09:00:00Z") },
    { id: "b", title: "B", updatedAt: new Date("2026-07-23T09:00:00Z") },
    { id: "c", title: "C", updatedAt: new Date("2026-07-20T09:00:00Z") },
    { id: "d", title: "D", updatedAt: new Date("2026-06-01T09:00:00Z") },
  ], now);
  expect(g.map((x) => x.label)).toEqual(["Oggi", "Ieri", "Ultimi 7 giorni", "Più vecchie"]);
});
it("omette i gruppi vuoti", () => {
  const g = groupConversations([{ id: "a", title: "A", updatedAt: now }], now);
  expect(g).toHaveLength(1);
  expect(g[0].label).toBe("Oggi");
});
```

- [ ] **Step 2: Run → FAIL.** `pnpm test src/lib/chat/group-conversations.test.ts`

- [ ] **Step 3: Implementa**

```ts
export interface HasDate { updatedAt: Date }
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function groupConversations<T extends HasDate>(items: T[], now: Date): { label: string; items: T[] }[] {
  const today = startOfDay(now).getTime();
  const day = 86_400_000;
  const buckets: { label: string; min: number; items: T[] }[] = [
    { label: "Oggi", min: today, items: [] },
    { label: "Ieri", min: today - day, items: [] },
    { label: "Ultimi 7 giorni", min: today - 7 * day, items: [] },
    { label: "Più vecchie", min: -Infinity, items: [] },
  ];
  for (const it of items) {
    const t = it.updatedAt.getTime();
    (buckets.find((b) => t >= b.min) ?? buckets[buckets.length - 1]).items.push(it);
  }
  return buckets.filter((b) => b.items.length > 0).map(({ label, items }) => ({ label, items }));
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Test + impl `isNearBottom`**

```ts
// scroll.test.ts
import { isNearBottom } from "./scroll";
it("vero se vicino al fondo", () => { expect(isNearBottom({ scrollTop: 880, scrollHeight: 1000, clientHeight: 100 })).toBe(true); });
it("falso se staccato", () => { expect(isNearBottom({ scrollTop: 200, scrollHeight: 1000, clientHeight: 100 })).toBe(false); });
```
```ts
// scroll.ts
export function isNearBottom(el: { scrollTop: number; scrollHeight: number; clientHeight: number }, thresholdPx = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}
```
Run → PASS.

- [ ] **Step 6: Commit** `git commit -S -am "feat(chat): helper puri raggruppo-conversazioni + near-bottom (TDD)"`

---

## Task 8: Hook `useChatStream` (deroga fetch/SSE + STOP)

**Files:**
- Create: `src/hooks/use-chat-stream.ts`
- Consumes: `ChatEvent` (via un tipo client duplicato o import type dal server-safe `events.ts`; importare solo il **tipo** è sicuro). Riusa `sseEvents`? No: lato client scriviamo un parser inline minimale (o riusiamo `eventsource-parser` client-side).

**Interfaces:**
- Produces:
  ```ts
  type StreamState = { status: "idle"|"streaming"|"error"; text: string; tool: string|null; error: { recoverable:boolean; retryAfter?:number; message:string }|null; products: ChatProductSummary[]; messageId: string|null };
  function useChatStream(): { state: StreamState; start(input:{conversationId:string; content?:string; mode:"send"|"regenerate"}): Promise<void>; stop(): void; reset(): void };
  ```

- [ ] **Step 1: Implementa il hook** (deroga documentata in cima al file)

```ts
"use client";
import { useCallback, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import type { ChatEvent } from "@/server/chat/events";
import type { ChatProductSummary } from "@/server/chat/products";

// DEROGA UNICA alla regola "no fetch diretto dal client" (spec D1): lo streaming SSE
// non è esprimibile via tRPC httpBatchLink. Confinata a questo hook.
export interface StreamState { /* come sopra */ }

export function useChatStream() {
  const [state, setState] = useState<StreamState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef("");

  const flush = useCallback(() => {
    rafRef.current = null;
    const chunk = bufferRef.current; bufferRef.current = "";
    if (chunk) setState((s) => ({ ...s, text: s.text + chunk }));
  }, []);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  const start = useCallback(async (input) => {
    abortRef.current?.abort();
    const ac = new AbortController(); abortRef.current = ac;
    setState({ ...initial, status: "streaming" });
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: ac.signal,
      });
      if (!res.ok || !res.body) { setState((s) => ({ ...s, status: "error", error: { recoverable: res.status === 429, message: "Errore di rete" } })); return; }
      const reader = res.body.getReader(); const decoder = new TextDecoder();
      const parser = createParser({ onEvent: (e) => handleEvent(JSON.parse(e.data) as ChatEvent) });
      function handleEvent(ev: ChatEvent) {
        if (ev.type === "delta") { bufferRef.current += ev.text; if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush); }
        else if (ev.type === "tool") setState((s) => ({ ...s, tool: ev.phase === "start" ? ev.label : null }));
        else if (ev.type === "done") { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); flush(); setState((s) => ({ ...s, status: "idle", tool: null, products: ev.products, messageId: ev.messageId })); }
        else if (ev.type === "error") setState((s) => ({ ...s, status: "error", tool: null, error: { recoverable: ev.recoverable, retryAfter: ev.retryAfter, message: ev.message } }));
      }
      for (;;) { const { done, value } = await reader.read(); if (value) parser.feed(decoder.decode(value, { stream: true })); if (done) break; }
    } catch (err) {
      if ((err as Error).name === "AbortError") { flush(); setState((s) => ({ ...s, status: "idle", tool: null })); return; } // STOP: tieni il parziale
      setState((s) => ({ ...s, status: "error", error: { recoverable: false, message: "Errore di connessione" } }));
    }
  }, [flush]);

  const reset = useCallback(() => setState(initial), []);
  return { state, start, stop, reset };
}
```

- [ ] **Step 2: Typecheck** `pnpm typecheck` → PASS. (Nota: importare **solo tipi** da moduli server-only è sicuro; se il bundler protesta, duplica i tipi in `src/lib/chat/chat-events.ts`.)

- [ ] **Step 3: Commit** `git commit -S -am "feat(chat): hook useChatStream (SSE, STOP, rAF-batch) — deroga fetch confinata"`

---

## Task 9: Rendering markdown (MarkdownMessage + CodeBlock)

**Files:**
- Create: `src/components/chat/code-block.tsx`, `src/components/chat/markdown-message.tsx`
- Dep: `pnpm add react-markdown remark-gfm`

**Interfaces:**
- Produces: `<MarkdownMessage content={string} />` (blocco AI markdown, codici AGB mono, code-block con copia).

- [ ] **Step 1: Installa** `pnpm add react-markdown remark-gfm`

- [ ] **Step 2: `CodeBlock`** (riusa il pattern copia di `CopyCodeButton`)

```tsx
"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };
  return (
    <div className="relative my-2 overflow-x-auto rounded-md border border-line bg-surface-sunken">
      <button type="button" onClick={copy} aria-label="Copia codice" className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-line-strong bg-surface px-2 py-1 text-xs text-ink-muted hover:bg-surface-sunken">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? "Copiato" : "Copia"}
      </button>
      <pre className="overflow-x-auto p-3 pt-9 text-xs"><code className="font-mono">{children}</code></pre>
    </div>
  );
}
```

- [ ] **Step 3: `MarkdownMessage`** con renderer custom e codici AGB mono

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

const AGB_CODE = /\b([A-Z]\d{4,5}(?:\.[0-9A-Z]{2,3})*)\b/g;
function withAgbMono(text: string) {
  const parts = text.split(AGB_CODE);
  return parts.map((p, i) => (i % 2 === 1 ? <code key={i} className="rounded bg-ink/[0.06] px-1 font-mono text-[0.92em]">{p}</code> : p));
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-chat text-sm leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => <a href={href} className="text-info underline">{children}</a>,
          table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
          th: ({ children }) => <th className="border border-line-strong bg-surface-sunken px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-line-strong px-2 py-1">{children}</td>,
          code: ({ className, children }) => {
            const text = String(children).replace(/\n$/, "");
            if (className?.includes("language-") || text.includes("\n")) return <CodeBlock>{text}</CodeBlock>;
            return <code className="rounded bg-ink/[0.06] px-1 font-mono text-[0.92em]">{text}</code>;
          },
          text: ({ children }) => <>{withAgbMono(String(children))}</>,
        }}
      >{content}</ReactMarkdown>
    </div>
  );
}
```

> Se il componente `text` non è supportato dalla versione di react-markdown installata, applica `withAgbMono` dentro `p`/`li` iterando i children stringa. Verificare in browser (Task 13).

- [ ] **Step 4: Typecheck + lint.** `pnpm typecheck && pnpm lint`

- [ ] **Step 5: Commit** `git commit -S -am "feat(chat): rendering markdown (react-markdown+gfm), code-block copia, codici AGB mono"`

---

## Task 10: Componenti UI (composer · tool-status · error-banner · inline-products · message-turn · conversations-panel · scroll-to-bottom)

**Files:** create i componenti elencati in File Structure.

**Interfaces (props principali):**
- `<Composer onSend(text) streaming onStop disabled />` — textarea auto-grow, Invio/Shift+Invio, Invia↔STOP, contatore.
- `<ToolStatus label />` — chip info con spinner.
- `<ErrorBanner error onRetry />` — banner + countdown da `retryAfter`.
- `<InlineProducts products />` — chip «N prodotti» + card (thumbnail `ProductThumb`, `CopyCodeButton`, prezzo `formatPrice`, badge, link archivio, `ListinoButton`).
- `<MessageTurn role content status products streaming actions />` — utente pill dx / AI blocco full-width + `MarkdownMessage` + azioni Copia/Rigenera.
- `<ConversationsPanel items activeId onSelect onNew onRename onDelete onArchive search onSearch />` — usa `groupConversations`, dropdown ⋯ `fixed` (pattern `utenti-client.tsx`).
- `<ScrollToBottom onClick visible />`.

- [ ] **Step 1: Composer** (auto-grow via `useRef`+`scrollHeight`; STOP quando `streaming`)

```tsx
"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { SendHorizonal, Square } from "lucide-react";
const MAX = 4000;
export function Composer({ onSend, streaming, onStop, disabled }: { onSend: (t: string) => void; streaming: boolean; onStop: () => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = "0px"; el.style.height = Math.min(el.scrollHeight, 168) + "px"; }, [value]);
  const submit = () => { const t = value.trim(); if (!t || streaming || disabled) return; onSend(t); setValue(""); };
  return (
    <form className="flex items-end gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex-1">
        <textarea ref={ref} rows={1} value={value} maxLength={MAX} aria-label="Messaggio per l'assistente" placeholder="Chiedi all'assistente…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-42 w-full resize-none rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        {value.length > 3500 && <p className="mt-1 text-right text-xs text-ink-subtle">{value.length}/{MAX}</p>}
      </div>
      {streaming ? (
        <button type="button" onClick={onStop} aria-label="Interrompi" className="inline-flex size-11 items-center justify-center rounded-lg border border-line-strong text-danger hover:bg-surface-sunken"><Square className="size-4" /></button>
      ) : (
        <button type="submit" disabled={disabled || value.trim().length === 0} aria-label="Invia messaggio" className="inline-flex size-11 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50"><SendHorizonal className="size-4" /></button>
      )}
    </form>
  );
}
```

- [ ] **Step 2: ToolStatus** (chip info + spinner) — vedi anteprima; reduced-motion guard sullo spin.
- [ ] **Step 3: ErrorBanner** (countdown `retryAfter` con `useEffect`+`setInterval`, «Riprova»).
- [ ] **Step 4: InlineProducts** (chip espandibile `useState`, card come da anteprima; riusa `ProductThumb`, `CopyCodeButton`, `ListinoButton`, `formatPrice`).
- [ ] **Step 5: MessageTurn** (utente pill dx; AI: `ai-mark` + `MarkdownMessage` + `InlineProducts` + azioni Copia/Rigenera; cursore typing se `streaming`; stato ERROR con Rigenera).
- [ ] **Step 6: ConversationsPanel** (input ricerca, `groupConversations(items, new Date())` con header gruppi, voce attiva `bg-brand-light`, ⋯ dropdown `fixed`, rinomina inline, elimina con conferma inline).
- [ ] **Step 7: ScrollToBottom** (bottone flottante `absolute bottom-20`).
- [ ] **Step 8: Typecheck + lint** `pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 9: Commit** `git commit -S -am "feat(chat): componenti UI (composer, tool-status, error, inline-products, message-turn, conversations)"`

---

## Task 11: Rewrite `assistente-client.tsx` + persistenza URL + wiring

**Files:**
- Rewrite: `src/app/(dashboard)/assistente/assistente-client.tsx`
- Modify: `src/app/(dashboard)/assistente/page.tsx` (wrap in `<Suspense>` per `useSearchParams`)
- Delete: `src/components/chat/message-bubble.tsx`, `chat-input.tsx`, `product-panel.tsx`

**Interfaces:**
- Consumes: `useChatStream` (Task 8), `api.chat.list/get/create/rename/delete/archive`, tutti i componenti (Task 10).

- [ ] **Step 1: Struttura a due zone + stato**

Composizione: layout `flex h-[100dvh]`; rail conversazioni (desktop, collassabile) / drawer (mobile via stato `drawerOpen`, riuso pattern `topbar.tsx`); colonna chat = header compatto + lista messaggi (`overflow-y-auto`, `aria-live="polite"`, `onScroll`→`isNearBottom`) + `Composer`. `conversationId` da `useSearchParams().get("c")`; cambio via `router.replace(\`?c=${id}\`, { scroll: false })`.

- [ ] **Step 2: Flusso invio/streaming**

```tsx
const { state, start, stop } = useChatStream();
const handleSend = async (content: string) => {
  let id = conversationId;
  if (!id) { id = (await create.mutateAsync()).id; router.replace(`?c=${id}`, { scroll: false }); }
  await start({ conversationId: id, content, mode: "send" });
  void utils.chat.get.invalidate({ conversationId: id });   // dopo done: ricarica la storia canonica
  void utils.chat.list.invalidate();
};
const handleRegenerate = async () => { if (!conversationId) return; await start({ conversationId, mode: "regenerate" }); void utils.chat.get.invalidate({ conversationId }); };
```

Durante lo streaming, renderizza i messaggi persistiti da `chat.get` **più** una bolla assistant "live" da `state.text`/`state.tool`/`state.products`/`state.error`. A `done` (`state.status==="idle"` + invalidate) la bolla live viene rimpiazzata dalla riga persistita (dedup: nascondi la live quando `!isStreaming && !state.text`).

- [ ] **Step 3: Empty-state + prompt d'esempio + scroll intelligente + STOP.** (autoscroll solo se near-bottom; `ScrollToBottom` altrimenti.)

- [ ] **Step 4: `page.tsx` sotto `<Suspense>`** (per `useSearchParams`, come `archivio/page.tsx`).

- [ ] **Step 5: Elimina i componenti vecchi**

```bash
git rm src/components/chat/message-bubble.tsx src/components/chat/chat-input.tsx src/components/chat/product-panel.tsx
```
Assicurati che nessun altro file li importi (`git grep -n "message-bubble\|chat-input\|product-panel" src`).

- [ ] **Step 6: Gate** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → PASS.

- [ ] **Step 7: Commit** `git commit -S -am "feat(chat): nuova UI assistente (streaming, 2-zone, URL ?c=), rimuovi componenti bozza"`

---

## Task 12: Verifica browser (desktop + mobile ≤375px) + doc

**Files:** `CLAUDE.md`, `handoff.md` (update); nessun codice nuovo salvo fix da verifica.

- [ ] **Step 1: Avvia l'app** (`bash scripts/dev-bootstrap.sh` + `pnpm dev`; serve una `GEMINI_API_KEY` reale in `.env`, altrimenti testa gli stati con provider stub).

- [ ] **Step 2: Verifica desktop (Chromium)**: nuova conversazione → invio → stati «Sto cercando…» → streaming token-by-token → STOP interrompe e tiene il parziale → card prodotto inline (thumbnail/prezzo/listino) → Copia/Rigenera → markdown (tabella/elenco/code-block+copia) → rename/delete/search conversazioni → refresh mantiene `?c=`.

- [ ] **Step 3: Verifica mobile ≤375px**: drawer conversazioni (backdrop/Esc), composer sticky sopra la tastiera, nessuna funzione tagliata, card prodotto inline leggibili, dropdown ⋯ non ritagliato, scroll intelligente + «scorri in fondo».

- [ ] **Step 4: Screenshot** desktop + 375px allegati; correggi eventuali difetti trovati (commit mirati).

- [ ] **Step 5: Aggiorna doc**

- `CLAUDE.md`: riga provider → «Provider LLM: Gemini unico (chat streaming + embedding). Kimi rimosso 2026-07-24 (kit deterministico, nessun consumatore). Resilienza = breaker per-Gemini + rate-limit + degrado; ⚠ concentrazione vendor app-wide (chat+ricerca semantica).» Nota anche la deroga fetch confinata a `useChatStream`.
- `handoff.md`: nuova sezione «Chat streaming ✅» (decisioni 2× council, scope core, azioni ops = solo env Vercel `KIMI_MODEL`/`MOONSHOT_API_KEY` da rimuovere se presenti, no migrazioni).

- [ ] **Step 6: Commit** `git commit -S -am "docs: chiusura chat streaming (CLAUDE.md provider + handoff)"`

---

## Note operative finali (post-merge)
- **Nessuna migrazione, nessun seed.**
- **Env Vercel (non bloccante):** rimuovere `KIMI_MODEL` / `MOONSHOT_API_KEY` se presenti.
- PR solo dopo ok utente (come da workflow).

## Self-Review (fatto)
- **Copertura spec:** streaming(T2-5), STOP(T8), stati tool(T4,T10), Gemini-only(T1), conversazioni rename/delete/search(T6,T10), rendering markdown(T9), prodotti inline B1(T4,T6,T10), azioni copia/rigenera(T5,T10,T11), URL(T11), mobile-first(T10-12), degrado 429(T4,T10). ✔
- **Placeholder:** nessuno (codice reale in ogni step; UI di dettaglio verificata in browser T12). ✔
- **Coerenza tipi:** `ChatEvent`/`ProviderChunk`/`ChatProductSummary` definiti una volta e riusati; `chatStream`/`generateStream` firme coerenti tra task. ✔
