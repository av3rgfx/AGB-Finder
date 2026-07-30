import { describe, it, expect } from "vitest";
import type { ArtechKitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaLegno } from "./rules-artech-legno";

/**
 * Input pilota (ADR 2026-07-04 + emendamento 2026-07-04-fase1d-emendamento-legno):
 * pivot da ALLUMINIO «ad applicare» (gamma 2021 non più a listino 2026) a
 * ARTECH LEGNO. Struttura/quantità della distinta reale restano identiche;
 * i codici profilo-specifici sono rimappati sugli equivalenti legno 2026.
 *
 * Dal 2026-07-29 la geometria non è più quattro numeri liberi ma un
 * discriminatore: `A12_I13_B20` **è** aria 12 / interasse 13 / battuta 20, cioè
 * esattamente la geometria della distinta reale del 16/11/2021.
 */
const base = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
} as const satisfies ArtechKitInput;

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
  ["A50805.05.SX", 1], // supporto-cerniera SX — «Aria 12 - Interasse 9/13, battuta 20» p0451 (449)
  ["A51301.02.21", 1], // coperture-kit ARGENTO SX
  ["A51400.05.03", 1], // incontro-dss aria 12
  ["A51400.05.02", 5], // incontri-nottolino aria 12
  ["A51400.05.70", 1], // incontro-ribalta (non più DX/SX)
  ["A51912.36.02", 1], // forbice-braccio SX — interasse 13 battuta 20 gruppo 2
];

describe("artechAntaRibaltaLegno — default (chiusure supplementari OFF)", () => {
  it("genera solo il set obbligatorio: 12 righe / 17 pezzi", () => {
    const lines = artechAntaRibaltaLegno.generate(base); // base NON ha il flag
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN_MANDATORY.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN_MANDATORY) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(12);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(17);
  });

  it("ogni riga ha position, ruleId e ruleDescription valorizzati", () => {
    for (const line of artechAntaRibaltaLegno.generate(base)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it.each([1000, 2200])(
    "altezza %d (fuori banda chiusure): default OFF genera senza errore",
    (heightMm) => {
      expect(() => artechAntaRibaltaLegno.generate({ ...base, heightMm })).not.toThrow();
    },
  );
});

describe("artechAntaRibaltaLegno — toggle chiusure supplementari ON", () => {
  it("aggiunge le 4 righe supplementari: 16 righe / 21 pezzi (distinta storica)", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, supplementaryClosures: true });
    const codes = lines.map((l) => l.code);
    for (const c of ["A50330.00.00", "A50401.00.03", "A51801.00.01", "A51803.00.03"])
      expect(codes).toContain(c);
    expect(lines).toHaveLength(16);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(21);
  });

  it("toggle ON + altezza fuori banda 1520-2120 → KitGenerationError artech.verticali", () => {
    try {
      artechAntaRibaltaLegno.generate({ ...base, heightMm: 2200, supplementaryClosures: true });
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
      expect(() => artechAntaRibaltaLegno.generate({ ...base, material })).toThrow(
        KitGenerationError,
      );
    },
  );
});

describe("selezioni dipendenti dall'input", () => {
  it("mano DESTRA → squadra/supporto-cerniera/braccio/coperture in variante DX, stessa struttura", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, openingSide: "DESTRA" });
    const codes = lines.map((l) => l.code);
    expect(codes).not.toContain("A50904.36.02");
    expect(codes).not.toContain("A50805.05.SX");
    expect(codes).not.toContain("A51301.02.21");
    expect(codes).not.toContain("A51912.36.02");
    expect(codes).toContain("A50904.36.01");
    expect(codes).toContain("A50805.05.DX");
    expect(codes).toContain("A51301.01.21");
    expect(codes).toContain("A51911.36.02");
    expect(lines).toHaveLength(12);
  });

  it("altezza fuori dal range cremonese più alto (2510) → KitGenerationError esplicito", () => {
    expect(() => artechAntaRibaltaLegno.generate({ ...base, heightMm: 3000 })).toThrow(
      KitGenerationError,
    );
  });

  it("larghezza sopra l'ultimo scaglione forbice (1204) → errore tipato, mai kit silenzioso", () => {
    // Adattato ai dati reali: il primo scaglione forbice parte da 277mm, sotto
    // il minimo di kitInputSchema (300) — lo scenario "troppo stretto" non è
    // raggiungibile da input validati. Si verifica invece il bordo superiore.
    expect(() => artechAntaRibaltaLegno.generate({ ...base, widthMm: 1205 })).toThrow(
      KitGenerationError,
    );
  });

  it("bordi del range forbice golden: 476 e 604 inclusi, 605 nello scaglione successivo", () => {
    const at = (w: number) =>
      artechAntaRibaltaLegno
        .generate({ ...base, widthMm: w })
        .find((l) => l.position === "forbice-corpo")!.code;
    expect(at(476)).toBe("A50510.00.02");
    expect(at(604)).toBe("A50510.00.02");
    expect(at(605)).toBe("A50510.00.03"); // scaglione successivo (476-604 e 594-804 si sovrappongono)
  });

  it("incontri nottolino: quantità cresce con l'altezza a scatti del passo 600", () => {
    const qtyAt = (h: number) =>
      artechAntaRibaltaLegno
        .generate({ ...base, heightMm: h })
        .find((l) => l.code === "A51400.05.02")!.quantity;
    expect(qtyAt(1820)).toBe(5); // golden: 2+floor(1820/600)+floor(550/600) = 2+3+0
    expect(qtyAt(1799)).toBe(4); // appena sotto la soglia di scatto floor(H/600)=3→2
    // 2400 è fuori dall'unica banda CHIUSURE_VERTICALI (1520-2120): col
    // vecchio codice (chiusure sempre generate) sarebbe fallita qui; col
    // default OFF (Task 1) è raggiungibile senza errore.
    expect(qtyAt(2400)).toBe(6); // 2+floor(2400/600)+floor(550/600) = 2+4+0
  });
});

describe("artechAntaRibaltaLegno — banda cremonese GR02", () => {
  it("copre le altezze da 620 mm (hbb 610), come il listino p0424 (422)", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, heightMm: 620 });
    expect(lines.find((l) => l.position === "cremonese")?.code).toBe("A50122.15.02");
  });

  it("rifiuta sotto la banda del listino (hbb < 610)", () => {
    // Ancorato al messaggio e al ruleId: con il solo `toThrow(KitGenerationError)`
    // il test restava verde per QUALUNQUE altro rifiuto del modulo (materiale,
    // geometria, finitura…), cioè non provava che a mancare fosse la cremonese.
    try {
      artechAntaRibaltaLegno.generate({ ...base, heightMm: 615 });
      expect.unreachable("attesa cremonese fuori campo");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
      expect((err as Error).message).toMatch(/Nessuna variante cremonese per altezza 605 mm/);
    }
  });
});

/**
 * Prima del 2026-07-29 qui viveva la prova che il modulo chiamasse
 * `assertPilotGeometry`: la geometria era quattro numeri liberi e tutto ciò che
 * non fosse il pilota andava rifiutato. Ora le geometrie coperte sono sette e la
 * prova cambia natura — non «rifiuta ciò che non conosce», ma «serve a ciascuna
 * i SUOI codici». Le tre righe sotto sono le configurazioni che i clienti reali
 * ordinano davvero (MC, Peruzzi, Fosca), tutte rifiutate dal vecchio motore.
 */
describe("le tre geometrie dei clienti reali", () => {
  /**
   * Le colonne coprono TUTTE E SETTE le righe geometria-dipendenti del modulo:
   * `squadra-angolare`, `supporto-cerniera`, `supporto-forbice` e `forbice-braccio`
   * (codici e `braccioMid` da `artech-geometrie.ts`) più `incontro-dss`,
   * `incontro-ribalta` e `incontri-nottolino` (da `artech-incontri.ts`, via
   * `chiave()`: MC e Peruzzi hanno aria 4 asse 9 → mano SINISTRA della famiglia
   * A48012/A514SX; Fosca ha aria 12 sede 24 → 13x24, ambidestro). Le altre righe
   * (cremonese, corpo forbice, coperture, fissi) non dipendono dalla geometria.
   *
   * PERCHÉ SETTE E NON CINQUE. Fino al 2026-07-30 mancavano `supporto-cerniera` e
   * `forbice-braccio`, e nessun altro test le copriva per queste tre geometrie:
   * cablare il supporto cerniera di MC sul valore del pilota (`A50805.05.SX`) o il
   * suo `braccioMid` su `"24"` invece di `"22"` passava l'intera suite **e il gate
   * su catalogo reale** — i cinque supporti cerniera sono tutti a listino a 4,44 €
   * e tutte e 40 le combinazioni di braccio esistono, quindi «codice a listino con
   * prezzo» non distingue il pezzo giusto dal vicino sbagliato. Solo un atteso
   * per-geometria lo fa.
   */
  it.each([
    // nome · geometry · squadra · supporto cerniera · supporto forbice · braccio ·
    // DSS · ribalta · nottolino
    [
      "MC",
      "A4_I85_B15",
      "A50902.22.02",
      "A50803.01.02",
      "A50703.01.00",
      "A51912.22.02",
      "A48012.01.03",
      "A514SX.01.64",
      "A514SX.01.02",
    ],
    [
      "Peruzzi",
      "A4_I9_B18",
      "A50904.24.02",
      "A50801.01.02",
      "A50701.01.00",
      "A51912.24.02",
      "A48012.01.03",
      "A514SX.01.64",
      "A514SX.01.02",
    ],
    [
      "Fosca",
      "A12_I13_B18",
      "A50904.34.02",
      "A50804.05.SX",
      "A50701.05.00",
      "A51912.34.02",
      "A48010.CR.03",
      "A51400.CR.70",
      "A51400.CR.13",
    ],
  ] as const)(
    "%s genera la distinta completa coi SUOI codici: 12 righe / 17 pezzi",
    (
      _nome,
      geometry,
      squadra,
      supportoCerniera,
      supportoForbice,
      braccio,
      dss,
      ribalta,
      nottolino,
    ) => {
      const lines = artechAntaRibaltaLegno.generate({ ...base, geometry });
      const codeAt = (position: string) => lines.find((l) => l.position === position)?.code;
      expect(codeAt("squadra-angolare"), "squadra-angolare").toBe(squadra);
      expect(codeAt("supporto-cerniera"), "supporto-cerniera").toBe(supportoCerniera);
      expect(codeAt("supporto-forbice"), "supporto-forbice").toBe(supportoForbice);
      expect(codeAt("forbice-braccio"), "forbice-braccio").toBe(braccio);
      expect(codeAt("incontro-dss"), "incontro-dss").toBe(dss);
      expect(codeAt("incontro-ribalta"), "incontro-ribalta").toBe(ribalta);
      expect(codeAt("incontri-nottolino"), "incontri-nottolino").toBe(nottolino);
      expect(lines).toHaveLength(12);
      expect(lines.reduce((n, l) => n + l.quantity, 0)).toBe(17);
    },
  );

  it("il golden del pilota non si muove: 12 righe / 17 pezzi senza chiusure", () => {
    const lines = artechAntaRibaltaLegno.generate(base);
    expect(lines).toHaveLength(12);
    expect(lines.reduce((n, l) => n + l.quantity, 0)).toBe(17);
  });

  it("il golden storico con chiusure ON: 16 righe / 21 pezzi", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, supplementaryClosures: true });
    expect(lines).toHaveLength(16);
    expect(lines.reduce((n, l) => n + l.quantity, 0)).toBe(21);
  });

  it("SEDE_30 viene rifiutata finché manca l'incontro DSS 13x30", () => {
    // Ancorato anche al ruleId, per la ragione già scritta sopra sulla cremonese:
    // col solo messaggio il test resterebbe verde per qualunque altro rifiuto che
    // per caso nominasse la sede 30.
    try {
      artechAntaRibaltaLegno.generate({ ...base, seatConfig: "SEDE_30" });
      expect.unreachable("atteso rifiuto della configurazione sede 30");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.sede");
      expect((err as Error).message).toMatch(/sede 30/i);
    }
  });
});

describe("artechAntaRibaltaLegno — entrata maniglia", () => {
  // Le nove bande HBB, i GR e l'altezza maniglia di A50122.08.* e A50122.15.*
  // coincidono riga per riga a p0424 (422): cambia il codice, non la selezione.
  // ATTENZIONE ai valori scelti: le bande si SOVRAPPONGONO e `pick()` risolve
  // prendendo la più stretta, a parità di ampiezza la PRIMA della tabella. Con
  // hbb 2100 le bande [1794,2110] e [1994,2310] hanno la stessa ampiezza (316) e
  // vincerebbe la .08, non la .09. Ogni valore qui sotto cade quindi in **una
  // sola** banda.
  const BANDE: [hbb: number, e15: string, e75: string][] = [
    [700, "A50122.15.02", "A50122.08.02"],
    [900, "A50122.15.03", "A50122.08.03"],
    [1100, "A50122.15.04", "A50122.08.04"],
    [1300, "A50122.15.05", "A50122.08.05"],
    [1500, "A50122.15.06", "A50122.08.06"],
    [1700, "A50122.15.07", "A50122.08.07"],
    [1900, "A50122.15.08", "A50122.08.08"],
    [2150, "A50122.15.09", "A50122.08.09"],
    [2400, "A50122.15.10", "A50122.08.10"],
  ];

  it.each(BANDE)("hbb %i → %s con entrata 15, %s con entrata 7,5", (hbb, e15, e75) => {
    // `base` usa hbb = heightMm - 10 (ASSUNZIONE dichiarata, domanda 10).
    const perEntrata = (entrata: "E15" | "E75") =>
      artechAntaRibaltaLegno
        .generate({ ...base, heightMm: hbb + 10, entrata })
        .find((l) => l.position === "cremonese")!.code;

    expect(perEntrata("E15")).toBe(e15);
    expect(perEntrata("E75")).toBe(e75);
  });

  it("l'entrata cambia SOLO la riga della cremonese", () => {
    const senzaCremonese = (entrata: "E15" | "E75") =>
      artechAntaRibaltaLegno
        .generate({ ...base, entrata })
        .filter((l) => l.position !== "cremonese")
        .map((l) => `${l.position}|${l.code}|${l.quantity}`);

    expect(senzaCremonese("E75")).toEqual(senzaCremonese("E15"));
  });

  it("la ruleDescription dichiara l'entrata, così la distinta stampata la riporta", () => {
    const riga = artechAntaRibaltaLegno
      .generate({ ...base, entrata: "E75" })
      .find((l) => l.position === "cremonese")!;
    expect(riga.ruleDescription).toContain("entrata 7,5");
  });
});
