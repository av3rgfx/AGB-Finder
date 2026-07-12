import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaPvc } from "./rules-artech-pvc";

/**
 * Golden PVC PROVVISORIO (Fase 1g, Task 3): i valori NON sono validati da un
 * esperto — vedi scratchpad/kit-pvc-assunzioni.md. Il test è volutamente uno
 * "shape test" (distinta coerente, non un golden esatto blindato): struttura
 * derivata dal modulo LEGNO + 4 swap material-specific dalla tabella di
 * certificazione ift EN 13126-8 (schemi 8/9 "ARTech PVC", listino righe
 * ~625-627 / ~17188). La validazione dei codici avverrà via l'integrazione
 * gated (INTEGRATION_DATABASE_URL) e la revisione dell'esperto.
 */
const base: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "PVC",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("artechAntaRibaltaPvc — shape provvisoria (da validare con agente)", () => {
  it("genera una distinta non vuota, ogni riga tipata e con ruleId artech.*", () => {
    const lines = artechAntaRibaltaPvc.generate(base);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.code, l.position).toMatch(/^A\d{5}\./);
      expect(l.quantity, l.code).toBeGreaterThan(0);
      expect(l.ruleId, l.code).toMatch(/^artech\./);
      expect(l.position.length, l.code).toBeGreaterThan(0);
      expect(l.ruleDescription.length, l.code).toBeGreaterThan(0);
    }
  });

  it("include i 4 componenti material-specific PVC (cert ift schemi 8/9)", () => {
    const codes = artechAntaRibaltaPvc.generate(base).map((l) => l.code);
    // supporto-forbice, squadra-angolare, supporto-cerniera PVC (fissi);
    // braccio SX gruppo 02 per larghezza 550 (A51922.36.02).
    for (const c of ["A50712.00.00", "A50922.07.00", "A50812.07.00", "A51922.36.02"])
      expect(codes).toContain(c);
  });

  it("materiale ≠ PVC → KitGenerationError", () => {
    expect(() => artechAntaRibaltaPvc.generate({ ...base, material: "LEGNO" })).toThrow(
      KitGenerationError,
    );
  });

  it("mano DESTRA → braccio in variante DX (A51921*), stessa lunghezza distinta", () => {
    const dx = artechAntaRibaltaPvc.generate({ ...base, openingSide: "DESTRA" });
    const codes = dx.map((l) => l.code);
    expect(codes).toContain("A51921.36.02");
    expect(codes).not.toContain("A51922.36.02");
    expect(dx.length).toBe(artechAntaRibaltaPvc.generate(base).length);
  });

  it("altezza fuori campo cremonese → KitGenerationError tipato", () => {
    try {
      artechAntaRibaltaPvc.generate({ ...base, heightMm: 3000 });
      expect.unreachable("attesa cremonese fuori campo");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
    }
  });
});
