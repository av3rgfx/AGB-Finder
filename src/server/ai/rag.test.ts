import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { FakeEmbeddingService } from "./embedding";
import { RAGEngine } from "./rag";

const queryRaw = vi.fn();
const executeRaw = vi.fn();
const db = { $queryRaw: queryRaw, $executeRaw: executeRaw } as never;

const hit = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT Nichelato opaco DX",
  shortDescription: "Cerniere · Per porte a filo · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 0,
  categoryId: "c1",
  categoryName: "Cerniere",
  textScore: 0.6,
  vectorScore: 0,
  score: 0.6,
};

beforeEach(() => {
  queryRaw.mockReset();
  executeRaw.mockReset();
  queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);
});

const sqlOf = (call: unknown[]): Prisma.Sql => call[0] as Prisma.Sql;

describe("RAGEngine.search — degradazione tsvector-only", () => {
  it("senza EmbeddingService usa SOLO il ramo testuale (mai <=>)", async () => {
    const engine = new RAGEngine(db);
    const result = await engine.search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("plainto_tsquery");
    expect(query.sql).toContain("'italian'");
    expect(query.sql).not.toContain("<=>");
    expect(query.values).toContain("cerniera");
    expect(result.hits).toEqual([hit]);
    expect(result.total).toBe(1);
    expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("include il ramo fuzzy pg_trgm (flessioni italiane fuori stemmer)", async () => {
    await new RAGEngine(db).search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("<%");
    expect(query.sql).toContain("word_similarity");
  });

  it("boost del match per prefisso codice (ILIKE 'query%')", async () => {
    await new RAGEngine(db).search("B00590");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("ILIKE");
    expect(query.values).toContain("B00590%");
  });

  it("applica i filtri in modo parametrizzato (mai interpolati nella stringa)", async () => {
    await new RAGEngine(db).search("cerniera", {
      categoryId: "c1",
      priceMin: 10,
      priceMax: 100,
      material: "acciaio",
      inStockOnly: true,
    });
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("category_id");
    expect(query.sql).toContain("base_price");
    expect(query.sql).toContain("specifications");
    expect(query.sql).toContain("is_available");
    expect(query.values).toEqual(expect.arrayContaining(["c1", 10, 100, "%acciaio%"]));
    expect(query.sql).not.toContain("acciaio"); // il valore vive nei parametri
  });

  it("rispetta limit e offset", async () => {
    await new RAGEngine(db).search("x", {}, { limit: 12, offset: 24 });
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.values).toEqual(expect.arrayContaining([12, 24]));
  });
});

describe("RAGEngine.search — ramo ibrido", () => {
  it("con EmbeddingService combina tsvector e vettori (pesi 0.4/0.6)", async () => {
    const engine = new RAGEngine(db, new FakeEmbeddingService());
    await engine.search("maniglia cremonese");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("<=>");
    expect(query.sql).toContain("FULL OUTER JOIN");
    expect(query.sql).toContain("0.4");
    expect(query.sql).toContain("0.6");
    // Il vettore è passato come parametro '[v1,v2,…]'::vector, mai interpolato.
    expect(query.values.some((v) => typeof v === "string" && v.startsWith("["))).toBe(true);
  });
});

describe("RAGEngine — degrado su embedding fallito", () => {
  it("se l'EmbeddingService lancia, usa il solo ramo testuale senza propagare", async () => {
    const broken = { generate: () => Promise.reject(new Error("Gemini giù")) };
    const result = await new RAGEngine(db, broken).search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).not.toContain("<=>");
    expect(result.hits).toEqual([hit]);
  });
});

describe("RAGEngine — embedding dei prodotti (batch)", () => {
  it("listUnembedded seleziona solo prodotti senza embedding", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([]);
    await new RAGEngine(db).listUnembedded(100);
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("embedding IS NULL");
    expect(query.values).toContain(100);
  });

  it("storeEmbeddings esegue un UPDATE parametrizzato per prodotto", async () => {
    executeRaw.mockResolvedValue(1);
    await new RAGEngine(db).storeEmbeddings([
      { id: "p1", embedding: [0.1, 0.2] },
      { id: "p2", embedding: [0.3, 0.4] },
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    const update = sqlOf(executeRaw.mock.calls[0]!);
    expect(update.sql).toContain("UPDATE products SET embedding");
    expect(update.values).toContain("[0.1,0.2]");
    expect(update.values).toContain("p1");
  });
});

describe("RAGEngine.getRelated", () => {
  it("cerca nella stessa categoria escludendo il prodotto sorgente", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([]);
    await new RAGEngine(db).getRelated("p1", 4);
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("category_id");
    expect(query.sql).toContain("<>");
    expect(query.values).toEqual(expect.arrayContaining(["p1", 4]));
  });
});
