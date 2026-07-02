import { describe, it, expect } from "vitest";
import { parseListino } from "./parse-listino";
import { PAGE_SERRATURE, PAGE_CERNIERE, PAGE_PROFILI, ALL_FIXTURE_PAGES } from "./fixtures";

describe("parseListino — serrature (finish rows, inherited dimension)", () => {
  const { rows } = parseListino(PAGE_SERRATURE);

  it("extracts all 14 product rows", () => expect(rows).toHaveLength(14));

  it("parses code, price cents, packaging, discount class", () => {
    const r = rows.find((x) => x.agbCode === "B00590.15.03")!;
    expect(r.priceCents).toBe(123);
    expect(r.packBox).toBe(25);
    expect(r.packCarton).toBe(250);
    expect(r.discountClass).toBe("A2");
  });

  it("assigns category and subcategory from page headers", () => {
    expect(rows[0]!.category).toBe("SERRATURE");
    expect(rows[0]!.subcategory).toBe("Incontri - Sicurezza");
  });

  it("captures group title and material", () => {
    const r = rows.find((x) => x.agbCode === "B00590.30.06")!;
    expect(r.groupTitle).toBe("Larghezza 22 mm, bordo tondo spessore 2 mm");
    expect(r.material).toBe("ACCIAIO");
  });

  it("inherits the dimension from the first row of the block", () => {
    const first = rows.find((x) => x.agbCode === "B00590.15.03")!;
    const later = rows.find((x) => x.agbCode === "B00590.15.34")!;
    expect(first.dimension).toBe("238 mm");
    expect(later.dimension).toBe("238 mm");
    expect(later.finish).toBe("Cromato opaco");
  });
});

describe("parseListino — cerniere (hand dx/sx, ø dimension)", () => {
  const { rows } = parseListino(PAGE_CERNIERE);

  it("extracts all 8 rows with hand", () => {
    expect(rows).toHaveLength(8);
    expect(rows.find((x) => x.agbCode === "E10157.14.93")!.hand).toBe("DX");
    expect(rows.find((x) => x.agbCode === "E10158.14.93")!.hand).toBe("SX");
  });

  it("parses ø dimension and strips it from finish", () => {
    const r = rows.find((x) => x.agbCode === "E10157.14.93")!;
    expect(r.dimension).toBe("ø 14");
    expect(r.finish).toBe("Black Powerage 83");
  });

  it("keeps the group title and inherits ø on sx rows", () => {
    const sx = rows.find((x) => x.agbCode === "E10038.18.21")!;
    expect(sx.groupTitle).toBe("Mod.179 Ala, lame in asse senza perni");
    expect(sx.dimension).toBe("ø 18");
    expect(sx.priceCents).toBe(508);
  });
});

describe("parseListino — profili (uppercase finish-group lines)", () => {
  const { rows } = parseListino(PAGE_PROFILI);

  it("extracts all 15 rows", () => expect(rows).toHaveLength(15));

  it("uses the uppercase color line as finish when the row has none", () => {
    expect(rows.find((x) => x.agbCode === "G01342.01.86")!.finish).toBe("GRIGIO RAL 7035");
    expect(rows.find((x) => x.agbCode === "G01342.01.93")!.finish).toBe("NERO OPACO");
    expect(rows.find((x) => x.agbCode === "G02401.15.01")!.finish).toBe("ALLUMINIO ARGENTO");
  });

  it("row dimension comes from the row prefix", () => {
    expect(rows.find((x) => x.agbCode === "G01342.02.86")!.dimension).toBe("3000 mm");
    expect(rows.find((x) => x.agbCode === "G02019.10.93")!.dimension).toBe("10 metri");
  });

  it("parses thousands-free decimal prices", () => {
    expect(rows.find((x) => x.agbCode === "G01342.02.86")!.priceCents).toBe(12488);
    expect(rows.find((x) => x.agbCode === "G01342.05.93")!.priceCents).toBe(31140);
  });
});

describe("parseListino — stats & robustness", () => {
  it("reports pages/codeLines/parsed/skipped consistently", () => {
    const { rows, stats } = parseListino(ALL_FIXTURE_PAGES);
    expect(stats.pages).toBe(3);
    expect(rows).toHaveLength(37);
    expect(stats.parsed).toBe(rows.length);
    expect(stats.codeLines).toBeGreaterThanOrEqual(stats.parsed);
    expect(stats.skipped).toBe(stats.codeLines - stats.parsed);
  });

  it("rows without a category page header land in ALTRO, never crash", () => {
    const orphan = `\f  LISTINO 2026\n  qualcosa   Z90870.09.99   1 1   88,00  A1`;
    const { rows } = parseListino(orphan);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBe("ALTRO");
  });

  it("parses a thousands-separated price (1.234,56)", () => {
    const page = `\f  DEMO   LISTINO 2026\nSub\n   gruppo test\n   FINITURA   CODICE   € CS\n   Argento   X12345.01.02   1 10   1.234,56   B1`;
    const { rows } = parseListino(page);
    expect(rows[0]!.priceCents).toBe(123456);
  });
});
