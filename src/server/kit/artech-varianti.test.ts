import { describe, it, expect } from "vitest";
import {
  opzioniSquadraAngolare,
  squadraAngolare,
  squadraAngolareEtichettaSeNonStandard,
  SQUADRA_ANGOLARE,
  opzioniIncontroRibalta,
  incontroRibaltaVariante,
  incontroRibaltaEtichettaSeNonStandard,
  opzioniIncontroNottolino,
  incontroNottolinoVariante,
  incontroNottolinoEtichettaSeNonStandard,
  movimentoAngolareCodice,
  movimentoAngolareEtichettaSeNonStandard,
  piastrinoCodice,
  avvisiVarianti,
  scelteNonStandard,
  COMPONENTE_LABEL,
  eAntieffrazione,
  INCONTRO_NOTTOLINO_ANTIEFFRAZIONE,
} from "./artech-varianti";
import { GEOMETRIE, type ArtechGeometryId } from "./artech-geometrie";
import { KitGenerationError } from "./types";
import {
  incontroRibalta as incontroRibaltaStandard,
  incontroNottolino as incontroNottolinoStandard,
} from "./artech-incontri";

describe("squadra angolare", () => {
  it("il default riproduce ESATTAMENTE il codice che il motore emette oggi", () => {
    for (const [id, geo] of Object.entries(GEOMETRIE)) {
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        expect(squadraAngolare(id as ArtechGeometryId, mano, undefined)).toBe(
          geo.squadraAngolare[mano],
        );
      }
    }
  });

  it("l'interasse 8,5 ha DUE opzioni, le altre geometrie quattro", () => {
    expect(opzioniSquadraAngolare("A4_I85_B15").map((o) => o.id)).toEqual(["BASE", "TRAVERSO_ALU"]);
    expect(opzioniSquadraAngolare("A12_I13_B20")).toHaveLength(4);
  });

  it("A50901.22 e A50904.22 non compaiono in nessuna tabella (non esistono a listino)", () => {
    const tutti = Object.values(SQUADRA_ANGOLARE).flatMap((perGeo) =>
      Object.values(perGeo).flatMap((perMano) => Object.values(perMano)),
    );
    expect(tutti.filter((c) => c.startsWith("A50901.22") || c.startsWith("A50904.22"))).toEqual([]);
  });

  it("ogni opzione disponibile produce un codice, e sono tutti diversi fra loro", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[]) {
      const codici = opzioniSquadraAngolare(geometry).map((o) =>
        squadraAngolare(geometry, "DESTRA", o.id),
      );
      expect(new Set(codici).size).toBe(codici.length);
    }
  });

  it.each(["COMPENSATORE", "TRAVERSO_ALU_COMPENSATORE"] as const)(
    "%s su A4_I85_B15 (interasse 8,5) solleva KitGenerationError, non un TypeError su undefined",
    (scelta) => {
      expect(() => squadraAngolare("A4_I85_B15", "DESTRA", scelta)).toThrow(KitGenerationError);

      try {
        squadraAngolare("A4_I85_B15", "DESTRA", scelta);
        expect.unreachable("doveva sollevare KitGenerationError");
      } catch (err) {
        expect(err).toBeInstanceOf(KitGenerationError);
        expect((err as KitGenerationError).message).toContain("A4_I85_B15");
        expect((err as KitGenerationError).ruleId).toBe("artech.varianti");
      }
    },
  );
});

describe("incontro ribalta", () => {
  it("il default riproduce il codice standard di oggi, su tutte le geometrie e mani", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[])
      for (const mano of ["DESTRA", "SINISTRA"] as const)
        expect(incontroRibaltaVariante(geometry, mano, undefined)).toBe(
          incontroRibaltaStandard(geometry, mano),
        );
  });

  it("aria 4 asse 9 non offre alcuna scelta: a listino c'è solo l'acciaio", () => {
    expect(opzioniIncontroRibalta("A4_I9_B18")).toEqual([]);
  });

  it("aria 4 asse 13 offre due opzioni, e non le viti dritte (l'aria 4 non le pubblica)", () => {
    expect(opzioniIncontroRibalta("A4_I13_B18").map((o) => o.id)).toEqual([
      "ZAMA",
      "ACCIAIO_INCLINATE",
    ]);
  });

  it("aria 12 offre tre opzioni", () => {
    expect(opzioniIncontroRibalta("A12_I13_B20").map((o) => o.id)).toEqual([
      "ZAMA",
      "ACCIAIO_INCLINATE",
      "ACCIAIO_DRITTE",
    ]);
  });

  it.each(["A4_I85_B15", "A4_I9_B18", "A4_I13_B18"] as const)(
    "ACCIAIO_DRITTE su %s (aria 4) solleva KitGenerationError, non un TypeError su undefined",
    (geometry) => {
      // ACCIAIO_DRITTE in INCONTRO_RIBALTA ha voci solo per A12_9x18/A12_13x24
      // (vedi commento «A4_* ASSENTI» sopra la tabella): tutte e tre le
      // geometrie aria 4 (asse 9 → A4_ASSE9, asse 13 → A4_ASSE13) non hanno
      // riscontro.
      expect(() => incontroRibaltaVariante(geometry, "DESTRA", "ACCIAIO_DRITTE")).toThrow(
        KitGenerationError,
      );

      try {
        incontroRibaltaVariante(geometry, "DESTRA", "ACCIAIO_DRITTE");
        expect.unreachable("doveva sollevare KitGenerationError");
      } catch (err) {
        expect(err).toBeInstanceOf(KitGenerationError);
        expect((err as KitGenerationError).ruleId).toBe("artech.varianti");
      }
    },
  );
});

describe("antieffrazione", () => {
  it("il movimento angolare di default è quello di oggi", () => {
    expect(movimentoAngolareCodice(undefined)).toBe("A50302.01.02");
    expect(movimentoAngolareCodice("DUE_NOTTOLINI")).toBe("A50302.02.02");
  });

  it("l'incontro nottolino di default è quello standard di oggi", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[])
      for (const mano of ["DESTRA", "SINISTRA"] as const)
        expect(incontroNottolinoVariante(geometry, mano, undefined)).toBe(
          incontroNottolinoStandard(geometry, mano),
        );
  });

  it("in aria 4 le viti dritte non sono offerte", () => {
    expect(opzioniIncontroNottolino("A4_I9_B18").map((o) => o.id)).toEqual([
      "NORMALE",
      "ANTIEFFRAZIONE_INCLINATE",
    ]);
  });

  /**
   * La categoria «antieffrazione» è DICHIARATA dal registro, non dedotta dalla
   * forma del nome. Erano tre `startsWith("ANTIEFFRAZIONE")` (avviso della NB,
   * stato dell'interruttore, codice che l'interruttore imposta): rinominare una
   * voce dell'enum li avrebbe lasciati compilare, restituendo `false` in
   * silenzio. Ora la sorgente è `INCONTRO_NOTTOLINO_ANTIEFFRAZIONE`, che con
   * `satisfies` non compila se una voce viene rinominata.
   */
  it("la categoria antieffrazione è quella dichiarata dal registro", () => {
    expect(eAntieffrazione("ANTIEFFRAZIONE_INCLINATE")).toBe(true);
    expect(eAntieffrazione("ANTIEFFRAZIONE_DRITTE")).toBe(true);
    expect(eAntieffrazione("NORMALE")).toBe(false);
    // `undefined` = lo standard del programma, cioè NORMALE.
    expect(eAntieffrazione(undefined)).toBe(false);
  });

  it("l'elenco è esattamente ciò che il registro offre oltre alla voce normale", () => {
    // `A12_I13_B20` è l'unica chiave incontri che pubblica tutte e tre le voci.
    const offerte = opzioniIncontroNottolino("A12_I13_B20").map((o) => o.id);
    expect(offerte.filter((id) => eAntieffrazione(id))).toEqual([
      ...INCONTRO_NOTTOLINO_ANTIEFFRAZIONE,
    ]);
    expect(offerte.filter((id) => !eAntieffrazione(id))).toEqual(["NORMALE"]);
  });

  it("il piastrino dipende dall'entrata", () => {
    expect(piastrinoCodice("E75")).toBe("A50194.00.01");
    expect(piastrinoCodice("E15")).toBe("A20050.00.02");
  });

  it.each(["A4_I85_B15", "A4_I9_B18", "A4_I13_B18"] as const)(
    "ANTIEFFRAZIONE_DRITTE su %s (aria 4) solleva KitGenerationError, non un TypeError su undefined",
    (geometry) => {
      // ANTIEFFRAZIONE_DRITTE in INCONTRO_NOTTOLINO ha voci solo per
      // A12_9x18/A12_13x24 (vedi commento «A4_* ASSENTI» sopra la tabella):
      // tutte e tre le geometrie aria 4 (asse 9 → A4_ASSE9, asse 13 →
      // A4_ASSE13) non hanno riscontro.
      expect(() => incontroNottolinoVariante(geometry, "DESTRA", "ANTIEFFRAZIONE_DRITTE")).toThrow(
        KitGenerationError,
      );

      try {
        incontroNottolinoVariante(geometry, "DESTRA", "ANTIEFFRAZIONE_DRITTE");
        expect.unreachable("doveva sollevare KitGenerationError");
      } catch (err) {
        expect(err).toBeInstanceOf(KitGenerationError);
        expect((err as KitGenerationError).ruleId).toBe("artech.varianti");
      }
    },
  );
});

/**
 * Rilievo 2 (review Task 5): le `*EtichettaSeNonStandard` — undefined quando
 * la scelta (esplicita o assente) coincide con lo standard del contesto,
 * l'etichetta italiana altrimenti. Testate qui a livello di registro, dove
 * vivono i default; il modulo le usa senza saperne l'implementazione.
 */
describe("etichetta se non standard (Rilievo 2)", () => {
  it("squadra angolare: assente o standard esplicito → undefined", () => {
    expect(squadraAngolareEtichettaSeNonStandard("A12_I13_B20", undefined)).toBeUndefined();
    expect(
      squadraAngolareEtichettaSeNonStandard("A12_I13_B20", "TRAVERSO_ALU_COMPENSATORE"),
    ).toBeUndefined();
    // A4_I85_B15 ha uno standard diverso (BASE): stessa scelta, esiti opposti.
    expect(squadraAngolareEtichettaSeNonStandard("A4_I85_B15", "BASE")).toBeUndefined();
  });

  it("squadra angolare: scelta diversa dallo standard → l'etichetta italiana", () => {
    expect(squadraAngolareEtichettaSeNonStandard("A12_I13_B20", "BASE")).toBe("Base");
    expect(squadraAngolareEtichettaSeNonStandard("A4_I85_B15", "TRAVERSO_ALU")).toBe(
      "Per traverso in alluminio",
    );
  });

  it("incontro ribalta: assente o standard esplicito (ZAMA per aria 12) → undefined", () => {
    expect(incontroRibaltaEtichettaSeNonStandard("A12_I13_B20", undefined)).toBeUndefined();
    expect(incontroRibaltaEtichettaSeNonStandard("A12_I13_B20", "ZAMA")).toBeUndefined();
    // Aria 4 asse 9: lo standard è ACCIAIO_INCLINATE, non ZAMA.
    expect(incontroRibaltaEtichettaSeNonStandard("A4_I9_B18", "ACCIAIO_INCLINATE")).toBeUndefined();
  });

  it("incontro ribalta: scelta diversa dallo standard → l'etichetta italiana", () => {
    expect(incontroRibaltaEtichettaSeNonStandard("A12_I13_B20", "ACCIAIO_INCLINATE")).toBe(
      "Acciaio, viti inclinate",
    );
  });

  it("incontro nottolino: assente o NORMALE esplicito → undefined", () => {
    expect(incontroNottolinoEtichettaSeNonStandard(undefined)).toBeUndefined();
    expect(incontroNottolinoEtichettaSeNonStandard("NORMALE")).toBeUndefined();
  });

  it("incontro nottolino: scelta diversa dal NORMALE → l'etichetta italiana", () => {
    expect(incontroNottolinoEtichettaSeNonStandard("ANTIEFFRAZIONE_DRITTE")).toBe(
      "Antieffrazione, viti dritte",
    );
  });

  it("movimento angolare: assente o UN_NOTTOLINO esplicito → undefined", () => {
    expect(movimentoAngolareEtichettaSeNonStandard(undefined)).toBeUndefined();
    expect(movimentoAngolareEtichettaSeNonStandard("UN_NOTTOLINO")).toBeUndefined();
  });

  it("movimento angolare: DUE_NOTTOLINI → l'etichetta italiana", () => {
    expect(movimentoAngolareEtichettaSeNonStandard("DUE_NOTTOLINI")).toBe(
      "Due nottolini (antieffrazione)",
    );
  });
});

/**
 * `scelteNonStandard` è ciò che il riepilogo del wizard e la scheda della
 * richiesta mostrano all'agente. Deve dire ESATTAMENTE quello che dicono le
 * righe di distinta — riusa infatti le stesse `*EtichettaSeNonStandard` — e
 * mai la parola «antieffrazione» da sola (spec §9).
 */
describe("scelte non standard (per il riepilogo)", () => {
  it("senza varianti, o con la sola scelta standard esplicita, non elenca nulla", () => {
    expect(scelteNonStandard("A12_I13_B20", undefined)).toEqual([]);
    expect(
      scelteNonStandard("A12_I13_B20", {
        squadraAngolare: "TRAVERSO_ALU_COMPENSATORE",
        incontroRibalta: "ZAMA",
        movimentoAngolare: "UN_NOTTOLINO",
        incontroNottolino: "NORMALE",
      }),
    ).toEqual([]);
  });

  it("elenca ogni scelta diversa dallo standard, per esteso", () => {
    expect(
      scelteNonStandard("A12_I13_B20", {
        squadraAngolare: "BASE",
        movimentoAngolare: "DUE_NOTTOLINI",
        incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
        piastrinoAntieffrazione: true,
      }),
    ).toEqual([
      { componente: "Squadra angolare", scelta: "Base" },
      { componente: "Movimento angolare", scelta: "Due nottolini (antieffrazione)" },
      { componente: "Incontri nottolino", scelta: "Antieffrazione, viti inclinate" },
      { componente: "Piastrino antieffrazione", scelta: "Sì — riga aggiunta alla distinta" },
    ]);
  });

  it("lo standard dipende dalla geometria: la stessa scelta si elenca su una e non sull'altra", () => {
    const v = { squadraAngolare: "BASE" } as const;
    expect(scelteNonStandard("A4_I85_B15", v)).toEqual([]); // lì BASE È lo standard
    expect(scelteNonStandard("A12_I13_B20", v)).toHaveLength(1);
  });

  it("il piastrino a false non è una scelta da elencare", () => {
    expect(scelteNonStandard("A12_I13_B20", { piastrinoAntieffrazione: false })).toEqual([]);
  });

  it("i nomi dei componenti sono quelli delle righe di distinta", () => {
    expect(COMPONENTE_LABEL.squadraAngolare).toBe("Squadra angolare");
    expect(COMPONENTE_LABEL.incontroRibalta).toBe("Incontro ribalta");
    expect(COMPONENTE_LABEL.movimentoAngolare).toBe("Movimento angolare");
  });
});

describe("avvisi", () => {
  it("segnala l'incontro antieffrazione senza il movimento angolare a due nottolini", () => {
    const a = avvisiVarianti({ incontroNottolino: "ANTIEFFRAZIONE_INCLINATE" });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/A50302\.02\.02/);
  });

  it("non segnala nulla quando la combinazione è coerente", () => {
    expect(
      avvisiVarianti({
        incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
        movimentoAngolare: "DUE_NOTTOLINI",
      }),
    ).toEqual([]);
  });

  it("non segnala nulla senza varianti", () => {
    expect(avvisiVarianti(undefined)).toEqual([]);
  });
});
