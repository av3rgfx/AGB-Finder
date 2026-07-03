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
