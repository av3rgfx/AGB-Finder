import { describe, it, expect } from "vitest";
import { buildProductData, slugify } from "./map-product";
import type { ParsedRow } from "./parse-listino";

const row: ParsedRow = {
  agbCode: "B00590.15.03",
  priceCents: 123,
  category: "SERRATURE",
  subcategory: "Incontri - Sicurezza",
  groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
  material: "ACCIAIO",
  finish: "Ottonato lucido",
  dimension: "238 mm",
  hand: null,
  packBox: 25,
  packCarton: 250,
  discountClass: "A2",
  rawLine: "",
};

describe("slugify", () => {
  it("normalizes headers to slugs", () => {
    expect(slugify("SERRATURE")).toBe("serrature");
    expect(slugify("IMAGO E IMAGO+")).toBe("imago-e-imago");
    expect(slugify("FERRAMENTA PER IMPOSTE")).toBe("ferramenta-per-imposte");
    expect(slugify("CLIMATECH E CLIMATECH+")).toBe("climatech-e-climatech");
  });
});

describe("buildProductData", () => {
  const d = buildProductData(row);

  it("composes a readable name from group/finish/dimension", () => {
    expect(d.name).toBe("Larghezza 22 mm, bordo tondo spessore 3 mm, Ottonato lucido, 238 mm");
  });

  it("stores the price as a decimal string in EUR", () => {
    expect(d.basePrice).toBe("1.23");
    expect(buildProductData({ ...row, priceCents: 123456 }).basePrice).toBe("1234.56");
  });

  it("keeps structured attributes in specifications", () => {
    expect(d.specifications).toMatchObject({
      finitura: "Ottonato lucido",
      materiale: "ACCIAIO",
      dimensione: "238 mm",
      confezione: { scatola: 25, cartone: 250 },
      classeSconto: "A2",
      sottocategoria: "Incontri - Sicurezza",
    });
  });

  it("builds a searchable description from category context", () => {
    expect(d.description).toBe(
      "SERRATURE — Incontri - Sicurezza — Larghezza 22 mm, bordo tondo spessore 3 mm",
    );
  });

  it("falls back to category+code when nothing else exists", () => {
    const bare = { ...row, groupTitle: null, finish: null, dimension: null, hand: null };
    expect(buildProductData(bare).name).toBe("SERRATURE B00590.15.03");
  });

  it("appends the hand to the name when present", () => {
    expect(buildProductData({ ...row, hand: "DX" }).name).toContain("DX");
  });
});
