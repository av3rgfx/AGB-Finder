import { describe, it, expect, vi } from "vitest";
import { EMBEDDING_DIM } from "@/server/constants/embedding";
import { FakeEmbeddingService, GeminiEmbeddingService, l2Normalize } from "./embedding";

function fetchReturning(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(payload) });
}

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

describe("GeminiEmbeddingService.generateBatch", () => {
  const vector = Array.from({ length: EMBEDDING_DIM }, () => 0.5);

  it("una richiesta batchEmbedContents con taskType e dimensioni", async () => {
    const fetchImpl = fetchReturning({ embeddings: [{ values: vector }, { values: vector }] });
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", fetchImpl as never);
    const result = await service.generateBatch(["a", "b"]);
    expect(result).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain(":batchEmbedContents");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toMatchObject({
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIM,
      content: { parts: [{ text: "a" }] },
    });
  });

  it("normalizza L2 ogni vettore del batch", async () => {
    const service = new GeminiEmbeddingService(
      "key",
      "RETRIEVAL_DOCUMENT",
      fetchReturning({ embeddings: [{ values: vector }] }) as never,
    );
    const [first] = await service.generateBatch(["a"]);
    const norm = Math.sqrt(first!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("rifiuta più di 100 testi", async () => {
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", vi.fn() as never);
    await expect(service.generateBatch(Array.from({ length: 101 }, () => "x"))).rejects.toThrow(
      /100/,
    );
  });

  it("batch vuoto → [] senza chiamate", async () => {
    const fetchImpl = vi.fn();
    const service = new GeminiEmbeddingService("key", "RETRIEVAL_DOCUMENT", fetchImpl as never);
    expect(await service.generateBatch([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("HTTP 429 → HttpStatusError con status (per il backoff dello script)", async () => {
    const service = new GeminiEmbeddingService(
      "key",
      "RETRIEVAL_DOCUMENT",
      fetchReturning({}, 429) as never,
    );
    await expect(service.generateBatch(["a"])).rejects.toMatchObject({ status: 429 });
  });

  it("conteggio embeddings diverso dai testi → errore", async () => {
    const service = new GeminiEmbeddingService(
      "key",
      "RETRIEVAL_DOCUMENT",
      fetchReturning({ embeddings: [{ values: vector }] }) as never,
    );
    await expect(service.generateBatch(["a", "b"])).rejects.toThrow(/incompleto/i);
  });
});
