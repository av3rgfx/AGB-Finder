// Mapping ParsedRow → dati Product/ProductCategory. Puro, riusato da scripts/ e prisma/.
import type { ParsedRow } from "./parse-listino";

export interface ProductUpsertData {
  agbCode: string;
  sku: string;
  name: string;
  shortDescription: string;
  basePrice: string; // Prisma Decimal accetta stringhe: niente float
  priceUnit: "EUR";
  isAvailable: true;
  stockQuantity: 0;
  specifications: Record<string, unknown>;
  categorySlug: string;
  listinoPage: number | null;
}

export function slugifyCategory(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nomi visualizzati: marchi noti preservati, altrimenti title case con preposizioni minuscole. */
const BRAND_NAMES: Record<string, string> = {
  "i.MOTION-S": "i.MOTION-S",
  "AGB 4K": "AGB 4K",
  "IMAGO++": "IMAGO++",
  "IMAGO E IMAGO+": "IMAGO e IMAGO+",
  "CLIMATECH E CLIMATECH+": "CLIMATECH e CLIMATECH+",
};

export function categoryDisplayName(header: string): string {
  const brand = BRAND_NAMES[header];
  if (brand) return brand;
  return header
    .toLowerCase()
    .replace(/(^|[\s(-])([a-zà-ù])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Di|Del|Della|E|Ed|Per|A|Ad|Da|Con)\b/g, (word) => word.toLowerCase());
}

export function composeName(row: ParsedRow): string {
  const name = [row.groupTitle, row.finish, row.dimension, row.hand]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return name || `${categoryDisplayName(row.category)} ${row.agbCode}`;
}

export function toProductData(row: ParsedRow): ProductUpsertData {
  const specifications: Record<string, unknown> = {};
  if (row.finish) specifications.finitura = row.finish;
  if (row.material) specifications.materiale = row.material;
  if (row.dimension) specifications.dimensione = row.dimension;
  if (row.hand) specifications.mano = row.hand;
  if (row.packBox !== null || row.packCarton !== null) {
    specifications.confezione = { scatola: row.packBox, cartone: row.packCarton };
  }
  if (row.discountClass) specifications.classeSconto = row.discountClass;
  if (row.subcategory) specifications.sottocategoria = row.subcategory;
  if (row.groupTitle) specifications.gruppo = row.groupTitle;
  if (Object.keys(row.attributes).length > 0) specifications.colonne = row.attributes;

  return {
    agbCode: row.agbCode,
    sku: row.agbCode,
    name: composeName(row),
    shortDescription: [categoryDisplayName(row.category), row.subcategory, row.material]
      .filter(Boolean)
      .join(" · "),
    basePrice: (row.priceCents / 100).toFixed(2),
    priceUnit: "EUR",
    isAvailable: true,
    stockQuantity: 0,
    specifications,
    categorySlug: slugifyCategory(row.category),
    listinoPage: row.page,
  };
}

/** Deduplica per agbCode: l'ultima occorrenza nel listino vince (8.217 righe → 6.191 codici). */
export function dedupeRows(rows: ParsedRow[]): ParsedRow[] {
  const byCode = new Map<string, ParsedRow>();
  for (const row of rows) byCode.set(row.agbCode, row);
  return [...byCode.values()];
}
