import { describe, it, expect } from "vitest";
import { encodeSSE } from "./stream-encode";

describe("encodeSSE", () => {
  it("serializza un evento come frame SSE", () => {
    expect(encodeSSE({ type: "delta", text: "ciao" })).toBe(
      'data: {"type":"delta","text":"ciao"}\n\n',
    );
  });

  it("serializza un evento done con prodotti", () => {
    expect(
      encodeSSE({ type: "done", messageId: "m1", products: [], tokens: 42 }),
    ).toBe('data: {"type":"done","messageId":"m1","products":[],"tokens":42}\n\n');
  });

  it("serializza un evento error", () => {
    expect(
      encodeSSE({ type: "error", recoverable: true, retryAfter: 20, message: "boh" }),
    ).toBe(
      'data: {"type":"error","recoverable":true,"retryAfter":20,"message":"boh"}\n\n',
    );
  });
});
