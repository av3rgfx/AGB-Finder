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
  console.log(`▶ ${filePath}`);
  console.log(
    `  foglio «${sheetName}» · ${rows.length} righe · colonne: ${Object.keys(rows[0] ?? {}).join(" · ")}\n`,
  );

  const parsed = parseListinoSheet(rows);
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
  // Le soglie della spec (≤ 40 regge, ~300 muore) erano una stima fatta PRIMA di
  // vedere il file. Un numero che cade in mezzo non si giudica con una soglia
  // inventata: si dichiara la conseguenza, che è quanto lungo diventa lo scorrimento.
  const schermate = Math.ceil(m.firstWords.distinct / 8.5);
  console.log(
    `\n  A 375px, righe da 44px: ~${schermate} schermate per l'elenco delle prime parole,` +
      `\n  contro ~${Math.ceil(m.total / 6)} schermate per i ${m.total} codici ordinabili.`,
  );
  console.log(
    m.firstWords.distinct <= 40
      ? "  ✅ elenco piatto, si sfoglia com'è"
      : m.firstWords.distinct <= 150
        ? "  🟡 elenco lungo ma finito: serve un ordinamento dichiarato e un secondo livello dentro i gruppi grossi"
        : "  🔴 non è una tassonomia, è un elenco di parole",
  );
  console.log("");
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
  // ── (b bis) ───────────────────────────────────────────────────────────────
  console.log("\n═══ (b bis) LA FAMIGLIA, OVUNQUE STIA NELLA DESCRIZIONE ═══");
  console.log(
    `  trovata .................... ${m.familyToken.found} su ${m.total} (${pct(m.familyToken.found, m.total)})`,
  );
  console.log("  in quale posizione:");
  for (const p of m.familyToken.positions) {
    console.log(
      `   token n.${p.index + 1} ${String(p.count).padStart(6)}  ${pct(p.count, m.familyToken.found).padStart(6)}`,
    );
  }
  console.log(
    m.familyToken.ratio >= 0.9
      ? "  ✅ il livello «modello» è estraibile DAL LISTINO — il catalogo PDF serve solo per le foto"
      : m.familyToken.ratio >= 0.7
        ? "  🟡 estraibile per la maggioranza: il livello «modello» avrebbe una coda scoperta"
        : "  🔴 non estraibile dal listino: il modello può venire solo dal catalogo PDF",
  );

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
