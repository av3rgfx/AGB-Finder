import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaAlu } from "./rules-artech-alu";

const base: KitInput = {
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

describe("artechAntaRibaltaAlu — gate 'non ancora disponibile'", () => {
  it("espone engineId artech-ar-alu (registrabile, riservato per il futuro)", () => {
    expect(artechAntaRibaltaAlu.engineId).toBe("artech-ar-alu");
  });

  it("generate() rifiuta con KitGenerationError esplicito: nessun dato alluminio nel listino", () => {
    expect(() => artechAntaRibaltaAlu.generate(base)).toThrow(KitGenerationError);
    expect(() => artechAntaRibaltaAlu.generate(base)).toThrow(/non ancora disponibile/i);
  });

  it("il rifiuto è deterministico e indipendente dall'input (nessuna distinta parziale)", () => {
    const other = { ...base, widthMm: 900, heightMm: 2000, openingSide: "DESTRA" as const };
    expect(() => artechAntaRibaltaAlu.generate(other)).toThrow(KitGenerationError);
  });
});
