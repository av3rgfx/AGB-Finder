import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaBattenteLegno, BATTENTE_CREMONESI } from "./rules-artech-battente-legno";

const input: KitInput = {
  windowType: "ANTA_BATTENTE",
  widthMm: 600,
  heightMm: 1300,
  material: "LEGNO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "DESTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("artechAntaBattenteLegno — gated (distinta incompleta)", () => {
  it("rifiuta: la distinta non ha il gruppo di sospensione superiore", () => {
    expect(() => artechAntaBattenteLegno.generate(input)).toThrow(KitGenerationError);
  });

  it("il messaggio nomina il dato mancante (terna cerniere dello schema)", () => {
    expect(() => artechAntaBattenteLegno.generate(input)).toThrow(/cerniere/i);
  });

  it("mantiene l'engineId registrato nel registry", () => {
    expect(artechAntaBattenteLegno.engineId).toBe("artech-batt-legno");
  });
});

describe("BATTENTE_CREMONESI — verificata contro p0429 (427), conservata per la ripartenza", () => {
  it("ha le 10 bande del listino, dalla GR01 alla GR10", () => {
    expect(BATTENTE_CREMONESI).toHaveLength(10);
    expect(BATTENTE_CREMONESI[0]).toMatchObject({ minH: 360, maxH: 610, code: "A50200.15.01" });
    expect(BATTENTE_CREMONESI[9]).toMatchObject({ minH: 2200, maxH: 2510, code: "A50200.15.10" });
  });
});
