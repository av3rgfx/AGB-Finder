import { describe, it, expect } from "vitest";
import { kitInputFromRequest, type PersistedKitRequest } from "./from-request";
import { KitGenerationError } from "./types";

const artechRow: PersistedKitRequest = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "LEGNO",
  finish: "ARGENTO",
  series: "ARTECH",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  supplementaryClosures: true,
  sashWeightKg: null,
  tourSchema: null,
  notes: null,
};

const tourRow: PersistedKitRequest = {
  windowType: "BILICO",
  widthMm: 700,
  heightMm: 900,
  material: "LEGNO",
  finish: "MARRONE RAL 8019",
  series: "TOUR",
  airGapMm: null,
  axisOffsetMm: null,
  rebateMm: null,
  seatMm: null,
  openingSide: null,
  openingDir: null,
  supplementaryClosures: false,
  sashWeightKg: null,
  tourSchema: 2,
  notes: null,
};

describe("kitInputFromRequest", () => {
  it("ricostruisce una richiesta ARTECH con tutta la sua geometria", () => {
    expect(kitInputFromRequest(artechRow)).toEqual({
      windowType: "ANTA_RIBALTA",
      widthMm: 550,
      heightMm: 1820,
      material: "LEGNO",
      finish: "ARGENTO",
      series: "ARTECH",
      airGapMm: 12,
      axisOffsetMm: 13,
      rebateMm: 20,
      seatMm: 18,
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      supplementaryClosures: true,
    });
  });

  it("ricostruisce una richiesta TOUR con il solo schema", () => {
    const input = kitInputFromRequest(tourRow);
    expect(input).toMatchObject({ series: "TOUR", windowType: "BILICO", tourSchema: 2 });
    expect(input).not.toHaveProperty("airGapMm");
    expect(input).not.toHaveProperty("openingSide");
  });

  it("propaga notes e sashWeightKg solo quando valorizzati", () => {
    expect(kitInputFromRequest({ ...tourRow, sashWeightKg: 180, notes: "urgente" })).toMatchObject({
      sashWeightKg: 180,
      notes: "urgente",
    });
  });

  /**
   * Una riga incoerente non deve MAI diventare una distinta: è il caso di una
   * richiesta creata prima di un cambio di schema, o modificata a mano a DB.
   * Meglio un rifiuto esplicito che una distinta plausibile e sbagliata.
   */
  it("rifiuta una riga TOUR senza schema invece di generare a vuoto", () => {
    expect(() => kitInputFromRequest({ ...tourRow, tourSchema: null })).toThrow(KitGenerationError);
    expect(() => kitInputFromRequest({ ...tourRow, tourSchema: null })).toThrow(/incoerente/i);
  });

  it("rifiuta una riga ARTECH cui manca la geometria", () => {
    expect(() => kitInputFromRequest({ ...artechRow, airGapMm: null })).toThrow(KitGenerationError);
  });

  it("rifiuta una serie sconosciuta", () => {
    expect(() => kitInputFromRequest({ ...artechRow, series: "PLANA" })).toThrow(
      KitGenerationError,
    );
  });
});
