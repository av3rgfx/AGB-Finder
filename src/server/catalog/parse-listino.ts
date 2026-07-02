// Parser deterministico del listino AGB (output `pdftotext -layout`). MAI LLM.
// NIENTE `server-only`: modulo puro riusato da scripts/import-agb.ts e prisma/ via tsx.

export interface ParsedRow {
  agbCode: string;
  priceCents: number;
  category: string;
  subcategory: string | null;
  groupTitle: string | null;
  material: string | null;
  finish: string | null;
  dimension: string | null;
  hand: "DX" | "SX" | null;
  packBox: number | null;
  packCarton: number | null;
  discountClass: string | null;
  /** Celle-colonna della riga (chiave = intestazione colonna minuscola). */
  attributes: Record<string, string>;
  rawLine: string;
}

export interface ParseStats {
  pages: number;
  codeLines: number;
  parsed: number;
  skipped: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  stats: ParseStats;
}

/** Codice AGB: lettera + 5 cifre + .NN.NN (es. B00590.15.03). */
export const CODE_TOKEN = /[A-Z]\d{5}\.\d{2}\.\d{2}/;

/** Firma rigida: codice + confezione (2 interi) + prezzo IT + classe sconto. */
const PRODUCT_SIGNATURE =
  /([A-Z]\d{5}\.\d{2}\.\d{2})[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d{1,3}(?:\.\d{3})*,\d{2})[ \t]+([A-Z]\d)\b/g;

/** "1.234,56" → 123456 (centesimi; niente float). */
export function parsePriceCents(price: string): number {
  const [euros = "0", cents = "0"] = price.replace(/\./g, "").split(",");
  return Number(euros) * 100 + Number(cents);
}

export function parseListino(text: string): ParseResult {
  const pageBreaks = (text.match(/\f/g) ?? []).length;
  const stats: ParseStats = {
    pages: pageBreaks === 0 ? 1 : pageBreaks,
    codeLines: 0,
    parsed: 0,
    skipped: 0,
  };
  const rows: ParsedRow[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replaceAll("\f", "");
    if (CODE_TOKEN.test(line)) stats.codeLines++;
    else continue;

    PRODUCT_SIGNATURE.lastIndex = 0;
    let emitted = 0;
    let sig = PRODUCT_SIGNATURE.exec(line);
    while (sig !== null) {
      rows.push({
        agbCode: sig[1]!,
        packBox: Number(sig[2]!),
        packCarton: Number(sig[3]!),
        priceCents: parsePriceCents(sig[4]!),
        discountClass: sig[5]!,
        category: "",
        subcategory: null,
        groupTitle: null,
        material: null,
        finish: null,
        dimension: null,
        hand: null,
        attributes: {},
        rawLine: line,
      });
      emitted++;
      sig = PRODUCT_SIGNATURE.exec(line);
    }
    if (emitted > 0) stats.parsed += emitted;
    else stats.skipped++;
  }

  return { rows, stats };
}
