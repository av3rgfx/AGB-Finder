import { describe, it, expect } from "vitest";
import { GEOMETRIE, geometria, geometriaLabel, assertSeatConfigSupportata } from "./artech-geometrie";
import { KitGenerationError } from "./types";

describe("GEOMETRIE — le 7 combinazioni del listino 2026", () => {
  it("copre le tre configurazioni dei clienti reali", () => {
    expect(GEOMETRIE.A4_I85_B15).toMatchObject({ airGapMm: 4, axisOffsetMm: 8.5, rebateMm: 15 });
    expect(GEOMETRIE.A4_I9_B18).toMatchObject({ airGapMm: 4, axisOffsetMm: 9, rebateMm: 18 });
    expect(GEOMETRIE.A12_I13_B18).toMatchObject({ airGapMm: 12, axisOffsetMm: 13, rebateMm: 18 });
  });

  it("l'interasse 8,5 NON usa A50904, che a listino non ha il .22", () => {
    expect(GEOMETRIE.A4_I85_B15.squadraAngolare.DESTRA).toBe("A50902.22.01");
    expect(GEOMETRIE.A4_I85_B15.squadraAngolare.SINISTRA).toBe("A50902.22.02");
  });

  it("il pilota storico conserva i codici verificati della distinta 2021", () => {
    expect(GEOMETRIE.A12_I13_B20).toMatchObject({
      squadraAngolare: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
      supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
      supportoForbice: "A50702.05.00",
      braccioMid: "36",
    });
  });

  it("per aria 4 la sede non esiste (fresatura), per aria 12 è derivata", () => {
    expect(GEOMETRIE.A4_I9_B18.sedeMm).toBeNull();
    expect(GEOMETRIE.A12_I9_B18.sedeMm).toBe(18);
    expect(GEOMETRIE.A12_I13_B18.sedeMm).toBe(24);
  });

  it("nessun codice dichiarato è vuoto o malformato", () => {
    const re = /^[A-Z]\d{5}\.[0-9A-Z]{2}\.[0-9A-Z]{2}$|^[A-Z]\d{5}\.\d{2}\.\d{2}$/;
    for (const g of Object.values(GEOMETRIE)) {
      expect(g.supportoForbice).toMatch(re);
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        expect(g.squadraAngolare[mano]).toMatch(re);
        expect(g.supportoCerniera[mano]).toMatch(re);
      }
    }
  });
});

describe("geometria()", () => {
  it("restituisce la riga richiesta", () => {
    expect(geometria("A12_I13_B20").braccioMid).toBe("36");
  });
});

describe("geometriaLabel()", () => {
  it("è leggibile da un serramentista, con la virgola decimale italiana", () => {
    expect(geometriaLabel("A4_I85_B15")).toBe("Aria 4 · interasse 8,5 · battuta 15");
    expect(geometriaLabel("A12_I13_B18")).toBe("Aria 12 · interasse 13 · battuta 18");
  });
});

describe("assertSeatConfigSupportata()", () => {
  it("STANDARD passa", () => {
    expect(() => assertSeatConfigSupportata("STANDARD")).not.toThrow();
  });

  it("SEDE_30 viene rifiutata: manca l'incontro DSS 13x30 a listino", () => {
    expect(() => assertSeatConfigSupportata("SEDE_30")).toThrow(KitGenerationError);
    expect(() => assertSeatConfigSupportata("SEDE_30")).toThrow(/sede 30/i);
  });
});
