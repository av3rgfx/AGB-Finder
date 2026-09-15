/**
 * Import del listino COLOMBO «Vision 2026» (edizione 05/26).
 *
 *   pnpm import:vision COLOMBO ./vision.pdf
 *
 * ⚠️ È un'AGGIUNTA, non una sostituzione, e la differenza è una SOTTRAZIONE.
 * `import:listino` significa «questo file È il listino»: riscrive
 * `lastListingAt` e poi stampa «N articoli NON erano in questo listino». Su un
 * delta quella riga direbbe che 3.456 articoli non sono più a listino — falso,
 * ed è proprio la riga che l'operatore legge per capire se è andata bene.
 *
 * Qui `lastListingAt` si scrive lo stesso (quelle righe SONO in un listino), ma
 * il conteggio degli assenti **non si calcola affatto**: un delta non è in
 * condizione di sapere cosa sia stato ritirato.
 *
 * Script separato e non un flag: la semantica sbagliata non dev'essere
 * raggiungibile per distrazione.
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { decodeVision } from "../src/server/maniglie/vision-decode";
import { parseVision, BANDE_VISION_2026 } from "../src/server/maniglie/vision-parse";
import { articoliVision } from "../src/server/maniglie/vision-codici";

const prisma = new PrismaClient();

async function main() {
  const [brandArg, filePath] = process.argv.slice(2);
  if (!brandArg || !filePath) {
    console.error("Uso: pnpm import:vision <MARCA> <file.pdf>");
    console.error("Esempio: pnpm import:vision COLOMBO ./vision2026.pdf");
    process.exit(1);
  }
  const brand = brandArg.toUpperCase();
  console.log(`▶ Listino Vision 2026 ${brand} — ${filePath}`);

  // `-layout` ricostruisce le colonne con la spaziatura: le bande dichiarate in
  // `vision-parse` sono colonne di QUEL testo. Senza `-layout` non combaciano.
  const raw = execFileSync("pdftotext", ["-layout", filePath, "-"], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "buffer",
  });
  const testo = decodeVision(raw);
  if (!testo.includes("Vision")) {
    console.error("✗ Il file non è il listino Vision 2026 (firma «Vision» assente).");
    process.exit(1);
  }

  const { articoli, esclusi } = articoliVision(parseVision(testo, BANDE_VISION_2026));
  console.log(`  ${articoli.length} articoli letti · ${esclusi.length} modelli con righe escluse`);
  if (esclusi.length > 0) {
    console.log(
      `  ⚠ «zirconium HPS/1» esclusa su ${esclusi.length} modelli: COLOMBO usa ` +
        `due code (I1 e HPS1) nella stessa serie e non è derivabile. ` +
        `Entrano quando risponde.`,
    );
  }

  const now = new Date();
  let creati = 0;
  let aggiornati = 0;
  for (const a of articoli) {
    const res = await prisma.article.upsert({
      where: { brand_code: { brand, code: a.code } },
      // `surcharge: null` — mai `0`. È l'unico valore che non afferma un
      // sovrapprezzo che il documento non dichiara mai, ed è il discriminante
      // (`surcharge IS NULL`) che ritrova queste 251 righe il giorno in cui
      // COLOMBO risponde. `0` darebbe lo stesso totale in `articleTotal` ma
      // AFFERMA l'assenza, e cancella il discriminante in silenzio.
      //
      // ⚠️ Vale anche in UPDATE, sui 17 codici già a listino, e non è una
      // svista: il prezzo e la sua composizione devono venire dallo STESSO
      // documento. Lasciando il surcharge del 02/26 accanto al prezzo del
      // 05/26, i 6 articoli rincarati si ritroverebbero una maggiorazione
      // calcolata su un prezzo che non esiste più — `0BT13-CM` avrebbe 12,40
      // con 0,57, cioè il 4,6 %. E i restanti 11 porterebbero due convenzioni
      // dentro un solo import.
      //
      // `catalogPage` e `imageUrl` non si toccano: sono lo strato facoltativo
      // scritto dallo script del catalogo, e un import non deve cancellare un
      // arricchimento già fatto.
      update: { name: a.name, priceList: a.priceList, surcharge: null, lastListingAt: now },
      create: {
        brand,
        code: a.code,
        codeNorm: a.codeNorm,
        name: a.name,
        priceList: a.priceList,
        lastListingAt: now,
      },
      select: { createdAt: true, updatedAt: true },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) creati++;
    else aggiornati++;
  }

  console.log(`✓ ${articoli.length} articoli — ${creati} nuovi, ${aggiornati} aggiornati`);
  console.log(
    `  ${articoli.length} importati SENZA temporary surcharge: il listino 05/26 ` +
      `non lo dichiara. La domanda è aperta per COLOMBO.`,
  );
  // NIENTE conteggio degli «assenti»: è un delta (vedi il commento in testa).
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
