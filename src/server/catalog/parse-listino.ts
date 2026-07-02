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

/** Riga materiale: MAIUSCOLA, indentata, che inizia con un materiale noto. */
const MATERIAL_LINE =
  /^[ \t]+((?:ACCIAIO|OTTONE|ALLUMINIO|ZAMA|INOX|NYLON|POLIAMMIDE|TECNOPOLIMERO|PVC)[A-Z .]*)$/;

/** Note, bullet, footnote e righe numero-pagina: mai titoli di gruppo. */
const NOISE_LINE = /^[ \t]*(?:NB|N\.B\.|\(\*|\*|-|•|Contenuto)|^[ \t]*\d{1,4}[ \t]*$/;

/** Header di pagina: riga che termina con "LISTINO 2026"; il prefisso è la categoria. */
const PAGE_HEADER = /^(.*?)\s*LISTINO 2026\s*$/;

export function parseListino(text: string): ParseResult {
  const pageBreaks = (text.match(/\f/g) ?? []).length;
  const stats: ParseStats = {
    pages: pageBreaks === 0 ? 1 : pageBreaks,
    codeLines: 0,
    parsed: 0,
    skipped: 0,
  };
  const rows: ParsedRow[] = [];

  let category = "";
  let subcategory: string | null = null;
  let groupTitle: string | null = null;
  let material: string | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replaceAll("\f", "");
    const trimmed = line.trim();
    const hasCode = CODE_TOKEN.test(line);
    if (hasCode) stats.codeLines++;
    if (!trimmed) continue;

    // 1. Header di pagina → categoria (se il prefisso non è vuoto).
    const header = PAGE_HEADER.exec(trimmed);
    if (header) {
      const name = header[1]!.trim().replace(/[ \t]{2,}/g, " ");
      if (name) category = name;
      continue;
    }

    // 2. Riga materiale (mai contiene codici).
    const materialMatch = MATERIAL_LINE.exec(line);
    if (materialMatch && !hasCode) {
      material = materialMatch[1]!.trim();
      continue;
    }

    // 3. Righe prodotto (firma rigida; il regex globale gestisce più match).
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
        category,
        subcategory,
        groupTitle,
        material,
        finish: null,
        dimension: null,
        hand: null,
        attributes: {},
        rawLine: line,
      });
      emitted++;
      sig = PRODUCT_SIGNATURE.exec(line);
    }
    if (emitted > 0) {
      stats.parsed += emitted;
      continue;
    }
    if (hasCode) {
      stats.skipped++;
      continue;
    }

    // 4. Rumore (note, bullet, numeri pagina).
    if (NOISE_LINE.test(line)) continue;

    // 5. Riga a colonna 0 → sottocategoria (reset del contesto blocco).
    if (/^\S/.test(line)) {
      subcategory = trimmed.split(/[ \t]{3,}/)[0]!.trim();
      groupTitle = null;
      material = null;
      continue;
    }

    // 6. Intestazione colonne: gestita in Task 3 (per ora la si salta).
    if (line.includes("CODICE") && line.includes("€")) continue;

    // 7. Riga di testo indentata → titolo gruppo (l'ultima prima dell'header vince);
    //    un nuovo gruppo azzera il materiale (nei dati reali il materiale segue sempre il gruppo).
    groupTitle = trimmed.replace(/[ \t]{2,}/g, " ");
    material = null;
  }

  return { rows, stats };
}
