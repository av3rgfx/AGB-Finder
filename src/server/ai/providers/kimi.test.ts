import { describe, it, expect, vi } from "vitest";
import { KimiChatProvider } from "./kimi";
import { ProviderHttpError, type ChatTurn } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("KimiChatProvider", () => {
  it("mappa i turni nel formato OpenAI (assistant tool_calls, tool → role tool)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: "ecco" } }],
        usage: { total_tokens: 7 },
      }),
    );
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchMock);
    const turns: ChatTurn[] = [
      { role: "system", content: "Sei un assistente." },
      { role: "user", content: "cerniere" },
      { role: "assistant", content: null, toolCalls: [{ id: "abc", name: "search_products", args: { query: "cerniere" } }] },
      { role: "tool", content: null, toolCallId: "abc", toolName: "search_products", toolOutput: { hits: [] } },
    ];
    const result = await provider.complete(turns, []);

    expect(result).toEqual({ text: "ecco", toolCalls: [], tokensUsed: 7 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("kimi-k2.6");
    expect(body.messages).toEqual([
      { role: "system", content: "Sei un assistente." },
      { role: "user", content: "cerniere" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "abc", type: "function", function: { name: "search_products", arguments: '{"query":"cerniere"}' } },
        ],
      },
      { role: "tool", tool_call_id: "abc", content: '{"hits":[]}' },
    ]);
  });

  it("estrae i tool_calls (arguments JSON string → args object)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: "x1", type: "function", function: { name: "search_products", arguments: '{"query":"maniglie"}' } },
              ],
            },
          },
        ],
      }),
    );
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchMock);
    const result = await provider.complete([{ role: "user", content: "maniglie" }], []);
    expect(result.toolCalls).toEqual([{ id: "x1", name: "search_products", args: { query: "maniglie" } }]);
  });

  it("HTTP non-ok → ProviderHttpError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchMock);
    await expect(provider.complete([{ role: "user", content: "x" }], [])).rejects.toMatchObject({
      provider: "kimi",
      status: 500,
    });
  });
});
