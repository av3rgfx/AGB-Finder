import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaBattenteLegno } from "./rules-artech-battente-legno";

/**
 * Golden PROVVISORIO (Fase 1h): distinta anta a battente derivata dal listino
 * 2026 (cremonese Mod. 502 A50200.15.NN) + famiglie legno condivise, MENO il
 * meccanismo di ribalta. NON validata da un esperto — vedi
 * docs/superpowers/kit-assunzioni/battente.md. Altezza 1300 scelta per essere
 * robusta all'offset cremonese (±10 → sempre gruppo .05).
 */
const golden: KitInput = {
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

// 5 righe / 10 pezzi. Cremonese battente + cerniere (condivise) + movimento
// angolare (condiviso) + incontri nottolino (condivisi).
const GOLDEN: [code: string, qty: number][] = [
  ["A50200.15.05", 1], // cremonese Mod. 502 — altezza 1300 (gruppo 1200-1410)
  ["A50904.36.01", 1], // squadra angolare DX (condivisa)
  ["A50801.01.01", 1], // supporto cerniera DX (condivisa)
  ["A50302.01.02", 2], // movimento angolare 125x125 (condiviso)
  ["A51400.05.02", 5], // incontri nottolino — 2+floor(1300/600)+floor(600/600)=2+2+1
];

describe("artechAntaBattenteLegno — golden provvisorio (da validare con agente)", () => {
  it("genera la distinta battente: 5 righe / 10 pezzi", () => {
    const lines = artechAntaBattenteLegno.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(5);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(10);
  });

  it("NON include il meccanismo di ribalta (forbice, supporto forbice, incontro ribalta, DSS)", () => {
    const codes = artechAntaBattenteLegno.generate(golden).map((l) => l.code);
    for (const c of ["A50510.00.02", "A50702.05.00", "A50790.00.00", "A51400.05.70", "A51400.05.03"])
      expect(codes).not.toContain(c);
  });

  it("ogni riga è tipata (position, ruleId artech.*, ruleDescription)", () => {
    for (const line of artechAntaBattenteLegno.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it("mano SINISTRA → cerniere in variante SX, stessa struttura (5 righe)", () => {
    const codes = artechAntaBattenteLegno
      .generate({ ...golden, openingSide: "SINISTRA" })
      .map((l) => l.code);
    expect(codes).toContain("A50904.36.02");
    expect(codes).toContain("A50801.01.02");
    expect(codes).not.toContain("A50904.36.01");
    expect(codes).not.toContain("A50801.01.01");
  });

  it("materiale ≠ LEGNO → KitGenerationError (solo LEGNO per il battente)", () => {
    for (const material of ["PVC", "ALLUMINIO"] as const)
      expect(() => artechAntaBattenteLegno.generate({ ...golden, material })).toThrow(
        KitGenerationError,
      );
  });

  it("altezza fuori campo cremonese (3000) → KitGenerationError tipato", () => {
    try {
      artechAntaBattenteLegno.generate({ ...golden, heightMm: 3000 });
      expect.unreachable("attesa cremonese fuori campo");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
    }
  });

  it("incontri nottolino: quantità cresce a scatti del passo 600", () => {
    const qtyAt = (w: number, h: number) =>
      artechAntaBattenteLegno
        .generate({ ...golden, widthMm: w, heightMm: h })
        .find((l) => l.code === "A51400.05.02")!.quantity;
    expect(qtyAt(600, 1300)).toBe(5); // 2+2+1
    expect(qtyAt(550, 1799)).toBe(4); // 2+2+0
  });
});
