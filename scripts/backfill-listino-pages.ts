// Backfill Product.listinoPage dai form-feed del listino. Idempotente.
// Uso: pnpm backfill:pages <listino.pdf>
// Client Prisma proprio (come import-agb.ts): gira sotto tsx, fuori dal bundle server.
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "../src/server/catalog/extract-pdf";
import { parseListino } from "../src/server/catalog/parse-listino";
import { collectListinoPages } from "../src/server/catalog/map-product";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Uso: pnpm backfill:pages <listino.pdf>");
    process.exit(1);
  }
  console.log(`Estrazione testo da ${pdfPath}…`);
  const text = await extractPdfText(pdfPath);
  const { rows } = parseListino(text);
  const pages = collectListinoPages(rows);
  console.log(`Codici con pagina: ${pages.length}. Aggiornamento…`);

  const db = new PrismaClient();
  // Batch da 500 in transazione (come upsertCatalog): una transazione ogni 500
  // codici invece di 6.191 round-trip singoli su Neon (da ~30 min a pochi secondi).
  const BATCH = 500;
  let updated = 0;
  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH);
    const results = await db.$transaction(
      batch.map(({ agbCode, page }) =>
        db.product.updateMany({ where: { agbCode }, data: { listinoPage: page } }),
      ),
    );
    updated += results.reduce((sum, r) => sum + r.count, 0);
  }
  await db.$disconnect();
  console.log(`✓ Backfill completato: ${updated}/${pages.length} prodotti aggiornati.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
