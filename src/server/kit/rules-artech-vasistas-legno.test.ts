import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechVasistasLegno } from "./rules-artech-vasistas-legno";

/**
 * Golden PROVVISORIO: distinta vasistas ARTECH legno anta singola, trascritta
 * dallo schema di montaggio p0418 (416). NON validata da un esperto — vedi
 * docs/superpowers/kit-assunzioni/vasistas.md. Config GR03 (H1000, non ambigua).
 */
const golden: KitInput = {
  windowType: "VASISTAS",
  widthMm: 600,
  heightMm: 1000, // → GR03 (820-1220): 1 nottolino
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

/**
 * Golden vasistas — TRASCRIZIONE delle 13 voci dello schema di montaggio p0418
 * (416) «Finestra rettangolare legno - apertura vasistas», per la geometria del
 * pilota (aria 12 / interasse 13 / battuta 20 / sede 18) e H 1000 / L 600.
 * 13 righe / 19 pezzi (1+1+1+1 + 2+2 + 2+2 + 2+1+1+2 + 1).
 *
 * Voci dello schema e loro resa:
 *  1 cremonese A50111.15.NN per GR ....................... cremonese
 *  2 forbici per vasistas (tabella LBB) .................. forbici-vasistas
 *  3 terminale con nottolino corsa 18 .................... terminale-vasistas-18
 *  4 terminale con nottolino corsa 18+18 ................. terminale-vasistas-18-18
 *  5 movimenti angolari per ante rettangolari ............ movimento-angolare
 *  6 limitatore di corsa 18 mm ........................... limitatore-corsa
 *  7 chiusure supplementari › terminale .................. dietro supplementaryClosures (task 7)
 *  8 supporti forbice .................................... supporto-forbice
 *  9 perno per supporto forbice .......................... perno-supporto-forbice
 * 10 centrale registrabile portante e per vasistas ....... cerniera-portante
 * 11 articolazione superiore anta semifissa .............. articolazione-superiore-dx/-sx
 * 12 corpo articolazione superiore ....................... corpo-articolazione
 * 13 incontri nottolino .................................. incontri-nottolino
 *
 * Le voci 10-11-12 sono quelle che APPENDONO l'anta: nel disegno stanno ai due
 * angoli inferiori, speculari (più la ⑩ centrale opzionale per ante 70-80 kg).
 * La legenda le cita come «Cerniere per seconda anta » …» perché quello è il
 * titolo della sezione di listino p0453 (451)-p0455 (453) da cui provengono, non
 * la loro destinazione — vedi il commento del modulo.
 * Essendo i due angoli speculari, la voce 11 (l'unica data per mano dal listino)
 * vale 1 pezzo DX + 1 pezzo SX, indipendentemente da `openingSide`.
 *
 * NON compaiono nello schema, quindi NON sono nella distinta: DSS A50190.00.00 e
 * incontro DSS A51400.05.03. Erano stati presi da una NB della tabella cremonesi
 * p0424 (422)/p0426 (424) scritta per l'uso ANTA-RIBALTA della famiglia condivisa
 * «Anta ribalta/vasistas» — l'NB di p0424 (422) dice infatti «DSS sempre presente
 * su tutti i GR» a proposito dell'anta ribalta.
 */
const GOLDEN: [code: string, qty: number][] = [
  ["A50111.15.13", 1], // 1 cremonese vasistas GR03 (H 1000), p0426 (424)
  ["A50545.00.00", 1], // 2 forbici — LBB 541-860 → 1 sul traverso, p0442 (440)
  ["A50193.00.03", 1], // 3 terminale corsa 18, p0431 (429)
  ["A50193.00.02", 1], // 4 terminale corsa 18+18, p0431 (429)
  ["A50302.01.02", 2], // 5 movimento angolare 125x125, p0435 (433)
  ["A50196.00.18", 2], // 6 limitatore di corsa 18 = n. movimenti angolari
  ["A50702.05.00", 2], // 8 supporto forbice = n. cerniere portanti, p0449 (447)
  ["A50790.00.00", 2], // 9 perno = n. cerniere portanti, p0449 (447)
  ["A51101.36.01", 2], // 10 centrale registrabile portante e per vasistas, p0455 (453)
  ["A51001.36.01", 1], // 11 articolazione superiore anta semifissa DX, p0455 (453)
  ["A51001.36.02", 1], // 11 articolazione superiore anta semifissa SX (angolo speculare)
  ["A51050.16.12", 2], // 12 corpo articolazione superiore, p0454 (452)
  ["A51400.05.02", 1], // 13 incontri nottolino — NOT.(GR03) = 1, p0469 (467)
];

describe("artechVasistasLegno — golden provvisorio (da validare con agente)", () => {
  it("genera la distinta vasistas: 13 righe / 19 pezzi (GR03)", () => {
    const lines = artechVasistasLegno.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(13);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(19);
  });

  it("NON usa il meccanismo forbice/cerniere dell'anta-ribalta (A50510, A50904, A50805)", () => {
    const codes = artechVasistasLegno.generate(golden).map((l) => l.code);
    for (const c of ["A50510.00.03", "A50904.36.01", "A50805.05.DX"])
      expect(codes).not.toContain(c);
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

describe("artechVasistasLegno — forbici dalla tabella «Posizionamento forbici» p0418 (416)", () => {
  const forbiciAt = (widthMm: number) =>
    artechVasistasLegno
      .generate({ ...golden, widthMm })
      .find((l) => l.position === "forbici-vasistas")?.quantity;

  it("LBB 274-540 → 2 (sui montanti)", () => {
    expect(forbiciAt(300)).toBe(2);
    expect(forbiciAt(540)).toBe(2);
  });

  it("LBB 541-860 → 1 (sul traverso)", () => {
    expect(forbiciAt(541)).toBe(1);
    expect(forbiciAt(600)).toBe(1); // golden
    expect(forbiciAt(860)).toBe(1);
  });

  it("LBB 861-1200 → 3 (1 traverso + 2 montanti)", () => {
    expect(forbiciAt(861)).toBe(3);
    expect(forbiciAt(1200)).toBe(3);
  });

  it("LBB 1201-2510 → 4 (2 traverso + 2 montanti)", () => {
    expect(forbiciAt(1201)).toBe(4);
  });

  it("non dipende più dall'altezza: stessa larghezza, GR diversi, stesse forbici", () => {
    expect(forbiciAt(600)).toBe(
      artechVasistasLegno
        .generate({ ...golden, widthMm: 600, heightMm: 1300 })
        .find((l) => l.position === "forbici-vasistas")?.quantity,
    );
  });

  it("la descrizione cita la banda LBB, non il GR", () => {
    const riga = artechVasistasLegno
      .generate({ ...golden, widthMm: 900 })
      .find((l) => l.position === "forbici-vasistas");
    expect(riga?.ruleDescription).toMatch(/861/);
  });
});

describe("artechVasistasLegno — aderenza allo schema p0418 (416)", () => {
  const lines = artechVasistasLegno.generate(golden);

  it("non genera il DSS: lo schema vasistas non lo prevede", () => {
    expect(lines.map((l) => l.code)).not.toContain("A50190.00.00");
  });

  it("non genera l'incontro DSS", () => {
    expect(lines.map((l) => l.code)).not.toContain("A51400.05.03");
  });

  it("genera le tre famiglie di cerniere (voci 10, 11, 12), 2 pezzi ciascuna", () => {
    // Un angolo inferiore per parte: 2 pezzi per famiglia. La voce 11 è l'unica
    // che il listino dà per mano → i 2 pezzi sono 2 righe da 1 (DX + SX).
    for (const position of ["cerniera-portante", "corpo-articolazione"])
      expect(lines.find((l) => l.position === position)?.quantity).toBe(2);
    const articolazioni = lines.filter((l) => l.position.startsWith("articolazione-superiore"));
    expect(articolazioni.map((l) => [l.position, l.code, l.quantity])).toEqual([
      ["articolazione-superiore-dx", "A51001.36.01", 1],
      ["articolazione-superiore-sx", "A51001.36.02", 1],
    ]);
  });

  it("la distinta NON dipende da openingSide: il vasistas è incernierato in basso", () => {
    // I due angoli inferiori sono speculari: servono entrambe le mani della voce
    // 11, e nessun'altra voce ha varianti di mano. Prima il modulo sceglieva
    // 2 pezzi della stessa mano in base a `openingSide`, dato privo di
    // significato per una ribalta pura.
    const sx = artechVasistasLegno.generate({ ...golden, openingSide: "SINISTRA" });
    expect(sx).toEqual(lines);
  });

  it("supporto forbice e perno seguono le cerniere portanti, non le forbici", () => {
    // LBB 900 → 3 forbici, ma le cerniere portanti restano 2
    const largo = artechVasistasLegno.generate({ ...golden, widthMm: 900 });
    expect(largo.find((l) => l.position === "forbici-vasistas")?.quantity).toBe(3);
    expect(largo.find((l) => l.position === "supporto-forbice")?.quantity).toBe(2);
    expect(largo.find((l) => l.position === "perno-supporto-forbice")?.quantity).toBe(2);
  });

  it("genera entrambi i terminali (voci 3 e 4)", () => {
    expect(lines.find((l) => l.position === "terminale-vasistas-18")?.code).toBe("A50193.00.03");
    expect(lines.find((l) => l.position === "terminale-vasistas-18-18")?.code).toBe("A50193.00.02");
  });
});
