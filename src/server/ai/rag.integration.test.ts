import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { RAGEngine } from "./rag";

// Real-DB integration: runs only when INTEGRATION_DATABASE_URL points at a
// migrated + seeded database (docker dev DB). Plain `pnpm test` skips it.
const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)("RAGEngine (integration, seeded docker DB)", () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const rag = new RAGEngine(prisma, null);

  afterAll(() => prisma.$disconnect());

  it("finds seeded serrature by Italian full-text", async () => {
    const { hits, queryTimeMs } = await rag.search("incontri sicurezza acciaio");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.agbCode).toMatch(/^B00590/);
    expect(hits[0]!.textScore).toBeGreaterThan(0);
    expect(queryTimeMs).toBeLessThan(1000);
  });

  it("finds a product by AGB code prefix (core lookup use case)", async () => {
    const { hits } = await rag.search("B00590.15");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.agbCode === "B00590.15.03")).toBe(true);
  });

  it("agent-style multi-term query falls back to OR instead of zero results", async () => {
    const { hits } = await rag.search("cerniera anta ribalta");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("filters by category and respects the limit", async () => {
    const cat = await prisma.productCategory.findUnique({ where: { slug: "cerniere" } });
    const { hits } = await rag.search("powerage", { categoryId: cat!.id }, { limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (const h of hits) expect(h.categorySlug).toBe("cerniere");
  });

  it("returns prices as plain numbers (float8 cast)", async () => {
    const { hits } = await rag.search("B00590.15.03");
    const hit = hits.find((h) => h.agbCode === "B00590.15.03")!;
    expect(hit.basePrice).toBe(1.23);
    expect(typeof hit.basePrice).toBe("number");
  });

  it("getRelated returns same-category products, excluding self", async () => {
    const p = await prisma.product.findUnique({ where: { agbCode: "E10157.14.93" } });
    const related = await rag.getRelated(p!.id, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related.some((r) => r.agbCode === "E10157.14.93")).toBe(false);
  });
});
