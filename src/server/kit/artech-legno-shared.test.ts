import { describe, it, expect } from "vitest";
import {
  PER_MANO,
  MOVIMENTO_ANGOLARE,
  incontriNottolino,
  PILOT_GEOMETRY,
  assertPilotGeometry,
} from "./artech-legno-shared";
import { KitGenerationError, type KitInput } from "./types";

describe("artech-legno-shared", () => {
  it("PER_MANO ha varianti DX/SX per squadra angolare e supporto cerniera", () => {
    expect(PER_MANO.DESTRA.squadraAngolare).toBe("A50904.36.01");
    expect(PER_MANO.SINISTRA.squadraAngolare).toBe("A50904.36.02");
    expect(PER_MANO.DESTRA.supportoCerniera).toBe("A50805.05.DX");
    expect(PER_MANO.SINISTRA.supportoCerniera).toBe("A50805.05.SX");
  });

  it("MOVIMENTO_ANGOLARE è il fisso 125x125 in quantità 2", () => {
    expect(MOVIMENTO_ANGOLARE.code).toBe("A50302.01.02");
    expect(MOVIMENTO_ANGOLARE.quantity).toBe(2);
  });

  it("incontriNottolino: 2 base + scatti passo 600 in altezza e larghezza", () => {
    expect(incontriNottolino(550, 1820)).toBe(5); // golden A/R: 2+floor(1820/600)+floor(550/600)
    expect(incontriNottolino(600, 1300)).toBe(5); // golden battente: 2+floor(1300/600)+floor(600/600)
  });
});

const pilota: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "LEGNO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("assertPilotGeometry", () => {
  it("accetta la geometria coperta", () => {
    expect(() => assertPilotGeometry(pilota)).not.toThrow();
  });

  it("rifiuta un'aria diversa e la nomina nel messaggio", () => {
    expect(() => assertPilotGeometry({ ...pilota, airGapMm: 4 })).toThrow(/aria 4/);
  });

  it("rifiuta un interasse diverso", () => {
    expect(() => assertPilotGeometry({ ...pilota, axisOffsetMm: 9 })).toThrow(KitGenerationError);
  });

  it("rifiuta una battuta diversa", () => {
    expect(() => assertPilotGeometry({ ...pilota, rebateMm: 18 })).toThrow(KitGenerationError);
  });

  it("rifiuta una sede diversa", () => {
    expect(() => assertPilotGeometry({ ...pilota, seatMm: 30 })).toThrow(/sede 30/);
  });

  it("elenca tutti i parametri fuori campo, non solo il primo", () => {
    expect(() => assertPilotGeometry({ ...pilota, airGapMm: 4, seatMm: 30 })).toThrow(
      /aria 4.*sede 30/s,
    );
  });

  it("la geometria coperta è quella del golden", () => {
    expect(PILOT_GEOMETRY).toEqual({ airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18 });
  });
});
