import { describe, it, expect } from "vitest";
import { sseEvents } from "./sse";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  });
}

describe("sseEvents", () => {
  it("emette i payload data: completi", async () => {
    const out: string[] = [];
    for await (const e of sseEvents(streamFrom(["data: a\n\n", "data: b\n\n"]))) out.push(e);
    expect(out).toEqual(["a", "b"]);
  });

  it("ricompone un frame spezzato tra due chunk", async () => {
    const out: string[] = [];
    for await (const e of sseEvents(streamFrom(['data: {"x":1', '}\n\n']))) out.push(e);
    expect(out).toEqual(['{"x":1}']);
  });

  it("gestisce UTF-8 multibyte a cavallo dei chunk", async () => {
    const enc = new TextEncoder();
    const bytes = enc.encode("data: à\n\n"); // 'à' = 2 byte
    const s = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); },
    });
    const out: string[] = [];
    for await (const e of sseEvents(s)) out.push(e);
    expect(out).toEqual(["à"]);
  });
});
