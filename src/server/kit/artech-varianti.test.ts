import { describe, it, expect } from "vitest";
import {
  opzioniSquadraAngolare,
  squadraAngolare,
  SQUADRA_ANGOLARE,
  opzioniIncontroRibalta,
  incontroRibaltaVariante,
  opzioniIncontroNottolino,
  incontroNottolinoVariante,
  movimentoAngolareCodice,
  piastrinoCodice,
  avvisiVarianti,
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
    expect(opzioniSquadraAngolare("A4_I85_B15").map((o) => o.id)).toEqual([
      "BASE",
      "TRAVERSO_ALU",
    ]);
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
      expect(() =>
        incontroNottolinoVariante(geometry, "DESTRA", "ANTIEFFRAZIONE_DRITTE"),
      ).toThrow(KitGenerationError);

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
