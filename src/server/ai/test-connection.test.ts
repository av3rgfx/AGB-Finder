import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock("./providers/gemini", () => ({
  GeminiChatProvider: vi.fn(() => ({ name: "gemini", chat: chatMock })),
}));
vi.mock("./providers/kimi", () => ({
  KimiChatProvider: vi.fn(() => ({ name: "kimi", chat: chatMock })),
}));
vi.mock("@/env", () => ({ env: { GEMINI_MODEL: "m", KIMI_MODEL: "m" } }));

import { testProviderKey } from "./test-connection";

beforeEach(() => chatMock.mockReset());

describe("testProviderKey", () => {
  it("ritorna ok con latenza quando la chat riesce", async () => {
    chatMock.mockResolvedValueOnce({ text: "pong", toolCalls: [], modelUsed: "m", tokensUsed: null });
    const result = await testProviderKey("gemini", "sk-good");
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("ritorna ok:false con il messaggio d'errore quando la chat fallisce", async () => {
    // mockRejectedValueOnce (non mockRejectedValue): con la variante persistente dopo un
    // mockResolvedValue in un test precedente, Vitest 3.2.6 segnala erroneamente il test come
    // fallito con l'errore del mock anche se il try/catch di testProviderKey lo gestisce
    // correttamente (verificato con debug logging: risultato ok:false corretto, nessun
    // unhandledRejection reale). "Once" è comunque semanticamente corretto: ogni test invoca
    // il mock una sola volta.
    chatMock.mockRejectedValueOnce(new Error("401 Unauthorized"));
    const result = await testProviderKey("kimi", "sk-bad");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });
});
