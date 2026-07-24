import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { CircuitBreaker } from "./breaker";
import { RateLimiter } from "./ratelimit";
import { ProviderHttpError } from "./errors";
import { AIGateway } from "./gateway";
import type { ChatProvider, ChatResult } from "./providers/types";

const OK: ChatResult = { text: "ok", toolCalls: [], modelUsed: "m", tokensUsed: 1 };

function provider(
  name: string,
  impl: () => Promise<ChatResult>,
): ChatProvider & { chat: ReturnType<typeof vi.fn> } {
  return { name, chat: vi.fn(impl) } as never;
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
