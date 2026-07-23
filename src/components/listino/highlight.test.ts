import { describe, it, expect } from "vitest";
import { makeHighlighter } from "./highlight";

describe("makeHighlighter", () => {
  const hl = makeHighlighter("A50111.15.13");
  it("avvolge il codice in <mark> (case-insensitive)", () => {
    expect(hl({ str: "cremonese A50111.15.13 argento" })).toContain(
      '<mark class="listino-hl">A50111.15.13</mark>',
    );
  });
  it("ritorna il testo (escapato) se il codice non c'è", () => {
    expect(hl({ str: "nessun codice <qui>" })).toBe("nessun codice &lt;qui&gt;");
  });
  it("stringa vuota → vuota", () => {
    expect(hl({ str: "" })).toBe("");
  });
});
