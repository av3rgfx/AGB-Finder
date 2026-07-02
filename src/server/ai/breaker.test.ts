import { describe, it, expect } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { RedisCircuitBreaker } from "./breaker";

describe("RedisCircuitBreaker", () => {
  it("resta chiuso sotto la soglia di fallimenti", async () => {
    const breaker = new RedisCircuitBreaker(new FakeRedis());
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("apre alla soglia (5 fallimenti in 60s) e resta aperto per openSeconds", async () => {
    const redis = new FakeRedis();
    const breaker = new RedisCircuitBreaker(redis);
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(true);
    redis.advance(29_000);
    expect(await breaker.isOpen("gemini")).toBe(true);
  });

  it("half-open: scaduto il TTL torna chiuso (la prima chiamata fa da probe)", async () => {
    const redis = new FakeRedis();
    const breaker = new RedisCircuitBreaker(redis);
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    redis.advance(31_000);
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("un successo azzera il conteggio fallimenti", async () => {
    const redis = new FakeRedis();
    const breaker = new RedisCircuitBreaker(redis);
    for (let i = 0; i < 4; i++) await breaker.recordFailure("gemini");
    await breaker.recordSuccess("gemini");
    await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("gemini")).toBe(false);
  });

  it("i provider hanno breaker indipendenti", async () => {
    const breaker = new RedisCircuitBreaker(new FakeRedis());
    for (let i = 0; i < 5; i++) await breaker.recordFailure("gemini");
    expect(await breaker.isOpen("kimi")).toBe(false);
  });
});
