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
