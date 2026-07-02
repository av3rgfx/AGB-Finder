import { describe, it, expect, vi } from "vitest";
import { RAGEngine } from "./rag";
import { FakeEmbeddingService } from "./embedding";

function stubDb() {
  const sqlTexts: string[] = [];
  const db = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
      sqlTexts.push(Array.isArray(strings) ? strings.join(" ? ") : String(strings));
      return [];
    }),
  };
  return { db: db as never, sqlTexts };
}

describe("RAGEngine SQL branch selection", () => {
  it("without embeddings uses ONLY the tsvector branch", async () => {
    const { db, sqlTexts } = stubDb();
    const rag = new RAGEngine(db, null);
    const result = await rag.search("cerniera anta");
    const sql = sqlTexts.join(" ");
    expect(sql).toContain("plainto_tsquery");
    expect(sql).not.toContain("<=>");
    expect(result.hits).toEqual([]);
    expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("with embeddings adds the pgvector cosine branch", async () => {
    const { db, sqlTexts } = stubDb();
    const rag = new RAGEngine(db, new FakeEmbeddingService());
    await rag.search("cerniera anta");
    const sql = sqlTexts.join(" ");
    expect(sql).toContain("plainto_tsquery");
    expect(sql).toContain("<=>");
  });

  it("getRelated orders by vector distance with NULLS LAST fallback", async () => {
    const { db, sqlTexts } = stubDb();
    await new RAGEngine(db, null).getRelated("p1", 4);
    expect(sqlTexts.join(" ")).toContain("NULLS LAST");
  });
});
