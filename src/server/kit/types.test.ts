import { describe, it, expect } from "vitest";
import { kitInputSchema } from "./types";

const valid = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "ALLUMINIO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("kitInputSchema", () => {
  it("accetta l'input della distinta golden", () => {
    expect(kitInputSchema.parse(valid)).toMatchObject({ widthMm: 550, heightMm: 1820 });
  });

  it("rifiuta serie non pilota", () => {
    expect(kitInputSchema.safeParse({ ...valid, series: "PLANA" }).success).toBe(false);
  });

  it("rifiuta dimensioni fuori 300-3000 e parametri fuori range", () => {
    expect(kitInputSchema.safeParse({ ...valid, widthMm: 200 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, airGapMm: 3 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, seatMm: 25 }).success).toBe(false);
  });

  it("sashWeightKg è opzionale e non rompe gli input esistenti", () => {
    const senza = kitInputSchema.safeParse(valid);
    expect(senza.success).toBe(true);
    const con = kitInputSchema.safeParse({ ...valid, sashWeightKg: 75 });
    expect(con.success).toBe(true);
  });

  it("sashWeightKg rifiuta valori fuori scala", () => {
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 0 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 250 }).success).toBe(false);
  });
});
