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
  geometry: "A12_I13_B20",
  entrata: "E15",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  supplementaryClosures: true,
  sashWeightKg: null,
  tourSchema: null,
  notes: null,
  variants: null,
};

const tourRow: PersistedKitRequest = {
  windowType: "BILICO",
  widthMm: 700,
  heightMm: 900,
  material: "LEGNO",
  finish: "MARRONE RAL 8019",
  series: "TOUR",
  geometry: null,
  entrata: null,
  seatConfig: null,
  openingSide: null,
  openingDir: null,
  supplementaryClosures: false,
  sashWeightKg: null,
  tourSchema: 2,
  notes: null,
  variants: null,
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
      geometry: "A12_I13_B20",
      entrata: "E15",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      supplementaryClosures: true,
    });
  });

  /**
   * Le due colonne con default a schema possono essere NULL su una riga scritta
   * prima della migrazione: il default si applica qui, non si fa fallire il
   * parse. `geometry` invece NON ha default e resta l'unico dato indispensabile.
   */
  it("applica il default a seatConfig e openingDir nulli, senza inventare la geometria", () => {
    expect(
      kitInputFromRequest({ ...artechRow, seatConfig: null, openingDir: null }),
    ).toMatchObject({ seatConfig: "STANDARD", openingDir: "TIRARE" });
  });

  it("ricostruisce una richiesta TOUR con il solo schema", () => {
    const input = kitInputFromRequest(tourRow);
    expect(input).toMatchObject({ series: "TOUR", windowType: "BILICO", tourSchema: 2 });
    expect(input).not.toHaveProperty("geometry");
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
    expect(() => kitInputFromRequest({ ...artechRow, geometry: null })).toThrow(KitGenerationError);
  });

  it("rifiuta una geometria che non è fra le 7 del listino", () => {
    expect(() => kitInputFromRequest({ ...artechRow, geometry: "A9_I11_B17" })).toThrow(
      KitGenerationError,
    );
  });

  it("rifiuta una serie sconosciuta", () => {
    expect(() => kitInputFromRequest({ ...artechRow, series: "PLANA" })).toThrow(
      KitGenerationError,
    );
  });

  it("rilegge l'entrata dalla riga e la consegna al motore", () => {
    const input = kitInputFromRequest({ ...artechRow, entrata: "E75" });
    expect(input.series).toBe("ARTECH");
    if (input.series === "ARTECH") expect(input.entrata).toBe("E75");
  });

  it("rifiuta una riga ARTECH senza entrata invece di assumerne una", () => {
    expect(() => kitInputFromRequest({ ...artechRow, entrata: null })).toThrow(/entrata/i);
  });

  it("non pretende l'entrata sulle righe TOUR", () => {
    const input = kitInputFromRequest({ ...tourRow, entrata: null });
    expect(input.series).toBe("TOUR");
  });

  it("rilegge le varianti dalla riga", () => {
    const input = kitInputFromRequest({ ...artechRow, variants: { squadraAngolare: "BASE" } });
    expect(input.series === "ARTECH" && input.variants?.squadraAngolare).toBe("BASE");
  });

  it("una riga senza varianti resta senza: nessun default materializzato", () => {
    const input = kitInputFromRequest({ ...artechRow, variants: null });
    expect(input.series === "ARTECH" && input.variants).toBeUndefined();
  });

  it("RIFIUTA una riga con varianti corrotte invece di ignorarle", () => {
    expect(() =>
      kitInputFromRequest({ ...artechRow, variants: { squadraAngolare: "INESISTENTE" } }),
    ).toThrow(/incoerente/);
  });
});
