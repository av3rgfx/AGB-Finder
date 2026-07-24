import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { CircuitBreaker } from "./breaker";
import { RateLimiter } from "./ratelimit";
import { ProviderHttpError } from "./errors";
import { AIGateway } from "./gateway";
import type { ChatProvider, ChatResult, ProviderChunk } from "./providers/types";

const OK: ChatResult = { text: "ok", toolCalls: [], modelUsed: "m", tokensUsed: 1 };

function provider(
  name: string,
  impl: () => Promise<ChatResult>,
): ChatProvider & { chat: ReturnType<typeof vi.fn> } {
  return { name, chat: vi.fn(impl) } as never;
}

/** Provider fake per lo streaming: chat() non usato dai test ma richiesto dall'interfaccia ChatProvider. */
function streamProvider(
  name: string,
  chunks: ProviderChunk[],
): ChatProvider & { chatStream: ReturnType<typeof vi.fn> } {
  return {
    name,
    chat: vi.fn(() => Promise.resolve(OK)),
    chatStream: vi.fn(async function* () {
      for (const chunk of chunks) yield chunk;
    }),
  } as never;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

let redis: FakeRedis;

function gateway(
  providers: ChatProvider[],
  overrides: Partial<ConstructorParameters<typeof AIGateway>[0]> = {},
) {
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
    await expect(gw.chat([], [], { userId: "u1" })).rejects.toMatchObject({
      name: "RateLimitedError",
    });
  });

  it("primo provider ok → risponde e registra il successo", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    const result = await gateway([gemini]).chat([], [], { userId: "u1" });
    expect(result).toEqual(OK);
    expect(gemini.chat).toHaveBeenCalledTimes(1);
  });

  it("429 → 1 retry sullo stesso provider, poi ok", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    gemini.chat
      .mockRejectedValueOnce(new ProviderHttpError("gemini", 429))
      .mockResolvedValueOnce(OK);
    const result = await gateway([gemini]).chat([], [], { userId: "u1" });
    expect(result).toEqual(OK);
    expect(gemini.chat).toHaveBeenCalledTimes(2); // 1 + 1 retry
  });

  it("errore non ritentabile (es. 400) → niente retry, nessun altro provider → AIUnavailableError", async () => {
    const gemini = provider("gemini", () => Promise.reject(new ProviderHttpError("gemini", 400)));
    await expect(gateway([gemini]).chat([], [], { userId: "u1" })).rejects.toMatchObject({
      name: "AIUnavailableError",
    });
    expect(gemini.chat).toHaveBeenCalledTimes(1);
  });

  it("breaker aperto → salta il provider senza chiamarlo → AIUnavailableError", async () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    const breaker = new CircuitBreaker(redis);
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    await expect(
      gateway([gemini], { breaker }).chat([], [], { userId: "u1" }),
    ).rejects.toMatchObject({ name: "AIUnavailableError" });
    expect(gemini.chat).not.toHaveBeenCalled();
  });

  it("provider giù → AIUnavailableError e fallimento registrato sul breaker", async () => {
    const gemini = provider("gemini", () => Promise.reject(new ProviderHttpError("gemini", 500)));
    const gw = gateway([gemini]);
    await expect(gw.chat([], [], { userId: "u1" })).rejects.toMatchObject({
      name: "AIUnavailableError",
    });
    expect(await redis.get("cb:gemini:fail")).toBe("1");
  });
});

describe("AIGateway.chatStream", () => {
  it("oltre 20 msg/min per utente → RateLimitedError", async () => {
    const gemini = streamProvider("gemini", []);
    const gw = gateway([gemini]);
    for (let i = 0; i < 20; i++) await drain(gw.chatStream([], [], { userId: "u1" }));
    await expect(drain(gw.chatStream([], [], { userId: "u1" }))).rejects.toMatchObject({
      name: "RateLimitedError",
    });
  });

  it("breaker aperto → salta il provider senza chiamarlo → AIUnavailableError", async () => {
    const gemini = streamProvider("gemini", []);
    const breaker = new CircuitBreaker(redis);
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    await expect(
      drain(gateway([gemini], { breaker }).chatStream([], [], { userId: "u1" })),
    ).rejects.toMatchObject({ name: "AIUnavailableError" });
    expect(gemini.chatStream).not.toHaveBeenCalled();
  });

  it("inoltra i chunk nell'ordine esatto del provider e registra il successo sul breaker", async () => {
    const chunks: ProviderChunk[] = [
      { type: "text-delta", text: "ciao" },
      { type: "text-delta", text: " mondo" },
      { type: "usage", tokens: 42 },
    ];
    const gemini = streamProvider("gemini", chunks);
    const breaker = new CircuitBreaker(redis);
    const recordSuccess = vi.spyOn(breaker, "recordSuccess");
    const out = await drain(gateway([gemini], { breaker }).chatStream([], [], { userId: "u1" }));
    expect(out).toEqual(chunks); // toEqual su array verifica anche l'ordine
    expect(recordSuccess).toHaveBeenCalledWith("gemini");
  });

  it("errore del provider a metà stream → registra il fallimento sul breaker e rilancia", async () => {
    const error = new ProviderHttpError("gemini", 500);
    const gemini: ChatProvider = {
      name: "gemini",
      chat: vi.fn(() => Promise.resolve(OK)),
      chatStream: vi.fn(async function* () {
        yield { type: "text-delta", text: "hi" } as ProviderChunk;
        throw error;
      }),
    } as never;
    const breaker = new CircuitBreaker(redis);
    const recordFailure = vi.spyOn(breaker, "recordFailure");
    await expect(
      drain(gateway([gemini], { breaker }).chatStream([], [], { userId: "u1" })),
    ).rejects.toBe(error);
    expect(recordFailure).toHaveBeenCalledWith("gemini");
  });

  it("STOP dell'utente (signal del chiamante abortato) a metà stream → NON registra il fallimento sul breaker", async () => {
    const controller = new AbortController();
    const gemini: ChatProvider = {
      name: "gemini",
      chat: vi.fn(() => Promise.resolve(OK)),
      chatStream: vi.fn(async function* () {
        yield { type: "text-delta", text: "hi" } as ProviderChunk;
        controller.abort(); // l'utente preme STOP a metà stream
        throw new DOMException("Aborted", "AbortError");
      }),
    } as never;
    const breaker = new CircuitBreaker(redis);
    const recordFailure = vi.spyOn(breaker, "recordFailure");
    await expect(
      drain(
        gateway([gemini], { breaker }).chatStream([], [], {
          userId: "u1",
          signal: controller.signal,
        }),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(recordFailure).not.toHaveBeenCalled();
    expect(await redis.get("cb:gemini:fail")).toBeNull();
  });
});

describe("AIGateway.providerNames", () => {
  it("espone i nomi dei provider configurati", () => {
    const gemini = provider("gemini", () => Promise.resolve(OK));
    expect(gateway([gemini]).providerNames()).toEqual(["gemini"]);
  });

  it("vuoto quando nessun provider è configurato", () => {
    expect(gateway([]).providerNames()).toEqual([]);
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
