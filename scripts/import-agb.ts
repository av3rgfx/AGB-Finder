// Import del listino AGB: pnpm import:agb <listino.pdf>
// Client Prisma proprio (come prisma/seed.ts): gira sotto tsx, fuori dal bundle server.
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "../src/server/catalog/extract-pdf";
import { parseListino } from "../src/server/catalog/parse-listino";
import { upsertCatalog } from "../src/server/catalog/import-catalog";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Uso: pnpm import:agb <listino.pdf>");
    process.exit(1);
  }
  console.log(`Estrazione testo da ${pdfPath}…`);
  const text = await extractPdfText(pdfPath);
  const { rows, stats } = parseListino(text);
  console.log(
    `✓ Pagine: ${stats.pages} · Righe con codice: ${stats.codeLines} · ` +
      `Parsed: ${stats.parsed} · Skipped: ${stats.skipped}`,
  );
  const db = new PrismaClient();
  try {
    const report = await upsertCatalog(db, rows);
    console.log(`✓ Prodotti unici: ${report.products} · Categorie: ${report.categories}`);
    if (report.failedBatches > 0) {
      console.warn(`⚠ Blocchi falliti: ${report.failedBatches} (vedi log sopra)`);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
