/**
 * Seed di sviluppo del reparto maniglie: articoli COLOMBO verosimili + una
 * pronta consegna, così le schermate si possono verificare in browser senza i
 * file veri di Andrea (che non stanno nel repo).
 *
 * Come `seed-catalog.ts` per l'archivio AGB: i dati sono INVENTATI ma la forma è
 * quella misurata sui file veri — codici nelle tre grafie, descrizioni troncate
 * a 35 caratteri, i due refusi del listino, e orfani che il listino non conosce.
 *
 *   pnpm db:seed:maniglie
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { normalizeArticleCode } from "../src/server/maniglie/code-norm";

const prisma = new PrismaClient();

const D = (v: string) => new Prisma.Decimal(v);

/** [codice, descrizione, prezzo, surcharge, ean] */
const LISTINO: [string, string, string, string, string][] = [
  ["0CD41R-CM", "MANIGLIA CD41 CROMO SATINATO", "101.00", "3.54", "8033433012345"],
  ["0CD41R-OL", "MANIGLIA CD41 OTTONE LUCIDO", "94.78", "3.32", "8033433012352"],
  ["0CD41R-NM", "MANIGLIA CD41 NERO OPACO", "99.10", "3.47", "8033433012369"],
  ["0CD41RCB", "BOCCEHTTA CD41 CROMO BIANCO", "11.88", "0.42", "8033433012376"],
  ["0CD42IM-CM", "MANIGLIA CD42 CROMO MATT", "88.40", "3.09", "8033433012383"],
  ["0CD63FP-CM", "BOCCHETTA CD63 FORO PATENT CROMO", "9.66", "0.34", "8033433012390"],
  ["0CD63GB-CM", "BOCCHETTA CD63 FORO YALE CROMO", "9.66", "0.34", "8033433012406"],
  ["PB01/Q-CM", "POMOLO PB01 QUADRO CROMO", "63.20", "2.21", "8033433012413"],
  ["SE11R-RY", "MANIGLIA SE11 ROSETTA RETTANGOLARE", "112.35", "3.93", "8033433012420"],
  ["ID36-CM", "MANIGLIA ID36 CROMO SATINATO", "78.90", "2.76", "8033433012437"],
  ["ID81R-NM", "MANIGLIA ID81 NERO OPACO", "84.15", "2.95", "8033433012444"],
  ["LC55-VT", "VITE FISSAGGIO ROSETTA M4X22", "0.81", "0.03", "8033433012451"],
  ["LC45-MO", "MOLLA DI RICHIAMO MANIGLIA", "1.94", "0.07", "8033433012468"],
  ["AM15-CR", "ROSETTA AM15 TONDA CROMO", "14.20", "0.50", "8033433012475"],
  ["AM25-CR", "ROSETTA AM25 QUADRA CROMO", "15.85", "0.55", "8033433012482"],
  ["CB16ZB-OT", "ROBOCINQUQ CB16 OTTONE", "42.60", "1.49", "8033433012499"],
  ["MP12-CM", "MANIGLIONE MP12 CROMO 300MM", "156.40", "5.47", "8033433012505"],
  ["MP12-NM", "MANIGLIONE MP12 NERO 300MM", "162.90", "5.70", "8033433012512"],
  ["QD08-CM", "QUADRO 8X8 ACCIAIO L.100", "3.15", "0.11", "8033433012529"],
  ["BU22-NY", "BUSSOLA NYLON D.22", "0.68", "0.02", "8033433012536"],
];

/** In pronta consegna. Gli ultimi tre NON sono a listino: sono gli orfani. */
const PRONTA_CONSEGNA = [
  "0CD41RCM",
  "0CD41RNM",
  "0CD41RCB",
  "0CD63FPCM",
  "PB01QCM",
  "SE11RRY",
  "LC55VT",
  "AM15CR",
  "MP12CM",
  "QD08CM",
  // Orfani: codici che Andrea ha a magazzino e che il listino non conosce.
  // Restano come StockLine con articleId = null e si aggancerebbero da soli al
  // prossimo listino. Non sono visibili all'agente.
  "0ID91R",
  "0AM41",
  "XGRATZ7SX",
];

async function main() {
  const brand = "COLOMBO";
  const now = new Date();

  console.log(`▶ Seed reparto maniglie (${brand}) — dati di sviluppo, non reali`);

  for (const [code, name, priceList, surcharge, ean] of LISTINO) {
    const data = {
      codeNorm: normalizeArticleCode(code),
      name,
      priceList: D(priceList),
      surcharge: D(surcharge),
      ean,
      lastListingAt: now,
    };
    await prisma.article.upsert({
      where: { brand_code: { brand, code } },
      update: data,
      create: { brand, code, ...data },
    });
  }
  console.log(`  ${LISTINO.length} articoli a listino`);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("  nessun ADMIN a DB: salto la pronta consegna (lancia prima `pnpm db:seed`)");
    return;
  }

  // Idempotente: un solo import di seed per marca, rifatto da capo a ogni giro.
  await prisma.stockImport.deleteMany({ where: { brand, fileName: "seed-pronta-consegna.xls" } });

  const articles = await prisma.article.findMany({
    where: { brand },
    select: { id: true, codeNorm: true },
  });
  const byNorm = new Map(articles.map((a) => [a.codeNorm, a.id]));

  const lines = PRONTA_CONSEGNA.map((raw) => {
    const codeNorm = normalizeArticleCode(raw);
    return { rawCode: raw, codeNorm, articleId: byNorm.get(codeNorm) ?? null };
  });
  const matched = lines.filter((l) => l.articleId).length;

  await prisma.stockImport.create({
    data: {
      brand,
      fileName: "seed-pronta-consegna.xls",
      importedById: admin.id,
      rowCount: lines.length,
      matchedCount: matched,
      orphanCount: lines.length - matched,
      lines: { create: lines },
    },
  });

  console.log(
    `  pronta consegna: ${lines.length} righe · ${matched} agganciate · ${lines.length - matched} orfane`,
  );
  console.log("✓ fatto");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
