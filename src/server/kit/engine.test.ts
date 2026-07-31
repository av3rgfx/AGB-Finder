import { describe, it, expect, vi, beforeEach } from "vitest";
import { KitEngine } from "./engine";
import { KitGenerationError, type KitInput } from "./types";

const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const db = {
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
} as never;

const validInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "LEGNO",
  geometry: "A12_I13_B20", entrata: "E15", seatConfig: "STANDARD",
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
};

const template = { id: "t1", rules: { engine: "artech-ar-legno", version: 1 } };

// Golden vasistas (rules-artech-vasistas-legno.test.ts): il modulo dichiara
// `varianti: []` — è il soggetto naturale per verificare il rifiuto di una
// variante non dichiarata.
const vasistasInput = {
  windowType: "VASISTAS", widthMm: 600, heightMm: 1000, material: "LEGNO",
  geometry: "A12_I13_B20", entrata: "E15", seatConfig: "STANDARD",
  openingSide: "DESTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
};

beforeEach(() => {
  templateFindFirst.mockReset();
  productFindMany.mockReset();
});

describe("KitEngine.generate", () => {
  it("input invalido → KitGenerationError (messaggio italiano)", async () => {
    const engine = new KitEngine(db);
    await expect(engine.generate({ ...validInput, widthMm: 10 })).rejects.toThrow(/non valid/i);
  });

  it("nessun template attivo → errore esplicito", async () => {
    templateFindFirst.mockResolvedValue(null);
    const engine = new KitEngine(db);
    await expect(engine.generate(validInput)).rejects.toThrow(/template/i);
  });

  it("genera, prezza dal catalogo e somma i totali", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve(
        (where.agbCode.in as string[]).map((code: string) => ({
          id: "p_" + code, agbCode: code, name: "Prodotto " + code,
          basePrice: { toString: () => "2.000" },
        })),
      ),
    );
    const engine = new KitEngine(db);
    const output = await engine.generate(validInput);
    // Task 1 (Fase 1g): validInput non imposta supplementaryClosures →
    // default OFF → set obbligatorio (12 righe/17 pezzi), non più 16/21.
    expect(output.lines.length).toBe(12);
    expect(output.totalComponents).toBe(12);
    expect(output.warnings).toEqual([]);
    const incontri = output.lines.find((l) => l.code === "A51400.05.02")!;
    expect(incontri.quantity).toBe(5);
    expect(incontri.totalPrice).toBeCloseTo(10);
    expect(output.totalPrice).toBeCloseTo(2 * 17);
    expect(output.templateId).toBe("t1");
  });

  it("codice mancante a listino → warning, riga senza prezzo, kit comunque generato", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve(
        (where.agbCode.in as string[])
          .filter((code: string) => code !== "A50122.15.07")
          .map((code: string) => ({ id: "p_" + code, agbCode: code, name: code, basePrice: { toString: () => "1" } })),
      ),
    );
    const engine = new KitEngine(db);
    const output = await engine.generate(validInput);
    const missing = output.lines.find((l) => l.code === "A50122.15.07")!;
    expect(missing.productId).toBeNull();
    expect(output.warnings.join(" ")).toContain("A50122.15.07");
  });

  it("seleziona il template per windowType/series/material con priority", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockResolvedValue([]);
    const engine = new KitEngine(db);
    await engine.generate(validInput);
    expect(templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          windowType: "ANTA_RIBALTA",
          series: "ARTECH",
        }),
        orderBy: { priority: "desc" },
      }),
    );
  });

  // ANTA_BATTENTE DISATTIVATO 2026-07-25 (distinta priva del gruppo di
  // sospensione superiore): con il DB reale il template è isActive:false e la
  // barriera scatta prima. Qui il template è mockato attivo, quindi si verifica
  // la seconda barriera — il modulo rifiuta — e che l'engine abbia comunque
  // inoltrato la windowType alla query di selezione.
  it("seleziona il template per ANTA_BATTENTE, poi il modulo gated rifiuta", async () => {
    templateFindFirst.mockResolvedValue({
      id: "tb",
      rules: { engine: "artech-batt-legno", version: 1 },
    });
    productFindMany.mockResolvedValue([]);
    const engine = new KitEngine(db);
    await expect(engine.generate({ ...validInput, windowType: "ANTA_BATTENTE" })).rejects.toThrow(
      KitGenerationError,
    );
    expect(templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          windowType: "ANTA_BATTENTE",
          series: "ARTECH",
        }),
      }),
    );
  });

  // Strato 1 della garanzia sulle varianti (spec §6): il motore rifiuta, col
  // nome della variante, una richiesta che ne porta una non dichiarata dal
  // modulo — prima che quella scelta si perda in silenzio in una distinta.
  it("rifiuta, col nome della variante, una richiesta che porta una variante non dichiarata dal modulo", async () => {
    templateFindFirst.mockResolvedValue({
      id: "tv",
      rules: { engine: "artech-vasistas-legno", version: 1 },
    });
    const engine = new KitEngine(db);
    // Il modulo vasistas dichiara `varianti: []`.
    const input = { ...vasistasInput, variants: { squadraAngolare: "BASE" } } as KitInput;
    await expect(engine.generate(input)).rejects.toThrow(/squadraAngolare/);
  });
});
