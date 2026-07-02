import { describe, it, expect } from "vitest";
import { FakeRedis } from "@/test/fake-redis";
import { RedisRateLimiter } from "./ratelimit";

describe("RedisRateLimiter (finestra fissa)", () => {
  it("consente fino a `limit` chiamate nella finestra e rifiuta le successive", async () => {
    const redis = new FakeRedis();
    const limiter = new RedisRateLimiter(redis);
    expect(await limiter.consume("user:a", 2, 60)).toBe(true);
    expect(await limiter.consume("user:a", 2, 60)).toBe(true);
    expect(await limiter.consume("user:a", 2, 60)).toBe(false);
  });

  it("il budget si azzera alla scadenza della finestra", async () => {
    const redis = new FakeRedis();
    const limiter = new RedisRateLimiter(redis);
    await limiter.consume("user:a", 1, 60);
    expect(await limiter.consume("user:a", 1, 60)).toBe(false);
    redis.advance(61_000);
    expect(await limiter.consume("user:a", 1, 60)).toBe(true);
  });

  it("chiavi diverse hanno budget indipendenti", async () => {
    const redis = new FakeRedis();
    const limiter = new RedisRateLimiter(redis);
    expect(await limiter.consume("user:a", 1, 60)).toBe(true);
    expect(await limiter.consume("user:b", 1, 60)).toBe(true);
  });
});
