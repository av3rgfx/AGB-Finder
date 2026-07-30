import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";

const { testProviderKey, setApiKey, getStatus, resolveApiKey } = vi.hoisted(() => ({
  testProviderKey: vi.fn(),
  setApiKey: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockResolvedValue({ provider: "gemini", configured: true, source: "db", maskedSuffix: "1111", updatedAt: null, updatedBy: null }),
  resolveApiKey: vi.fn(),
}));
vi.mock("@/server/ai/test-connection", () => ({ testProviderKey }));
vi.mock("@/server/settings/service", () => ({ setApiKey, getStatus, resolveApiKey }));
vi.mock("@/server/ai/redis", () => ({ getRedis: () => ({}) }));

const { getDiscountThreshold, setDiscountThreshold } = vi.hoisted(() => ({
  getDiscountThreshold: vi.fn().mockResolvedValue(40),
  setDiscountThreshold: vi.fn().mockResolvedValue(55),
}));
vi.mock("@/server/settings/discount-threshold", () => ({
  getDiscountThreshold,
  setDiscountThreshold,
  SOGLIA_SCONTO_DEFAULT: 40,
}));

import { settingsRouter } from "./settings";

const appRouter = createTRPCRouter({ settings: settingsRouter });
const makeCtx = (session: unknown): TRPCContext => ({
  db: {} as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
});
const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };
const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  testProviderKey.mockReset();
  setApiKey.mockClear();
});

describe("settings.aiKeys authorization", () => {
  it("nega un AGENT con FORBIDDEN", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.settings.aiKeys.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("settings.aiKeys.set", () => {
  it("rifiuta con BAD_REQUEST se il test di connessione fallisce (non persiste)", async () => {
    testProviderKey.mockResolvedValue({ ok: false, error: "401 Unauthorized" });
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.settings.aiKeys.set({ provider: "gemini", apiKey: "sk-bad" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(setApiKey).not.toHaveBeenCalled();
  });

  it("persiste la key quando il test riesce", async () => {
    testProviderKey.mockResolvedValue({ ok: true, latencyMs: 12 });
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await caller.settings.aiKeys.set({ provider: "gemini", apiKey: "sk-good" });
    expect(setApiKey).toHaveBeenCalledWith(expect.anything(), expect.anything(), "gemini", "sk-good", "admin1");
  });
});

describe("settings.discountThreshold", () => {
  it("un AGENT puo` leggere la soglia (gli serve per l'avviso)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.settings.discountThreshold.get()).resolves.toBe(40);
  });

  it("un AGENT NON puo` cambiarla", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.settings.discountThreshold.set({ soglia: 90 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setDiscountThreshold).not.toHaveBeenCalled();
  });

  it("un ADMIN la cambia", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(caller.settings.discountThreshold.set({ soglia: 55 })).resolves.toBe(55);
    expect(setDiscountThreshold).toHaveBeenCalledWith(expect.anything(), 55, "admin1");
  });

  it("rifiuta una soglia fuori da 0-100", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.settings.discountThreshold.set({ soglia: 101 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
