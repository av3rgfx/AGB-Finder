import { describe, it, expect } from "vitest";
import { parseListino, parsePriceCents } from "./parse-listino";

describe("parsePriceCents", () => {
  it("converte i prezzi in formato italiano in centesimi (aritmetica intera)", () => {
    expect(parsePriceCents("1,23")).toBe(123);
    expect(parsePriceCents("104,52")).toBe(10452);
    expect(parsePriceCents("1.234,56")).toBe(123456);
    expect(parsePriceCents("0,97")).toBe(97);
  });
});

describe("parseListino — firma riga-prodotto", () => {
  // Righe REALI dal listino AGB 2026 (pdftotext -layout).
  const block = [
    "                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2",
    "                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2",
    "NB: utilizzare gli incontri elettrici dedicati alla serratura Opera SL",
    "Ferramenta per finestre - cod. A40457.25.10          Serrature - cod. B00591.50.03",
  ].join("\n");

  it("estrae codice, confezione, prezzo e classe sconto dalle righe con firma rigida", () => {
    const { rows } = parseListino(block);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      agbCode: "B00590.15.03",
      packBox: 25,
      packCarton: 250,
      priceCents: 123,
      discountClass: "A2",
    });
    expect(rows[1]).toMatchObject({ agbCode: "B00590.15.06", priceCents: 135 });
  });

  it("conta le righe-codice senza firma completa come skipped (senza crash)", () => {
    const { stats } = parseListino(block);
    expect(stats.codeLines).toBe(3); // 2 firme + 1 riga indice con 2 codici
    expect(stats.parsed).toBe(2);
    expect(stats.skipped).toBe(1);
  });

  it("conta le pagine dai marker \\f", () => {
    expect(parseListino("a\fb\fc").stats.pages).toBe(2);
    expect(parseListino("senza marker").stats.pages).toBe(1);
  });
});

// Fixture REALE — pagina 118 del listino (spaziatura preservata).
const FIXTURE_SERRATURE = [
  "\f                SERRATURE                                                                LISTINO 2026",
  "",
  "Incontri - Sicurezza",
  "                            Larghezza 22 mm, bordo tondo spessore 3 mm",
  "                            ACCIAIO",
  "                            LUNGHEZZA         FINITURA               CODICE                     € CS",
  "                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2",
  "                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2",
  "                                              Bronzato opaco vern.   B00590.15.22   25 250    0,97   A2",
  "                                              Cromato opaco          B00590.15.34   25 250    2,07   A2",
  "",
  "                            Larghezza 22 mm, bordo tondo spessore 2 mm",
  "                            ACCIAIO",
  "                            LUNGHEZZA         FINITURA               CODICE                     € CS",
  "                            238 mm            Ottonato lucido        B00590.30.03   25 250    1,05   A1",
  "",
  "                                                                                                 118",
].join("\n");

describe("parseListino — contesto di pagina", () => {
  it("attribuisce categoria, sottocategoria, gruppo e materiale a ogni riga", () => {
    const { rows, stats } = parseListino(FIXTURE_SERRATURE);
    expect(stats.parsed).toBe(5);
    expect(rows[0]).toMatchObject({
      agbCode: "B00590.15.03",
      category: "SERRATURE",
      subcategory: "Incontri - Sicurezza",
      groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
      material: "ACCIAIO",
    });
    // Il secondo gruppo aggiorna il titolo, la sottocategoria resta.
    expect(rows[4]).toMatchObject({
      agbCode: "B00590.30.03",
      groupTitle: "Larghezza 22 mm, bordo tondo spessore 2 mm",
      material: "ACCIAIO",
      discountClass: "A1",
    });
  });

  it("gestisce header con prefisso minuscolo (i.MOTION-S) e ignora numeri pagina", () => {
    const page = [
      "\f       i.MOTION-S                               LISTINO 2026",
      "Guide",
      "                     Guida singola",
      "                     FINITURA          CODICE               € CS",
      "                     Argento           M02022.01.02   1 1    10,00   C1",
      "                                                                573",
    ].join("\n");
    const { rows } = parseListino(page);
    expect(rows[0]).toMatchObject({ category: "i.MOTION-S", subcategory: "Guide" });
  });
});
