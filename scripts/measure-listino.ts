/**
 * Le cinque misure di §7 della spec «Sfoglia», su un listino vero.
 *
 *   pnpm measure:listino /percorso/listino.xlsx
 *
 * SOLA LETTURA: non tocca il database, non scrive nulla. Serve a decidere se la
 * prima parola della descrizione sia una tassonomia sfogliabile prima che si
 * scriva una riga di interfaccia — perché sui 20 articoli inventati del seed
 * ogni misura torna «bene» e non dice nulla sugli altri 3.436.
 *
 * Riusa `parseListinoSheet`, lo stesso parser dell'import: le colonne si
 * riconoscono per nome, quindi il file può essere il vecchio o l'aggiornato.
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseListinoSheet } from "../src/server/maniglie/listino-parse";
import { measureListino, type WordGroup } from "../src/server/maniglie/listino-measure";

const pct = (n: number, tot: number) => (tot === 0 ? "0%" : `${((n / tot) * 100).toFixed(1)}%`);

function table(groups: WordGroup[], total: number, limit: number) {
  const width = Math.max(...groups.slice(0, limit).map((g) => g.word.length), 12);
  for (const g of groups.slice(0, limit)) {
    const bar = "█".repeat(Math.max(1, Math.round((g.count / groups[0]!.count) * 28)));
    console.log(
      `   ${g.word.padEnd(width)}  ${String(g.count).padStart(5)}  ${pct(g.count, total).padStart(6)}  ${bar}`,
    );
  }
  if (groups.length > limit) console.log(`   … e altri ${groups.length - limit} gruppi`);
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: pnpm measure:listino <file.xlsx>");
    process.exit(1);
  }

  const workbook = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("✗ Il file non contiene fogli.");
    process.exit(1);
  }
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
  const headers =
    (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0 })[0] as string[]) ?? [];

  console.log(`▶ ${filePath}`);
  console.log(`  foglio «${sheetName}» · ${rows.length} righe · colonne: ${headers.join(" · ")}\n`);

  const parsed = parseListinoSheet(rows, headers);
  if (parsed.fatal) {
    console.error(`✗ ${parsed.fatal}`);
    process.exit(1);
  }
  if (parsed.skipped.length > 0) {
    console.log(`⚠ ${parsed.skipped.length} righe scartate dal parser (non entrano nelle misure)\n`);
  }

  const m = measureListino(parsed.articles);
  console.log(`ARTICOLI MISURATI: ${m.total}\n`);

  // ── (a) ───────────────────────────────────────────────────────────────────
  console.log("═══ (a) PRIME PAROLE — la misura che decide ═══");
  console.log(`  parole distinte ............ ${m.firstWords.distinct}`);
  console.log(
    `  coprono il 95% dei codici .. ${m.firstWords.wordsFor95} parole (le altre ${m.firstWords.distinct - m.firstWords.wordsFor95} stanno nella coda)`,
  );
  console.log(
    `  gruppi da UN codice solo ... ${m.firstWords.singletons}  (refusi e nomi di modello si annidano qui)`,
  );
  console.log(`  spaziatura irregolare ...... ${m.firstWords.irregularWhitespace} descrizioni`);
  const verdetto =
    m.firstWords.distinct <= 40
      ? "✅ REGGE — l'elenco è sfogliabile (soglia di spec: ≤ 40)"
      : m.firstWords.distinct <= 80
        ? "🟡 REGGE CON UNA SOGLIA — troppi per un elenco piatto, si mostrano i gruppi principali e la coda dietro «Altro»"
        : "🔴 NON REGGE — non è una tassonomia, è un elenco di parole (soglia di spec: ~300 = muore)";
  console.log(`\n  ${verdetto}\n`);
  table(m.firstWords.groups, m.total, 60);
  const coda = m.firstWords.groups.filter((g) => g.count === 1);
  if (coda.length > 0) {
    console.log(`\n  CODA (1 codice) — da guardare a occhio, sono refusi o nomi di modello:`);
    console.log(`   ${coda.map((g) => g.word).join(" · ")}`);
  }

  // ── (b) ───────────────────────────────────────────────────────────────────
  console.log("\n═══ (b) IL SECONDO TOKEN È LA FAMIGLIA DEL CODICE? ═══");
  console.log(
    `  agganciano ................. ${m.secondTokenIsFamily.matched} su ${m.total} (${pct(m.secondTokenIsFamily.matched, m.total)})`,
  );
  console.log(
    m.secondTokenIsFamily.ratio >= 0.9
      ? "  ✅ il livello «modello» esce GRATIS dalla descrizione — niente PDF, niente regexp sul codice"
      : m.secondTokenIsFamily.ratio >= 0.6
        ? "  🟡 vale per la maggioranza ma non per tutti: il livello «modello» avrebbe dei buchi"
        : "  🔴 il secondo token non è la famiglia: il modello può venire solo dal catalogo PDF",
  );
  console.log("\n  Per prima parola — è QUI che si legge la risposta vera:");
  for (const r of m.secondTokenIsFamily.byFirstWord.slice(0, 25)) {
    const flag = r.ratio >= 0.9 ? "✅" : r.ratio >= 0.6 ? "🟡" : "  ";
    console.log(
      `   ${flag} ${r.word.padEnd(18)} ${String(r.matched).padStart(5)}/${String(r.total).padEnd(5)}  ${(r.ratio * 100).toFixed(0).padStart(3)}%`,
    );
  }

  if (m.secondTokenIsFamily.counterExamples.length > 0) {
    console.log(`\n  Controesempi (primi 25 di ${m.secondTokenIsFamily.counterExamples.length}):`);
    for (const c of m.secondTokenIsFamily.counterExamples.slice(0, 25)) {
      console.log(`   ${c.code.padEnd(16)} «${c.name}» → secondo token «${c.token}»`);
    }
  }

  // ── (c) e (d) ─────────────────────────────────────────────────────────────
  console.log("\n═══ (c) e (d) LE FAMIGLIE ═══");
  console.log(`  famiglie distinte .......... ${m.families.distinct}`);
  console.log(`  codici per famiglia (med.) . ${m.families.medianCodes}`);
  if (m.families.largest) {
    console.log(
      `  famiglia più popolosa ...... ${m.families.largest.word} con ${m.families.largest.count} codici`,
    );
  }
  console.log(
    `  (la spec stimava «36 codici per nome commerciale»: la mediana qui lo conferma o lo smentisce)\n`,
  );
  table(m.families.groups, m.total, 25);

  // ── (e) ───────────────────────────────────────────────────────────────────
  console.log("\n═══ (e) LA CODA DOPO L'ULTIMO SEPARATORE ═══");
  console.log(
    `  codici con separatore ...... ${m.tails.withSeparator} su ${m.total} (${pct(m.tails.withSeparator, m.total)})`,
  );
  console.log(`  code distinte .............. ${m.tails.distinct}`);
  console.log(
    m.tails.distinct <= 30
      ? "  ✅ la finitura è un asse vero (soglia di spec: 15-30) — le pastiglie di colore hanno senso"
      : "  🔴 non è un asse: troppe code distinte perché siano finiture (soglia di spec: ~300 = non lo è)",
  );
  console.log("");
  table(m.tails.groups, m.total, 40);
}

main();
