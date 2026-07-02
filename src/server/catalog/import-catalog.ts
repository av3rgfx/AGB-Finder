// Upsert idempotente di categorie e prodotti. Condiviso da scripts/import-agb.ts e prisma/seed-catalog.ts.
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ParsedRow } from "./parse-listino";
import { categoryDisplayName, dedupeRows, slugifyCategory, toProductData } from "./map-product";

export interface ImportReport {
  categories: number;
  products: number;
  failedBatches: number;
}

export async function upsertCatalog(
  db: PrismaClient,
  rows: ParsedRow[],
  batchSize = 500,
): Promise<ImportReport> {
  const unique = dedupeRows(rows).filter((row) => row.category !== "");

  const nameBySlug = new Map<string, string>();
  for (const row of unique) {
    const slug = slugifyCategory(row.category);
    if (!nameBySlug.has(slug)) nameBySlug.set(slug, categoryDisplayName(row.category));
  }
  const idBySlug = new Map<string, string>();
  for (const [slug, name] of nameBySlug) {
    const category = await db.productCategory.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
    idBySlug.set(slug, category.id);
  }

  // Ogni blocco è una transazione; un blocco fallito viene loggato e si prosegue
  // (regola spec §Error handling: mai bloccare l'intero import).
  let imported = 0;
  let failedBatches = 0;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      await db.$transaction(
        batch.map((row) => {
          const { categorySlug, specifications, ...fields } = toProductData(row);
          const categoryId = idBySlug.get(categorySlug);
          if (!categoryId) throw new Error(`Categoria mancante per slug '${categorySlug}'`);
          const data = {
            ...fields,
            categoryId,
            specifications: specifications as Prisma.InputJsonValue,
          };
          return db.product.upsert({
            where: { agbCode: fields.agbCode },
            update: data,
            create: data,
          });
        }),
      );
      imported += batch.length;
    } catch (error) {
      failedBatches++;
      console.error(
        `✗ Blocco ${i}-${i + batch.length - 1} fallito (${batch[0]?.agbCode}…): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { categories: idBySlug.size, products: imported, failedBatches };
}
