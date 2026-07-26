import { describe, it, expect } from "vitest";
import { tourBilicoLegno, SCHEMI_TOUR } from "./rules-tour-bilico-legno";
import { KitGenerationError, type KitInput } from "./types";

/** 3 lati: 700 × 900 = 0,63 m² ≤ 2 m². Schema 2 (Tour 30, listello 30, battuta 18). */
const golden3: KitInput = {
  windowType: "BILICO",
  series: "TOUR",
  material: "LEGNO",
  widthMm: 700,
  heightMm: 900,
  finish: "MARRONE RAL 8019",
  tourSchema: 2,
};

/** 4 lati: 1500 × 1600 = 2,40 m² > 2 m². Schema 5 (Tour 40, 300 kg). */
const golden4: KitInput = {
  windowType: "BILICO",
  series: "TOUR",
  material: "LEGNO",
  widthMm: 1500,
  heightMm: 1600,
  finish: "CROMATO OPACO",
  tourSchema: 5,
};

const codici = (input: KitInput) =>
  tourBilicoLegno.generate(input).map((l) => `${l.code}×${l.quantity}`);

describe("tourBilicoLegno — golden 3 lati (superficie ≤ 2 m²)", () => {
  it("emette i 4 kit + 1 asta per mano + guarnizione", () => {
    expect(codici(golden3)).toEqual([
      "T47501.00.02×1", // A · kit elementi orizzontali, LBB 700 → GR2 (640-800)
      "T46000.02.01×1", // ❸ · asta senza braccetto, solo SX sui 3 lati
      "T46001.02.01×1", // ❹ · asta con braccetto, HBB 900 → GR1 (580-1000), SX
      "T48101.03.00×1", // B · movimenti angolari, HBB 801-1000, 3 lati
      "T17800.30.94×1", // C · kit cerniere Tour 30, marrone RAL 8019
      "T47701.02.00×1", // D · kit incontri schema 2, 3 lati
      "T18001.02.93×12", // guarnizione battuta 11/18, confezione base 12 m
    ]);
  });

  it("non emette il kit spessori fuori dallo schema 3", () => {
    expect(codici(golden3)).not.toContain("T16635.04.01×1");
  });

  it("dichiara la mano derivata invece di lasciarla implicita", () => {
    const asta = tourBilicoLegno.generate(golden3).find((l) => l.position === "asta-verticale-sx");
    expect(asta?.ruleDescription).toMatch(/3 lati/);
    expect(asta?.ruleDescription).toMatch(/sinistra/i);
  });

  it("echeggia la geometria implicata dallo schema, che non è persistita", () => {
    const cerniere = tourBilicoLegno.generate(golden3).find((l) => l.position === "kit-cerniere");
    expect(cerniere?.ruleDescription).toMatch(/listello 30/);
    expect(cerniere?.ruleDescription).toMatch(/asse 15/);
    expect(cerniere?.ruleDescription).toMatch(/battuta 18/);
  });
});

describe("tourBilicoLegno — golden 4 lati (superficie > 2 m²)", () => {
  it("raddoppia le aste verticali e passa ai kit a 4 lati", () => {
    expect(codici(golden4)).toEqual([
      "T47501.00.04×1", // A · LBB 1500 → GR4 (1201-1600)
      "T46000.01.01×1", // ❸ DX
      "T46000.02.01×1", // ❸ SX
      "T46001.01.03×1", // ❹ DX · HBB 1600 → GR3 (1401-1800)
      "T46001.02.03×1", // ❹ SX
      "T48102.04.00×1", // B · HBB ≥ 1001, 4 lati
      "T17800.40.34×1", // C · Tour 40 (schema 5), cromato opaco
      "T47702.05.00×1", // D · kit incontri schema 5, 4 lati
      "T18001.02.93×12",
    ]);
  });
});

describe("tourBilicoLegno — schema 3 (l'unico con spessori)", () => {
  it("aggiunge il kit spessori battuta 15 e la sua guarnizione", () => {
    const righe = codici({ ...golden3, tourSchema: 3 });
    expect(righe).toContain("T16635.04.01×1");
    expect(righe).toContain("T18001.03.93×12");
    expect(righe).toContain("T17800.35.94×1"); // Tour 35
  });

  it("l'asse 17,5 esiste nella tabella ma non è mai un intero persistito", () => {
    expect(SCHEMI_TOUR[3].asseMm).toBe(17.5);
  });
});

describe("tourBilicoLegno — confine dei 3/4 lati", () => {
  it("sotto i 2 m² usa i 3 lati", () => {
    // 1000 × 1999 = 1,999 m²
    expect(codici({ ...golden3, widthMm: 1000, heightMm: 1999 })).toContain("T47701.02.00×1");
  });

  it("a 2 m² ESATTI usa i 4 lati (scelta prudenziale: il listino non copre il caso)", () => {
    // 1000 × 2000 = 2,000 m² esatti. Confronto in mm² interi, mai in float.
    expect(codici({ ...golden3, widthMm: 1000, heightMm: 2000 })).toContain("T47702.02.00×1");
  });

  it("sopra i 2 m² usa i 4 lati", () => {
    expect(codici({ ...golden3, widthMm: 1000, heightMm: 2001 })).toContain("T47702.02.00×1");
  });
});

describe("tourBilicoLegno — bande", () => {
  it("rispetta gli estremi inclusivi del kit elementi orizzontali", () => {
    expect(codici({ ...golden3, widthMm: 530 })).toContain("T47501.00.01×1");
    expect(codici({ ...golden3, widthMm: 2400 })).toContain("T47501.00.06×1");
  });

  it("sulla sovrapposizione LBB 640-650 sceglie lo span più stretto (GR1)", () => {
    // GR1 = 530-650 (span 120), GR2 = 640-800 (span 160) → vince GR1.
    expect(codici({ ...golden3, widthMm: 645 })).toContain("T47501.00.01×1");
  });

  it("cambia gruppo dell'asta con braccetto sulle bande HBB", () => {
    expect(codici({ ...golden3, heightMm: 1001 })).toContain("T46001.02.02×1");
    expect(codici({ ...golden3, heightMm: 1401 })).toContain("T46001.02.03×1");
    expect(codici({ ...golden3, heightMm: 1801 })).toContain("T46001.02.04×1");
  });

  it("l'asta senza braccetto resta il codice unico GR1 su ogni altezza", () => {
    // Assunzione dichiarata (domanda 11): la legenda scrive il suffisso
    // LETTERALE .01, mentre per l'asta con braccetto scrive 0X.
    expect(codici({ ...golden3, heightMm: 2000 })).toContain("T46000.02.01×1");
  });
});

describe("tourBilicoLegno — rifiuti", () => {
  it("rifiuta un materiale diverso dal legno", () => {
    expect(() => tourBilicoLegno.generate({ ...golden3, material: "PVC" })).toThrow(
      /LEGNO/i,
    );
  });

  it("rifiuta una finitura fuori dalle due di listino", () => {
    expect(() => tourBilicoLegno.generate({ ...golden3, finish: "ARGENTO" })).toThrow(
      KitGenerationError,
    );
    expect(() => tourBilicoLegno.generate({ ...golden3, finish: "ARGENTO" })).toThrow(
      /cromato opaco|marrone/i,
    );
  });

  it("rifiuta un'anta oltre la portata delle cerniere dello schema scelto", () => {
    // Schema 2 = Tour 30 = 200 kg.
    expect(() => tourBilicoLegno.generate({ ...golden3, sashWeightKg: 201 })).toThrow(/200 kg/);
    // Lo stesso peso passa sullo schema 5 (Tour 40, 300 kg).
    expect(() =>
      tourBilicoLegno.generate({ ...golden3, tourSchema: 5, sashWeightKg: 201 }),
    ).not.toThrow();
  });

  it("rifiuta HBB sotto il minimo, con il 580 riservato allo schema 1", () => {
    expect(() => tourBilicoLegno.generate({ ...golden3, heightMm: 590 })).toThrow(/600/);
    expect(() =>
      tourBilicoLegno.generate({ ...golden3, tourSchema: 1, heightMm: 590 }),
    ).not.toThrow();
    expect(() => tourBilicoLegno.generate({ ...golden3, tourSchema: 1, heightMm: 579 })).toThrow(
      /580/,
    );
  });

  it("rifiuta larghezze e altezze fuori dalle tabelle", () => {
    expect(() => tourBilicoLegno.generate({ ...golden3, widthMm: 520 })).toThrow(
      KitGenerationError,
    );
    expect(() => tourBilicoLegno.generate({ ...golden3, widthMm: 2401 })).toThrow(
      KitGenerationError,
    );
    expect(() => tourBilicoLegno.generate({ ...golden3, heightMm: 2401 })).toThrow(
      KitGenerationError,
    );
  });

  it("rifiuta un input di un'altra serie", () => {
    const artech = {
      windowType: "ANTA_RIBALTA",
      series: "ARTECH",
      material: "LEGNO",
      widthMm: 550,
      heightMm: 1820,
      finish: "ARGENTO",
      airGapMm: 12,
      axisOffsetMm: 13,
      rebateMm: 20,
      seatMm: 18,
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
    } satisfies KitInput;
    expect(() => tourBilicoLegno.generate(artech)).toThrow(/TOUR/);
  });
});
