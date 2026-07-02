import { describe, it, expect, vi } from "vitest";
import { EMBEDDING_DIM } from "@/server/constants/embedding";
import { FakeEmbeddingService, GeminiEmbeddingService, l2Normalize } from "./embedding";

describe("l2Normalize", () => {
  it("normalizza a norma unitaria", () => {
    const v = l2Normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });
  it("rifiuta il vettore nullo", () => {
    expect(() => l2Normalize([0, 0])).toThrow();
  });
});

describe("FakeEmbeddingService", () => {
  it("genera vettori deterministici a 768 dimensioni, normalizzati", async () => {
    const service = new FakeEmbeddingService();
    const a = await service.generate("cerniere");
    const b = await service.generate("cerniere");
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });
});

describe("GeminiEmbeddingService", () => {
  const values = Array.from({ length: EMBEDDING_DIM }, () => 0.5);

  it("chiama embedContent con taskType/outputDimensionality e normalizza la risposta", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values } }),
    });
    const service = new GeminiEmbeddingService("test-key", "RETRIEVAL_QUERY", fetchMock as never);
    const vector = await service.generate("maniglia");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-embedding-001:embedContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIM,
      content: { parts: [{ text: "maniglia" }] },
    });
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1); // le uscite a 768 dim NON sono pre-normalizzate da Gemini
  });

  it("rifiuta risposte con dimensione errata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: [1, 2, 3] } }),
    });
    const service = new GeminiEmbeddingService("k", "RETRIEVAL_QUERY", fetchMock as never);
    await expect(service.generate("x")).rejects.toThrow(/768/);
  });
});
