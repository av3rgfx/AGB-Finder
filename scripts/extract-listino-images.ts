// Estrae le foto prodotto dal listino PDF e le salva in ProductImage (feature
// «immagini prodotto»). Deterministico, MAI LLM. Idempotente (upsert per agbCode).
//
// Perché non il viewer PDF: le foto del listino sono JPEG2000 (jpx) e PDF.js le
// rende male/non le rende. poppler (openjpeg) le decodifica → le estraiamo come PNG
// e le serviamo come <img> native.
//
// Uso (in ops, con poppler installato):
//   pnpm extract:images <listino.pdf>
// Test locale (range + dry-run, niente DB):
//   IMG_FROM=290 IMG_TO=310 IMG_DRY=1 pnpm extract:images <listino.pdf>
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  parsePdftohtmlXml,
  filterProductImages,
  mapImagesToCodes,
} from "../src/server/catalog/listino-images";

// Soglia lato-layout (punti) per scartare strisce/loghi decorativi.
const MIN_IMG_SIDE = 50;
// Distanza massima (punti) per il fallback «foto più vicina» quando il codice
// non cade dentro nessuna banda.
const MAX_FALLBACK_DIST = 80;
// Larghezza minima in PIXEL della PNG per considerarla una vera foto prodotto.
const MIN_PNG_WIDTH = 200;

/** Larghezza/altezza di una PNG dai byte dell'header IHDR (offset 16/20, big-endian). */
function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function pageCount(pdfPath: string): number {
  const out = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const m = /Pages:\s+(\d+)/.exec(out);
  if (!m) throw new Error("Impossibile leggere il numero di pagine (pdfinfo).");
  return Number(m[1]);
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath || !existsSync(pdfPath)) {
    console.error("Uso: pnpm extract:images <listino.pdf>");
    process.exit(1);
  }
  const dry = process.env.IMG_DRY === "1";
  const total = pageCount(pdfPath);
  const from = Number(process.env.IMG_FROM ?? 1);
  const to = Number(process.env.IMG_TO ?? total);
  console.log(`Estrazione immagini: pagine ${from}–${to} di ${total}${dry ? " (DRY RUN)" : ""}.`);

  const db = dry ? null : new PrismaClient();
  // Solo i codici realmente a catalogo ricevono un'immagine (niente orfani).
  const known = db
    ? new Set((await db.product.findMany({ select: { agbCode: true } })).map((p) => p.agbCode))
    : null;

  const outDir = mkdtempSync(join(tmpdir(), "listino-img-"));
  let mapped = 0;
  let pending: { agbCode: string; data: Uint8Array<ArrayBuffer> }[] = [];

  const flush = async () => {
    if (!db || pending.length === 0) return;
    const batch = pending;
    pending = [];
    await db.$transaction(
      batch.map((r) =>
        db.productImage.upsert({
          where: { agbCode: r.agbCode },
          create: { agbCode: r.agbCode, data: r.data, mimeType: "image/png" },
          update: { data: r.data, mimeType: "image/png" },
        }),
      ),
    );
  };

  for (let page = from; page <= to; page++) {
    const base = join(outDir, `p${page}`);
    execFileSync(
      "pdftohtml",
      ["-xml", "-fmt", "png", "-f", String(page), "-l", String(page), pdfPath, base],
      { stdio: "ignore" },
    );
    const xmlPath = `${base}.xml`;
    if (!existsSync(xmlPath)) continue;
    const { images, codes } = parsePdftohtmlXml(readFileSync(xmlPath, "utf8"));
    const map = mapImagesToCodes(filterProductImages(images, MIN_IMG_SIDE), codes, {
      maxFallbackDist: MAX_FALLBACK_DIST,
    });

    const cache = new Map<string, Uint8Array<ArrayBuffer> | null>(); // src → png bytes (o null se scartata)
    for (const [code, src] of Object.entries(map)) {
      if (known && !known.has(code)) continue;
      if (!cache.has(src)) {
        // pdftohtml prefissa src con la cartella di output → leggiamo per basename.
        const p = join(outDir, basename(src));
        let buf: Uint8Array<ArrayBuffer> | null = null;
        if (existsSync(p)) {
          const b = readFileSync(p); // Buffer (per readUInt32BE dell'header PNG)
          if (pngSize(b).w >= MIN_PNG_WIDTH) {
            // Copia in Uint8Array con ArrayBuffer proprio: il campo Bytes di Prisma
            // vuole Uint8Array<ArrayBuffer>, non Buffer<ArrayBufferLike>.
            buf = new Uint8Array(b.byteLength);
            buf.set(b);
          }
        }
        cache.set(src, buf);
      }
      const data = cache.get(src);
      if (!data) continue;
      mapped++;
      if (dry) {
        if (mapped <= 10) console.log(`  ${code} → ${src} (${data.length} byte)`);
      } else {
        pending.push({ agbCode: code, data });
        if (pending.length >= 100) await flush();
      }
    }
    // pulizia file della pagina (tieni la scratch leggera)
    for (const f of readdirSync(outDir)) {
      if (f.startsWith(`p${page}.`) || f.startsWith(`p${page}-`)) rmSync(join(outDir, f));
    }
    if (page % 50 === 0 || page === to) console.log(`  …pagina ${page}, mappate finora: ${mapped}`);
  }

  await flush();
  rmSync(outDir, { recursive: true, force: true });
  await db?.$disconnect();
  console.log(`✓ Completato: ${mapped} immagini${dry ? " (dry run, niente scritture)" : " salvate in product_images"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
