import { describe, it, expect, vi } from "vitest";
import { KimiChatProvider } from "./kimi";
import type { ChatMessage, ToolDeclaration } from "./types";

const TOOLS: ToolDeclaration[] = [
  { name: "search_products", description: "cerca", parameters: { type: "object", properties: {} } },
];

function fetchReturning(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(payload),
  });
}

const signal = new AbortController().signal;

describe("KimiChatProvider", () => {
  it("mappa i messaggi nel formato OpenAI (tool_calls e role tool)", async () => {
    const fetchImpl = fetchReturning({ choices: [{ message: { content: "ok" } }] });
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchImpl as never);
    const messages: ChatMessage[] = [
      { role: "system", content: "istruzioni" },
      { role: "user", content: "ciao" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "c1", name: "search_products", arguments: { query: "x" } }],
      },
      { role: "tool", toolCallId: "c1", toolName: "search_products", content: '{"total":0}' },
    ];
    await provider.chat(messages, TOOLS, signal);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("kimi-k2.6");
    expect(body.messages[0]).toEqual({ role: "system", content: "istruzioni" });
    expect(body.messages[2].tool_calls[0]).toEqual({
      id: "c1",
      type: "function",
      function: { name: "search_products", arguments: '{"query":"x"}' },
    });
    expect(body.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: '{"total":0}' });
    expect(body.tools[0]).toEqual({ type: "function", function: TOOLS[0] });
  });

  it("estrae testo, tool_calls (argomenti JSON) e usage", async () => {
    const fetchImpl = fetchReturning({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "c9", function: { name: "search_products", arguments: '{"query":"cerniera"}' } },
            ],
          },
        },
      ],
      usage: { total_tokens: 17 },
    });
    const provider = new KimiChatProvider("key", "kimi-k2.6", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], TOOLS, signal);
    expect(result.toolCalls).toEqual([
      { id: "c9", name: "search_products", arguments: { query: "cerniera" } },
    ]);
    expect(result.text).toBeNull();
    expect(result.tokensUsed).toBe(17);
    expect(result.modelUsed).toBe("kimi-k2.6");
  });

  it("argomenti tool con JSON invalido → oggetto vuoto (il modello riformulerà)", async () => {
    const fetchImpl = fetchReturning({
      choices: [
        { message: { tool_calls: [{ id: "c1", function: { name: "t", arguments: "{rotto" } }] } },
      ],
    });
    const provider = new KimiChatProvider("key", "m", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "x" }], TOOLS, signal);
    expect(result.toolCalls[0]!.arguments).toEqual({});
  });

  it("HTTP non-2xx → ProviderHttpError", async () => {
    const provider = new KimiChatProvider("key", "m", fetchReturning({}, 503) as never);
    await expect(provider.chat([{ role: "user", content: "x" }], [], signal)).rejects.toMatchObject({
      provider: "kimi",
      status: 503,
    });
  });
});
