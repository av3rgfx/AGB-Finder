import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../../../prisma/seed-catalog";
import { RAGEngine } from "./rag";

const url = process.env.INTEGRATION_DATABASE_URL;

// NB: il DB dev può contenere il solo seed (50 prodotti) o l'intero catalogo
// (6.191): le asserzioni sono per-comportamento, mai su conteggi assoluti.
describe.runIf(Boolean(url))("RAGEngine — integrazione su Postgres/pgvector", () => {
  let db: PrismaClient;
  let engine: RAGEngine;
  let cerniereId: string;
  let artechId: string;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedCatalog(db);
    engine = new RAGEngine(db); // niente embeddings: ramo testuale
    cerniereId = (await db.productCategory.findUniqueOrThrow({ where: { slug: "cerniere" } })).id;
    artechId = (await db.productCategory.findUniqueOrThrow({ where: { slug: "artech" } })).id;
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("trova le cerniere cercando 'cerniera' (singolare → categoria al plurale)", async () => {
    // 'cerniera' → lexema 'cernier', ma 'Cerniere' → 'cern': il tsvector da solo
    // NON matcherebbe. Il ramo pg_trgm (word_similarity ≈ 0.78) deve coprirlo.
    const result = await engine.search("cerniera", { categoryId: cerniereId });
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.every((h) => h.categoryId === cerniereId)).toBe(true);
    expect(result.hits[0]!.vectorScore).toBe(0);
    expect(result.queryTimeMs).toBeLessThan(1000);
  });

  it("gestisce altre flessioni via trigram ('cremonese' vs sottocategoria 'Cremonesi')", async () => {
    const result = await engine.search("cremonese", { categoryId: artechId });
    expect(result.total).toBeGreaterThan(0);
    expect(result.hits.every((h) => h.categoryId === artechId)).toBe(true);
  });

  it("il prefisso codice AGB domina il ranking (boost 2.0)", async () => {
    const result = await engine.search("B00590");
    expect(result.total).toBeGreaterThanOrEqual(5);
    // Con il boost, tutti i risultati in prima pagina iniziano col prefisso.
    expect(result.hits.every((h) => h.agbCode.startsWith("B00590"))).toBe(true);
  });

  it("filtra per categoria", async () => {
    const filtered = await engine.search("lucido", { categoryId: cerniereId });
    expect(filtered.hits.length).toBeGreaterThan(0);
    expect(filtered.hits.every((h) => h.categoryId === cerniereId)).toBe(true);
  });

  it("getRelated restituisce prodotti della stessa categoria, escluso il sorgente", async () => {
    const source = await db.product.findUniqueOrThrow({ where: { agbCode: "B00590.15.03" } });
    const related = await engine.getRelated(source.id, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((r) => r.id !== source.id)).toBe(true);
    expect(related.every((r) => r.categoryName === "Serrature")).toBe(true);
  });
});
