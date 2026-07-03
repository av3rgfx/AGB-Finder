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
    await expect(gw.chat([], [], { userId: "u1" })).rejects.toMatchObject({
      name: "AIUnavailableError",
    });
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
