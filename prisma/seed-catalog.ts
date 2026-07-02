import type { PrismaClient } from "@prisma/client";
import { parseListino, type ParsedRow } from "../src/server/catalog/parse-listino";
import { ALL_FIXTURE_PAGES } from "../src/server/catalog/fixtures";
import { buildProductData, slugify } from "../src/server/catalog/map-product";

/**
 * Deterministic dev/test catalog: real listino rows parsed from the committed
 * fixtures — no 39MB PDF needed. Idempotent (upsert by slug/agbCode).
 */
export function buildCatalogSeedRows(): ParsedRow[] {
  const { rows } = parseListino(ALL_FIXTURE_PAGES);
  const byCode = new Map<string, ParsedRow>();
  for (const r of rows) if (!byCode.has(r.agbCode)) byCode.set(r.agbCode, r);
  return [...byCode.values()];
}

export async function seedCatalog(db: PrismaClient) {
  const rows = buildCatalogSeedRows();

  const categoryIds = new Map<string, string>();
  for (const name of new Set(rows.map((r) => r.category))) {
    const cat = await db.productCategory.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryIds.set(name, cat.id);
  }

  for (const row of rows) {
    const data = buildProductData(row);
    const categoryId = categoryIds.get(row.category)!;
    await db.product.upsert({
      where: { agbCode: row.agbCode },
      update: { ...data, categoryId },
      create: { ...data, categoryId, imageUrls: [] },
    });
  }

  return { products: rows.length, categories: categoryIds.size };
}
