import type { ParsedRow } from "./parse-listino";

/** Header name → URL slug (accents stripped, symbols collapsed). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map a parsed listino row to Product create/update data (categoryId added by caller). */
export function buildProductData(row: ParsedRow) {
  const nameParts = [row.groupTitle, row.finish, row.dimension, row.hand].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(", ") : `${row.category} ${row.agbCode}`;
  const description =
    [row.category, row.subcategory, row.groupTitle].filter(Boolean).join(" — ") || null;

  return {
    agbCode: row.agbCode,
    sku: row.agbCode,
    name,
    description,
    shortDescription: row.subcategory,
    basePrice: (row.priceCents / 100).toFixed(2), // Prisma Decimal accepts strings
    specifications: {
      finitura: row.finish,
      materiale: row.material,
      dimensione: row.dimension,
      mano: row.hand,
      confezione: { scatola: row.packBox, cartone: row.packCarton },
      classeSconto: row.discountClass,
      sottocategoria: row.subcategory,
      gruppo: row.groupTitle,
    },
  };
}
