import { normalizeArticleCode } from "./code-norm";

/**
 * Lettura e aggancio del file di pronta consegna.
 *
 * Il file è un `.xls` con una sola colonna di codici (Andrea: «il formato del
 * file è soltanto .xls»). Si legge SOLO la prima colonna: meno superficie letta,
 * meno modi di sbagliare — e il file lo carica un ADMIN autenticato, non
 * internet.
 *
 * Modulo puro: niente rete, disco o database. La lettura del binario xls la fa
 * la route, l'aggancio lo fa il router; qui c'è solo la regola.
 */

/** Parole che, da sole nella prima cella, denunciano una riga d'intestazione. */
const HEADER_WORDS = new Set(["CODICE", "ARTICOLO", "COD", "CODE", "DESCRIZIONE", "CODICI"]);

/**
 * Prima cella di ogni riga, com'è scritta nel file. Il codice GREZZO si conserva
 * perché è ciò che Andrea rilegge nel suo gestionale, e perché il giorno che la
 * normalizzazione va rivista serve il dato d'origine.
 */
export function extractStockCodes(rows: unknown[][]): string[] {
  const out: string[] = [];
  rows.forEach((row, i) => {
    const cell = row?.[0];
    if (cell === null || cell === undefined) return;
    const raw = typeof cell === "string" ? cell.trim() : String(cell).trim();
    if (!raw) return;
    // Solo la PRIMA riga può essere un'intestazione: più giù, una cella che dice
    // «CODICE» è un dato strano, non una struttura, e va conservata.
    if (i === 0 && HEADER_WORDS.has(normalizeArticleCode(raw))) return;
    out.push(raw);
  });
  return out;
}

export interface StockLineDraft {
  rawCode: string;
  codeNorm: string;
  articleId: string | null;
}

export interface StockMatch {
  lines: StockLineDraft[];
  matchedCount: number;
  /** Codici a magazzino che il listino non conosce. Li vede SOLO Andrea. */
  orphans: string[];
  /** Ripetizioni dello stesso codice nel file: scartate. */
  duplicates: string[];
  /** Celle che non contengono un codice utilizzabile. */
  invalid: string[];
}

/**
 * Aggancia i codici del file agli articoli, per codice normalizzato.
 *
 * Un codice non trovato NON è un errore: è una riga orfana (`articleId = null`),
 * conservata apposta. Quando arriverà il listino aggiornato e l'articolo
 * nascerà, l'aggancio avviene da solo — nessun file da ricaricare, nessuna
 * storia da ricostruire.
 */
export function matchStockCodes(
  rawCodes: string[],
  articleIdByNorm: Map<string, string>,
): StockMatch {
  const lines: StockLineDraft[] = [];
  const orphans: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawCode of rawCodes) {
    const codeNorm = normalizeArticleCode(rawCode);
    if (!codeNorm) {
      invalid.push(rawCode);
      continue;
    }
    // La disponibilità è un INSIEME, non un conteggio: le quantità sono fuori
    // scope per decisione di Andrea («all'agente basta sapere che è in pronta
    // consegna»), quindi lo stesso codice due volte è una riga sola.
    if (seen.has(codeNorm)) {
      duplicates.push(rawCode);
      continue;
    }
    seen.add(codeNorm);

    const articleId = articleIdByNorm.get(codeNorm) ?? null;
    if (!articleId) orphans.push(rawCode);
    lines.push({ rawCode, codeNorm, articleId });
  }

  return {
    lines,
    matchedCount: lines.length - orphans.length,
    orphans,
    duplicates,
    invalid,
  };
}

/**
 * Entrate e uscite rispetto all'import precedente. È ciò che smaschera il file
 * della marca sbagliata PRIMA della conferma: numeri che saltano all'occhio,
 * invece di dieci agenti che si trovano davanti un magazzino irriconoscibile.
 */
export function diffStock(
  previous: string[],
  next: string[],
): { entered: string[]; left: string[] } {
  const prev = new Set(previous.map(normalizeArticleCode));
  const curr = new Set(next.map(normalizeArticleCode));
  return {
    entered: [...curr].filter((c) => !prev.has(c)),
    left: [...prev].filter((c) => !curr.has(c)),
  };
}
