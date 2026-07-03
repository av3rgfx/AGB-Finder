import { describe, it, expect, vi } from "vitest";
import { ProviderHttpError } from "../errors";
import { GeminiChatProvider } from "./gemini";
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

describe("GeminiChatProvider — richiesta", () => {
  it("mappa system/user/assistant/tool nel formato generateContent", async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchImpl as never);
    const messages: ChatMessage[] = [
      { role: "system", content: "istruzioni" },
      { role: "user", content: "ciao" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "call_0", name: "search_products", arguments: { query: "x" } }],
      },
      { role: "tool", toolCallId: "call_0", toolName: "search_products", content: '{"total":0}' },
    ];
    await provider.chat(messages, TOOLS, signal);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("models/gemini-2.5-flash:generateContent");
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": "key" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toBe("istruzioni");
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "ciao" }] });
    expect(body.contents[1].parts[0].functionCall).toEqual({
      name: "search_products",
      args: { query: "x" },
    });
    expect(body.contents[2].parts[0].functionResponse).toEqual({
      name: "search_products",
      response: { result: { total: 0 } },
    });
    expect(body.tools[0].functionDeclarations).toEqual(TOOLS);
  });

  it("omette tools quando la lista è vuota", async () => {
    const fetchImpl = fetchReturning({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
    const provider = new GeminiChatProvider("key", "m", fetchImpl as never);
    await provider.chat([{ role: "user", content: "ciao" }], [], signal);
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.tools).toBeUndefined();
  });
});

describe("GeminiChatProvider — risposta", () => {
  it("estrae testo e usage", async () => {
    const fetchImpl = fetchReturning({
      candidates: [{ content: { parts: [{ text: "risposta" }] } }],
      usageMetadata: { totalTokenCount: 42 },
    });
    const provider = new GeminiChatProvider("key", "gemini-2.5-flash", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], [], signal);
    expect(result).toEqual({
      text: "risposta",
      toolCalls: [],
      modelUsed: "gemini-2.5-flash",
      tokensUsed: 42,
    });
  });

  it("estrae le functionCall come toolCalls con id sintetici", async () => {
    const fetchImpl = fetchReturning({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: "search_products", args: { query: "cerniera" } } }],
          },
        },
      ],
    });
    const provider = new GeminiChatProvider("key", "m", fetchImpl as never);
    const result = await provider.chat([{ role: "user", content: "ciao" }], TOOLS, signal);
    expect(result.text).toBeNull();
    expect(result.toolCalls).toEqual([
      { id: "call_0", name: "search_products", arguments: { query: "cerniera" } },
    ]);
  });

  it("HTTP non-2xx → ProviderHttpError con status", async () => {
    const provider = new GeminiChatProvider("key", "m", fetchReturning({}, 429) as never);
    await expect(provider.chat([{ role: "user", content: "x" }], [], signal)).rejects.toMatchObject({
      name: "ProviderHttpError",
      provider: "gemini",
      status: 429,
    });
    expect(new ProviderHttpError("gemini", 429).status).toBe(429);
  });
});
