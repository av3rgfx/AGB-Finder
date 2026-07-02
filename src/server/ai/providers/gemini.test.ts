import { describe, it, expect, vi } from "vitest";
import { GeminiChatProvider } from "./gemini";
import { ProviderHttpError, type ChatTurn, type ToolDeclaration } from "./types";

const TOOLS: ToolDeclaration[] = [
  {
    name: "search_products",
    description: "Cerca prodotti",
    parameters: { type: "object", properties: { query: { type: "string" } } },
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("GeminiChatProvider", () => {
  it("mappa i turni nel formato generateContent (system → systemInstruction, tool → functionResponse)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "ciao" }], role: "model" } }],
        usageMetadata: { totalTokenCount: 42 },
      }),
    );
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchMock);
    const turns: ChatTurn[] = [
      { role: "system", content: "Sei un assistente." },
      { role: "user", content: "cerniere" },
      { role: "assistant", content: null, toolCalls: [{ id: "call_0", name: "search_products", args: { query: "cerniere" } }] },
      { role: "tool", content: null, toolCallId: "call_0", toolName: "search_products", toolOutput: { hits: [] } },
    ];
    const result = await provider.complete(turns, TOOLS);

    expect(result).toEqual({ text: "ciao", toolCalls: [], tokensUsed: 42 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("models/gemini-2.5-flash:generateContent");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Sei un assistente.");
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "cerniere" }] },
      { role: "model", parts: [{ functionCall: { name: "search_products", args: { query: "cerniere" } } }] },
      { role: "user", parts: [{ functionResponse: { name: "search_products", response: { result: { hits: [] } } } }] },
    ]);
    expect(body.tools).toEqual([{ functionDeclarations: TOOLS }]);
  });

  it("estrae le functionCall come toolCalls con id sintetici", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ functionCall: { name: "search_products", args: { query: "x" } } }] } },
        ],
      }),
    );
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchMock);
    const result = await provider.complete([{ role: "user", content: "x" }], TOOLS);
    expect(result.text).toBeNull();
    expect(result.toolCalls).toEqual([{ id: "call_0", name: "search_products", args: { query: "x" } }]);
  });

  it("HTTP non-ok → ProviderHttpError con status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchMock);
    await expect(provider.complete([{ role: "user", content: "x" }], [])).rejects.toThrowError(
      ProviderHttpError,
    );
    await expect(provider.complete([{ role: "user", content: "x" }], [])).rejects.toMatchObject({
      status: 429,
    });
  });
});
