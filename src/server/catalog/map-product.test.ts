import { describe, it, expect } from "vitest";
import type { ParsedRow } from "./parse-listino";
import {
  composeName,
  categoryDisplayName,
  dedupeRows,
  slugifyCategory,
  toProductData,
} from "./map-product";

const row = (partial: Partial<ParsedRow>): ParsedRow => ({
  agbCode: "B00590.15.03",
  page: 1,
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
  attributes: { lunghezza: "238 mm", finitura: "Ottonato lucido" },
  rawLine: "…",
  ...partial,
});

describe("slugifyCategory", () => {
  it("produce slug stabili e compatibili con il seed 1a", () => {
    expect(slugifyCategory("SERRATURE")).toBe("serrature");
    expect(slugifyCategory("CERNIERE")).toBe("cerniere");
    expect(slugifyCategory("FERRAMENTA PER IMPOSTE")).toBe("ferramenta-per-imposte");
    expect(slugifyCategory("GALILEO PRO - ALLUMINIO")).toBe("galileo-pro-alluminio");
    expect(slugifyCategory("i.MOTION-S")).toBe("i-motion-s");
    expect(slugifyCategory("AGB 4K")).toBe("agb-4k");
    expect(slugifyCategory("IMAGO E IMAGO+")).toBe("imago-e-imago");
  });
});

describe("categoryDisplayName", () => {
  it("è leggibile (title case, preposizioni minuscole, marchi preservati)", () => {
    expect(categoryDisplayName("SERRATURE")).toBe("Serrature");
    expect(categoryDisplayName("FERRAMENTA PER IMPOSTE")).toBe("Ferramenta per Imposte");
    expect(categoryDisplayName("i.MOTION-S")).toBe("i.MOTION-S");
    expect(categoryDisplayName("AGB 4K")).toBe("AGB 4K");
  });
});

describe("composeName", () => {
  it("compone gruppo + finitura + dimensione + mano", () => {
    expect(composeName(row({ hand: "DX" }))).toBe(
      "Larghezza 22 mm, bordo tondo spessore 3 mm Ottonato lucido 238 mm DX",
    );
  });
  it("fallback categoria + codice quando mancano i componenti", () => {
    expect(
      composeName(row({ groupTitle: null, finish: null, dimension: null, hand: null })),
    ).toBe("Serrature B00590.15.03");
  });
});

describe("toProductData", () => {
  it("mappa prezzo (centesimi → stringa decimale), specifications e shortDescription", () => {
    const data = toProductData(row({}));
    expect(data).toMatchObject({
      agbCode: "B00590.15.03",
      sku: "B00590.15.03",
      basePrice: "1.23",
      priceUnit: "EUR",
      isAvailable: true,
      stockQuantity: 0,
      categorySlug: "serrature",
      shortDescription: "Serrature · Incontri - Sicurezza · ACCIAIO",
    });
    expect(data.specifications).toMatchObject({
      finitura: "Ottonato lucido",
      materiale: "ACCIAIO",
      dimensione: "238 mm",
      confezione: { scatola: 25, cartone: 250 },
      classeSconto: "A2",
      sottocategoria: "Incontri - Sicurezza",
      gruppo: "Larghezza 22 mm, bordo tondo spessore 3 mm",
      colonne: { lunghezza: "238 mm", finitura: "Ottonato lucido" },
    });
    expect(data.specifications).not.toHaveProperty("mano");
  });

  it("porta la pagina fisica in listinoPage", () => {
    expect(toProductData(row({ page: 418 })).listinoPage).toBe(418);
  });
});

describe("dedupeRows", () => {
  it("deduplica per agbCode, ultima occorrenza vince", () => {
    const rows = [
      row({ priceCents: 100 }),
      row({ agbCode: "X00001.01.01" }),
      row({ priceCents: 200 }),
    ];
    const unique = dedupeRows(rows);
    expect(unique).toHaveLength(2);
    expect(unique.find((r) => r.agbCode === "B00590.15.03")?.priceCents).toBe(200);
  });
});
