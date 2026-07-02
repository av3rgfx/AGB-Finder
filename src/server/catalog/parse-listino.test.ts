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
