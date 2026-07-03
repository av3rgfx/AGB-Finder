import type { UnembeddedProduct } from "./rag";

const SPEC_KEYS = ["materiale", "dimensione", "finitura"] as const;

/** Testo da embeddare per un prodotto: nome + shortDescription + specifiche chiave. */
export function embeddingText(product: UnembeddedProduct): string {
  const spec = product.specifications ?? {};
  const extras = SPEC_KEYS.map((key) => spec[key]).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [product.name, product.shortDescription, ...extras]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
