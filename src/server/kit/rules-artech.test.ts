import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaLegno } from "./rules-artech";

/**
 * Input pilota (ADR 2026-07-04 + emendamento 2026-07-04-fase1d-emendamento-legno):
 * pivot da ALLUMINIO «ad applicare» (gamma 2021 non più a listino 2026) a
 * ARTECH LEGNO. Struttura/quantità della distinta reale restano identiche;
 * i codici profilo-specifici sono rimappati sugli equivalenti legno 2026.
 */
const golden: KitInput = {
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

/**
 * Set obbligatorio (Task 1, Fase 1g: chiusure supplementari OFF di default):
 * 12 righe / 17 pezzi — i codici verificati a DB in Task 0 + supporto-cerniera
 * estratto in Task 2 (vedi rules-artech.ts e scratchpad/artech-varianti.txt
 * §5), MENO le 4 righe "chiusura-*" ora dietro il flag `supplementaryClosures`.
 */
const GOLDEN_MANDATORY: [code: string, qty: number][] = [
  ["A50122.15.07", 1], // cremonese — hbb 1594-1810 (ASSUNZIONE hbb=heightMm-10)
  ["A50302.01.02", 2], // movimento angolare 125x125
  ["A50510.00.02", 1], // forbice-corpo — lbb 476-604
  ["A50702.05.00", 1], // supporto-forbice legno aria 12 - interasse 9/13
  ["A50790.00.00", 1], // perno-supporto-forbice
  ["A50904.36.02", 1], // squadra-angolare — interasse 13 SX
  ["A50801.01.02", 1], // supporto-cerniera SX (pin da estrazione, vedi ASSUNZIONE)
  ["A51301.02.21", 1], // coperture-kit ARGENTO SX
  ["A51400.05.03", 1], // incontro-dss aria 12
  ["A51400.05.02", 5], // incontri-nottolino aria 12
  ["A51400.05.70", 1], // incontro-ribalta (non più DX/SX)
  ["A51912.36.02", 1], // forbice-braccio SX — interasse 13 battuta 20 gruppo 2
];

describe("artechAntaRibaltaLegno — default (chiusure supplementari OFF)", () => {
  it("genera solo il set obbligatorio: 12 righe / 17 pezzi", () => {
    const lines = artechAntaRibaltaLegno.generate(golden); // golden NON ha il flag
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN_MANDATORY.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN_MANDATORY) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(12);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(17);
  });

  it("ogni riga ha position, ruleId e ruleDescription valorizzati", () => {
    for (const line of artechAntaRibaltaLegno.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it.each([1000, 2200])(
    "altezza %d (fuori banda chiusure): default OFF genera senza errore",
    (heightMm) => {
      expect(() => artechAntaRibaltaLegno.generate({ ...golden, heightMm })).not.toThrow();
    },
  );
});

describe("artechAntaRibaltaLegno — toggle chiusure supplementari ON", () => {
  it("aggiunge le 4 righe supplementari: 16 righe / 21 pezzi (distinta storica)", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...golden, supplementaryClosures: true });
    const codes = lines.map((l) => l.code);
    for (const c of ["A50330.00.00", "A50401.00.03", "A51801.00.01", "A51803.00.03"])
      expect(codes).toContain(c);
    expect(lines).toHaveLength(16);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(21);
  });

  it("toggle ON + altezza fuori banda 1520-2120 → KitGenerationError artech.verticali", () => {
    try {
      artechAntaRibaltaLegno.generate({ ...golden, heightMm: 2200, supplementaryClosures: true });
      expect.unreachable("atteso errore chiusure fuori banda");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.verticali");
    }
  });
});

describe("guardia materiale", () => {
  it.each(["ALLUMINIO", "PVC"] as const)(
    "material %s → KitGenerationError esplicito (il generatore copre solo LEGNO)",
    (material) => {
      expect(() => artechAntaRibaltaLegno.generate({ ...golden, material })).toThrow(
        KitGenerationError,
      );
    },
  );
});

describe("selezioni dipendenti dall'input", () => {
  it("mano DESTRA → squadra/supporto-cerniera/braccio/coperture in variante DX, stessa struttura", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...golden, openingSide: "DESTRA" });
    const codes = lines.map((l) => l.code);
    expect(codes).not.toContain("A50904.36.02");
    expect(codes).not.toContain("A50801.01.02");
    expect(codes).not.toContain("A51301.02.21");
    expect(codes).not.toContain("A51912.36.02");
    expect(codes).toContain("A50904.36.01");
    expect(codes).toContain("A50801.01.01");
    expect(codes).toContain("A51301.01.21");
    expect(codes).toContain("A51911.36.02");
    expect(lines).toHaveLength(12);
  });

  it("altezza fuori dal range cremonese più alto (2510) → KitGenerationError esplicito", () => {
    expect(() => artechAntaRibaltaLegno.generate({ ...golden, heightMm: 3000 })).toThrow(
      KitGenerationError,
    );
  });

  it("larghezza sopra l'ultimo scaglione forbice (1204) → errore tipato, mai kit silenzioso", () => {
    // Adattato ai dati reali: il primo scaglione forbice parte da 277mm, sotto
    // il minimo di kitInputSchema (300) — lo scenario "troppo stretto" non è
    // raggiungibile da input validati. Si verifica invece il bordo superiore.
    expect(() => artechAntaRibaltaLegno.generate({ ...golden, widthMm: 1205 })).toThrow(
      KitGenerationError,
    );
  });

  it("bordi del range forbice golden: 476 e 604 inclusi, 605 nello scaglione successivo", () => {
    const at = (w: number) =>
      artechAntaRibaltaLegno
        .generate({ ...golden, widthMm: w })
        .find((l) => l.position === "forbice-corpo")!.code;
    expect(at(476)).toBe("A50510.00.02");
    expect(at(604)).toBe("A50510.00.02");
    expect(at(605)).toBe("A50510.00.03"); // scaglione successivo (476-604 e 594-804 si sovrappongono)
  });

  it("incontri nottolino: quantità cresce con l'altezza a scatti del passo 600", () => {
    const qtyAt = (h: number) =>
      artechAntaRibaltaLegno
        .generate({ ...golden, heightMm: h })
        .find((l) => l.code === "A51400.05.02")!.quantity;
    expect(qtyAt(1820)).toBe(5); // golden: 2+floor(1820/600)+floor(550/600) = 2+3+0
    expect(qtyAt(1799)).toBe(4); // appena sotto la soglia di scatto floor(H/600)=3→2
    // 2400 è fuori dall'unica banda CHIUSURE_VERTICALI (1520-2120): col
    // vecchio codice (chiusure sempre generate) sarebbe fallita qui; col
    // default OFF (Task 1) è raggiungibile senza errore.
    expect(qtyAt(2400)).toBe(6); // 2+floor(2400/600)+floor(550/600) = 2+4+0
  });
});
