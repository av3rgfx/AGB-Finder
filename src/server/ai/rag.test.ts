import { describe, it, expect, vi } from "vitest";
import { RAGEngine } from "./rag";
import { FakeEmbeddingService } from "./embedding";

function stubDb(results: unknown[][] = []) {
  const sqlTexts: string[] = [];
  let call = 0;
  const db = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
      sqlTexts.push(Array.isArray(strings) ? strings.join(" ? ") : String(strings));
      return results[call++] ?? [];
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

describe("RAGEngine query strategies", () => {
  it("code-like queries use an agb_code prefix match, not full-text", async () => {
    const { db, sqlTexts } = stubDb();
    await new RAGEngine(db, null).search("B00590.15");
    const sql = sqlTexts.join(" ");
    expect(sql).toContain("agb_code");
    expect(sql).toContain("ILIKE");
    expect(sql).not.toContain("plainto_tsquery");
  });

  it("falls back to OR full-text when the strict AND query has no hits", async () => {
    const { db, sqlTexts } = stubDb([[], []]);
    await new RAGEngine(db, null).search("cerniera anta ribalta");
    expect(sqlTexts).toHaveLength(2);
    expect(sqlTexts[0]).toContain("plainto_tsquery");
    expect(sqlTexts[1]).toContain("to_tsquery");
  });

  it("does not run the OR fallback when AND already has hits", async () => {
    const { db, sqlTexts } = stubDb([[{ id: "p1" }]]);
    const { hits } = await new RAGEngine(db, null).search("cerniera");
    expect(sqlTexts).toHaveLength(1);
    expect(hits).toHaveLength(1);
  });
});
