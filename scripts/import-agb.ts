/**
 * Import the AGB LISTINO PDF into the database.
 *
 *   pnpm import:agb <percorso-listino.pdf>
 *
 * Deterministic pipeline: pdftotext → parseListino → upsert categories →
 * chunked product upserts (idempotent by agbCode). Prints a coverage report.
 */
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "../src/server/catalog/extract-pdf";
import { parseListino } from "../src/server/catalog/parse-listino";
import { buildProductData, slugify } from "../src/server/catalog/map-product";

const db = new PrismaClient();

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error("Uso: pnpm import:agb <percorso-listino.pdf>");

  console.log("▶ estrazione testo (pdftotext)…");
  const text = await extractPdfText(pdfPath);

  console.log("▶ parsing…");
  const { rows, stats } = parseListino(text);

  // Dedup by agbCode — re-listings keep the first (primary) occurrence.
  const byCode = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byCode.has(r.agbCode)) byCode.set(r.agbCode, r);
  const unique = [...byCode.values()];

  console.log("▶ categorie…");
  const categoryIds = new Map<string, string>();
  for (const name of new Set(unique.map((r) => r.category))) {
    const cat = await db.productCategory.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryIds.set(name, cat.id);
  }

  console.log(`▶ upsert ${unique.length} prodotti…`);
  let done = 0;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    await db.$transaction(
      chunk.map((row) => {
        const data = buildProductData(row);
        const categoryId = categoryIds.get(row.category)!;
        return db.product.upsert({
          where: { agbCode: row.agbCode },
          update: { ...data, categoryId },
          create: { ...data, categoryId, imageUrls: [] },
        });
      }),
    );
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${unique.length}`);
  }

  console.log(`\n✓ import completato
  pagine: ${stats.pages} | righe-codice: ${stats.codeLines} | parse ok: ${stats.parsed} | saltate: ${stats.skipped}
  codici unici: ${unique.length} | categorie: ${categoryIds.size}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
