// Parser deterministico del listino AGB (output `pdftotext -layout`). MAI LLM.
// NIENTE `server-only`: modulo puro riusato da scripts/import-agb.ts e prisma/ via tsx.

export interface ParsedRow {
  agbCode: string;
  /** Pagina FISICA del PDF (1-based) dove la riga di prezzo appare = deep-link listino. */
  page: number;
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

interface Column {
  name: string;
  start: number;
}

/** Colonne di un header: gruppi di token separati da 2+ spazi, con offset carattere. */
function parseColumns(line: string): Column[] {
  const columns: Column[] = [];
  const re = /\S+(?: \S+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    columns.push({ name: m[0].trim(), start: m.index });
  }
  return columns;
}

/** Affetta le celle-attributo (colonne prima di CODICE) per offset, con tolleranza -2. */
function sliceCells(line: string, columns: Column[], codeStart: number): Record<string, string> {
  const cells: Record<string, string> = {};
  const codeIdx = columns.findIndex((c) => c.name === "CODICE");
  const attrCols = codeIdx > 0 ? columns.slice(0, codeIdx) : [];
  for (let i = 0; i < attrCols.length; i++) {
    const col = attrCols[i]!;
    const start = Math.max(0, col.start - 2);
    const nextStart = i + 1 < attrCols.length ? attrCols[i + 1]!.start : codeStart + 2;
    const end = Math.min(Math.max(start, nextStart - 2), codeStart);
    const value = line
      .slice(start, end)
      .trim()
      .replace(/[ \t]{2,}/g, " ");
    if (value) cells[col.name.toLowerCase()] = value;
  }
  return cells;
}

/** Colonne che rappresentano una dimensione (chiavi minuscole). */
const DIMENSION_COLUMN = /^(lunghezza|altezza|entrata|spessore|misura|h\b|h |x\b|x-|ø)/;

function pickCell(
  cells: Record<string, string>,
  predicate: (key: string) => boolean,
): string | null {
  for (const [key, value] of Object.entries(cells)) {
    if (predicate(key)) return value;
  }
  return null;
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

  // Pagina fisica corrente: 1 + form-feed (\f) cumulati. Calibrato sul listino
  // 2026 (la vasistas «pag. 416» è alla pagina fisica 418 del PDF = deep-link).
  let currentPage = 1;
  let category = "";
  let subcategory: string | null = null;
  let groupTitle: string | null = null;
  let material: string | null = null;
  let columns: Column[] = [];
  let carriedCells: Record<string, string> = {};

  for (const rawLine of text.split("\n")) {
    const ffOnLine = (rawLine.match(/\f/g) ?? []).length;
    if (ffOnLine > 0) currentPage += ffOnLine;
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

    // 2. Intestazione colonne → nuovo blocco tabella (azzera l'ereditarietà).
    if (line.includes("CODICE") && line.includes("€") && !hasCode) {
      columns = parseColumns(line);
      carriedCells = {};
      continue;
    }

    // 3. Riga materiale (mai contiene codici).
    const materialMatch = MATERIAL_LINE.exec(line);
    if (materialMatch && !hasCode) {
      material = materialMatch[1]!.trim();
      continue;
    }

    // 4. Righe prodotto (firma rigida; il regex globale gestisce più match).
    PRODUCT_SIGNATURE.lastIndex = 0;
    let emitted = 0;
    let sig = PRODUCT_SIGNATURE.exec(line);
    while (sig !== null) {
      const cells = { ...carriedCells, ...sliceCells(line, columns, sig.index) };
      carriedCells = cells;
      const handCell = pickCell(cells, (k) => k.includes("mano"));
      const handMatch = handCell ? /\b(dx|sx)\b/i.exec(handCell) : null;
      const dimensionCell = pickCell(cells, (k) => DIMENSION_COLUMN.test(k));
      const dimension = dimensionCell
        ? dimensionCell.replace(/\b(dx|sx)\b/gi, "").trim() || null
        : null;
      rows.push({
        agbCode: sig[1]!,
        page: currentPage,
        packBox: Number(sig[2]!),
        packCarton: Number(sig[3]!),
        priceCents: parsePriceCents(sig[4]!),
        discountClass: sig[5]!,
        category,
        subcategory,
        groupTitle,
        material,
        finish: pickCell(cells, (k) => k.includes("finitura")),
        dimension,
        hand: handMatch ? (handMatch[1]!.toUpperCase() as "DX" | "SX") : null,
        attributes: cells,
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

    // 5. Rumore (note, bullet, numeri pagina).
    if (NOISE_LINE.test(line)) continue;

    // 6. Riga a colonna 0 → sottocategoria (reset del contesto blocco).
    if (/^\S/.test(line)) {
      subcategory = trimmed.split(/[ \t]{3,}/)[0]!.trim();
      groupTitle = null;
      material = null;
      carriedCells = {};
      continue;
    }

    // 7. Riga di testo indentata → titolo gruppo (l'ultima prima dell'header vince);
    //    un nuovo gruppo azzera materiale ed ereditarietà (il materiale segue sempre il gruppo).
    groupTitle = trimmed.replace(/[ \t]{2,}/g, " ");
    material = null;
    carriedCells = {};
  }

  return { rows, stats };
}
