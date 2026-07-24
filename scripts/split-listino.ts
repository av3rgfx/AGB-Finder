// Split del listino in PAGINE SINGOLE su Vercel Blob (feature «visualizza nel
// listino», Opzione B). Ogni pagina diventa un file minuscolo con TUTTE le sue
// immagini: il viewer la scarica per intero → immagini complete, veloce, mobile-friendly.
//
// Idempotente (allowOverwrite): ri-eseguibile su una nuova edizione del listino.
// Uso (in ops, con poppler installato):
//   BLOB_READ_WRITE_TOKEN=... pnpm split:listino <listino.pdf>
//
// IMPORTANTE: usare lo STESSO PDF che ha popolato Product.listinoPage (stesso link
// registrato), così page-N.pdf combacia con la pagina fisica indicizzata. Niente
// linearizzazione: serviva solo per il range-streaming del monolite, non più usato.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { put } from "@vercel/blob";
import { pageUrlTemplateFromUrl } from "../src/server/catalog/listino-blob";

// Punto di calibrazione noto (parse-listino.ts): la vasistas «pag. 416» è alla
// pagina fisica 418 e il suo cremonese è A50111.*. Spot-check soft dopo lo split.
const CALIBRATION = { page: 418, code: "A50111" } as const;

function pageNumber(file: string): number {
  const m = /^page-(\d+)\.pdf$/.exec(file);
  return m ? Number(m[1]) : NaN;
}

async function putWithRetry(pathname: string, body: Buffer, token: string, attempts = 3) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await put(pathname, body, {
        access: "public",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/pdf",
      });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Uso: pnpm split:listino <listino.pdf>");
    process.exit(1);
  }
  if (!existsSync(pdfPath)) {
    console.error(`File non trovato: ${pdfPath}`);
    process.exit(1);
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN mancante nell'ambiente.");
    process.exit(1);
  }

  // 1. Split in pagine singole (numerazione fisica 1-based, %d SENZA zero-pad).
  const outDir = mkdtempSync(join(tmpdir(), "listino-split-"));
  console.log(`Split di ${pdfPath} → ${outDir} …`);
  execFileSync("pdfseparate", [pdfPath, join(outDir, "page-%d.pdf")], { stdio: "inherit" });

  const files = readdirSync(outDir)
    .filter((f) => /^page-\d+\.pdf$/.test(f))
    .sort((a, b) => pageNumber(a) - pageNumber(b));
  const total = files.length;
  if (total === 0) {
    console.error("pdfseparate non ha prodotto pagine.");
    process.exit(1);
  }

  // 2. Numerazione contigua 1..N (deve combaciare con Product.listinoPage).
  for (let i = 0; i < total; i++) {
    if (pageNumber(files[i]!) !== i + 1) {
      console.error(`Numerazione non contigua: atteso page-${i + 1}.pdf, trovato ${files[i]}`);
      process.exit(1);
    }
  }
  console.log(`Pagine generate: ${total}.`);

  // 3. Spot-check calibrazione vasistas (soft): non blocca, ma segnala un PDF diverso.
  const calFile = join(outDir, `page-${CALIBRATION.page}.pdf`);
  if (existsSync(calFile)) {
    try {
      const txt = execFileSync("pdftotext", ["-layout", calFile, "-"], { encoding: "utf8" });
      console.log(
        txt.includes(CALIBRATION.code)
          ? `✓ Calibrazione OK: page-${CALIBRATION.page}.pdf contiene ${CALIBRATION.code} (vasistas).`
          : `⚠ page-${CALIBRATION.page}.pdf NON contiene ${CALIBRATION.code}: il PDF potrebbe non essere l'edizione del backfill.`,
      );
    } catch {
      /* pdftotext è solo per lo spot-check, non blocca */
    }
  }

  // 4. Upload su Vercel Blob (naming prevedibile listino/page-N.pdf, idempotente).
  console.log(`Upload di ${total} paginette su Vercel Blob …`);
  let page1Url = "";
  for (const f of files) {
    const n = pageNumber(f);
    const body = readFileSync(join(outDir, f));
    const { url } = await putWithRetry(`listino/page-${n}.pdf`, body, token);
    if (n === 1) page1Url = url;
    if (n % 50 === 0 || n === total) console.log(`  ${n}/${total} …`);
  }

  const template = pageUrlTemplateFromUrl(page1Url);
  console.log("\n✓ Split completato. Imposta su Vercel (Production) e fai redeploy:\n");
  console.log(`  LISTINO_TOTAL_PAGES=${total}`);
  console.log(`  LISTINO_PAGE_URL_TEMPLATE=${template}`);
  console.log(`\nVerifica il deep-link vasistas (pagina ${CALIBRATION.page}):`);
  console.log(`  ${template.replace("{page}", String(CALIBRATION.page))}`);
  console.log("\nRicorda: rimuovi la vecchia env LISTINO_PDF_URL (non più letta).");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
