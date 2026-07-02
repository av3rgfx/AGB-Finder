import { describe, it, expect } from "vitest";
import { l2Normalize, FakeEmbeddingService, getEmbeddingService } from "./embedding";
import { EMBEDDING_DIM } from "@/server/constants/embedding";

describe("l2Normalize", () => {
  it("returns a unit-length vector", () => {
    const v = l2Normalize([3, 4]);
    expect(Math.hypot(...v)).toBeCloseTo(1);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });

  it("survives the zero vector", () => {
    expect(l2Normalize([0, 0])).toEqual([0, 0]);
  });
});

describe("FakeEmbeddingService", () => {
  it("is deterministic, EMBEDDING_DIM-long and unit-norm", async () => {
    const svc = new FakeEmbeddingService();
    const a = await svc.generate("cerniera", "RETRIEVAL_QUERY");
    const b = await svc.generate("cerniera", "RETRIEVAL_QUERY");
    expect(a).toEqual(b);
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...a)).toBeCloseTo(1);
  });

  it("different texts produce different vectors", async () => {
    const svc = new FakeEmbeddingService();
    const a = await svc.generate("cerniera", "RETRIEVAL_QUERY");
    const b = await svc.generate("serratura", "RETRIEVAL_QUERY");
    expect(a).not.toEqual(b);
  });
});

describe("getEmbeddingService", () => {
  it("returns null when GEMINI_API_KEY is unset (tsvector-only mode)", () => {
    expect(getEmbeddingService()).toBeNull();
  });
});
