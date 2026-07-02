import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../../../prisma/seed-catalog";
import { RAGEngine } from "./rag";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("RAGEngine — integrazione su Postgres/pgvector", () => {
  let db: PrismaClient;
  let engine: RAGEngine;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedCatalog(db);
    engine = new RAGEngine(db); // niente embeddings: ramo tsvector
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("trova le cerniere cercando 'cerniera' (stemming italiano su shortDescription)", async () => {
    const result = await engine.search("cerniera");
    expect(result.total).toBeGreaterThan(0);
    expect(result.hits.some((h) => h.categoryName === "Cerniere")).toBe(true);
    expect(result.hits[0]!.vectorScore).toBe(0);
    expect(result.queryTimeMs).toBeLessThan(1000);
  });

  it("gestisce la flessione singolare/plurale via trigram (stemmer italiano asimmetrico)", async () => {
    // 'cerniera' → lexema 'cernier', ma 'Cerniere' → 'cern': il tsvector da solo
    // NON matcherebbe. Il ramo pg_trgm (word_similarity ≈ 0.78) deve coprirlo.
    const result = await engine.search("cerniera");
    expect(result.hits.some((h) => h.agbCode === "E10073.10.16")).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(3);
    // Analogamente 'cremonese' (singolare) vs sottocategoria 'Cremonesi'.
    const cremonesi = await engine.search("cremonese");
    expect(cremonesi.hits.some((h) => h.categoryName === "Artech")).toBe(true);
  });

  it("trova per prefisso codice AGB", async () => {
    const result = await engine.search("B00590");
    expect(result.total).toBe(5);
    expect(result.hits.every((h) => h.agbCode.startsWith("B00590"))).toBe(true);
  });

  it("filtra per categoria", async () => {
    const all = await engine.search("lucido");
    const cerniereId = all.hits.find((h) => h.categoryName === "Cerniere")?.categoryId;
    expect(cerniereId).toBeDefined();
    const filtered = await engine.search("lucido", { categoryId: cerniereId });
    expect(filtered.hits.length).toBeGreaterThan(0);
    expect(filtered.hits.every((h) => h.categoryId === cerniereId)).toBe(true);
  });

  it("getRelated restituisce prodotti della stessa categoria, escluso il sorgente", async () => {
    const search = await engine.search("B00590.15.03");
    const source = search.hits[0]!;
    const related = await engine.getRelated(source.id, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((r) => r.id !== source.id)).toBe(true);
    expect(related.every((r) => r.categoryName === source.categoryName)).toBe(true);
  });
});
