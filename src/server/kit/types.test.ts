import { describe, it, expect } from "vitest";
import { kitInputSchema, asArtech, asTour, KitGenerationError } from "./types";

const valid = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "ALLUMINIO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

const validTour = {
  windowType: "BILICO",
  widthMm: 700,
  heightMm: 900,
  material: "LEGNO",
  finish: "MARRONE RAL 8019",
  series: "TOUR",
  tourSchema: 2,
};

describe("kitInputSchema", () => {
  it("accetta l'input della distinta golden", () => {
    expect(kitInputSchema.parse(valid)).toMatchObject({ widthMm: 550, heightMm: 1820 });
  });

  it("rifiuta serie non coperta", () => {
    expect(kitInputSchema.safeParse({ ...valid, series: "PLANA" }).success).toBe(false);
  });

  it("rifiuta dimensioni fuori 300-3000 e parametri fuori range", () => {
    expect(kitInputSchema.safeParse({ ...valid, widthMm: 200 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, airGapMm: 3 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, seatMm: 35 }).success).toBe(false);
  });

  /**
   * La sede 30 è quella di TUTTI gli schemi di montaggio base ARTECH del listino
   * 2026 (22 pagine rimandano agli «schemi sede 30 mm»). Deve essere
   * *scrivibile*: chi ha quel serramento deve arrivare al messaggio del motore,
   * che gli dice quale configurazione è coperta, invece di sbattere contro un
   * errore di range che non spiega niente. Restare generabile è un altro
   * discorso — se ne occupa assertPilotGeometry.
   */
  it("accetta le sedi telaio che il listino pubblica davvero (18, 20, 24, 30)", () => {
    for (const seatMm of [18, 20, 24, 30])
      expect(kitInputSchema.safeParse({ ...valid, seatMm }).success).toBe(true);
  });

  it("sashWeightKg è opzionale e non rompe gli input esistenti", () => {
    expect(kitInputSchema.safeParse(valid).success).toBe(true);
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 75 }).success).toBe(true);
  });

  it("sashWeightKg rifiuta valori fuori scala", () => {
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 0 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, sashWeightKg: 250 }).success).toBe(false);
  });

  it("il ramo ARTECH esige la geometria: senza, rifiuta", () => {
    const { airGapMm: _a, ...senzaAria } = valid;
    expect(kitInputSchema.safeParse(senzaAria).success).toBe(false);
  });

  it("il ramo ARTECH non accetta le tipologie di un'altra serie", () => {
    expect(kitInputSchema.safeParse({ ...valid, windowType: "BILICO" }).success).toBe(false);
  });
});

describe("kitInputSchema — ramo TOUR", () => {
  it("accetta un bilico senza i campi geometria ARTECH", () => {
    expect(kitInputSchema.parse(validTour)).toMatchObject({ series: "TOUR", tourSchema: 2 });
  });

  it("esige tourSchema, e solo nell'intervallo 1-5", () => {
    const { tourSchema: _t, ...senza } = validTour;
    expect(kitInputSchema.safeParse(senza).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...validTour, tourSchema: 0 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...validTour, tourSchema: 6 }).success).toBe(false);
  });

  it("il bilico è l'unica tipologia della serie TOUR", () => {
    expect(kitInputSchema.safeParse({ ...validTour, windowType: "ANTA_RIBALTA" }).success).toBe(
      false,
    );
  });

  /**
   * È LA RAGIONE DELL'UNIONE, non un dettaglio. `kit.create` riversa nella riga
   * ogni campo dell'input parsato e `kit.generate` ricostruisce l'input del
   * motore RILEGGENDO quelle colonne: la riga a DB È l'input di ogni
   * rigenerazione. Se la geometria ARTECH sopravvivesse al parse di un bilico,
   * verrebbe persistita e poi ri-somministrata al modulo TOUR che la ignora —
   * cioè esattamente il bug «campi raccolti, validati e ignorati» della bonifica,
   * spostato dal motore alla persistenza.
   */
  it("scarta la geometria ARTECH da un input TOUR invece di persistirla", () => {
    const parsed = kitInputSchema.parse({
      ...validTour,
      airGapMm: 12,
      axisOffsetMm: 13,
      rebateMm: 20,
      seatMm: 18,
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      supplementaryClosures: true,
    });
    expect(parsed).not.toHaveProperty("airGapMm");
    expect(parsed).not.toHaveProperty("axisOffsetMm");
    expect(parsed).not.toHaveProperty("rebateMm");
    expect(parsed).not.toHaveProperty("seatMm");
    expect(parsed).not.toHaveProperty("openingSide");
    expect(parsed).not.toHaveProperty("openingDir");
    expect(parsed).not.toHaveProperty("supplementaryClosures");
  });

  it("sashWeightKg resta disponibile al bilico (portata delle cerniere)", () => {
    expect(kitInputSchema.safeParse({ ...validTour, sashWeightKg: 180 }).success).toBe(true);
  });
});

describe("restringimenti asArtech / asTour", () => {
  it("asArtech passa un input ARTECH e rifiuta un TOUR", () => {
    const artech = kitInputSchema.parse(valid);
    expect(asArtech(artech).airGapMm).toBe(12);
    expect(() => asArtech(kitInputSchema.parse(validTour))).toThrow(KitGenerationError);
  });

  it("asTour passa un input TOUR e rifiuta un ARTECH", () => {
    const tour = kitInputSchema.parse(validTour);
    expect(asTour(tour).tourSchema).toBe(2);
    expect(() => asTour(kitInputSchema.parse(valid))).toThrow(KitGenerationError);
  });
});
