import { describe, it, expect } from "vitest";
import { opzioniSquadraAngolare, squadraAngolare, SQUADRA_ANGOLARE } from "./artech-varianti";
import { GEOMETRIE, type ArtechGeometryId } from "./artech-geometrie";
import { KitGenerationError } from "./types";

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
