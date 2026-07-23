import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechVasistasLegno } from "./rules-artech-vasistas-legno";

/**
 * Golden PROVVISORIO (Fase 1i): distinta vasistas ARTECH legno anta singola,
 * base pag.416, derivata dal listino 2026. NON validata da un esperto — vedi
 * docs/superpowers/kit-assunzioni/vasistas.md. Config GR03 (H1000, non ambigua).
 */
const golden: KitInput = {
  windowType: "VASISTAS",
  widthMm: 600,
  heightMm: 1000, // → GR03 (820-1220): 1 forbice, 1 nottolino
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

// 10 righe / 12 pezzi. Cremonese vasistas + catena DSS + forbici (1) + supporto/
// perno (1) + terminale + movimento angolare (2) + limitatore (2) + incontri (1).
const GOLDEN: [code: string, qty: number][] = [
  ["A50111.15.13", 1], // cremonese vasistas GR03 (altezza 1000)
  ["A50190.00.00", 1], // DSS ambidestro (ASSUNZIONE: A50111 lo richiede a parte)
  ["A51400.05.03", 1], // incontro DSS
  ["A50545.00.00", 1], // forbici per vasistas (GR03 → 1)
  ["A50702.05.00", 1], // supporto forbice battuta 20 (= n. forbici)
  ["A50790.00.00", 1], // perno supporto forbice (= n. forbici)
  ["A50193.00.03", 1], // terminale per vasistas corsa 18 (ASSUNZIONE)
  ["A50302.01.02", 2], // movimento angolare 125x125 (codice condiviso, qty 2)
  ["A50196.00.18", 2], // limitatore di corsa 18 (= n. movimenti angolari)
  ["A51400.05.02", 1], // incontri nottolino — NOT.(GR03) = 1
];

describe("artechVasistasLegno — golden provvisorio (da validare con agente)", () => {
  it("genera la distinta vasistas: 10 righe / 12 pezzi (GR03)", () => {
    const lines = artechVasistasLegno.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(10);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(12);
  });

  it("include la catena DSS (A50190.00.00 + incontro A51400.05.03) — a differenza del battente", () => {
    const codes = artechVasistasLegno.generate(golden).map((l) => l.code);
    expect(codes).toContain("A50190.00.00");
    expect(codes).toContain("A51400.05.03");
  });

  it("NON usa il meccanismo forbice/cerniere dell'anta-ribalta (A50510, A50904, A50801)", () => {
    const codes = artechVasistasLegno.generate(golden).map((l) => l.code);
    for (const c of ["A50510.00.03", "A50904.36.01", "A50801.01.01"])
      expect(codes).not.toContain(c);
  });

  it("forbici/supporto/perno scalano col GR: GR03 → 1, GR05 (H1800) → 2", () => {
    const qty = (input: KitInput, code: string) =>
      artechVasistasLegno.generate(input).find((l) => l.code === code)?.quantity ?? 0;
    for (const code of ["A50545.00.00", "A50702.05.00", "A50790.00.00"]) {
      expect(qty(golden, code)).toBe(1);
      expect(qty({ ...golden, heightMm: 1800 }, code)).toBe(2); // H1800 → GR05
    }
  });

  it("incontri nottolino = colonna NOT.(GR): GR03→1, GR05→2, GR06→4, GR01→assente", () => {
    const incontri = (h: number) =>
      artechVasistasLegno
        .generate({ ...golden, heightMm: h })
        .find((l) => l.code === "A51400.05.02")?.quantity ?? 0;
    expect(incontri(1000)).toBe(1); // GR03
    expect(incontri(1800)).toBe(2); // GR05
    expect(incontri(2400)).toBe(4); // GR06
    expect(incontri(600)).toBe(0); // GR01 (NOT.=0 → nessuna riga incontri)
  });

  it("ogni riga è tipata (position, ruleId artech.*, ruleDescription)", () => {
    for (const line of artechVasistasLegno.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it("materiale ≠ LEGNO → KitGenerationError (solo LEGNO per la vasistas)", () => {
    for (const material of ["PVC", "ALLUMINIO"] as const)
      expect(() => artechVasistasLegno.generate({ ...golden, material })).toThrow(
        KitGenerationError,
      );
  });

  it("superficie > 2 m² → KitGenerationError (artech.superficie)", () => {
    try {
      artechVasistasLegno.generate({ ...golden, widthMm: 1500, heightMm: 1500 }); // 2.25 m²
      expect.unreachable("attesa superficie fuori limite");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.superficie");
    }
  });

  it("altezza fuori campo GR (3000 e 500) → KitGenerationError tipato (artech.cremonese)", () => {
    for (const heightMm of [3000, 500]) {
      try {
        artechVasistasLegno.generate({ ...golden, heightMm });
        expect.unreachable("attesa cremonese fuori campo");
      } catch (err) {
        expect(err).toBeInstanceOf(KitGenerationError);
        expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
      }
    }
  });
});
