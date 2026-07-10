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
