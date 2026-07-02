/**
 * Deterministic parser for the AGB "LISTINO 2026" price list, operating on
 * `pdftotext -layout` output. NO LLM involved (project rule #1).
 *
 * Page anatomy (see fixtures.ts for real samples):
 *   <CATEGORY, UPPERCASE>            LISTINO 2026     ← page header
 *   <subcategory at column 0>
 *       <group title>
 *       <MATERIAL or FINISH-GROUP, UPPERCASE>
 *       <column headers ... CODICE ... € CS>
 *       [dimension] [finish] [hand]  CODE  pack pack  price  CS   ← product row
 */

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
  rawLine: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  stats: { pages: number; codeLines: number; parsed: number; skipped: number };
}

const CODE_RE = /[A-Z]\d{5}\.\d{2}\.\d{2}/;
const ROW_RE =
  /^(.*?)\s*([A-Z]\d{5}\.\d{2}\.\d{2})\s+(\d+)\s+(\d+)\s+((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s+([A-Z]\d)\s*$/;
const CATEGORY_RE = /^(.*?)\s*LISTINO 2026\s*$/;
const COLUMN_HEADER_RE = /\bCODICE\b/;
const MATERIALS = new Set([
  "ACCIAIO",
  "ACCIAIO INOX",
  "INOX",
  "OTTONE",
  "ALLUMINIO",
  "ZAMA",
  "NYLON",
  "TECNOPOLIMERO",
  "POLIAMMIDE",
  "PVC",
]);
const DIMENSION_RE = /^(ø\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:mm|cm|m\b|metri))\s*/i;
const HAND_RE = /\b(dx|sx)\s*$/i;
const NOTE_RE = /^(NB|N\.B\.|Nota)\b/i;

function priceToCents(price: string): number {
  const [ints, dec] = price.split(",");
  return parseInt(ints!.replace(/\./g, ""), 10) * 100 + parseInt(dec!, 10);
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseListino(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const stats = { pages: 0, codeLines: 0, parsed: 0, skipped: 0 };

  // Parser state (page- and block-scoped)
  let category = "ALTRO";
  let subcategory: string | null = null;
  let groupTitle: string | null = null;
  let material: string | null = null;
  let finishGroup: string | null = null;
  let dimension: string | null = null;
  let afterCategoryLine = false;

  for (const rawLine of text.split("\n")) {
    let line = rawLine;
    if (line.includes("\f")) {
      // New page: reset page-scoped state (category persists across pages of
      // the same chapter until the next header overrides it).
      stats.pages += 1;
      subcategory = null;
      groupTitle = null;
      material = null;
      finishGroup = null;
      dimension = null;
      afterCategoryLine = false;
      line = line.replace(/\f/g, "");
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    const catMatch = trimmed.match(CATEGORY_RE);
    if (catMatch) {
      const name = squash(catMatch[1] ?? "");
      if (name && name === name.toUpperCase() && /[A-Z]/.test(name)) category = name;
      afterCategoryLine = true;
      continue;
    }

    if (CODE_RE.test(trimmed)) {
      stats.codeLines += 1;
      const m = trimmed.match(ROW_RE);
      if (!m) {
        stats.skipped += 1; // order forms, odd layouts — logged via stats, never fatal
        continue;
      }
      let prefix = squash(m[1] ?? "");
      let hand: "DX" | "SX" | null = null;
      const handMatch = HAND_RE.exec(prefix);
      if (handMatch) {
        hand = handMatch[1]!.toUpperCase() as "DX" | "SX";
        prefix = squash(prefix.slice(0, handMatch.index));
      }
      const dimMatch = DIMENSION_RE.exec(prefix);
      if (dimMatch) {
        dimension = squash(dimMatch[1]!);
        prefix = squash(prefix.slice(dimMatch[0].length));
      }
      const finish = prefix || finishGroup;
      rows.push({
        agbCode: m[2]!,
        priceCents: priceToCents(m[5]!),
        category,
        subcategory,
        groupTitle,
        material,
        finish: finish || null,
        dimension,
        hand,
        packBox: parseInt(m[3]!, 10),
        packCarton: parseInt(m[4]!, 10),
        discountClass: m[6]!,
        rawLine: trimmed,
      });
      stats.parsed += 1;
      continue;
    }

    if (COLUMN_HEADER_RE.test(trimmed)) continue; // column-header lines
    if (NOTE_RE.test(trimmed)) continue; // NB / notes
    if (/^\d+$/.test(trimmed)) continue; // page numbers

    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      const name = squash(trimmed);
      if (MATERIALS.has(name)) material = name;
      else finishGroup = name; // e.g. "GRIGIO RAL 7035", "NERO OPACO"
      continue;
    }

    // First unindented, non-uppercase line right after the page header → subcategory.
    if (afterCategoryLine && !/^\s/.test(line) && subcategory === null) {
      subcategory = squash(trimmed);
      continue;
    }

    // Anything else wordy and indented → new product-group title (resets block state).
    if (trimmed.length > 3) {
      groupTitle = squash(trimmed);
      dimension = null;
      finishGroup = null;
    }
  }

  return { rows, stats };
}
