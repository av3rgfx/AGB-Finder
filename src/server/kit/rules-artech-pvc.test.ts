import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaPvc } from "./rules-artech-pvc";

const input: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "PVC",
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("artechAntaRibaltaPvc — gated (composizione assente dal listino 2026)", () => {
  it("rifiuta sempre, anche con input valido", () => {
    expect(() => artechAntaRibaltaPvc.generate(input)).toThrow(KitGenerationError);
  });

  it("il messaggio nomina il dato mancante e dove cercarlo", () => {
    expect(() => artechAntaRibaltaPvc.generate(input)).toThrow(/listino PVC e ALLUMINIO/);
  });

  it("rifiuta anche per gli altri materiali (nessun percorso genera righe)", () => {
    expect(() => artechAntaRibaltaPvc.generate({ ...input, material: "LEGNO" })).toThrow(
      KitGenerationError,
    );
  });

  it("mantiene l'engineId registrato nel registry", () => {
    expect(artechAntaRibaltaPvc.engineId).toBe("artech-ar-pvc");
  });
});
