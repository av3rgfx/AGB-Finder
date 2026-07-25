import { describe, it, expect, vi } from "vitest";
import { GeminiChatProvider } from "./gemini";
import type { ProviderChunk } from "./types";

function sseResponse(events: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); c.close(); },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function sseResponseRaw(frames: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const f of frames) c.enqueue(enc.encode(f)); c.close(); },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("GeminiChatProvider.chatStream", () => {
  it("emette text-delta in ordine, tool-call e usage", async () => {
    const fakeFetch = async () => sseResponse([
      { candidates: [{ content: { parts: [{ text: "Ciao " }] } }] },
      { candidates: [{ content: { parts: [{ text: "mondo" }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: "search_products", args: { query: "x" } } }] } }] },
      { usageMetadata: { totalTokenCount: 42 } },
    ]);
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    const out: ProviderChunk[] = [];
    for await (const c of p.chatStream([{ role: "user", content: "hi" }], [], AbortSignal.timeout(1000))) out.push(c);
    expect(out).toEqual([
      { type: "text-delta", text: "Ciao " },
      { type: "text-delta", text: "mondo" },
      { type: "tool-call", call: { id: "call_0", name: "search_products", arguments: { query: "x" } } },
      { type: "usage", tokens: 42 },
    ]);
  });

  it("lancia ProviderHttpError su status non-ok", async () => {
    const fakeFetch = async () => new Response("nope", { status: 429 });
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    await expect(async () => { for await (const _ of p.chatStream([], [], AbortSignal.timeout(1000))) void _; })
      .rejects.toMatchObject({ status: 429 });
  });

  it("salta frame non-JSON e continua lo stream", async () => {
    const fakeFetch = async () => sseResponseRaw([
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "primo " }] } }] })}\n\n`,
      `data: [DONE]\n\n`,
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "secondo" }] } }] })}\n\n`,
    ]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    const out: ProviderChunk[] = [];
    for await (const c of p.chatStream([{ role: "user", content: "hi" }], [], AbortSignal.timeout(1000))) out.push(c);
    expect(out).toEqual([
      { type: "text-delta", text: "primo " },
      { type: "text-delta", text: "secondo" },
    ]);
    warnSpy.mockRestore();
  });

  it("lancia ProviderHttpError 502 se response.body è null", async () => {
    const fakeFetch = async () => new Response(null, { status: 200 });
    const p = new GeminiChatProvider("k", "gemini-2.0", fakeFetch as typeof fetch);
    await expect(async () => { for await (const _ of p.chatStream([], [], AbortSignal.timeout(1000))) void _; })
      .rejects.toMatchObject({ status: 502 });
  });
});
