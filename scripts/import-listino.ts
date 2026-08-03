/**
 * Import del listino di una marca del reparto maniglie.
 *
 *   pnpm import:listino COLOMBO /percorso/listino.xlsx
 *
 * Idempotente: `upsert` su (brand, code). È un'operazione rara e da
 * sviluppatore, lanciata dal workflow «Ops — Neon» — non merita una schermata,
 * a differenza della pronta consegna che la carica Andrea.
 *
 * `lastListingAt` viene riscritto a ogni passaggio: è ciò che rende visibile
 * «non più a listino» quando arriverà il listino aggiornato, senza cancellare
 * nulla (un `upsert` da solo lascerebbe gli zombie a schermo identici agli altri).
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { parseListinoSheet } from "../src/server/maniglie/listino-parse";

const prisma = new PrismaClient();

async function main() {
  const [brandArg, filePath] = process.argv.slice(2);
  if (!brandArg || !filePath) {
    console.error("Uso: pnpm import:listino <MARCA> <file.xlsx>");
    console.error("Esempio: pnpm import:listino COLOMBO ./listino-colombo.xlsx");
    process.exit(1);
  }
  const brand = brandArg.toUpperCase();

  console.log(`▶ Listino ${brand} — ${filePath}`);
  const workbook = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("✗ Il file non contiene fogli.");
    process.exit(1);
  }
  const sheet = workbook.Sheets[sheetName]!;

  // `raw: true` di proposito: con `raw: false` SheetJS applica la FORMATTAZIONE
  // della cella, e un prezzo memorizzato 104,535 ma mostrato «104,54» arriverebbe
  // già arrotondato — perdendo la metà che serve a ricostruire il totale.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });
  const headers =
    (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0 })[0] as string[]) ?? [];

  console.log(`  foglio «${sheetName}» · ${rows.length} righe · ${headers.length} colonne`);

  const parsed = parseListinoSheet(rows, headers);

  if (parsed.fatal) {
    console.error(`✗ ${parsed.fatal}`);
    process.exit(1);
  }

  // Le collisioni di chiave normalizzata bloccano PRIMA di scrivere: il vincolo
  // @@unique([brand, code_norm]) le farebbe esplodere comunque, ma a metà import
  // e con un errore di driver che non dice quali codici siano.
  if (parsed.duplicateNorms.length > 0) {
    console.error(`✗ ${parsed.duplicateNorms.length} collisioni di codice normalizzato:`);
    for (const d of parsed.duplicateNorms) {
      console.error(`   ${d.codeNorm} ← ${d.codes.join(" , ")}`);
    }
    console.error("  Nessuna riga scritta. La chiave di aggancio deve restare univoca.");
    process.exit(1);
  }

  if (parsed.skipped.length > 0) {
    console.warn(`⚠ ${parsed.skipped.length} righe scartate:`);
    for (const s of parsed.skipped.slice(0, 20)) {
      console.warn(`   riga ${s.row}: ${s.reason}`);
    }
    if (parsed.skipped.length > 20) console.warn(`   … e altre ${parsed.skipped.length - 20}`);
  }

  // Non blocca, ma va detto: l'invariante «le due metà ricostruiscono la SOMMA»
  // era verificato sul listino vecchio, e questo lo ricontrolla a ogni import.
  if (parsed.totalMismatches.length > 0) {
    console.warn(
      `⚠ ${parsed.totalMismatches.length} righe in cui prezzo + surcharge non ricostruisce la colonna somma:`,
    );
    for (const m of parsed.totalMismatches.slice(0, 10)) {
      console.warn(`   ${m.code}: calcolato ${m.computed} · dichiarato ${m.declared}`);
    }
    console.warn("  L'agente vedrà il totale CALCOLATO. Verificare il file con il fornitore.");
  }

  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const a of parsed.articles) {
    const data = {
      codeNorm: a.codeNorm,
      name: a.name,
      priceList: a.priceList,
      surcharge: a.surcharge,
      ean: a.ean,
      lastListingAt: now,
    };
    const res = await prisma.article.upsert({
      where: { brand_code: { brand, code: a.code } },
      // `catalogPage` e `imageUrl` NON compaiono: sono lo strato facoltativo
      // scritto dallo script del catalogo, e un import di listino non deve
      // cancellare un arricchimento già fatto.
      update: data,
      create: { brand, code: a.code, ...data },
      select: { createdAt: true, updatedAt: true },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++;
    else updated++;
  }

  const stale = await prisma.article.count({
    where: { brand, lastListingAt: { lt: now } },
  });

  console.log(`✓ ${parsed.articles.length} articoli — ${created} nuovi, ${updated} aggiornati`);
  if (stale > 0) {
    console.log(
      `  ${stale} articoli NON erano in questo listino: restano a DB e risultano non più a listino.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
