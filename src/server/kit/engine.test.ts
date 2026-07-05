import { describe, it, expect, vi, beforeEach } from "vitest";
import { KitEngine } from "./engine";

const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const db = {
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
} as never;

const validInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "LEGNO",
  airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
};

const template = { id: "t1", rules: { engine: "artech-ar-legno", version: 1 } };

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
    expect(output.lines.length).toBe(16);
    expect(output.totalComponents).toBe(16);
    expect(output.warnings).toEqual([]);
    const incontri = output.lines.find((l) => l.code === "A51400.05.02")!;
    expect(incontri.quantity).toBe(5);
    expect(incontri.totalPrice).toBeCloseTo(10);
    expect(output.totalPrice).toBeCloseTo(2 * 21);
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
});
